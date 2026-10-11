# Inventário da árvore de passivas do PoE (gerado)

Gerado por `game/tools/auditar-arvore-passivas.mjs` em 2026-10-11T19:08:09.978Z. Não edite à mão: rode de novo.

## Resumo

| Situação | Nós | % dos auditáveis |
| --- | ---: | ---: |
| funcional | 2189 | 78.7% |
| funcional-aproximado | 209 | 7.5% |
| parcial | 178 | 6.4% |
| sem-efeito | 96 | 3.5% |
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
| alocavel | 206 | 7.4% |
| interpretado | 32 | 1.2% |
| aplicado | 1306 | 46.9% |
| validado | 1238 | 44.5% |

Como o "aplicado" foi observado: ficha 1742 · combate 802 · sem efeito 206 · condicional 32. Legenda:

- **ficha**: um número da ficha efetiva mudou (vida, armadura, golpe…);
- **combate**: o valor está no que o combate lê no acerto/tique (`afPoe`, eventos, golpe por tag);
- **condicional**: depende de condição que o cenário automático não monta;
- **nao**: interpretado, mas nada mudou (verificar).

| Categoria | exibido | alocavel | interpretado | aplicado | validado |
| --- | ---: | ---: | ---: | ---: | ---: |
| notavel | 0 | 12 | 11 | 287 | 144 |
| comum | 0 | 65 | 8 | 512 | 933 |
| encaixe-de-joia | 0 | 57 | 0 | 0 | 0 |
| keystone | 0 | 8 | 1 | 20 | 19 |
| maestria | 0 | 9 | 0 | 306 | 0 |
| ascendencia-comum | 0 | 14 | 1 | 91 | 123 |
| ascendencia-notavel | 0 | 41 | 11 | 90 | 19 |

## Por categoria

| Categoria | Nós | funcional | funcional-aproximado | parcial | sem-efeito | nao-classificado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| notavel | 454 | 384 | 40 | 18 | 12 | 0 |
| comum | 1518 | 1392 | 56 | 5 | 23 | 42 |
| encaixe-de-joia | 57 | 0 | 0 | 0 | 0 | 57 |
| keystone | 48 | 30 | 8 | 2 | 8 | 0 |
| inicio | 7 | 0 | 0 | 0 | 0 | 0 |
| maestria | 315 | 127 | 77 | 102 | 9 | 0 |
| ascendencia-comum | 229 | 184 | 12 | 19 | 14 | 0 |
| ascendencia-notavel | 161 | 72 | 16 | 32 | 30 | 11 |
| ascendencia-inicio | 21 | 0 | 0 | 0 | 0 | 0 |

## Matriz por forma do efeito

| Tipo | Efeitos | Nós | Conectados (leitor no código) | Alocação ok / verificados | Cálculo ok / verificados |
| --- | ---: | ---: | ---: | ---: | ---: |
| soma simples | 3363 | 1877 | 3363 (100.0%) | 3363/3363 | 3363/3363 |
| tag de golpe (ataque, magia, projétil…) | 767 | 570 | 767 (100.0%) | 767/767 | 767/767 |
| condição de estado (com escudo, vida baixa…) | 695 | 395 | 695 (100.0%) | 695/695 | 695/695 |
| condição de estado + tag de golpe | 508 | 250 | 508 (100.0%) | 508/508 | 508/508 |
| evento (ao matar, bloquear…) | 284 | 183 | 284 (100.0%) | 284/284 | 284/284 |
| % de stat (formato das especializações) | 203 | 198 | 203 (100.0%) | 203/203 | 203/203 |
| dinâmico (buff, gema, keystone…) | 157 | 96 | 157 (100.0%) | 157/157 | 157/157 |
| escala (por X) | 157 | 104 | 157 (100.0%) | 157/157 | 157/157 |
| escala da ficha (por X de armadura, bloqueio…) | 38 | 27 | 38 (100.0%) | 38/38 | 38/38 |
| escala com condição | 18 | 17 | 18 (100.0%) | 18/18 | 18/18 |

## Matriz por tipo de modificador

| Tipo | Efeitos | Nós | Conectados (leitor no código) | Alocação ok / verificados | Cálculo ok / verificados |
| --- | ---: | ---: | ---: | ---: | ---: |
| dano % (aumentado e "mais") | 1054 | 682 | 1054 (100.0%) | 1054/1054 | 1054/1054 |
| outros | 804 | 482 | 804 (100.0%) | 804/804 | 804/804 |
| afecções e chance no acerto | 471 | 354 | 471 (100.0%) | 471/471 | 471/471 |
| crítico | 381 | 274 | 381 (100.0%) | 381/381 | 381/381 |
| velocidades | 370 | 325 | 370 (100.0%) | 370/370 | 370/370 |
| atributos (For/Des/Int) | 305 | 273 | 305 (100.0%) | 305/305 | 305/305 |
| efeito por evento | 284 | 183 | 284 (100.0%) | 284/284 | 284/284 |
| armadura e evasão | 274 | 201 | 274 (100.0%) | 274/274 | 274/274 |
| resistências | 246 | 125 | 246 (100.0%) | 246/246 | 246/246 |
| vida, regeneração e dreno de vida | 241 | 205 | 241 (100.0%) | 241/241 | 241/241 |
| lacaios e totens | 190 | 100 | 190 (100.0%) | 190/190 | 190/190 |
| escudo de energia | 176 | 135 | 176 (100.0%) | 176/176 | 176/176 |
| mana e custo | 175 | 156 | 175 (100.0%) | 175/175 | 175/175 |
| bloqueio | 165 | 108 | 165 (100.0%) | 165/165 | 165/165 |
| cargas e fúria | 142 | 120 | 142 (100.0%) | 142/142 | 142/142 |
| auras, maldições e reserva | 142 | 121 | 142 (100.0%) | 142/142 | 142/142 |
| área e projéteis | 132 | 130 | 132 (100.0%) | 132/132 | 132/132 |
| atordoamento | 130 | 106 | 130 (100.0%) | 130/130 | 130/130 |
| frascos | 111 | 55 | 111 (100.0%) | 111/111 | 111/111 |
| precisão | 102 | 68 | 102 (100.0%) | 102/102 | 102/102 |
| vida % | 99 | 99 | 99 (100.0%) | 99/99 | 99/99 |
| mana % | 71 | 71 | 71 (100.0%) | 71/71 | 71/71 |
| supressão de magia | 58 | 45 | 58 (100.0%) | 58/58 | 58/58 |
| precisão % | 33 | 33 | 33 (100.0%) | 33/33 | 33/33 |
| penetração | 21 | 21 | 21 (100.0%) | 21/21 | 21/21 |
| conversão / dano extra | 13 | 11 | 13 (100.0%) | 13/13 | 13/13 |

## Efeitos traduzidos sem efeito real (causa técnica)

Nenhum: todo efeito traduzido tem leitor no código.

## Linhas sem tradução com efeito (pendentes), por tema

| Grupo · tema | Linhas | Nós | O que precisa | Exemplos |
| --- | ---: | ---: | --- | --- |
| mecanica · Outros | 59 | 40 | mecânica própria desta linha | Velocidade de Ataque com a Mão Secundária aumentada em 30% enquanto em Dupla Empunhadura / Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você / ㅤ+25% de dano elétrico máximo |
| mecanica · Fúria, cargas e poder | 10 | 8 | ganhos e perdas de cargas/fúria em situações específicas | Efeito da Fúria Arcana aumentado em 10% por cada 200 de Mana gasto Recentemente, até 50% / Ataques têm 100% de Poder Arcano ao usar uma varinha / Não pode ganhar Fúria Liberta enquanto Liberto |
| gema · Canalização e repetição | 10 | 10 | canalização por estágios, intensidade, selos (Liberar) e repetição de magias — no jogo cada uso é um | Repetição Final das Magias têm Efeito em Área aumentado em 40% / Concede bônus para Habilidades Não Canalizadoras usadas por você consumindo 3 Cargas de um Frasco de cada um dos seguintes tipos, se possível: / Intensidade de Chama Santificada infligida por você aumentada em 20% |
| item · Frascos | 5 | 3 | cargas de frasco por abate/inimigo marcado e efeitos durante o frasco | Envenenamento causado por você durante o Efeito de Frascos possuem 20% de chance de causar 100% mais Dano / Se Cargas de um Frasco de Diamante forem consumidas, Chance de Golpe Crítico aumentado em 250% / Se Cargas de um Frasco de Bismuto forem consumidas, Penetra 25% das Resistências Elementais |
| mecanica · Afecções e controle | 5 | 4 | afecções em você (limite, "enquanto tiver uma"), empalar em você, resfriamento mínimo, dano por segundo congelado | Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada / Ganhe 1 de Fúria Liberta quando você infligir uma Afecção Elemental com um Acerto em um Inimigo, não mais que uma vez a cada 0.2 segundos por cada tipo de Afecção / Seus Acertos sempre infligem Congelamento, Eletrização e Incêndio enquanto Liberto |
| mecanica · Defesa e armadura | 4 | 4 | defender com armadura extra, bloqueio máximo, evasão condicional | Evasão é Dobrada contra Ataques de Projéteis / Defende com 120% da Armadura contra Ataques de Projéteis / 15% de Armadura também é aplicado ao Dano de Caos sofrido dos Acertos |
| item · Defesa de uma peça | 4 | 3 | a defesa de UMA peça já existe (`ficha.defesasDaFicha`, lote 5); faltam o que depende da recuperação/recarga do escudo e das condições de outras peças | Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo / Habilidades do Peitoral Equipado são Suportadas por Chamado Ancestral Nível 30 / Habilidades do Peitoral Equipado são Suportadas por Punho da Guerra Nível 20 |
| gema · Oferendas, golens e invocações | 4 | 2 | os efeitos específicos de cada invocação | Suas Habilidades de Oferenda também afetam você / Suas Oferendas possuem 50% de redução do Efeito em você |
| mecanica · Precisão e crítico | 3 | 2 | precisão "mais" contra únicos/de perto, crítico contra o personagem | Chance de Acerto Crítico Base para Ataques com Armas é de 8% / Inimigos Próximos tem -30% de Multiplicador de Acerto Crítico / Acertos Não Críticos penetram 10% das Resistências Elementais do Inimigo |
| gema · Maldições | 1 | 1 | as maldições do PoE já amaldiçoam o monstro com limite, duração, "expirou X%", lentidão e o evento "sem Maldições" (`Reforcos.marcar`); o monstro à prova de maldições, a regeneração/escudo do amaldiçoado, o "destruído" e as maldições dos monstros em você também; faltam as auras não-maldição nos inimigos e o redefinir de esfriamentos e eletrificações | Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos |
| mecanica · Atordoamento | 1 | 1 | duração do atordoamento crítico, ignorar atordoamento, atordoar em área ao ser atordoado | Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano |
| gema · Clamores | 1 | 1 | o Poder dos clamores, a recarga e os bônus do clamor reforçado | Seus Clamores não concedem Buffs ou Cargas a Você 100% mais Duração dos Clamores |
| gema · Golpes e ataques | 1 | 1 | alcance corpo a corpo, ataques impelidos por clamor, posturas | Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor |
| gema · Lacaios | 1 | 1 | os atributos dos lacaios além de dano/vida/velocidade (área, recarga, penetração, buffs ao matar, resistências máximas) — o lacaio do jogo ainda não tem esses números | Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você |
| gema · Marcas e Runas | 1 | 1 | marcas presas ao inimigo (vínculo, convocação, alcance, duração da marca) | Ativa Marca do Assassino nível 30 ao causar golpe crítico com ataques contra um inimigo raro ou único e você não tem uma marca |
| mecanica · Recuperação e regeneração | 1 | 1 | recuperação ao longo do tempo, regeneração periódica e a dos inimigos próximos | Inimigos Próximos têm Recuperação da Recarga reduzido em 10% |

## Nós parciais e sem efeito (lista verificável)

### notavel (30)

- `2275` Composto da Natureza — **sem-efeito**
- `6289` Sem Sangue — **parcial**
- `7069` Tiro Partido — **sem-efeito**
- `7136` Mestre Sabotador — **parcial**
- `8458` Tiro Longo — **parcial**
- `9055` Minas Voláteis — **sem-efeito**
- `14813` Pândega — **parcial**: pendente: Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos
- `15085` Ambidestria — **parcial**: pendente: Velocidade de Ataque com a Mão Secundária aumentada em 30% enquanto em Dupla Empunhadura
- `19794` Força Concussiva — **parcial**: pendente: Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano
- `21389` Forjador de Runas — **parcial**
- `21602` Aparato Destrutivo — **parcial**
- `25409` Exército Indomável — **parcial**
- `25439` Coveiro — **parcial**
- `26763` Fórmula Aperfeiçoada — **sem-efeito**
- `27119` Fúria Tribal — **sem-efeito**: pendente: Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor
- `27190` Super Preparado — **sem-efeito**
- `29861` Runas Explosivas — **parcial**
- `34978` Mistura Coloidal — **sem-efeito**
- `37425` Reaplicação Praticada — **sem-efeito**
- `39986` Forças Profanadas — **parcial**: pendente: Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você
- `44788` Conexões Potentes — **sem-efeito**
- `45329` Tiro Ardil — **sem-efeito**
- `46471` Vínculo Poderoso — **sem-efeito**
- `46965` Sabotador — **parcial**
- `48807` Arte do Gladiador — **parcial**
- `49416` Inflexível — **parcial**
- `51108` Capacitor Arcano — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 10% por cada 200 de Mana gasto Recentemente, até 50%
- `52030` Explosão Enérgica — **sem-efeito**
- `54694` Luz da Divindade — **parcial**
- `64355` Equidade de Runas — **parcial**

### comum (70)

- `655` Queima de Mana mais Lenta — **sem-efeito**
- `2413` Queima de Mana mais Lenta — **sem-efeito**
- `3854` Proxy de Posicionamento — **nao-classificado**
- `4546` Velocidade de Detonação de Minas — **sem-efeito**
- `6264` Efeito de Tinturas — **sem-efeito**
- `7609` Ângulo Bifurcado — **sem-efeito**
- `7956` Proxy de Posicionamento — **nao-classificado**
- `10643` Proxy de Posicionamento — **nao-classificado**
- `11200` Vida do Cadáver — **sem-efeito**
- `11800` Mana ao Matar com Tinturas — **sem-efeito**
- `13201` Proxy de Posicionamento — **nao-classificado**
- `13965` Queima de Mana mais Lenta — **sem-efeito**
- `18361` Proxy de Posicionamento — **nao-classificado**
- `18756` Proxy de Posicionamento — **nao-classificado**
- `19679` Alcance de Runas e Recuperação da Recarga de Runas — **parcial**
- `21019` Efeito de Tinturas — **sem-efeito**
- `22046` Proxy de Posicionamento — **nao-classificado**
- `22845` Efeito de Tinturas — **sem-efeito**
- `24452` Proxy de Posicionamento — **nao-classificado**
- `25134` Proxy de Posicionamento — **nao-classificado**
- `25441` Proxy de Posicionamento — **nao-classificado**
- `26661` Proxy de Posicionamento — **nao-classificado**
- `27475` Proxy de Posicionamento — **nao-classificado**
- `27819` Proxy de Posicionamento — **nao-classificado**
- `28018` Proxy de Posicionamento — **nao-classificado**
- `28650` Proxy de Posicionamento — **nao-classificado**
- `30275` Proxy de Posicionamento — **nao-classificado**
- `30826` Queima de Mana mais Lenta — **sem-efeito**
- `31438` Mana ao Matar com Tinturas — **sem-efeito**
- `33374` Chance de uma Difusão Extra de Projéteis — **sem-efeito**
- `33833` Proxy de Posicionamento — **nao-classificado**
- `33911` Duração das Minas — **sem-efeito**
- `34013` Proxy de Posicionamento — **nao-classificado**
- `35070` Proxy de Posicionamento — **nao-classificado**
- `35313` Proxy de Posicionamento — **nao-classificado**
- `35853` Proxy de Posicionamento — **nao-classificado**
- `35926` Proxy de Posicionamento — **nao-classificado**
- `36371` Vida do Cadáver — **sem-efeito**
- `36414` Proxy de Posicionamento — **nao-classificado**
- `37147` Proxy de Posicionamento — **nao-classificado**
- `37898` Proxy de Posicionamento — **nao-classificado**
- `38947` Distância do Ricochete — **sem-efeito**
- `40114` Proxy de Posicionamento — **nao-classificado**
- `40409` Velocidade de Detonação de Minas — **sem-efeito**
- `43989` Proxy de Posicionamento — **nao-classificado**
- `44362` Dano de Caos e Expiração do Definhamento — **parcial**: pendente: Definhamentos infligidos por você expiram 10% mais lentamente
- `44470` Proxy de Posicionamento — **nao-classificado**
- `45246` Queima de Mana mais Lenta — **sem-efeito**
- `48128` Proxy de Posicionamento — **nao-classificado**
- `48132` Proxy de Posicionamento — **nao-classificado**
- `49951` Proxy de Posicionamento — **nao-classificado**
- `50179` Proxy de Posicionamento — **nao-classificado**
- `50734` Queima de Mana mais Lenta — **sem-efeito**
- `51233` Proxy de Posicionamento — **nao-classificado**
- `51953` Ângulo Bifurcado — **sem-efeito**
- `53203` Proxy de Posicionamento — **nao-classificado**
- `53882` Efeito de Tinturas e Frascos — **parcial**
- `54600` Proxy de Posicionamento — **nao-classificado**
- `55706` Proxy de Posicionamento — **nao-classificado**
- `56439` Proxy de Posicionamento — **nao-classificado**
- `56671` Dano de Caos e Expiração do Definhamento — **parcial**: pendente: Definhamentos infligidos por você expiram 10% mais lentamente
- `57194` Proxy de Posicionamento — **nao-classificado**
- `58194` Proxy de Posicionamento — **nao-classificado**
- `58355` Proxy de Posicionamento — **nao-classificado**
- `59070` Alcance de Runas e Recuperação da Recarga de Runas — **parcial**
- `61573` Efeito de Tinturas — **sem-efeito**
- `62721` Efeito das Tinturas — **sem-efeito**
- `63754` Proxy de Posicionamento — **nao-classificado**
- `64166` Proxy de Posicionamento — **nao-classificado**
- `64888` Efeito das Tinturas — **sem-efeito**

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

### keystone (10)

- `13019` Lâmina Ensanguentada — **sem-efeito**
- `23090` Mobilização — **sem-efeito**: pendente: Seus Clamores não concedem Buffs ou Cargas a Você 100% mais Duração dos Clamores
- `40351` Tempestade Turbulenta — **sem-efeito**: pendente: ㅤ+25% de dano elétrico máximo · pendente: -50% de dano elétrico mínimo
- `41970` Vínculo Ancestral — **parcial**: pendente: Você não pode causar Dano com Habilidades por si só
- `42343` Mesclador de Runas — **parcial**
- `45175` Égide Necromântica — **sem-efeito**: pendente: Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você
- `49639` Ego Supremo — **sem-efeito**
- `54307` Acrobacia — **sem-efeito**: pendente: Modificadores de Chance de Suprimir Dano Mágico se aplicam à Chance de Esquivar dos Acertos Mágicos em 50% de seu valor, ao invés · pendente: Chance Máxima de Esquiva Mágica é 75%
- `54922` Dança da Flecha — **sem-efeito**: pendente: Evasão é Dobrada contra Ataques de Projéteis
- `63903` Chama Voraz — **sem-efeito**: pendente: Você pode infligir um incêndio adicional em cada inimigo · pendente: -25% de dano de incêndio

### maestria (111)

- `89` Maestria de Minas — **parcial**
- `857` Maestria de Escudo de Energia — **parcial**
- `1205` Maestria de Envenenamentos — **parcial**
- `2828` Maestria de Dano Degenerativo — **parcial**
- `3471` Maestria de Escudo de Energia — **parcial**
- `3883` Maestria de Evasão — **parcial**
- `4707` Maestria de Cargas — **parcial**
- `4788` Maestria de Garras — **parcial**
- `5348` Maestria Elementar — **parcial**
- `5726` Maestria Elementar — **parcial**
- `5826` Maestria de Projéteis — **parcial**
- `6338` Maestria de Escudo de Energia — **parcial**
- `6912` Maestria de Duas Mãos — **parcial**
- `7634` Maestria de Adagas — **parcial**
- `9083` Maestria Defensiva de Lacaios — **parcial**
- `9213` Maestria de Vínculos — **sem-efeito**
- `10166` Maestria de Minas — **parcial**
- `10204` Maestria de Espadas — **parcial**
- `10429` Maestria de Armadilhas — **parcial**
- `10729` Maestria de Escudo de Energia — **parcial**
- `12169` Maestria Física — **parcial**: pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `12239` Maestria Física — **parcial**: pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `12244` Maestria de Vínculos — **sem-efeito**
- `12503` Maestria de Proteção — **parcial**
- `12518` Maestria de Garras — **parcial**
- `12873` Maestria de Proteção — **parcial**
- `13387` Maestria Elementar — **parcial**
- `14113` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `15409` Maestria de Adagas — **parcial**
- `15697` Maestria de Tinturas — **sem-efeito**
- `17127` Maestria de Proteção — **parcial**
- `17411` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `17906` Maestria de Armadilhas — **parcial**
- `17945` Domínio de Dano Degenerativo — **parcial**
- `18240` Maestria de Escudo de Energia — **parcial**
- `19050` Maestria de Garras — **parcial**
- `19750` Maestria de Armadura e Evasão — **parcial**: pendente: Defende com 120% da Armadura contra Ataques de Projéteis
- `20675` Maestria Física — **parcial**: pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `21143` Maestria de Runas — **parcial**
- `21801` Maestria de Caos — **parcial**: pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `22067` Maestria de Dano Degenerativo — **parcial**
- `22970` Maestria Defensiva de Lacaios — **parcial**
- `23547` Maestria de Caos — **parcial**: pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `24334` Maestria de Vínculos — **sem-efeito**
- `25313` Domínio do Conjurador — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `25934` Maestria de Duas Mãos — **parcial**
- `26393` Maestria Defensiva de Lacaios — **parcial**
- `26697` Maestria de Espadas — **parcial**
- `27307` Maestria de Escudo de Energia — **parcial**
- `27371` Maestria de Evasão — **parcial**
- `27733` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `27872` Maestria de Minas — **parcial**
- `28680` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `28903` Maestria de Envenenamentos — **parcial**
- `31197` Maestria de Adagas — **parcial**
- `31291` Maestria de Espadas — **parcial**
- `31400` Maestria de Empalamento — **parcial**
- `31818` Maestria de Proteção — **parcial**
- `32509` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `33657` Maestria de Proteção — **parcial**
- `33678` Maestria de Cargas — **parcial**
- `34317` Maestria Elementar — **parcial**
- `34723` Maestria de Cargas — **parcial**
- `35038` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha
- `35118` Maestria de Duas Mãos — **parcial**
- `37616` Maestria de Armadilhas — **parcial**
- `38568` Maestria de Cegueira — **parcial**
- `38579` Maestria de Envenenamentos — **parcial**
- `38622` Maestria de Tinturas — **sem-efeito**
- `39338` Maestria de Duas Mãos — **parcial**
- `40196` Maestria de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `40439` Maestria de Runas — **parcial**
- `41163` Maestria de Evasão — **parcial**
- `41225` Maestria Defensiva de Lacaios — **parcial**
- `41273` Domínio de Dano Degenerativo — **parcial**
- `42361` Maestria de Caos — **parcial**: pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `42792` Maestria de Proteção — **parcial**
- `44206` Maestria de Tinturas — **sem-efeito**
- `44298` Maestria Elementar — **parcial**
- `44330` Maestria de Tinturas — **sem-efeito**
- `44540` Maestria de Armadilhas — **parcial**
- `47059` Maestria de Empalamento — **parcial**
- `47212` Maestria de Projéteis — **parcial**
- `47294` Maestria de Dano Degenerativo — **parcial**
- `48144` Maestria de Vínculos — **sem-efeito**
- `48290` Maestria Defensiva de Lacaios — **parcial**
- `48411` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha
- `48660` Maestria Elementar — **parcial**
- `48982` Maestria de Empalamento — **parcial**
- `49677` Maestria de Empalamentos — **parcial**
- `50757` Maestria de Evasão — **parcial**
- `52074` Maestria de Empalamento — **parcial**
- `52220` Maestria Física — **parcial**: pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `53365` Maestria de Garras — **parcial**
- `53738` Maestria de Minas — **parcial**
- `53828` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha
- `56023` Maestria de Projéteis — **parcial**
- `56128` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha
- `56519` Maestria de Tinturas — **sem-efeito**
- `57949` Maestria de Dano Degenerativo — **parcial**
- `59501` Maestria de Cegueira — **parcial**
- `59926` Maestria de Minas — **parcial**
- `60210` Maestria de Envenenamentos — **parcial**
- `60512` Domínio de Conjuração — **parcial**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40%
- `60834` Maestria de Dano Degenerativo — **parcial**
- `61343` Maestria de Runas — **parcial**
- `62235` Maestria de Armadura e Evasão — **parcial**: pendente: Defende com 120% da Armadura contra Ataques de Projéteis
- `62853` Maestria de Adagas — **parcial**
- `63184` Maestria de Espadas — **parcial**
- `64042` Maestria Física — **parcial**: pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `65528` Maestria de Evasão — **parcial**

### ascendencia-comum (33)

- `2060` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `19488` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `24214` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `58650` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `8281` Elementalista [Ascendant] — **parcial**
- `8656` Protetora [Ascendant] — **parcial**
- `10099` Necromante [Ascendant] — **parcial**: pendente: Suas Habilidades de Oferenda também afetam você · pendente: Suas Oferendas possuem 50% de redução do Efeito em você
- `34774` Gladiador [Ascendant] — **parcial**: pendente: Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo
- `43122` Assassino [Ascendant] — **parcial**
- `43195` Executor [Ascendant] — **parcial**
- `1977` Cintos Lendários [Luminary] — **sem-efeito**
- `19993` Botas Lendárias [Luminary] — **sem-efeito**
- `27123` Vida de Mercenário, Campo de Visão [Luminary] — **sem-efeito**
- `30675` Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] — **parcial**
- `32095` Elmos Lendários [Luminary] — **sem-efeito**
- `32669` Amuletos Lendários [Luminary] — **sem-efeito**
- `35877` Dano de Mercenário, Campo de Visão [Luminary] — **sem-efeito**
- `43645` Anéis Lendários [Luminary] — **sem-efeito**
- `52633` Luvas Lendárias [Luminary] — **sem-efeito**
- `61133` Vida de Mercenário, Campo de Visão [Luminary] — **sem-efeito**
- `63954` Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] — **parcial**
- `8081` As Areias do Tempo [Reliquarian] — **sem-efeito**
- `8967` Gritos dos Dessecados [Reliquarian] — **sem-efeito**: pendente: Você tem o bônus do Altar Impenetrável, se não estiver sob o efeito de frascos
- `20160` Espigão de Fidelitas [Reliquarian] — **parcial**
- `25795` Chamas de Ngamahu [Reliquarian] — **parcial**: pendente: Ativa Rajada Vulcânica nível 20 ao atingir corpo a corpo
- `26055` A Divindade Despedaçada [Reliquarian] — **parcial**: pendente: Concede a Habilidade Convocar Grande Emissário das Direções
- `33467` Vínculo de Kaom [Reliquarian] — **parcial**: pendente: Inimigos Próximos Convertem 25% de seu Dano Físico para Fogo
- `35448` Raízes de Kaom [Reliquarian] — **parcial**
- `36072` Presa Sombria [Reliquarian] — **parcial**
- `37303` O Bastão Negro [Reliquarian] — **sem-efeito**: pendente: Cada Fantasma Convocado concede a Você Poder Fantasmal
- `43857` Presa de Arakaali [Reliquarian] — **sem-efeito**
- `56940` A Apóstata [Reliquarian] — **parcial**
- `5929` Efeito da Chama Santificada [Guardian] — **sem-efeito**: pendente: Intensidade de Chama Santificada infligida por você aumentada em 20%

### ascendencia-notavel (73)

- `13374` Mestre do Metal [Champion] — **parcial**
- `31700` Fortitude [Champion] — **parcial**
- `8419` Sobrevivente Determinado [Gladiator] — **parcial**: pendente: Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo
- `17315` Esmagador [Slayer] — **parcial**: pendente: Chance de Acerto Crítico Base para Ataques com Armas é de 8% · pendente: Inimigos Próximos tem -30% de Multiplicador de Acerto Crítico
- `62817` Executor de Lendas [Slayer] — **parcial**
- `9271` Desafiando a Dor [Berserker] — **sem-efeito**: pendente: Ganha Desafio por 10 segundos ao perder Vida para um Acerto Inimigo, não mais do que uma vez a cada 0.3 segundos · pendente: Perde todo o Desafio quando chegar a 10 de Desafio · pendente: Ganha 3% da vida não reservada faltante antes de ser atingido por um inimigo para cada Desafio
- `38999` Fúria Ancestral [Berserker] — **sem-efeito**
- `50692` Ngamahu, Avanço da Chama [Chieftain] — **sem-efeito**
- `53095` Tukohama, Arauto da Guerra [Chieftain] — **sem-efeito**: pendente: Habilidades do Peitoral Equipado são Suportadas por Chamado Ancestral Nível 30 · pendente: Habilidades do Peitoral Equipado são Suportadas por Punho da Guerra Nível 20
- `61355` Ramako, Luz do Sol [Chieftain] — **sem-efeito**: pendente: Dano Degenerativo é -20% enquanto você estiver Parado
- `53816` Inquebrável [Juggernaut] — **parcial**: pendente: 15% de Armadura também é aplicado ao Dano de Caos sofrido dos Acertos
- `2872` Força Ocupante [Deadeye] — **parcial**
- `23169` Guarda do Vento [Deadeye] — **sem-efeito**: pendente: 4% menos Dano sofrido por Força dos Ventos · pendente: Perde toda a sua Força dos Ventos ao Acertar
- `24848` Ventania [Deadeye] — **parcial**: pendente: Ganha 1 de Força dos Ventos ao usar uma Habilidade · pendente: Efeito do Vento Favorável em você aumentado em 10% por Força dos Ventos
- `45313` Tiro Distante [Deadeye] — **parcial**
- `61627` Ricochete [Deadeye] — **parcial**
- `1697` Mestre Toxista [Pathfinder] — **parcial**: pendente: Envenenamento causado por você durante o Efeito de Frascos possuem 20% de chance de causar 100% mais Dano
- `6038` Mestre Destilador [Pathfinder] — **sem-efeito**: pendente: Concede bônus para Habilidades Não Canalizadoras usadas por você consumindo 3 Cargas de um Frasco de cada um dos seguintes tipos, se possível: · pendente: Se Cargas de um Frasco de Diamante forem consumidas, Chance de Golpe Crítico aumentado em 250% · pendente: Se Cargas de um Frasco de Bismuto forem consumidas, Penetra 25% das Resistências Elementais · pendente: Se Cargas de um Frasco de Ametista forem consumidas, 37% do Dano Físico como Dano Extra de Caos
- `63293` Mestre Cirurgiã [Pathfinder] — **parcial**: pendente: Efeitos do Frasco de Vida não se Enfileram
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
- `1564` Guarda-costas Leal [Luminary] — **sem-efeito**
- `15900` Juramento de Fidelidade [Luminary] — **parcial**
- `25944` Armas Lendárias [Luminary] — **sem-efeito**
- `31517` Glória Dourada [Luminary] — **sem-efeito**
- `46479` Sangue Nobre [Luminary] — **sem-efeito**
- `56292` Sagração à Cavalaria [Luminary] — **sem-efeito**
- `2460` Mostruário de Armas de Conjurador [Reliquarian] — **nao-classificado**
- `12003` Mostruário de Armas Marciais [Reliquarian] — **nao-classificado**
- `35989` Mostruário de Pedrarias [Reliquarian] — **nao-classificado**
- `36489` Mostruário de Armaduras [Reliquarian] — **nao-classificado**
- `1945` Infusão Mística [Assassin] — **sem-efeito**: pendente: A chance de causar golpe mágico crítico se bifurca · pendente: ㅤ-30% de chance de causar golpe mágico crítico
- `19083` Assassinar [Assassin] — **parcial**
- `46676` Estilo de Assassinato [Assassin] — **nao-classificado**
- `48239` Mortífero [Assassin] — **parcial**: pendente: Ativa Marca do Assassino nível 30 ao causar golpe crítico com ataques contra um inimigo raro ou único e você não tem uma marca
- `5087` Nascido nas Sombras [Saboteur] — **parcial**
- `14103` Risco Calculado [Saboteur] — **parcial**: pendente: Dano com Acertos é Azarado
- `28535` Crime Perfeito [Saboteur] — **parcial**: pendente: Ativa Convocar Robôs Ativadores Nível 20 quando Alocado
- `38918` Reação em Cadeia [Saboteur] — **parcial**
- `47778` Especialista em Bombas [Saboteur] — **parcial**: pendente: 30% de chance de sofrer 50% menos Dano em Área de Acertos
- `51462` Como Relógio [Saboteur] — **parcial**: pendente: Inimigos Próximos têm Recuperação da Recarga reduzido em 10%
- `57175` Especialista de Estilhaços [Saboteur] — **sem-efeito**
- `3458` Marechal da Divindade [Guardian] — **sem-efeito**: pendente: Inflige Chama Santificada ao atingir corpo a corpo · pendente: Você pode infligir +1 Chama Santificada nos inimigos · pendente: Ganha 10% do dano físico como dano elétrico adicional para cada uma das suas Chamas Santificadas que foram removidas recentemente por um ataque aliado, até 80%
- `4494` Cruzada Radiante [Guardian] — **sem-efeito**: pendente: 20% do Dano dos Acertos é sofrido na vida do seu Sentinela do Resplendor antes da sua
- `19641` Cruzada Implacável [Guardian] — **sem-efeito**: pendente: 25% de chance de Ativar Convocar Relíquia Elemental Nível 20 quando você ou um Aliado próximo Matar um Inimigo, ou Acertar um Inimigo Raro ou Único
- `42264` Fé Radiante [Guardian] — **sem-efeito**
- `61372` Harmonia do Propósito [Guardian] — **sem-efeito**: pendente: Ganha um buff de altar aleatório a cada 10 segundos
- `29026` Santuário do Pensamento [Hierophant] — **parcial**
- `51492` Sinal de Propósito [Hierophant] — **parcial**
- `13851` Instrumentos do Fervor [Inquisitor] — **sem-efeito**: pendente: Ganha Fanatismo por 5 segundos ao atingir o Máximo de Cargas Fanáticas · pendente: Ganha 1 Carga Fanática a cada segundo se tiver Atacado no segundo anterior · pendente: Perde todas as Cargas Fanáticas ao atingir o Máximo de Cargas Fanáticas · pendente: +3 ao Máximo de Cartas Fanáticas
- `40059` Presságio do Arrependimento [Inquisitor] — **parcial**: pendente: Inimigos próximos causam 8% menos Dano Elemental
- `48214` Julgamento Inevitável [Inquisitor] — **parcial**: pendente: Acertos Não Críticos penetram 10% das Resistências Elementais do Inimigo
- `4917` Bastião dos Elementos [Elementalist] — **sem-efeito**
- `53123` Modelador das Chamas [Elementalist] — **parcial**: pendente: Inimigos Incendiados por você têm 40% do Dano Físico causado por eles convertido para Fogo
- `56461` Suserano do Primordial [Elementalist] — **parcial**: pendente: Golens Convocados são Reconvocados 4 segundos após serem Mortos
- `57197` Coração da Destruição [Elementalist] — **sem-efeito**: pendente: Ganha Convergência ao Acertar um Inimigo Único, não mais do que uma vez a cada 8 segundos · pendente: Área de Efeito aumentada em 60% enquanto você não possuir Convergência
- `23572` Pacto Cadavérico [Necromancer] — **parcial**: pendente: Inimigos próximos a cadáveres Criados por você Recentemente são Resfriados e Eletrizados
- `36017` Comandante das Trevas [Necromancer] — **parcial**
- `48719` Dama do Sacrifício [Necromancer] — **parcial**: pendente: Suas Habilidades de Oferenda também afetam você · pendente: Suas Oferendas possuem 50% de redução do Efeito em você
- `5502` Rito Profano [Occultist] — **sem-efeito**
- `25309` Presença Pútrida [Occultist] — **parcial**: pendente: Inimigos Próximos Desacelerados causam 15% de Dano Degenerativo reduzido

## Inventário por nó (rastreável por id)

A versão completa, com as chaves de cada nó, está em `arvore-passivas-poe-inventario.json`.

| id | nó | categoria | tipos de modificador | situação | degrau | aplicado | cobertura |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `6` | Terrores Gêmeos | notavel | crítico | funcional | validado | ficha | 1/1 |
| `94` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `127` | Vida e Recuperação ao Matar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `223` | Decaimento Lento da Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `224` | Recuperação da Recarga de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `238` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `265` | Chance de Crítico e Precisão com Garras | comum | crítico | funcional | validado | ficha | 1/1 |
| `367` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `420` | Dano de Lacaio e Físico | comum | lacaios e totens, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `444` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `465` | Dano e Velocidade de Ataque do Projétil | comum | velocidades, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `476` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `487` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `494` | Dano com Habilidades de Retaliação e Bloqueio com Escudos | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `529` | Presas Venenosas | notavel | afecções e chance no acerto, dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `544` | Vigilância | notavel | lacaios e totens | funcional | aplicado | combate | 1/3 |
| `570` | Golpes Ofuscantes | notavel | crítico, afecções e chance no acerto, outros | funcional | aplicado | ficha | 0/3 |
| `651` | Resistências Elementais | comum | afecções e chance no acerto | funcional | validado | combate | 3/3 |
| `655` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `720` | Precisão e Dano com Ataques | comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `739` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `861` | Bastião Agressivo | notavel | bloqueio, dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | ficha | 3/4 |
| `864` | Efeito de Empalamento com Armas de Duas Mãos | comum | outros | funcional | aplicado | combate | 0/1 |
| `885` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `903` | Velocidade de Movimento e Supressão Mágica | comum | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `918` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `930` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `1006` | Potência da Vontade | notavel | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `1031` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `1159` | Dano de Ataques e Velocidade de Ataque com Escudo | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `1201` | Dano com Ataques | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `1203` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `1252` | Chance de Empurrar | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `1325` | Sangue do Golem | notavel | vida %, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `1340` | Baluarte | notavel | armadura e evasão, outros | funcional | aplicado | combate | 0/3 |
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
| `1652` | Área de Efeito de Feitiços | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `1655` | Dano com Minas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `1696` | Duração e Velocidade para Colocar Totem | comum | lacaios e totens, velocidades | funcional | aplicado | combate | 0/2 |
| `1698` | Chance e Multiplicador de Crítico da Espada | comum | crítico | funcional | validado | ficha | 2/2 |
| `1722` | Multiplicador de Golpe Crítico de Lacaios | comum | crítico | funcional | aplicado | combate | 0/1 |
| `1761` | Dano com Cajados e Armadura | comum | dano % (aumentado e "mais"), armadura e evasão | funcional | validado | ficha | 3/3 |
| `1767` | Vida e Escudo de Energia ao Matar | comum | vida, regeneração e dreno de vida, efeito por evento | funcional | aplicado | ficha | 0/2 |
| `1822` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `1891` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `1909` | Dano Corpo a Corpo e Velocidade de Ataque com Duas Mãos | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/3 |
| `1957` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `2081` | Eficácia da Reserva de mana de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `2092` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 2/2 |
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
| `2348` | Eficiência de Custo de Mana de Conexão | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `2355` | Defesas com Escudos | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `2392` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `2411` | Dano e Duração de Atordoamento de Maça | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 4/5 |
| `2413` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `2454` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `2474` | Vida Recuperada | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `2491` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `2550` | Incendiário | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `2599` | Resposta Pronta | notavel | outros | funcional | validado | combate | 2/2 |
| `2715` | Passo Rápido | notavel | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `2785` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `2913` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `2959` | Temporada Gélida | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `3009` | Precisão com Dupla Empunhadura | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `3089` | Efeito dos Vínculos | comum | outros | funcional | aplicado | combate | 0/1 |
| `3109` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `3167` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `3187` | Velocidade de Movimento e Supressão Mágica | comum | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `3309` | Pés Leves | notavel | armadura e evasão, velocidades, outros | funcional | aplicado | ficha | 2/3 |
| `3314` | Duração da Carga de Frenesi | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `3319` | Bloqueio com Escudos e Recuperação de Bloqueio | comum | bloqueio | funcional-aproximado | validado | ficha | 2/2 |
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
| `4177` | Ajuda Espiritual | notavel | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `4184` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `4207` | Janela de Oportunidade | notavel | afecções e chance no acerto | funcional-aproximado | aplicado | combate | 1/2 |
| `4219` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `4247` | Vida de Lacaios | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `4269` | Dano contra Inimigos Marcados | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `4270` | Duração de Runas | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
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
| `4918` | Vingança Indiscriminada | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
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
| `5203` | Duração do Atordoamento das Habilidades de Retaliação | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `5233` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5237` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5289` | Despertar de Batalha | notavel | mana %, outros | funcional | aplicado | ficha | 1/2 |
| `5296` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5408` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5430` | Golpes Magmáticos | notavel | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `5456` | Poder | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5462` | Área de Efeito com Cajados | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `5560` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `5591` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `5612` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `5613` | Dano Físico e Velocidade de Ataque e Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `5616` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5622` | Multiplicador de Dano Físico e Precisão em Dupla Empunhadura | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `5629` | Dano da Garra | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `5632` | Sangramento e Chance de Golpe Crítico | comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `5743` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `5802` | Dano com Adagas e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `5823` | Coordenação | notavel | velocidades, atributos (For/Des/Int) | funcional | validado | ficha | 4/4 |
| `5875` | Velocidade de Conjuração | comum | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `5916` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `5935` | Área de Efeito da Aura | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `5972` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `6042` | Vida Ganha ao Acertar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/1 |
| `6043` | Máximo de Resistência de Fogo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `6108` | Chance e Multiplicador de Crítico da Espada | comum | crítico | funcional | validado | ficha | 2/2 |
| `6109` | Efeito de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `6113` | Dano de Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `6139` | Ganho de Fortificações | comum | outros | funcional | aplicado | combate | 0/1 |
| `6204` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `6230` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `6233` | Ondas Explosivas | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | interpretado | condicional | 0/2 |
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
| `6633` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 5/5 |
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
| `6967` | Garantia | notavel | bloqueio, efeito por evento | funcional | aplicado | ficha | 1/4 |
| `6981` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7069` | Tiro Partido | notavel | — | sem-efeito | alocavel | — | — |
| `7082` | Dano da Espada | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `7085` | Arte da Arma | notavel | bloqueio, velocidades, outros | funcional-aproximado | validado | ficha | 4/4 |
| `7092` | Dano Físico e de Raio | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `7112` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7136` | Mestre Sabotador | notavel | dano % (aumentado e "mais"), efeito por evento | parcial | aplicado | ficha | 0/2 |
| `7153` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `7162` | Armadura e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `7187` | Multiplicador de Dano Incendiário com Ataques | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `7263` | Venenos Velozes | notavel | afecções e chance no acerto, velocidades | funcional | validado | ficha | 2/2 |
| `7285` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `7335` | Armadura e Regeneração de Vida | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `7347` | Bloqueio Mágico com Cajados | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `7364` | Área de Efeito com Cajados | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `7374` | Eficiência de Custo e Vida | comum | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `7388` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7399` | Resistência a Raio | comum | resistências | funcional | validado | ficha | 1/1 |
| `7440` | Ceifador de Inimigos | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 2/3 |
| `7444` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7503` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `7555` | Velocidade Crepitante | notavel | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `7594` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `7609` | Ângulo Bifurcado | comum | — | sem-efeito | alocavel | — | — |
| `7614` | Duração da Habilidade | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `7641` | Escudo de Energia e Velocidade da Recarga de Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `7659` | Eficiência de Custo de Mana de Marcas | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `7688` | Vínculo Duradouro | notavel | afecções e chance no acerto, lacaios e totens | funcional | aplicado | combate | 1/3 |
| `7728` | Duração dos Estandartes | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `7786` | Velocidade de Ataque do Totem | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `7828` | Velocidade de Ataques Corpo a Corpo | comum | velocidades | funcional | validado | combate | 1/1 |
| `7898` | Chance de Golpe Crítico de Lacaios | comum | crítico | funcional | aplicado | combate | 0/1 |
| `7903` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `7918` | Defesa Enigmática | notavel | dano % (aumentado e "mais"), bloqueio | funcional | aplicado | ficha | 2/3 |
| `7920` | Velocidade de Arremesso de Armadilhas e Minas | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `7938` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7956` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `7960` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `8001` | Ladrão Inteligênte | notavel | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 1/2 |
| `8012` | Vida e Mana ao Acertar | comum | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 0/2 |
| `8027` | Chance e Multiplicador de Golpes Críticos com Minas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `8135` | Aplicação Prática | notavel | resistências, atordoamento, atributos (For/Des/Int) | funcional | aplicado | ficha | 5/6 |
| `8139` | Velocidade de Conjuração dos Vínculos | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `8198` | Chance de Incendiar, Congelar e Eletrizar | comum | afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `8302` | Duração da Carga de Poder | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `8348` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `8410` | Velocidade de Ataque na Postura de Areia | comum | velocidades | funcional | interpretado | condicional | 0/1 |
| `8426` | Dano e Limite de Atordoamento Inimigo Reduzido Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 1/3 |
| `8458` | Tiro Longo | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `8500` | Dano e Duração do Atordoamento com Maças | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 5/5 |
| `8533` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `8544` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `8566` | Dano Físico com Arcos e Ponto de Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 2/3 |
| `8620` | Cargas de Frasco contra Inimigos Marcados | comum | frascos | funcional | aplicado | combate | 0/1 |
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
| `9262` | Dano com Espadas e Alcance Corpo a Corpo | comum | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 3/3 |
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
| `9535` | Estratégia do Caçador | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/3 |
| `9567` | Devorador da Luz | notavel | escudo de energia, dano % (aumentado e "mais") | funcional | aplicado | combate | 0/3 |
| `9650` | Dano de Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `9695` | Armadura e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `9769` | Supressão Mágica e Recarga do Escudo de Energia | comum | supressão de magia, escudo de energia | funcional | validado | ficha | 2/2 |
| `9786` | Evasão e Velocidade de Movimento | comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `9788` | Vivacidade | notavel | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `9797` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `9864` | Crescer e Apodrecer | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `9877` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `9933` | Efeito de Marcas | comum | outros | funcional | aplicado | combate | 0/1 |
| `9976` | Dano com Machados | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `9995` | Área de Efeito da Aura | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `10016` | Executor | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/2 |
| `10017` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `10031` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `10073` | Armadura e Recuperação da Recarga de Habilidades de Guarda | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `10115` | Perfeição Pródiga | notavel | mana %, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `10153` | Físico | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10221` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10282` | Dano Corpo a Corpo com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `10311` | Efeito da Aura dos Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `10490` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10511` | Tolerância | notavel | resistências, outros | funcional | aplicado | ficha | 1/3 |
| `10532` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `10542` | Baluarte de Espinhos | notavel | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `10555` | Duração do Vínculo | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
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
| `10989` | Dano e Ponto de Atordoamento com Habilidades de Retaliação | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/2 |
| `10992` | Área de Efeito de Feitiços | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `11016` | Dano Físico e Elemental | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 4/4 |
| `11018` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `11088` | Eficiência de Custo e Vida | comum | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `11128` | Anulação de Interrupções durante a Conjuração e Resistências Elementais | comum | resistências, atordoamento | funcional | aplicado | ficha | 3/4 |
| `11150` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `11162` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `11190` | Vida e Resistências Elementais de Totens | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 0/2 |
| `11200` | Vida do Cadáver | comum | — | sem-efeito | alocavel | — | — |
| `11239` | Dançarino do Vento | keystone | outros, afecções e chance no acerto, dano % (aumentado e "mais") | funcional-aproximado | interpretado | condicional | 0/3 |
| `11334` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11364` | Afecções Rápidas | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `11420` | Domínio do Ocultista | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `11431` | Vida e Dano de Totens | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/2 |
| `11455` | Inoculação do Caos | keystone | vida, regeneração e dreno de vida, outros | funcional | aplicado | ficha | 0/2 |
| `11456` | Recuperação da Recarga de Habilidades de Postura | comum | outros | funcional | aplicado | combate | 0/1 |
| `11489` | Chance e Multiplicador de Crítico de Adaga | comum | crítico | funcional | validado | ficha | 2/2 |
| `11497` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11515` | Dano Corpo a Corpo e Área de Efeito com Duas Mãos | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/3 |
| `11551` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11568` | Multiplicador de Dano com Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `11645` | Sopro Trovejante | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `11651` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11659` | Anulação de Interrupções durante a Conjuração e Resistências Elementais | comum | resistências, atordoamento | funcional | aplicado | ficha | 3/4 |
| `11678` | Dano de Projéteis | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `11688` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `11689` | Dano e Bloqueio Mágico com Escudos | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `11700` | Área de Efeito Corpo a Corpo | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `11716` | Multiplicador de Golpes Críticos de Minas | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `11730` | Tolerância | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `11784` | Vampirismo | notavel | vida, regeneração e dreno de vida | funcional | aplicado | combate | 1/2 |
| `11792` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `11800` | Mana ao Matar com Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `11811` | Chance e Duração dos Envenenamentos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `11820` | Carne Ungida | notavel | resistências, afecções e chance no acerto | funcional | aplicado | combate | 3/6 |
| `11850` | Duração da Cegueira | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `11859` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11924` | Sopro Flamejante | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `11984` | Chance de Envenenar com Magias | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `12032` | Velocidade de Conjuração e Eficiência de Custo de Mana de Magias | comum | velocidades, mana e custo | funcional | aplicado | ficha | 1/2 |
| `12033` | Lâmina Perversa | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `12068` | Dano com Arcos e Velocidade de Ataque | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 2/3 |
| `12095` | Velocidade de Ataque e Bloqueio com Empunhadura Dupla | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `12128` | Geada Cortante | keystone | outros | funcional-aproximado | aplicado | combate | 0/3 |
| `12143` | Influência | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `12161` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `12189` | Velocidade de Conjuração | comum | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `12215` | Sangramento Agravado na Chance de Golpe Crítico | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `12236` | Dano de Ataques com Escudo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `12246` | Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `12247` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `12250` | Escudo de Energia e Mana | comum | escudo de energia, mana % | funcional | validado | ficha | 2/2 |
| `12379` | Dano de Raio e Velocidade de Conjuração | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `12407` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `12412` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `12415` | Chance de Incêndio com Ataques e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
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
| `12809` | Freneticismo | notavel | velocidades, cargas e fúria | funcional | validado | ficha | 2/2 |
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
| `13191` | Duração de Habilidade | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
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
| `13703` | Postura Desafiadora | notavel | cargas e fúria | funcional | validado | combate | 2/2 |
| `13714` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `13753` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `13782` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `13807` | Dano e Velocidade de Ataque com Dupla Empunhadura | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `13885` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `13922` | Firme | notavel | outros, vida, regeneração e dreno de vida | funcional | aplicado | combate | 0/2 |
| `13935` | Calor da Batalha | notavel | mana e custo | funcional | aplicado | ficha | 0/2 |
| `13961` | Efeito de Afecções de Raio | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `13965` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `14001` | Invencível | notavel | atordoamento, vida, regeneração e dreno de vida | funcional | aplicado | combate | 0/2 |
| `14021` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14040` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `14056` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14057` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `14090` | Duração de Habilidades Reduzida | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `14151` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14157` | Chance de Crítico com Adagas | comum | crítico | funcional | validado | ficha | 1/1 |
| `14182` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `14209` | Duração de Afecções de Gelo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `14211` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `14292` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14384` | Máximo de Fortificações | comum | outros | funcional | aplicado | combate | 0/1 |
| `14400` | Duração do Efeito de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `14419` | Dano de Fogo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `14606` | Carnificina | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/4 |
| `14665` | Ira Divina | notavel | conversão / dano extra, penetração | funcional | aplicado | ficha | 0/2 |
| `14745` | Área de Efeito com Magias | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `14767` | Duração de Fortificações | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
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
| `15085` | Ambidestria | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `15086` | Chance de Crítico e Dano de Maça | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 6/6 |
| `15117` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15124` | Efeito de Empalar | comum | outros | funcional | aplicado | combate | 0/1 |
| `15144` | Velocidade de Ataque e Destreza | comum | velocidades, atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `15163` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 5/5 |
| `15167` | Vida e Efeito do Bônus de Golens | comum | lacaios e totens | funcional | aplicado | combate | 0/2 |
| `15226` | Retaliação Cruel | notavel | crítico, velocidades | funcional | aplicado | combate | 1/3 |
| `15228` | Multiplicador de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `15290` | Torres de Vigílha | notavel | dano % (aumentado e "mais"), lacaios e totens, velocidades | funcional | aplicado | ficha | 1/3 |
| `15344` | Liberdade de Movimento | notavel | armadura e evasão, velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `15365` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `15400` | Runas Escorregadias | notavel | área e projéteis, mana e custo, auras, maldições e reserva | funcional | aplicado | combate | 0/3 |
| `15405` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15437` | Deflexão | notavel | bloqueio, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `15438` | Dano e Duração de Atordoamento Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/3 |
| `15451` | Velocidade de Clamores | comum | velocidades | funcional-aproximado | aplicado | combate | 0/1 |
| `15452` | Multiplicador de Dano de Magia Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `15491` | Dano das Habilidades de Retaliação | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `15522` | Máximo de Resistência a Raio | comum | resistências | funcional | aplicado | combate | 0/1 |
| `15543` | Máximo de Fúria e Armadura | comum | armadura e evasão, cargas e fúria | funcional | validado | combate | 2/2 |
| `15549` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15599` | Precisão, Velocidade de Ataque e Conjuração | comum | precisão, velocidades | funcional | validado | ficha | 3/3 |
| `15614` | Garras do Gavião | notavel | crítico | funcional | validado | ficha | 2/2 |
| `15631` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15678` | Multiplicador de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `15711` | Raio da Explosão | notavel | área e projéteis, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `15716` | Chance e Multiplicador de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 2/2 |
| `15727` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `15783` | Efeito de Chão Consagrado | comum | outros | funcional | aplicado | combate | 0/1 |
| `15837` | Anulação de Afecções de Status | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `15842` | Um Com a Natureza | notavel | resistências, crítico, dano % (aumentado e "mais") | funcional | validado | ficha | 7/7 |
| `15852` | Banquete Etéreo | notavel | escudo de energia | funcional | aplicado | combate | 0/2 |
| `15868` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `15880` | Área de Efeito de Ataque e Precisão | comum | área e projéteis, precisão % | funcional | validado | ficha | 2/2 |
| `15973` | Dano e Duração de Runas | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `16079` | Evasão Por Carga de Frenesi | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `16113` | Bloqueio com Cajados | comum | bloqueio | funcional | aplicado | ficha | 1/2 |
| `16167` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16213` | Velocidade de Ataque por Carga de Frenesi | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `16218` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `16236` | Golpes Tóxicos | notavel | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `16243` | Fuzilaria | notavel | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `16245` | Duração da Usabilidade das Habilidades de Retaliação | comum | outros | funcional | validado | combate | 1/1 |
| `16380` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `16544` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16602` | Duração de Frascos e Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `16703` | Quebra-Crânio | notavel | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `16743` | Dupla Empunhadura e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `16754` | Chance de Crítico de Cajado | comum | crítico | funcional | validado | ficha | 1/1 |
| `16756` | Dano e Chance de Empalar com Machados | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `16775` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16790` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `16851` | Dano e Precisão de Arco | comum | dano % (aumentado e "mais"), precisão | funcional | aplicado | ficha | 1/3 |
| `16860` | Dano de Ataques Físicos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `16882` | Duração do Efeito de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `16954` | Chance de Golpes Críticos por Carga de Poder | comum | crítico | funcional | aplicado | combate | 0/1 |
| `16970` | Dano se Consumiu um Cadáver | comum | dano % (aumentado e "mais") | funcional | interpretado | condicional | 0/1 |
| `17020` | Dano de Ataque na Postura de Sangue | comum | dano % (aumentado e "mais") | funcional | interpretado | condicional | 0/1 |
| `17038` | Duração do Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `17171` | Congelamento Imediato | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `17201` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `17219` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `17236` | Escudo de Energia e Velocidade da Recarga de Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `17251` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `17352` | Mana e Vida | comum | vida %, mana % | funcional | validado | ficha | 2/2 |
| `17383` | Mana e Área de Efeito de Aura | comum | mana %, área e projéteis | funcional | validado | ficha | 2/2 |
| `17412` | Dano e Precisão do Lacaio | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `17421` | Mana e Cargas de Frasco Recebidas | comum | mana %, frascos | funcional | validado | ficha | 2/2 |
| `17429` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `17527` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `17546` | Mana e Frascos | comum | mana %, frascos | funcional | aplicado | ficha | 1/2 |
| `17566` | Armadura e Evasão | comum | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `17569` | Chance de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `17579` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `17608` | Passos Silenciosos | notavel | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `17674` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `17735` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `17749` | Recuperação de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `17788` | Cargas de Frasco Recebidas | comum | frascos | funcional | validado | combate | 1/1 |
| `17790` | Cargas de Frasco Recebidas | comum | frascos | funcional | validado | combate | 1/1 |
| `17814` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `17818` | Dança Carmesim | keystone | outros | funcional | validado | ficha | 3/3 |
| `17821` | Vida e Regeneração de Mana | comum | vida %, mana e custo | funcional | validado | ficha | 2/2 |
| `17833` | Dano e Multiplicador de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `17849` | Dano da Mina | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `17908` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `17934` | Dano de Ataques e Velocidade | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `18009` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 2/2 |
| `18025` | Batidas Fortes | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18033` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18103` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18174` | Bastião Místico | notavel | bloqueio, mana e custo | funcional | aplicado | ficha | 0/2 |
| `18182` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18202` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `18208` | Efeito de Chão Consagrado e Precisão | comum | outros, precisão % | funcional | aplicado | ficha | 1/2 |
| `18239` | Dano de Magia e Recuperação contra Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 1/2 |
| `18302` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `18357` | Agilidade Felina | notavel | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `18359` | Bloqueio de Lacaios | comum | bloqueio | funcional | aplicado | combate | 0/1 |
| `18361` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `18379` | Multiplicador e Chance de Crítico de Maça | comum | crítico | funcional | validado | ficha | 4/4 |
| `18402` | Vida e Frascos | comum | vida %, frascos | funcional | validado | ficha | 2/2 |
| `18436` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `18661` | Dano de Minas e Eficácia da Reserva | comum | dano % (aumentado e "mais"), auras, maldições e reserva | funcional | aplicado | ficha | 0/2 |
| `18663` | Instabilidade do Lacaio | keystone | lacaios e totens | funcional | aplicado | combate | 0/1 |
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
| `19008` | Dano e Bloqueio Mágico com Escudos | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `19069` | Pele Grossa | notavel | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `19098` | Danod e Raio com Varinhas | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `19103` | Exército da Justiça | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | ficha | 2/3 |
| `19144` | Sentinela | notavel | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `19196` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `19210` | Dano Físico e Redução de Dano Físico Ignorada | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `19228` | Dano de Afecções e Chance de Envenenar com Garras | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `19261` | Recuperação da Recarga de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `19287` | Vida e Vida ao Matar | comum | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `19374` | Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `19388` | Dano e Precisão de Machado | comum | dano % (aumentado e "mais"), precisão | funcional | aplicado | ficha | 2/3 |
| `19401` | Vida Ganha ao Acertar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/1 |
| `19501` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19506` | Caminho do Caçador | notavel | precisão, dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `19609` | Multiplicador de Dano Físico Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `19635` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19679` | Alcance de Runas e Recuperação da Recarga de Runas | comum | cargas e fúria | parcial | aplicado | combate | 0/1 |
| `19711` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19730` | Golpe Certeiro | notavel | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 2/2 |
| `19732` | O Agnóstico | keystone | outros, mana e custo | funcional | aplicado | combate | 0/2 |
| `19782` | Defesas com Escudo | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `19794` | Força Concussiva | notavel | atordoamento | parcial | aplicado | combate | 0/1 |
| `19858` | Herborismo | notavel | vida %, velocidades | funcional | aplicado | ficha | 1/2 |
| `19884` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19897` | Sintonia Mortal | notavel | lacaios e totens | funcional | validado | combate | 3/3 |
| `19919` | Bloqueio Mágico | comum | bloqueio | funcional | aplicado | ficha | 0/2 |
| `19939` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `19958` | Velocidade de Conjuração dos Vínculos | comum | velocidades | funcional | aplicado | combate | 0/1 |
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
| `20835` | Diplomacia Arriscada | notavel | área e projéteis | funcional | validado | combate | 1/1 |
| `20844` | Velocidade de Ataque e Precisão da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `20852` | Dano de Fogo e Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `20913` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `20953` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `20966` | Dano da Maça | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `20987` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21019` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `21033` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `21048` | Duração do Vínculo | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `21075` | Dano de Área de Efeito | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `21170` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `21184` | Prevenção de Interrupções enquanto Conjurando | comum | atordoamento | funcional | interpretado | condicional | 0/1 |
| `21210` | Arsenal da Vingança | keystone | outros | funcional | validado | combate | 1/1 |
| `21228` | Tiros Perfurantes | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `21262` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21297` | Altamente Explosivos | notavel | crítico, efeito por evento | funcional | aplicado | ficha | 0/3 |
| `21301` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `21330` | Recuperação Rápida | notavel | vida %, mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `21389` | Forjador de Runas | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `21413` | Vigor de Combate | notavel | armadura e evasão, vida %, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `21435` | Pano e Malha | notavel | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `21460` | Sopro Glacial | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `21548` | Duração dos Estandartes | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `21575` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21602` | Aparato Destrutivo | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `21634` | Química Arcana | notavel | mana %, frascos | funcional | aplicado | ficha | 3/4 |
| `21650` | Juventude Eterna | keystone | outros, escudo de energia | funcional | validado | ficha | 3/3 |
| `21678` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `21693` | Dano Físico e Ataque e Velocidade de Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `21758` | Duração da Carga de Frenesi | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `21835` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `21929` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `21934` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `21958` | Preparação Cruel | notavel | vida %, resistências | funcional | validado | ficha | 4/4 |
| `21973` | Proteção da Podridão | notavel | bloqueio, lacaios e totens | funcional-aproximado | aplicado | combate | 0/3 |
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
| `22472` | Mana e Efeito de Fúria Arcana | comum | mana %, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `22473` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `22488` | Velocidade de Arremesso com Armadilhas | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `22497` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `22535` | Sussurros da Ruína | notavel | outros | funcional | validado | combate | 1/1 |
| `22577` | Recuperação do Bloqueio e Escudo de Energia | comum | bloqueio, escudo de energia | funcional-aproximado | aplicado | combate | 1/2 |
| `22618` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `22627` | Vida e Armadura | comum | armadura e evasão, vida % | funcional-aproximado | aplicado | ficha | 1/2 |
| `22647` | Chance de Incêndio | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `22702` | Postura da Serpente | notavel | crítico, bloqueio | funcional | aplicado | ficha | 2/3 |
| `22703` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `22706` | Intensidade Selvagem | notavel | mana e custo, cargas e fúria | funcional | aplicado | combate | 1/2 |
| `22728` | Dano Elemental de Cajados e Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `22748` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `22845` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `22893` | Duração de Habilidade | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `22908` | Valor Máximo dos Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `22972` | Defensor com Varinha | notavel | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `22994` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `23027` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23036` | Recuperação da Recarga de Clamores e Área de Efeito | comum | outros, área e projéteis | funcional | aplicado | combate | 0/2 |
| `23038` | Matança | notavel | dano % (aumentado e "mais"), velocidades, cargas e fúria | funcional | validado | ficha | 4/4 |
| `23066` | Selvageria | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `23090` | Mobilização | keystone | — | sem-efeito | alocavel | — | — |
| `23122` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `23185` | Resistência a Dano de Caos e Dano dos Lacaios | comum | resistências, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23199` | Dano e Chance de Sangramento | comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `23215` | Maldições e Resistência a Caos | comum | resistências, auras, maldições e reserva | funcional | aplicado | ficha | 1/2 |
| `23237` | Área de Efeito das Auras | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `23334` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `23407` | Agonia Perfeita | keystone | outros, crítico | funcional | validado | ficha | 3/3 |
| `23438` | Duração de Frascos e Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `23439` | Chance de Golpes Críticos | comum | crítico | funcional | validado | ficha | 1/1 |
| `23449` | Dano Chance de Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `23456` | Regeneração de Mana e Vida | comum | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `23471` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23507` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional | validado | ficha | 2/2 |
| `23540` | Conduíte | keystone | — | funcional | aplicado | combate | — |
| `23616` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `23659` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `23690` | Infusão de Essência | notavel | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `23756` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `23760` | Dano Físico e Sobrecarregar | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `23834` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `23852` | Dano de Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `23881` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23886` | Velocidade de Ataque e Duração de Veneno | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
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
| `24256` | Dínamo | notavel | mana %, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `24324` | Impacto Explosivo | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 2/2 |
| `24362` | Pensamentos Profundos | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `24377` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `24383` | Sangue do Guerreiro | notavel | vida, regeneração e dreno de vida, atordoamento, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `24426` | Devastador Fantasma | keystone | outros, escudo de energia, cargas e fúria | funcional | validado | combate | 3/3 |
| `24452` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `24472` | Duração da Habilidade | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `24496` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24544` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `24641` | Dano com Dupla Empunhadura | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `24643` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `24677` | Dano Elemental e Precisão da Maça | comum | precisão, dano % (aumentado e "mais") | funcional | aplicado | ficha | 6/8 |
| `24716` | Transe de Batalha | notavel | cargas e fúria | funcional | validado | combate | 1/1 |
| `24720` | Guarda Desequilibrada | keystone | outros | funcional-aproximado | aplicado | combate | 0/2 |
| `24721` | Esmagador de Tórax | notavel | dano % (aumentado e "mais"), velocidades, área e projéteis | funcional | aplicado | ficha | 5/6 |
| `24772` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 5/5 |
| `24824` | Velocidade de Ataque e Conjuração do Lacaio | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `24858` | Lançador de Arpão | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 1/3 |
| `24865` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24872` | Vida e Efeito do Bônus de Golens | comum | lacaios e totens | funcional | aplicado | combate | 0/2 |
| `24914` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24970` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `24974` | Duração de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `25058` | Sifão de Sangue | notavel | vida %, vida, regeneração e dreno de vida, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `25067` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `25134` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `25168` | Dano Físico como Dano de Fogo Extra | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `25178` | Espírito Primitivo | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional-aproximado | aplicado | ficha | 3/4 |
| `25209` | Multiplicador de Dano Físico e Precisão em Dupla Empunhadura | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `25222` | Velocidade de Ataque e Conjuração do Lacaio | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `25237` | Regeneração de Mana e Eficiência de Custo de Mana | comum | mana e custo | funcional | aplicado | ficha | 1/2 |
| `25260` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `25324` | Dano de Ataques com Escudo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `25332` | Dano de Lacaios e Velocidade de Ataque e Conjuração | comum | lacaios e totens, velocidades | funcional | aplicado | combate | 1/3 |
| `25355` | Eficácia da Reserva de Posturas | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `25367` | Mestre da Lâmina | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | validado | ficha | 4/4 |
| `25409` | Exército Indomável | notavel | lacaios e totens, resistências | parcial | aplicado | combate | 0/2 |
| `25411` | Infundido | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `25431` | Eficiência de Custo de Mana de Maldições | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `25439` | Coveiro | notavel | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | parcial | interpretado | condicional | 0/2 |
| `25441` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `25456` | Dervixe | notavel | bloqueio, dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `25511` | Dano Elemental da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `25531` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `25682` | Dano do Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `25714` | Mana e Custo de Mana Aumentado | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `25732` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | funcional | aplicado | combate | 0/2 |
| `25738` | Perseguição Implacável | notavel | velocidades | funcional | interpretado | condicional | 0/2 |
| `25757` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `25766` | Multiplicador de Dano com Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25770` | Recuperação da Recarga de Armadilhas | comum | outros | funcional | aplicado | combate | 0/1 |
| `25775` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `25781` | Máximo de Fortificações | comum | outros | funcional | aplicado | combate | 0/1 |
| `25789` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `25796` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25831` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `25933` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `25959` | Área de Efeito de Feitiços | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `25970` | Amargor | notavel | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25989` | Ensinamentos Nômades | notavel | resistências | funcional | aplicado | combate | 0/3 |
| `26002` | Velocidade de Conjuração de Marcas | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `26023` | Ferimentos Selvagens | notavel | outros | funcional | aplicado | ficha | 0/1 |
| `26070` | Eficiência de Custo | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `26096` | Mestre da Machadinha | notavel | dano % (aumentado e "mais"), velocidades, efeito por evento | funcional | aplicado | ficha | 3/4 |
| `26188` | Dano e Chance de Crítico de Machado | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 3/3 |
| `26196` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `26270` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `26294` | Sangria | notavel | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `26365` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `26456` | Dano e Velocidade de Ataque da Maça | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `26471` | Anulação de Eletriações | comum | outros | funcional | aplicado | combate | 0/1 |
| `26481` | Dano e Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `26523` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `26528` | Vida e Evasão a Afecção Elemental | comum | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `26557` | Golpes Estáticos | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/3 |
| `26564` | Vencedor | notavel | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `26585` | Bloqueio Mágico com Cajados | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `26620` | Corrupção | notavel | outros | funcional | aplicado | combate | 0/1 |
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
| `27308` | Pacto da Sepultura | notavel | resistências, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `27323` | Bloqueio Mágico com Escudos | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `27325` | Cargas de Frasco contra Inimigos Marcados | comum | frascos | funcional | aplicado | combate | 0/1 |
| `27415` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27422` | Espírito da Guerra | notavel | mana e custo | funcional-aproximado | aplicado | ficha | 0/2 |
| `27444` | Chance e Multiplicador de Crítico do Totem | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `27475` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `27564` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27575` | Duração da Carga de Poder | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `27592` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27605` | Ganho de Fortificações | comum | outros | funcional | aplicado | combate | 0/1 |
| `27611` | Senhor dos Mortos | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 4/4 |
| `27623` | Lições Duras | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `27656` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27659` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27697` | Redução do Ponto de Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `27709` | Chance de Incendiar | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `27718` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `27788` | Bebedor de Sangue | notavel | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `27806` | Como o Trovão | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `27819` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `27879` | Chance e Multiplicador de Crítico de Varinha | comum | crítico | funcional | validado | ficha | 2/2 |
| `27929` | Sabedoria Profunda | notavel | escudo de energia, mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `27962` | Velocidade de Armamento e Área de Ativação da Armadilha | comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `28012` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `28018` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `28034` | Vínculo Maximizador | notavel | outros | funcional | aplicado | combate | 0/1 |
| `28076` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `28221` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `28265` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `28311` | Velocidade da Drenagem de Vida e Velocidade de Ataque | comum | velocidades, outros | funcional | validado | ficha | 2/2 |
| `28330` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `28424` | Mana e Mana ao Matar | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `28449` | Explosão de Vigor | notavel | outros | funcional | aplicado | combate | 0/1 |
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
| `29292` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `29353` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `29359` | Dano de Ataques e Dreno | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 3/3 |
| `29379` | Precisão e Resistências Elementais | comum | resistências, precisão % | funcional | validado | ficha | 4/4 |
| `29381` | Horda Faminta | notavel | lacaios e totens | funcional | aplicado | combate | 0/3 |
| `29454` | Supressão Mágica | comum | supressão de magia | funcional | validado | ficha | 1/1 |
| `29472` | Recuperação de Atordoamentos | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `29522` | Dança das Lâminas | notavel | outros | funcional | interpretado | condicional | 0/1 |
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
| `29870` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `29933` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `29937` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `30030` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `30038` | Duração dos Estandartes | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `30110` | Multiplicador de Dano Degenerativo de Caos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `30148` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `30155` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30160` | Defender-se | notavel | afecções e chance no acerto, outros | funcional-aproximado | aplicado | combate | 1/2 |
| `30170` | Decaimento Lento da Fúria | comum | armadura e evasão, cargas e fúria | funcional | validado | combate | 2/2 |
| `30205` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `30225` | Andarilho do Raio | notavel | dano % (aumentado e "mais"), velocidades, resistências | funcional | aplicado | ficha | 2/3 |
| `30251` | Dano com Machados e Espadas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `30275` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `30302` | Caloroso | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `30319` | Chance e Multiplicador de Crítico com Armadilhas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `30335` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30338` | Dano Degenerativo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30370` | Dano de Magia Degenerativo | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 0/1 |
| `30380` | Vida e Resistências Elementais | comum | vida %, resistências | funcional | validado | ficha | 4/4 |
| `30427` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `30439` | Açoite de Lava | notavel | penetração, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `30455` | Chance e Multiplicador de Crítico com Ataques de Projéteis | comum | crítico | funcional | validado | ficha | 2/2 |
| `30471` | Golpe Certeiro | notavel | crítico | funcional | validado | ficha | 2/2 |
| `30547` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 5/5 |
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
| `30974` | Caçador Perito | notavel | outros | funcional | aplicado | combate | 0/1 |
| `31033` | Robustez | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `31080` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `31103` | Vida e Redução de Dano Físico de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | combate | 1/2 |
| `31137` | Carga ao Matar | comum | cargas e fúria | funcional | aplicado | ficha | 0/1 |
| `31153` | Dano Físico e de Fogo | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `31222` | Atravessar | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `31257` | Autoridade Natural | notavel | dano % (aumentado e "mais"), outros | funcional-aproximado | aplicado | combate | 0/2 |
| `31315` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `31359` | Toxinas Fatais | notavel | afecções e chance no acerto, resistências, dano % (aumentado e "mais") | funcional | aplicado | ficha | 2/3 |
| `31371` | Área de Efeito de Minas | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `31438` | Mana ao Matar com Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `31462` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `31471` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `31473` | Mestre das Feridas | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `31501` | Velocidade de Armamento e Área de Ativação da Armadilha | comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `31508` | Aspecto de Lince | notavel | dano % (aumentado e "mais"), velocidades, crítico | funcional | validado | ficha | 3/3 |
| `31513` | Animosidade Adjacente | notavel | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/2 |
| `31520` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | funcional | aplicado | combate | 0/2 |
| `31583` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `31585` | Conservador Cuidadoso | notavel | frascos | funcional | aplicado | combate | 0/3 |
| `31604` | Sangramento Mais Rápido | comum | outros | funcional | aplicado | ficha | 0/1 |
| `31619` | Dano Mágico em Dupla Empunhadura e Bloqueio Mágico | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
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
| `32053` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 2/2 |
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
| `32376` | Dano das Habilidades de Retaliação | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `32431` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `32432` | Chance e Multiplicador de Golpes Críticos com Armadilhas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `32455` | Tecelagem da Tempestade | notavel | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `32477` | Dano Elemental com Armas e Efeito de Afecções | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional-aproximado | validado | ficha | 5/5 |
| `32480` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `32482` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `32514` | Multiplicador e Chance de Golpes Críticos com Arcos | comum | crítico | funcional | validado | ficha | 2/2 |
| `32519` | Dano e Chance de Crítico de Machado | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 3/3 |
| `32555` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32681` | Presa Marcada | notavel | precisão, dano % (aumentado e "mais") | funcional | aplicado | combate | 0/2 |
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
| `33296` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `33310` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33374` | Chance de uma Difusão Extra de Projéteis | comum | — | sem-efeito | alocavel | — | — |
| `33435` | Elementalista | notavel | resistências, dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 9/9 |
| `33479` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33508` | Resistência a Fogo | comum | resistências | funcional | validado | ficha | 1/1 |
| `33545` | Devastador | notavel | velocidades | funcional | validado | ficha | 3/3 |
| `33558` | Evasão e Velocidade de Movimento | comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `33566` | Ganho de Valor com Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `33582` | Espetada Forçada | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `33623` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `33631` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `33718` | Campeão da Causa | notavel | área e projéteis, auras, maldições e reserva | funcional | aplicado | combate | 1/3 |
| `33725` | Presunção | notavel | bloqueio, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `33740` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33753` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `33755` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `33777` | Dispositivos Devastadores | notavel | crítico, efeito por evento | funcional | aplicado | ficha | 0/3 |
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
| `34009` | Mestre da Arena | notavel | vida, regeneração e dreno de vida, dano % (aumentado e "mais"), outros, atributos (For/Des/Int) | funcional-aproximado | validado | ficha | 4/4 |
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
| `34306` | Bloqueio Mágico de Lacaios | comum | bloqueio | funcional-aproximado | aplicado | combate | 0/1 |
| `34327` | Precisão com Cajados | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `34359` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `34400` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34423` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `34478` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `34483` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `34506` | Comandante dos Golens | notavel | lacaios e totens | funcional | aplicado | combate | 1/2 |
| `34510` | Dano Degenerativo com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `34513` | Efeito da Aura | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `34560` | Dupla Empunhadura e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `34579` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `34590` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `34591` | Intenção Maliciosa | notavel | outros | funcional | aplicado | combate | 0/1 |
| `34601` | Proficiência | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34625` | Precisão do Arco | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `34660` | Efeito de Marcas | comum | outros | funcional | aplicado | combate | 0/1 |
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
| `34973` | Fúria Medida | notavel | outros | funcional | aplicado | combate | 0/1 |
| `34978` | Mistura Coloidal | notavel | — | sem-efeito | alocavel | — | — |
| `35035` | Recuperação da Recarga do Convocar Runas | comum | cargas e fúria | funcional | aplicado | combate | 0/1 |
| `35053` | Chance de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `35070` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35086` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `35179` | Velocidade de Movimento | comum | velocidades | funcional | validado | ficha | 1/1 |
| `35190` | Eficácia da Reserva de mana de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `35192` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `35233` | Artesão da Discórdia | notavel | dano % (aumentado e "mais"), auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `35237` | Valor Máximo dos Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `35255` | Dança Fantasma | keystone | escudo de energia, outros | funcional | aplicado | combate | 0/3 |
| `35260` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `35283` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `35288` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `35313` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35334` | Multiplicador e Chance de Golpes Críticos com Minas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `35362` | Dano Corpo a Corpo e Área de Efeito com Duas Mãos | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/3 |
| `35384` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `35406` | Duração e Valor Máximo dos Estandartes | comum | afecções e chance no acerto, outros | funcional | aplicado | combate | 1/2 |
| `35436` | Impactos Cinéticos | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/4 |
| `35503` | Resistência a Raio | comum | resistências | funcional | validado | ficha | 1/1 |
| `35507` | Velocidade do Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `35556` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `35568` | Armadura, Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `35663` | Braço Forte | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/4 |
| `35685` | Força Destemida | notavel | crítico | funcional | aplicado | combate | 0/2 |
| `35706` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `35724` | Dano e Mana | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 1/2 |
| `35730` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `35737` | Carga ao Matar | comum | cargas e fúria | funcional | aplicado | ficha | 0/1 |
| `35756` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `35791` | Multiplicador de Golpe Crítico de Lacaios | comum | crítico | funcional | aplicado | combate | 0/1 |
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
| `36200` | Velocidade de Clamores e Dano de Ataques Impelidos | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
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
| `36736` | Brutalidade Ardente | notavel | afecções e chance no acerto, velocidades | funcional | validado | ficha | 2/2 |
| `36761` | Dano de Ataques e Velocidade de Ataque com Escudo | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `36764` | Sangramento e Chance de Golpe Crítico | comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `36774` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `36801` | Dano de Afecções e Duração do Veneno com Garras | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `36849` | Velocidade de Ataque e Duração de Veneno | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `36858` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36859` | Postura da Madeira-aço | notavel | dano % (aumentado e "mais"), armadura e evasão, bloqueio | funcional | aplicado | ficha | 3/4 |
| `36874` | Sabedoria da Clareira | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36877` | Dano da Armadilha | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `36881` | Resistência a Gelo | comum | resistências | funcional | validado | ficha | 1/1 |
| `36915` | Pastorear o Rebanho | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | ficha | 2/3 |
| `36931` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `36945` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `36949` | Devoção | notavel | vida %, outros | funcional | aplicado | ficha | 1/2 |
| `36972` | Velocidade de Ataque com Duas Mãos | comum | velocidades | funcional | aplicado | ficha | 0/1 |
| `37078` | Caminho do Sábio | notavel | dano % (aumentado e "mais"), mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
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
| `38246` | Presságio | notavel | área e projéteis, auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `38344` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `38348` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38450` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `38462` | Velocidade das Habilidades de Retaliação | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `38508` | Duração da Carga de Tolerância | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `38516` | Decreto Justo | notavel | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `38520` | Multiplicador de Crítico com Garras | comum | crítico | funcional | validado | ficha | 1/1 |
| `38538` | Dano Físico e Sobrecarregar | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `38539` | Dano Físico e Velocidade de Ataque e Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `38662` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38664` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `38701` | Escudo de Energia e Mana | comum | escudo de energia, mana % | funcional | validado | ficha | 2/2 |
| `38772` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 2/2 |
| `38777` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `38789` | Duração e Chance de Incendiar | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `38805` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `38836` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `38849` | Calor Cauterizante | notavel | outros | funcional | aplicado | ficha | 0/1 |
| `38864` | Dano e Velocidade de Ataque da Adaga | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `38900` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
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
| `39725` | Precisão e Velocidade de Ataque | comum | velocidades, precisão | funcional | validado | ficha | 2/2 |
| `39743` | Artes Sombrias | notavel | bloqueio, velocidades | funcional | aplicado | ficha | 3/4 |
| `39761` | Contrapeso | notavel | crítico | funcional | validado | ficha | 2/2 |
| `39768` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `39773` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `39786` | Dano Corpo a Corpo com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `39814` | Recuperação da Recarga de Armadilhas | comum | outros | funcional | aplicado | combate | 0/1 |
| `39821` | Evasão e Vida | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/2 |
| `39841` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39861` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39904` | Espetos Brutais | notavel | outros | funcional | validado | combate | 1/1 |
| `39916` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39938` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `39986` | Forças Profanadas | notavel | velocidades, efeito por evento | parcial | aplicado | combate | 1/2 |
| `40075` | Dano Mágico com Cajados | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40100` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `40114` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `40126` | Área de Efeito da Maldição | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `40132` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `40135` | Dano com Espadas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40189` | Máximo de Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `40229` | Recuperação da Recarga de Clamores e Área de Efeito | comum | outros, área e projéteis | funcional | aplicado | combate | 0/2 |
| `40287` | Golpes Críticos contra Inimigos Cegos | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `40291` | Dano de Fogo e Velocidade de Conjuração com Habilidades de Fogo | comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 2/2 |
| `40351` | Tempestade Turbulenta | keystone | — | sem-efeito | alocavel | — | — |
| `40362` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `40366` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40400` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `40409` | Velocidade de Detonação de Minas | comum | — | sem-efeito | alocavel | — | — |
| `40483` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `40508` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `40535` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40609` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40619` | Admiração e Terror | notavel | efeito por evento, área e projéteis | funcional | aplicado | combate | 1/2 |
| `40637` | Dano de Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `40644` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `40645` | Quebra-Osso | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 5/5 |
| `40653` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40705` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `40743` | Pele de Cristal | notavel | resistências, afecções e chance no acerto | funcional | aplicado | combate | 1/4 |
| `40751` | Área de Efeito de Minas | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `40766` | Duração da Carga de Tolerância | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `40776` | Dano com Runas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40818` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `40840` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40841` | Chance e Dano de Ataque Físico de Empalar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `40867` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40907` | Postura Inabalável | keystone | — | funcional-aproximado | aplicado | ficha | — |
| `40927` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `41026` | Mana e Recuperação da Recarga de Habilidades de Guarda | comum | mana %, outros | funcional | aplicado | ficha | 1/2 |
| `41047` | Área de Efeito com Arcos | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `41068` | Duração do Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `41119` | Letalidade | notavel | crítico | funcional | validado | ficha | 2/2 |
| `41137` | Medicina de Campo | notavel | frascos | funcional-aproximado | aplicado | combate | 1/2 |
| `41190` | Dano e Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `41250` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `41251` | Efeito de Afecções | comum | afecções e chance no acerto | funcional-aproximado | validado | ficha | 2/2 |
| `41263` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `41305` | Resposta Esmagadora | notavel | atordoamento, afecções e chance no acerto | funcional | aplicado | combate | 0/2 |
| `41380` | Velocidade de Ataque e Precisão do Arco | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `41420` | Remédios Naturais | notavel | frascos, efeito por evento | funcional | aplicado | combate | 1/3 |
| `41472` | Disciplina e Treinamento | notavel | vida, regeneração e dreno de vida, vida % | funcional | validado | ficha | 2/2 |
| `41476` | Poder Ancião | notavel | dano % (aumentado e "mais"), cargas e fúria | funcional | aplicado | ficha | 0/2 |
| `41536` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `41595` | Marcado para Morrer | notavel | outros | funcional | aplicado | combate | 0/1 |
| `41599` | Dano e Bloqueio com Cajados | comum | dano % (aumentado e "mais"), bloqueio | funcional | validado | ficha | 3/3 |
| `41635` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `41689` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `41819` | Velocidade do Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `41866` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `41870` | Abraço Invernal | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `41876` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `41967` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `41970` | Vínculo Ancestral | keystone | lacaios e totens | parcial | validado | combate | 1/1 |
| `41989` | Desenvoltura | notavel | supressão de magia, escudo de energia, vida % | funcional | validado | ficha | 3/3 |
| `42006` | Dano de Minas e Eficácia da Reserva | comum | dano % (aumentado e "mais"), auras, maldições e reserva | funcional | aplicado | ficha | 0/2 |
| `42009` | Alma de Aço | notavel | armadura e evasão, resistências | funcional-aproximado | aplicado | ficha | 1/5 |
| `42041` | Química Profana | notavel | vida %, frascos | funcional | validado | ficha | 4/4 |
| `42086` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `42104` | Precisão e Velocidade de Ataque | comum | velocidades, precisão % | funcional | validado | ficha | 2/2 |
| `42106` | Dano e Ponto de Atordoamento com Habilidades de Retaliação | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/2 |
| `42133` | Ganho de Cargas de Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `42161` | Chance de Incendiar com Ataques e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `42178` | Queima-Roupa | keystone | outros | funcional-aproximado | aplicado | combate | 0/1 |
| `42343` | Mesclador de Runas | keystone | lacaios e totens | parcial | validado | combate | 1/1 |
| `42443` | Frenético | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `42485` | Dano Mágico com Cajados e Bloqueio | comum | dano % (aumentado e "mais"), bloqueio | funcional | validado | ficha | 2/2 |
| `42495` | Recuperação da Recarga das Habilidades de Retaliação | comum | outros | funcional | aplicado | combate | 0/1 |
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
| `43000` | Mana e Dano Mágico | comum | dano % (aumentado e "mais"), mana % | funcional | validado | ficha | 2/2 |
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
| `43413` | Bloqueio com Escudo e Recuperação de Bloqueio | comum | bloqueio | funcional-aproximado | validado | ficha | 2/2 |
| `43457` | Evasão e Efeito da Cegueira | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `43491` | Cargas Usadas de Frascos | comum | frascos | funcional | aplicado | combate | 0/1 |
| `43514` | Chance de Golpes Críticos e Precisão com Espadas | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `43608` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `43684` | Afecções Rápidas | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `43689` | Comando Espiritual | notavel | velocidades, lacaios e totens | funcional | aplicado | ficha | 0/3 |
| `43716` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `43787` | Precisão e Resistências Elementais | comum | resistências, precisão % | funcional | validado | ficha | 4/4 |
| `43822` | Dano e Duração de Atordoamento de Maça | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 5/5 |
| `43833` | Recuperação da Recarga de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `43988` | Mestre dos Feitiços | keystone | afecções e chance no acerto, auras, maldições e reserva | funcional | validado | combate | 2/2 |
| `43989` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `44102` | Explosivos Eficientes | notavel | auras, maldições e reserva, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/2 |
| `44103` | Reflexos | notavel | supressão de magia, armadura e evasão | funcional-aproximado | aplicado | ficha | 2/3 |
| `44134` | Chance e Multiplicador de Crítico de Adaga | comum | crítico | funcional | validado | ficha | 2/2 |
| `44169` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `44183` | Dano de Raio e Velocidade de Conjuração | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `44184` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44191` | Como a Montanha | notavel | bloqueio | funcional | aplicado | ficha | 2/3 |
| `44202` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44207` | Tartaruga | notavel | bloqueio, efeito por evento | funcional-aproximado | aplicado | ficha | 2/3 |
| `44268` | Área de Efeito das Habilidades de Retaliação | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
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
| `44824` | Misticismo | notavel | dano % (aumentado e "mais"), velocidades, mana e custo | funcional | aplicado | ficha | 2/3 |
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
| `45163` | Dano das Habilidades de Retaliação | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `45175` | Égide Necromântica | keystone | — | sem-efeito | alocavel | — | — |
| `45202` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `45227` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `45246` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `45272` | Vida e Dano Físico e de Caos | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 2/3 |
| `45283` | Presa Encurralada | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `45317` | Cinza, Gelo e Tempestade | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional-aproximado | validado | ficha | 8/8 |
| `45329` | Tiro Ardil | notavel | — | sem-efeito | alocavel | — | — |
| `45341` | Máximo de Resistência de Gelo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `45350` | Glória do Comando | notavel | precisão, área e projéteis | funcional-aproximado | interpretado | condicional | 0/2 |
| `45360` | Chance de Envenenamento e Dano | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `45366` | Multiplicador de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `45436` | Dano Elemental da Arma, Chance de Aflição de Status | comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `45456` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `45486` | Chance e Multiplicador de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 2/2 |
| `45491` | Dano com Ataques | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `45503` | Efeito da Aura dos Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `45565` | Duração do Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `45593` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `45608` | Detonações Sucessivas | notavel | crítico | funcional-aproximado | interpretado | condicional | 0/2 |
| `45646` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `45657` | Provação da Fé | notavel | atordoamento, efeito por evento | funcional | aplicado | combate | 0/3 |
| `45680` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `45788` | Velocidade de Ataque com Garras | comum | velocidades | funcional | validado | ficha | 1/1 |
| `45803` | Soldado Veterano | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `45810` | Dano de Envenenamento e Velocidade de Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `45827` | Dano com Armadilhas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `45838` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `45887` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `45945` | Barreira Conjurada | notavel | atordoamento, mana e custo | funcional | aplicado | ficha | 0/3 |
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
| `46585` | Área de Efeito dos Estandartes | comum | área e projéteis | funcional | validado | combate | 1/1 |
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
| `46904` | Santuário Arcano | notavel | bloqueio, dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `46910` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46965` | Sabotador | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/2 |
| `47030` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `47062` | Dano Mágico e Inteligência | comum | dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `47065` | Mestre das Lâminas | notavel | outros, atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 2/3 |
| `47085` | Multiplicador de Dano de Magia Degenerativo e Duração | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
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
| `47504` | Velocidade de Conjuração e Eficiência de Custo de Mana de Magias | comum | velocidades, mana e custo | funcional | aplicado | ficha | 1/2 |
| `47507` | Multiplicador de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `47743` | Perspicácia | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | aplicado | ficha | 2/4 |
| `47785` | Ganho de Valor com Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `47854` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `47902` | Dano das Habilidades de Retaliação | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `47949` | Dano de Caos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `48093` | Velocidade de Conjuração em Dupla Empunhadura e Recuperação da Recarga de Habilidades de Movimento | comum | velocidades, outros | funcional | aplicado | ficha | 1/2 |
| `48099` | Vida e Anulação de Atordoamentos | comum | vida %, atordoamento | funcional | aplicado | ficha | 1/2 |
| `48109` | Regeneração de Vida por Carga de Tolerância | comum | vida, regeneração e dreno de vida | funcional | aplicado | combate | 0/1 |
| `48118` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `48128` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `48132` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `48199` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `48275` | Prevenção de Interrupções enquanto Conjurando | comum | atordoamento | funcional | interpretado | condicional | 0/1 |
| `48282` | Chance de Crítico de Cajado | comum | crítico | funcional | validado | ficha | 1/1 |
| `48284` | Blqueio e Recuperação do Bloqueio | comum | bloqueio | funcional-aproximado | validado | ficha | 3/3 |
| `48287` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `48298` | Inspirador | notavel | escudo de energia, mana %, mana e custo | funcional | aplicado | ficha | 2/3 |
| `48362` | Mana e Vida | comum | vida %, mana % | funcional | validado | ficha | 2/2 |
| `48423` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `48438` | Coragem | notavel | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `48477` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional | validado | ficha | 2/2 |
| `48513` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `48514` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `48556` | Coração das Trevas | notavel | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 0/2 |
| `48614` | Fervor | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `48679` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `48698` | Barreira de Vácuo | notavel | armadura e evasão, escudo de energia, supressão de magia | funcional | aplicado | combate | 2/3 |
| `48713` | Chance de Golpe Crítico de Lacaios | comum | crítico | funcional | aplicado | combate | 0/1 |
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
| `49147` | Armadura e Recuperação da Recarga de Habilidades de Guarda | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `49167` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `49178` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49254` | Retribuição | notavel | dano % (aumentado e "mais"), lacaios e totens, velocidades, atributos (For/Des/Int) | funcional | validado | ficha | 6/6 |
| `49308` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `49318` | Bola de Demolição | notavel | dano % (aumentado e "mais"), velocidades, atordoamento | funcional | aplicado | ficha | 0/4 |
| `49343` | Chance de Bloqueio e Dano de Ataques com Escudo | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `49379` | Assassino de Aluguel | notavel | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `49407` | Recuperação da Recarga das Habilidades de Retaliação | comum | outros | funcional | aplicado | combate | 0/1 |
| `49408` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `49412` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49415` | Dano e Velocidade de Ataque da Espada | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `49416` | Inflexível | notavel | armadura e evasão, efeito por evento, afecções e chance no acerto | parcial | aplicado | combate | 1/3 |
| `49445` | Respirações Profundas | notavel | outros, área e projéteis | funcional | aplicado | combate | 0/2 |
| `49459` | Rei da Colina | notavel | crítico | funcional | validado | ficha | 1/1 |
| `49481` | Mana ao Acertar | comum | mana e custo | funcional | aplicado | ficha | 0/1 |
| `49515` | Supressão Mágica e Recarga do Escudo de Energia | comum | supressão de magia, escudo de energia | funcional | validado | ficha | 2/2 |
| `49534` | Dano Mágico com Cajados e Bloqueio Mágico | comum | dano % (aumentado e "mais"), bloqueio | funcional | aplicado | ficha | 1/2 |
| `49538` | Desafio | notavel | bloqueio, dano % (aumentado e "mais"), armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `49547` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `49568` | Chance e Multiplicador de Crítico de Garra | comum | crítico | funcional | validado | ficha | 2/2 |
| `49571` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `49588` | Dano de Raio e Chance de Eletrizar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `49605` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49621` | Acuidade | notavel | velocidades, precisão, precisão % | funcional | validado | ficha | 3/3 |
| `49635` | Ganho de Valor com Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
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
| `50515` | Fortificação em Atordoamentos Corpo a Corpo | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `50562` | Multiplicador de Dano Ardente com Ataques | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `50570` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50679` | Combatente Versátil | keystone | bloqueio | funcional | aplicado | combate | 0/3 |
| `50690` | Remédios Nutritivos | notavel | frascos | funcional | validado | combate | 5/5 |
| `50734` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `50826` | Mana e Bloqueio Mágico | comum | bloqueio, mana % | funcional | aplicado | ficha | 1/2 |
| `50842` | Ira do Veterano | notavel | cargas e fúria | funcional | aplicado | combate | 1/2 |
| `50858` | Admoestador | notavel | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/2 |
| `50862` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50904` | Vida e Armadura | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/2 |
| `50969` | Área de Efeito Corpo a Corpo | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `51108` | Capacitor Arcano | notavel | mana %, efeito por evento | parcial | aplicado | ficha | 1/2 |
| `51146` | Precisão e Velocidade de Ataque da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `51191` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `51198` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `51212` | Entropia | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `51213` | Eficácia de Reserva de Arautos | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `51219` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `51220` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `51233` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `51235` | Prevenção de Atordoamento | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `51291` | Área de Efeito | comum | área e projéteis | funcional | validado | combate | 1/1 |
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
| `51804` | Dano de Magia Degenerativo | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 0/1 |
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
| `52099` | Duração de Habilidades Reduzida | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
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
| `52655` | Duração de Runas | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `52714` | Proeza | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `52742` | Morte Apressada | notavel | dano % (aumentado e "mais"), velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 2/3 |
| `52789` | Círculo da Vida | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `52848` | Chance e Multiplicador de Crítico de Varinha | comum | crítico | funcional | validado | ficha | 2/2 |
| `52904` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53002` | Armadura, Evasão e Efeito de Agressividade | comum | armadura e evasão, outros | funcional | aplicado | combate | 2/3 |
| `53005` | Chance de Congelamento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `53013` | Atrofia | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `53018` | Dano e Duração de Runas | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `53042` | Performance Excepcional | notavel | afecções e chance no acerto | funcional | validado | combate | 1/1 |
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
| `53574` | Velocidade de Conjuração de Marcas e Eficiência de Custo de Mana | comum | velocidades, mana e custo | funcional | aplicado | combate | 0/2 |
| `53630` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `53652` | Mergulhado na Profanidade | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `53667` | Efeito de Empalamentos | comum | outros | funcional | aplicado | combate | 0/1 |
| `53677` | Dano dos Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `53732` | Multiplicador de Dano Degenerativo de Gelo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `53757` | Fúria Xamânica | notavel | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `53793` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53802` | Extração de Essência | notavel | frascos, outros | funcional-aproximado | aplicado | combate | 1/2 |
| `53809` | Duração de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `53840` | Vingança | notavel | armadura e evasão, efeito por evento | funcional | aplicado | combate | 0/2 |
| `53882` | Efeito de Tinturas e Frascos | comum | frascos | parcial | aplicado | combate | 0/1 |
| `53945` | Precisão com Cajados | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `53957` | Chance de Acerto Crítico com Cajados e Multiplicador | comum | crítico | funcional | validado | ficha | 2/2 |
| `53987` | Duração de Clamores e Efeito do Buff | comum | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `54043` | Dano Elemental da Varinha E Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `54127` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `54142` | Sutileza | notavel | velocidades, atributos (For/Des/Int), precisão % | funcional | validado | ficha | 3/3 |
| `54144` | Dupla Empunhadura e Velocidade de Conjuração e Bloqueio | comum | bloqueio, velocidades | funcional | validado | ficha | 3/3 |
| `54267` | Resistência a Dano de Caos e Dano dos Lacaios | comum | resistências, lacaios e totens | funcional | validado | ficha | 2/2 |
| `54268` | Barreira de Lâmina | notavel | bloqueio, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
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
| `54694` | Luz da Divindade | notavel | dano % (aumentado e "mais"), crítico, atributos (For/Des/Int) | parcial | aplicado | ficha | 3/4 |
| `54713` | Modelador de Força | notavel | conversão / dano extra, velocidades | funcional | aplicado | ficha | 2/3 |
| `54776` | Fluxo de Mana | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `54791` | Garras da Gralha | notavel | dano % (aumentado e "mais"), velocidades, efeito por evento | funcional | aplicado | ficha | 3/4 |
| `54862` | Duração da Usabilidade das Habilidades de Retaliação | comum | outros | funcional | validado | combate | 1/1 |
| `54868` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `54872` | Velocidade do Dreno de Mana | comum | outros | funcional | validado | combate | 1/1 |
| `54880` | Área de Efeito dos Estandartes | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `54922` | Dança da Flecha | keystone | — | sem-efeito | alocavel | — | — |
| `54954` | Maldições e Resistência a Caos | comum | resistências, auras, maldições e reserva | funcional | aplicado | ficha | 1/2 |
| `54974` | Área de Ativação de Armadilhas | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `55002` | Fúria Justificada | notavel | efeito por evento, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `55021` | Recuperação da Recarga de Habilidades de Postura | comum | outros | funcional | aplicado | combate | 0/1 |
| `55027` | Justiça Brilhante | notavel | outros, precisão | funcional | aplicado | combate | 0/2 |
| `55085` | Armadura e Evasão | comum | armadura e evasão | funcional | validado | combate | 2/2 |
| `55114` | Intelecto Extremo | notavel | atributos (For/Des/Int) | funcional | aplicado | ficha | 1/2 |
| `55166` | Dano e Velocidade de Ataque da Espada | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `55190` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `55194` | Cinzas Assentadas | notavel | auras, maldições e reserva | funcional-aproximado | interpretado | condicional | 0/1 |
| `55247` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `55307` | Anulação de Incêndios | comum | outros | funcional | aplicado | combate | 0/1 |
| `55332` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `55373` | Vida e Força | comum | vida, regeneração e dreno de vida, atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `55380` | Construção Inteligente | notavel | dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/1 |
| `55381` | Retaliação Arcana | notavel | dano % (aumentado e "mais") | funcional | interpretado | condicional | 0/1 |
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
| `55880` | Dano contra Inimigos Marcados | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
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
| `56153` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `56158` | Dano Mágico por Carga de Poder | comum | dano % (aumentado e "mais") | funcional | aplicado | combate | 0/1 |
| `56174` | Dano e Velocidade de Ataque da Adaga | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `56186` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `56231` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `56276` | Caçador Noturno | notavel | crítico, vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 2/3 |
| `56295` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `56330` | Fluxo da Batalha | notavel | dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | ficha | 0/2 |
| `56355` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 2/2 |
| `56359` | Ritual Canibalístico | notavel | mana e custo | funcional | aplicado | combate | 0/2 |
| `56370` | Fortificação em Atordoamentos Corpo a Corpo | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
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
| `56803` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `56807` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `56814` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `56855` | Velocidade de Ataque com Arcos e Trespassar | comum | velocidades, efeito por evento | funcional | aplicado | ficha | 1/2 |
| `56920` | Recuperação da Recarga das Habilidades de Retaliação | comum | outros | funcional | aplicado | combate | 0/1 |
| `56922` | Eficiência de Reserva | comum | auras, maldições e reserva, mana e custo | funcional | aplicado | combate | 0/2 |
| `56982` | Redução de Limite de Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `57011` | Duração do Atordoamento por Carga de Tolerância | comum | atordoamento | funcional | interpretado | condicional | 0/1 |
| `57030` | Chance de Envenenamento e Dano | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `57044` | Anulação de Sangramento | comum | outros | funcional | aplicado | combate | 0/1 |
| `57061` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `57080` | Precisão e Velocidade de Ataque | comum | velocidades, precisão % | funcional | validado | ficha | 2/2 |
| `57167` | Mana e Efeito da Fúria Arcana | comum | mana %, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `57194` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `57199` | Presas de Gelo | notavel | penetração, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `57226` | Escudo de Energia e mana | comum | escudo de energia, mana e custo | funcional | aplicado | ficha | 0/2 |
| `57240` | Mana e Efeito de Frascos | comum | mana %, frascos | funcional | aplicado | ficha | 1/2 |
| `57248` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional | validado | ficha | 2/2 |
| `57257` | O Empalador | keystone | outros, bloqueio | funcional | validado | combate | 3/3 |
| `57259` | Ganho de Cargas de Frascos de Mana | comum | frascos | funcional | validado | combate | 2/2 |
| `57264` | Dano Mágico e Mana | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 1/2 |
| `57266` | Dano da Maça e Limite de Atordoamento Inimigo Reduzido | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `57279` | Magia Sanguínea | keystone | vida %, mana % | funcional-aproximado | validado | ficha | 2/2 |
| `57283` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `57362` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `57404` | Efeito dos Vínculos | comum | outros | funcional | aplicado | combate | 0/1 |
| `57449` | Evasão por Carga de Frenesi | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `57457` | Velocidade de Ataque e Conjuração em Dupla Empunhadura | comum | velocidades | funcional | validado | ficha | 2/2 |
| `57565` | Eficiência de Custo de Mana de Conexão | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `57615` | Velocidade de Arremesso de Minas | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `57651` | Sangramento Agravado na Chance de Golpe Crítico | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
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
| `58210` | Dano Mágico com Escudos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `58214` | Velocidade de Ataque e Bloqueio com Empunhadura Dupla | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `58218` | Pureza da Carne | notavel | escudo de energia, vida %, resistências | funcional | validado | ficha | 3/3 |
| `58244` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58271` | Vida e Evasão a Afecção Elemental | comum | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `58288` | Velocidade e Dano com Totens | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `58336` | Ganho de Valor com Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `58355` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `58382` | Feitos Renomados | notavel | outros | funcional | aplicado | combate | 0/1 |
| `58402` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58449` | Nascido para Lutar | notavel | velocidades, atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `58453` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `58474` | Dano Físico como Dano de Gelo Extra | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `58541` | Dano e Velocidade de Ataque com Maças | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `58545` | Mana e Área de Efeito de Aura | comum | mana %, área e projéteis | funcional | validado | ficha | 2/2 |
| `58556` | Escudo Divino | keystone | escudo de energia | funcional | aplicado | combate | 0/2 |
| `58603` | Chance de Congelar | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `58604` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `58649` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `58763` | Dano de Gelo e Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `58803` | Chance de Crítico e Precisão Corpo a Corpo com Duas Mãos | comum | precisão, crítico | funcional | aplicado | ficha | 0/2 |
| `58831` | Estripar | notavel | crítico | funcional | validado | ficha | 2/2 |
| `58851` | Líder da Matilha | notavel | área e projéteis, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `58854` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `58869` | Velocidade de Conjuração de Maldições | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `58921` | Discipulo da Matança | notavel | cargas e fúria, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `58968` | Multiplicador de Dano de Caos Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `59005` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `59009` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `59016` | Bloqueio e Velocidade de Ataque em Dupla Empunhadura | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `59070` | Alcance de Runas e Recuperação da Recarga de Runas | comum | cargas e fúria | parcial | aplicado | combate | 0/1 |
| `59151` | Lâmina Brutal | notavel | bloqueio, dano % (aumentado e "mais"), cargas e fúria | funcional | aplicado | ficha | 4/5 |
| `59220` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `59252` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59306` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `59370` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59423` | Escalonamento | notavel | dano % (aumentado e "mais") | funcional-aproximado | interpretado | condicional | 0/1 |
| `59482` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `59494` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `59556` | Munições Rápidas | notavel | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `59585` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `59605` | Munições Instáveis | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/3 |
| `59606` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59650` | Escudo de Energia e Regeneração de Mana | comum | escudo de energia, mana e custo | funcional | aplicado | ficha | 1/2 |
| `59699` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `59718` | Armadura, Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `59728` | Dano da Área de Efeito | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `59766` | Técnicas Sujas | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `59833` | Chance de Empalar | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `59861` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `59866` | Entrincheirar | notavel | supressão de magia, efeito por evento | funcional-aproximado | aplicado | ficha | 1/2 |
| `59928` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59976` | Contra-ataque Cuidadoso | notavel | bloqueio | funcional | interpretado | condicional | 0/2 |
| `60002` | Disparos da Fúria | notavel | velocidades, dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `60031` | Pele Prismática | notavel | resistências | funcional | aplicado | combate | 0/3 |
| `60085` | Preservação Arcana | notavel | velocidades, mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `60090` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `60145` | Efeito dos Vínculos | comum | outros | funcional | aplicado | combate | 0/1 |
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
| `60781` | Vínculo Inspirador | notavel | efeito por evento, outros | funcional | aplicado | combate | 0/2 |
| `60803` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `60887` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `60942` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60949` | Dano de Armadilha e Mina | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `60963` | Ganho de Valor com Estandartes | comum | outros | funcional | aplicado | combate | 0/1 |
| `60989` | Efeito de Buff de Arautos | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `61007` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `61039` | Voracidade Selvagem | notavel | vida, regeneração e dreno de vida, outros | funcional | validado | ficha | 2/2 |
| `61050` | Multiplicador de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `61190` | Ícone da União | notavel | outros, resistências | funcional | aplicado | combate | 3/4 |
| `61198` | Coração do Guerreiro | notavel | vida, regeneração e dreno de vida, vida %, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `61217` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `61262` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `61264` | Dano de Raio e Chance de Eletrizar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `61283` | Mana ao Matar contra Inimigos Amaldiçoados | comum | efeito por evento | funcional | aplicado | combate | 0/1 |
| `61288` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61305` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61306` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `61308` | Amplificar | notavel | área e projéteis, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
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
| `61982` | Graves Intenções | notavel | resistências, escudo de energia | funcional | aplicado | combate | 0/2 |
| `62017` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `62021` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `62042` | Dano da Espada | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `62069` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `62094` | Fome de Sangue | notavel | vida, regeneração e dreno de vida, outros | funcional | validado | ficha | 2/2 |
| `62103` | Dano de Projétil e Destreza | comum | dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `62108` | Drenagem de Vida e Velocidade de Ataque | comum | velocidades, vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 2/2 |
| `62109` | Recuperação da Recarga das Habilidades de Retaliação | comum | outros | funcional | aplicado | combate | 0/1 |
| `62214` | Bloqueio Mágico com Escudo e Resistências Elementais com Escudo | comum | bloqueio, resistências | funcional | aplicado | ficha | 3/4 |
| `62217` | Velocidade de Ataque e Precisão da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `62303` | Eficiência de Custo de Mana e Vida | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `62319` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `62363` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `62429` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `62480` | Eficiência de Custo de Mana de Maldições | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `62490` | Anulação de Envenenamento | comum | outros | funcional | aplicado | combate | 0/1 |
| `62530` | Duração de Fortificações | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `62577` | Pulso de Essência | notavel | escudo de energia | funcional | aplicado | ficha | 0/2 |
| `62662` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `62694` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
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
| `62879` | Dano com Habilidades de Retaliação e Bloqueio com Escudos | comum | bloqueio, velocidades | funcional | aplicado | ficha | 0/3 |
| `62970` | Velocidade de Conjuração de Escudos | comum | velocidades | funcional | validado | ficha | 1/1 |
| `63027` | Dano de Ataques Impelidos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `63033` | Porta Estandarte | notavel | outros, afecções e chance no acerto | funcional | validado | combate | 2/2 |
| `63039` | Efeito de Buff de Arautos | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `63048` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `63067` | Dano e Velocidade de Ataque da Varinha | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `63138` | Bloqueio Mágico e Resistências Elementais | comum | resistências, bloqueio | funcional | aplicado | ficha | 3/5 |
| `63139` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63150` | Pau-Ferro | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | combate | 0/2 |
| `63194` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `63207` | Explosão Tempestuosa | notavel | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `63228` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `63251` | Inveterado | notavel | supressão de magia | funcional | aplicado | ficha | 1/2 |
| `63282` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63306` | Dano com Habilidades de Retaliação | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `63398` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `63413` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `63422` | Lascívia por Carnificina | notavel | velocidades, vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 2/2 |
| `63425` | Juramento do Zelote | keystone | outros | funcional | validado | ficha | 1/1 |
| `63439` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63447` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63453` | Sustento Excessivo | notavel | efeito por evento | funcional | aplicado | combate | 0/1 |
| `63558` | Dano de Magia e Recuperação contra Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 1/2 |
| `63618` | Dano e Velocidade de Posicionamento do Totem | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `63620` | Técnica Precisa | keystone | — | funcional | aplicado | ficha | — |
| `63635` | Manifestação Primitiva | notavel | dano % (aumentado e "mais"), vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | ficha | 0/3 |
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
| `63933` | Zelo Totêmico | notavel | velocidades, lacaios e totens | funcional | aplicado | combate | 0/3 |
| `63944` | Tecelão Prismático | notavel | velocidades, dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 4/5 |
| `63963` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `63965` | Dano Elemental | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 1/2 |
| `63976` | Modelador | notavel | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `64024` | Multiplicador de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `64077` | Treinamento de Guerreiro | notavel | outros, área e projéteis | funcional-aproximado | validado | combate | 2/2 |
| `64166` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `64181` | Área de Efeito de Clamores | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `64210` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `64221` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `64226` | Rugido Desafiador | notavel | cargas e fúria | funcional | aplicado | combate | 0/1 |
| `64235` | Evasão e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `64238` | Área de Efeito das Habilidades de Retaliação | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `64239` | Dano Físico da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `64241` | Anulação de Resfriamentos e Congelamentos | comum | outros | funcional | aplicado | combate | 0/2 |
| `64257` | Velocidade das Habilidades de Retaliação | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `64265` | Área de Efeito da Aura | comum | área e projéteis | funcional | validado | combate | 1/1 |
| `64284` | Recuperação da Recarga de Habilidades de Postura | comum | outros | funcional | aplicado | combate | 0/1 |
| `64355` | Equidade de Runas | notavel | afecções e chance no acerto, cargas e fúria | parcial | aplicado | combate | 1/2 |
| `64395` | Contusão | notavel | crítico, afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `64401` | Vida e Mana ao Matar contra Inimigos Amaldiçoados | comum | efeito por evento | funcional | aplicado | combate | 0/2 |
| `64426` | Resistências Elementais com Escudo | comum | resistências | funcional | validado | ficha | 3/3 |
| `64501` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `64509` | Dano de Afecções com Adagas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `64583` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `64587` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `64612` | Danod e Raio com Varinhas | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `64695` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `64709` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `64769` | Chance de Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `64816` | Dano Corpo a Corpo com Duas Mãos e Dreno | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/3 |
| `64878` | Dano Elemental da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `64882` | Discipulo do Inflexível | notavel | cargas e fúria, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `64888` | Efeito das Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `65033` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `65034` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `65053` | Seiva da Essência | notavel | mana e custo, outros | funcional | aplicado | ficha | 2/3 |
| `65093` | Dançarino da Lâmina | notavel | dano % (aumentado e "mais"), outros | funcional-aproximado | validado | ficha | 3/3 |
| `65097` | Liderança | notavel | área e projéteis, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `65107` | Quebra-bastião | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `65108` | Incansável | notavel | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `65112` | Máximo de Fortificações | comum | outros | funcional | aplicado | combate | 0/1 |
| `65125` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `65159` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | funcional | aplicado | combate | 0/2 |
| `65167` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `65203` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `65210` | Coração de Carvalho | notavel | vida %, atordoamento, vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/3 |
| `65224` | Aspecto da Águia | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | aplicado | ficha | 2/4 |
| `65273` | Alcance Enigmático | notavel | área e projéteis, efeito por evento, bloqueio | funcional | aplicado | ficha | 0/3 |
| `65308` | Pele de Diamante | notavel | resistências | funcional | validado | ficha | 3/3 |
| `65400` | Recuperação da Recarga de Clamores e Dano de Ataques Impelidos | comum | outros, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `65427` | Velocidade de Ataque | comum | velocidades | funcional | validado | ficha | 1/1 |
| `65456` | Distância do Empurrão | comum | outros | funcional-aproximado | validado | combate | 1/1 |
| `65485` | Armadura por Carga de Tolerância | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `65502` | Perfurador | notavel | crítico | funcional | validado | ficha | 1/1 |
| `89` | Maestria de Minas | maestria | outros, auras, maldições e reserva, vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/4 |
| `240` | Maestria de Raio | maestria | outros, crítico | funcional | aplicado | ficha | 3/6 |
| `292` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `857` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `1205` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `1215` | Maestria de Evasão e Escudo de Energia | maestria | armadura e evasão, escudo de energia, outros | funcional-aproximado | aplicado | ficha | 4/8 |
| `2828` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `2841` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `3042` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `3471` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `3571` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `3883` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `4139` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `4327` | Maestria de Retaliação | maestria | afecções e chance no acerto, efeito por evento, armadura e evasão, outros, mana e custo | funcional | aplicado | ficha | 1/5 |
| `4424` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), área e projéteis, cargas e fúria | funcional | aplicado | ficha | 1/7 |
| `4492` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/7 |
| `4707` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `4788` | Maestria de Garras | maestria | vida, regeneração e dreno de vida, mana e custo, velocidades, dano % (aumentado e "mais"), outros | parcial | aplicado | ficha | 2/6 |
| `5230` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, vida, regeneração e dreno de vida, mana e custo, crítico | funcional | aplicado | ficha | 3/10 |
| `5348` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `5368` | Maestria de Bloqueio | maestria | bloqueio, efeito por evento | funcional | aplicado | combate | 0/5 |
| `5726` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `5826` | Maestria de Projéteis | maestria | dano % (aumentado e "mais"), afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `6338` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `6384` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `6427` | Maestria de Arcos | maestria | cargas e fúria, área e projéteis, crítico, lacaios e totens, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 1/7 |
| `6507` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `6570` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `6588` | Maestria de Atordoamentos | maestria | atordoamento, crítico, efeito por evento | funcional | aplicado | ficha | 2/7 |
| `6912` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), armadura e evasão, atordoamento, velocidades | parcial | aplicado | ficha | 1/9 |
| `6968` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, vida, regeneração e dreno de vida, mana e custo, crítico | funcional | aplicado | ficha | 3/10 |
| `7023` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `7488` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `7528` | Maestria de Fúria | maestria | atordoamento, velocidades, cargas e fúria, efeito por evento, outros, auras, maldições e reserva | funcional | aplicado | combate | 3/7 |
| `7634` | Maestria de Adagas | maestria | crítico, outros, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/5 |
| `8370` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/7 |
| `8460` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `8556` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `8629` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `8732` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `8872` | Maestria de Dupla Empunhadura | maestria | bloqueio, crítico, dano % (aumentado e "mais"), efeito por evento, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/8 |
| `9083` | Maestria Defensiva de Lacaios | maestria | resistências, lacaios e totens, cargas e fúria, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/6 |
| `9213` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `9393` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `9458` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `9471` | Maestria de Fúria | maestria | atordoamento, velocidades, cargas e fúria, efeito por evento, outros, auras, maldições e reserva | funcional | aplicado | combate | 3/7 |
| `9586` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `10141` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `10166` | Maestria de Minas | maestria | outros, auras, maldições e reserva, vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/4 |
| `10204` | Maestria de Espadas | maestria | outros, afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 3/5 |
| `10245` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `10414` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `10429` | Maestria de Armadilhas | maestria | dano % (aumentado e "mais"), área e projéteis, efeito por evento | parcial | aplicado | combate | 0/3 |
| `10495` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `10729` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `11032` | Maestria de Evasão e Escudo de Energia | maestria | armadura e evasão, escudo de energia, outros | funcional-aproximado | aplicado | ficha | 4/8 |
| `11505` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `11596` | Maestria de Maça | maestria | outros, área e projéteis, afecções e chance no acerto, dano % (aumentado e "mais"), atordoamento | funcional | aplicado | combate | 1/14 |
| `12125` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `12169` | Maestria Física | maestria | atordoamento, outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `12239` | Maestria Física | maestria | atordoamento, outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `12244` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `12382` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `12503` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `12518` | Maestria de Garras | maestria | vida, regeneração e dreno de vida, mana e custo, velocidades, dano % (aumentado e "mais"), outros | parcial | aplicado | ficha | 2/6 |
| `12873` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `13387` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `13712` | Domínio de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `13862` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `14113` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `14122` | Maestria de Raio | maestria | outros, crítico | funcional | aplicado | ficha | 3/6 |
| `14505` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `14832` | Maestria de Maça | maestria | outros, área e projéteis, afecções e chance no acerto, dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 1/14 |
| `15409` | Maestria de Adagas | maestria | crítico, outros, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/5 |
| `15697` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `16123` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `16141` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `16810` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `17127` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `17380` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `17411` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `17906` | Maestria de Armadilhas | maestria | dano % (aumentado e "mais"), área e projéteis, efeito por evento | parcial | aplicado | combate | 0/3 |
| `17945` | Domínio de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `18240` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `18750` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `19050` | Maestria de Garras | maestria | vida, regeneração e dreno de vida, mana e custo, velocidades, dano % (aumentado e "mais"), outros | parcial | aplicado | ficha | 2/6 |
| `19725` | Maestria de Atordoamentos | maestria | atordoamento, crítico, efeito por evento | funcional | aplicado | ficha | 2/7 |
| `19749` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `19750` | Maestria de Armadura e Evasão | maestria | afecções e chance no acerto, armadura e evasão, atordoamento, outros | parcial | aplicado | combate | 0/9 |
| `20675` | Maestria Física | maestria | atordoamento, outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `20730` | Maestria de Supressão Mágica | maestria | supressão de magia, efeito por evento, outros | funcional | aplicado | combate | 1/10 |
| `20736` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `21143` | Maestria de Runas | maestria | área e projéteis, cargas e fúria | parcial | aplicado | combate | 1/2 |
| `21324` | Maestria de Bloqueio | maestria | bloqueio, efeito por evento | funcional | aplicado | combate | 0/5 |
| `21801` | Maestria de Caos | maestria | efeito por evento, outros, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/7 |
| `22067` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `22295` | Maestria de Sangramento | maestria | outros, afecções e chance no acerto, crítico | funcional | aplicado | ficha | 3/6 |
| `22480` | Maestria de Bloqueio | maestria | bloqueio, efeito por evento | funcional | aplicado | combate | 0/5 |
| `22959` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `22970` | Maestria Defensiva de Lacaios | maestria | resistências, lacaios e totens, cargas e fúria, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/6 |
| `23547` | Maestria de Caos | maestria | efeito por evento, outros, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/7 |
| `23796` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `24224` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), área e projéteis, cargas e fúria | funcional | aplicado | ficha | 1/7 |
| `24334` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `24481` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `24552` | Maestria de Arcos | maestria | cargas e fúria, área e projéteis, crítico, lacaios e totens, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 1/7 |
| `25011` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `25031` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `25186` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `25281` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `25313` | Domínio do Conjurador | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `25349` | Maestria de Arcos | maestria | cargas e fúria, área e projéteis, crítico, lacaios e totens, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 1/7 |
| `25446` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `25535` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `25934` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), armadura e evasão, atordoamento, velocidades | parcial | aplicado | ficha | 1/9 |
| `26037` | Maestria de Retaliação | maestria | afecções e chance no acerto, efeito por evento, armadura e evasão, outros, mana e custo | funcional | aplicado | ficha | 1/5 |
| `26148` | Maestria de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `26154` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `26393` | Maestria Defensiva de Lacaios | maestria | resistências, lacaios e totens, cargas e fúria, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/6 |
| `26608` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `26697` | Maestria de Espadas | maestria | outros, afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 3/5 |
| `27157` | Domínio de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `27193` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `27235` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `27307` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia, outros | parcial | aplicado | combate | 0/5 |
| `27371` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `27733` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `27865` | Maestria de Arcos | maestria | cargas e fúria, área e projéteis, crítico, lacaios e totens, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 1/7 |
| `27872` | Maestria de Minas | maestria | outros, auras, maldições e reserva, vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/4 |
| `27931` | Maestria de Maça | maestria | outros, área e projéteis, afecções e chance no acerto, dano % (aumentado e "mais"), atordoamento | funcional | aplicado | combate | 1/14 |
| `28039` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), área e projéteis, cargas e fúria | funcional | aplicado | ficha | 1/7 |
| `28284` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/7 |
| `28680` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `28862` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `28863` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `28903` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `29993` | Maestria de Duração | maestria | afecções e chance no acerto | funcional-aproximado | aplicado | combate | 3/4 |
| `30393` | Maestria de Armadura e Escudo de Energia | maestria | outros, efeito por evento, crítico, escudo de energia, armadura e evasão, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/7 |
| `31039` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `31197` | Maestria de Adagas | maestria | crítico, outros, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/5 |
| `31291` | Maestria de Espadas | maestria | outros, afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 3/5 |
| `31292` | Maestria de Maça | maestria | outros, área e projéteis, afecções e chance no acerto, dano % (aumentado e "mais"), atordoamento | funcional | aplicado | combate | 1/14 |
| `31400` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `31818` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `32241` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `32242` | Maestria de Estandartes | maestria | auras, maldições e reserva, efeito por evento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 2/5 |
| `32278` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `32509` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `32657` | Maestria de Marcas | maestria | outros, efeito por evento, crítico, precisão | funcional | aplicado | combate | 0/7 |
| `33037` | Maestria de Ataques | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `33657` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `33678` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `33823` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `34317` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `34487` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `34552` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `34723` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `34927` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `35038` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo, precisão | parcial | aplicado | ficha | 2/5 |
| `35085` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `35118` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), armadura e evasão, atordoamento, velocidades | parcial | aplicado | ficha | 1/9 |
| `35221` | Maestria de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `35321` | Maestria de Estandartes | maestria | auras, maldições e reserva, efeito por evento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 2/5 |
| `35859` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `35977` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `37502` | Maestria de Arcos | maestria | cargas e fúria, área e projéteis, crítico, lacaios e totens, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 1/7 |
| `37532` | Maestria de Raio | maestria | outros, crítico | funcional | aplicado | ficha | 3/6 |
| `37616` | Maestria de Armadilhas | maestria | dano % (aumentado e "mais"), área e projéteis, efeito por evento | parcial | aplicado | combate | 0/3 |
| `37641` | Maestria de Armadura e Escudo de Energia | maestria | outros, efeito por evento, crítico, escudo de energia, armadura e evasão, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/7 |
| `37698` | Maestria de Atordoamentos | maestria | atordoamento, crítico, efeito por evento | funcional | aplicado | ficha | 2/7 |
| `37795` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `37911` | Maestria Flamejante | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `37956` | Maestria de Sangramento | maestria | outros, afecções e chance no acerto, crítico | funcional | aplicado | ficha | 3/6 |
| `38207` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `38235` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `38320` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `38377` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `38436` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `38568` | Maestria de Cegueira | maestria | outros, afecções e chance no acerto, crítico | parcial | aplicado | ficha | 0/3 |
| `38579` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `38595` | Domínio de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `38622` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `38921` | Maestria de Bloqueio | maestria | bloqueio, efeito por evento | funcional | aplicado | combate | 0/5 |
| `39332` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, vida, regeneração e dreno de vida, mana e custo, crítico | funcional | aplicado | ficha | 3/10 |
| `39338` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), armadura e evasão, atordoamento, velocidades | parcial | aplicado | ficha | 1/9 |
| `39416` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `39836` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `40170` | Maestria de Sangramento | maestria | outros, afecções e chance no acerto, crítico | funcional | aplicado | ficha | 3/6 |
| `40196` | Maestria de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `40271` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `40383` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `40439` | Maestria de Runas | maestria | área e projéteis, cargas e fúria | parcial | aplicado | combate | 1/2 |
| `40698` | Maestria de Fúria | maestria | atordoamento, velocidades, cargas e fúria, efeito por evento, outros, auras, maldições e reserva | funcional | aplicado | combate | 3/7 |
| `41016` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `41163` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `41225` | Maestria Defensiva de Lacaios | maestria | resistências, lacaios e totens, cargas e fúria, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/6 |
| `41273` | Domínio de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `41415` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `41522` | Maestria de Duração | maestria | afecções e chance no acerto | funcional-aproximado | aplicado | combate | 3/4 |
| `41744` | Maestria de Retaliação | maestria | afecções e chance no acerto, efeito por evento, armadura e evasão, outros, mana e custo | funcional | aplicado | ficha | 1/5 |
| `42361` | Maestria de Caos | maestria | efeito por evento, outros, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/7 |
| `42533` | Maestria de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `42792` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `43307` | Maestria de Estandartes | maestria | auras, maldições e reserva, efeito por evento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 2/5 |
| `43495` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `43601` | Maestria de Sangramento | maestria | outros, afecções e chance no acerto, crítico | funcional | aplicado | ficha | 3/6 |
| `43647` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `43818` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `44179` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `44206` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `44298` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `44316` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `44330` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `44540` | Maestria de Armadilhas | maestria | dano % (aumentado e "mais"), área e projéteis, efeito por evento | parcial | aplicado | combate | 0/3 |
| `44948` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `45019` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `45358` | Maestria de Armadura | maestria | armadura e evasão, crítico, outros, resistências | funcional | aplicado | ficha | 0/9 |
| `45372` | Maestria de Ataques | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `45558` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `46495` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `46665` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `46761` | Maestria de Frascos | maestria | frascos, efeito por evento | funcional-aproximado | aplicado | combate | 7/9 |
| `47059` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `47197` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `47212` | Maestria de Projéteis | maestria | dano % (aumentado e "mais"), afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `47242` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `47294` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `48007` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `48144` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `48267` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `48290` | Maestria Defensiva de Lacaios | maestria | resistências, lacaios e totens, cargas e fúria, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/6 |
| `48349` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, vida, regeneração e dreno de vida, mana e custo, crítico | funcional | aplicado | ficha | 3/10 |
| `48411` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo, precisão | parcial | aplicado | ficha | 2/5 |
| `48505` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `48508` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `48660` | Maestria Elementar | maestria | outros, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `48717` | Maestria de Armadura | maestria | armadura e evasão, crítico, outros, resistências | funcional | aplicado | ficha | 0/9 |
| `48859` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `48982` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `49391` | Maestria de Ataques | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `49677` | Maestria de Empalamentos | maestria | outros | parcial | aplicado | combate | 3/4 |
| `49820` | Maestria de Supressão Mágica | maestria | supressão de magia, efeito por evento, outros | funcional | aplicado | combate | 1/10 |
| `50071` | Maestria de Dupla Empunhadura | maestria | bloqueio, crítico, dano % (aumentado e "mais"), efeito por evento, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/8 |
| `50540` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `50757` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `51583` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `51761` | Maestria de Dupla Empunhadura | maestria | bloqueio, crítico, dano % (aumentado e "mais"), efeito por evento, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/8 |
| `51974` | Maestria de Fortificação | maestria | vida, regeneração e dreno de vida, efeito por evento, afecções e chance no acerto, atordoamento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/8 |
| `52018` | Maestria de Empunhadura Dupla | maestria | bloqueio, crítico, dano % (aumentado e "mais"), efeito por evento, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/8 |
| `52061` | Maestria de Fúria | maestria | atordoamento, velocidades, cargas e fúria, efeito por evento, outros, auras, maldições e reserva | funcional | aplicado | combate | 3/7 |
| `52074` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `52220` | Maestria Física | maestria | atordoamento, outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `52462` | Maestria de Armadura | maestria | armadura e evasão, crítico, outros, resistências | funcional | aplicado | ficha | 0/9 |
| `52875` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `53188` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `53216` | Maestria de Atordoamentos | maestria | atordoamento, crítico, efeito por evento | funcional | aplicado | ficha | 2/7 |
| `53365` | Maestria de Garras | maestria | vida, regeneração e dreno de vida, mana e custo, velocidades, dano % (aumentado e "mais"), outros | parcial | aplicado | ficha | 2/6 |
| `53517` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `53615` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `53738` | Maestria de Minas | maestria | outros, auras, maldições e reserva, vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/4 |
| `53828` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo, precisão | parcial | aplicado | ficha | 2/5 |
| `54340` | Maestria de Armadura | maestria | armadura e evasão, crítico, outros, resistências | funcional | aplicado | ficha | 0/9 |
| `54413` | Maestria de Supressão Mágica | maestria | supressão de magia, efeito por evento, outros | funcional | aplicado | combate | 1/10 |
| `54849` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `54887` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `55017` | Maestria de Retaliação | maestria | afecções e chance no acerto, efeito por evento, armadura e evasão, outros, mana e custo | funcional | aplicado | ficha | 1/5 |
| `55152` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `55230` | Maestria de Dreno | maestria | outros, armadura e evasão, dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 4/7 |
| `55281` | Maestria de Estandartes | maestria | auras, maldições e reserva, efeito por evento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 2/5 |
| `55348` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `55491` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `56023` | Maestria de Projéteis | maestria | dano % (aumentado e "mais"), afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `56128` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo, precisão | parcial | aplicado | ficha | 2/5 |
| `56519` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `56595` | Maestria de Ataque | maestria | outros, efeito por evento, cargas e fúria, velocidades, mana e custo | funcional-aproximado | aplicado | combate | 1/7 |
| `56865` | Maestria de Marcas | maestria | outros, efeito por evento, crítico, precisão | funcional | aplicado | combate | 0/7 |
| `57949` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `58302` | Maestria de Precisão | maestria | precisão | funcional-aproximado | aplicado | ficha | 3/6 |
| `58540` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), área e projéteis, cargas e fúria | funcional | aplicado | ficha | 1/7 |
| `58563` | Maestria de Marcas | maestria | outros, efeito por evento, crítico, precisão | funcional | aplicado | combate | 0/7 |
| `58728` | Maestria de Retaliação | maestria | afecções e chance no acerto, efeito por evento, armadura e evasão, outros, mana e custo | funcional | aplicado | ficha | 1/5 |
| `58816` | Maestria de Raio | maestria | outros, crítico | funcional | aplicado | ficha | 3/6 |
| `59013` | Maestria de Maça | maestria | outros, área e projéteis, afecções e chance no acerto, dano % (aumentado e "mais"), atordoamento | funcional | aplicado | combate | 1/14 |
| `59335` | Maestria de Fortificação | maestria | vida, regeneração e dreno de vida, efeito por evento, afecções e chance no acerto, atordoamento, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/8 |
| `59501` | Maestria de Cegueira | maestria | outros, afecções e chance no acerto, crítico | parcial | aplicado | ficha | 0/3 |
| `59926` | Maestria de Minas | maestria | outros, auras, maldições e reserva, vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/4 |
| `60170` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 4/8 |
| `60210` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `60512` | Domínio de Conjuração | maestria | cargas e fúria, velocidades, outros | parcial | aplicado | combate | 1/3 |
| `60834` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `60992` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `61343` | Maestria de Runas | maestria | área e projéteis, cargas e fúria | parcial | aplicado | combate | 1/2 |
| `61529` | Maestria de Recuperação | maestria | efeito por evento, outros, auras, maldições e reserva, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/7 |
| `61785` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `61992` | Maestria Ofensiva de Lacaios | maestria | lacaios e totens, outros | funcional | aplicado | combate | 0/9 |
| `62015` | Maestria de Clamores | maestria | outros, efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 1/6 |
| `62023` | Maestria de Atordoamentos | maestria | atordoamento, crítico, efeito por evento | funcional | aplicado | ficha | 2/7 |
| `62235` | Maestria de Armadura e Evasão | maestria | afecções e chance no acerto, armadura e evasão, atordoamento, outros | parcial | aplicado | combate | 0/9 |
| `62416` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, vida, regeneração e dreno de vida, mana e custo, crítico | funcional | aplicado | ficha | 3/10 |
| `62506` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `62588` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `62759` | Maestria de Marcas | maestria | outros, efeito por evento, crítico, precisão | funcional | aplicado | combate | 0/7 |
| `62853` | Maestria de Adagas | maestria | crítico, outros, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/5 |
| `63184` | Maestria de Espadas | maestria | outros, afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 3/5 |
| `63268` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `63482` | Maestria de Raio | maestria | outros, crítico | funcional | aplicado | ficha | 3/6 |
| `63559` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `63710` | Maestria de Sangramento | maestria | outros, afecções e chance no acerto, crítico | funcional | aplicado | ficha | 3/6 |
| `63861` | Maestria de Críticos | maestria | crítico, atordoamento, outros | funcional | aplicado | ficha | 2/6 |
| `64042` | Maestria Física | maestria | atordoamento, outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `64128` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva, área e projéteis, afecções e chance no acerto | funcional | aplicado | combate | 3/8 |
| `64406` | Maestria de Armadura | maestria | armadura e evasão, crítico, outros, resistências | funcional | aplicado | ficha | 0/9 |
| `65154` | Maestria de Totens | maestria | lacaios e totens, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 2/6 |
| `65395` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `65528` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `6982` | Armadura e Evasão, Duração de Provocar [Champion] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | combate | 2/3 |
| `11412` | Inspirador [Champion] | ascendencia-notavel | auras, maldições e reserva, vida, regeneração e dreno de vida, outros | funcional-aproximado | aplicado | combate | 2/3 |
| `13374` | Mestre do Metal [Champion] | ascendencia-notavel | outros | parcial | validado | combate | 1/1 |
| `25111` | Armadura e Evasão, Efeito da Aura [Champion] | ascendencia-comum | armadura e evasão, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `27604` | Primeiro a Bater, Último a Cair [Champion] | ascendencia-notavel | outros, efeito por evento | funcional | aplicado | combate | 3/4 |
| `31700` | Fortitude [Champion] | ascendencia-notavel | outros | parcial | aplicado | ficha | 0/1 |
| `33940` | Herói Incontrolável [Champion] | ascendencia-notavel | armadura e evasão, velocidades | funcional | interpretado | condicional | 0/3 |
| `35185` | Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] | ascendencia-comum | armadura e evasão, dano % (aumentado e "mais") | funcional | aplicado | combate | 2/3 |
| `35750` | Causas Nobres [Champion] | ascendencia-notavel | outros, afecções e chance no acerto | funcional | validado | combate | 2/2 |
| `41433` | Armadura e Evasão, Chance de Empalar [Champion] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | combate | 2/3 |
| `43725` | Armadura e Evasão, Dano de Ataque [Champion] | ascendencia-comum | dano % (aumentado e "mais"), armadura e evasão | funcional | validado | ficha | 3/3 |
| `56967` | Inimigo Digno [Champion] | ascendencia-notavel | afecções e chance no acerto, dano % (aumentado e "mais"), outros | funcional | aplicado | combate | 0/3 |
| `60508` | Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] | ascendencia-comum | armadura e evasão, dano % (aumentado e "mais") | funcional | aplicado | combate | 2/3 |
| `61478` | Armadura e Evasão, Efeito de Aura [Champion] | ascendencia-comum | armadura e evasão, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `758` | Guerra do Desgaste [Gladiator] | ascendencia-notavel | dano % (aumentado e "mais") | funcional | aplicado | combate | 0/1 |
| `1675` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional | validado | ficha | 2/2 |
| `2598` | Mais Que Habilidade [Gladiator] | ascendencia-notavel | bloqueio | funcional | interpretado | condicional | 0/1 |
| `3651` | Velocidade de Ataque e Dano com Uma Mão [Gladiator] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `8419` | Sobrevivente Determinado [Gladiator] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/1 |
| `14726` | Velocidade de Ataque, Dano com Ataques [Gladiator] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `15616` | Técnica Irregular [Gladiator] | ascendencia-notavel | outros | funcional | validado | combate | 1/1 |
| `24538` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional | validado | ficha | 2/2 |
| `27864` | Violência Gratuita [Gladiator] | ascendencia-notavel | efeito por evento | funcional-aproximado | aplicado | combate | 0/1 |
| `33179` | Velocidade de Ataque, Chance de Sangramento [Gladiator] | ascendencia-comum | velocidades, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `37623` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional | validado | ficha | 2/2 |
| `48760` | Velocidade de Ataque, Chance de Sangramento [Gladiator] | ascendencia-comum | velocidades, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `52575` | Mestre das Armas [Gladiator] | ascendencia-notavel | precisão, área e projéteis, crítico, outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 3/6 |
| `63490` | Retaliação Comedida [Gladiator] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `3184` | Carrasco [Slayer] | ascendencia-notavel | outros, efeito por evento | funcional | aplicado | combate | 0/4 |
| `10143` | Fervor Brutal [Slayer] | ascendencia-notavel | outros, dano % (aumentado e "mais") | funcional | aplicado | combate | 1/3 |
| `15286` | Dano de Ataque, Velocidade de Ataque [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `16306` | Forma Magistral [Slayer] | ascendencia-notavel | cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `17315` | Esmagador [Slayer] | ascendencia-notavel | crítico | parcial | interpretado | condicional | 0/1 |
| `20954` | Dano de Ataque, Área de Efeito [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), área e projéteis | funcional | validado | ficha | 2/2 |
| `34215` | Dano de Ataque, Drenagem de Vida [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `34484` | Apetite Insaciável [Slayer] | ascendencia-notavel | outros, velocidades, atordoamento | funcional | aplicado | combate | 3/4 |
| `38180` | Impacto [Slayer] | ascendencia-notavel | outros, área e projéteis, dano % (aumentado e "mais"), precisão % | funcional-aproximado | aplicado | ficha | 2/4 |
| `42293` | Dano de Ataque, Velocidade de Ataque [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `45696` | Dano de Ataque, Drenagem de Vida [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `50845` | Dano de Ataque, Duração de Cargas de Frenesi e Tolerância [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `61393` | Dano de Ataque, Chance de Crítico [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 2/2 |
| `62817` | Executor de Lendas [Slayer] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/2 |
| `5865` | Dano Físico, Armadura [Berserker] | ascendencia-comum | armadura e evasão, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `8592` | Dano Físico, Alcance de Golpe Corpo a Corpo [Berserker] | ascendencia-comum | outros, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `9271` | Desafiando a Dor [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `24528` | Frenesi de Combate [Berserker] | ascendencia-notavel | velocidades, cargas e fúria | funcional | aplicado | combate | 0/2 |
| `29630` | Dançarino Sanguinolento [Berserker] | ascendencia-notavel | outros | funcional | validado | combate | 1/1 |
| `32251` | Portador da Guerra [Berserker] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/1 |
| `38999` | Fúria Ancestral [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `42861` | Dano Físico, Fúria ao Acertar [Berserker] | ascendencia-comum | cargas e fúria, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `48904` | Dano Físico, Vida Roubada por Segundo [Berserker] | ascendencia-comum | outros, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `50024` | Dano Físico, Velocidade do Clamor [Berserker] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `57560` | Ritual da Ruína [Berserker] | ascendencia-notavel | outros, cargas e fúria | funcional-aproximado | aplicado | combate | 0/2 |
| `59920` | Aspecto da Carnificina [Berserker] | ascendencia-notavel | dano % (aumentado e "mais") | funcional | aplicado | combate | 0/2 |
| `63583` | Dano Físico, Fúria ao Acertar [Berserker] | ascendencia-comum | cargas e fúria, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `63673` | Dano Físico, Velocidade de Ataque [Berserker] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `982` | Regeneração de Vida, Dano Corpo a Corpo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `1731` | Hinekora, Fúria da Morte [Chieftain] | ascendencia-notavel | efeito por evento | funcional | aplicado | combate | 0/1 |
| `5643` | Regeneração de Vida, Resistência a Fogo [Chieftain] | ascendencia-comum | resistências, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `6028` | Regeneração de Vida, Duração do Clamor [Chieftain] | ascendencia-comum | vida, regeneração e dreno de vida, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `9971` | Regeneração de Vida, Força [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `10238` | Regeneração de Vida, Dano de Fogo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `14996` | Regeneração de Vida, Dano de Fogo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `31667` | Sione, Rugido Solar [Chieftain] | ascendencia-notavel | outros, cargas e fúria | funcional | aplicado | combate | 0/2 |
| `32249` | Valako, Abraço da Tormenta [Chieftain] | ascendencia-notavel | resistências | funcional | aplicado | combate | 0/1 |
| `42659` | Regeneração de Vida, Resistência a Fogo [Chieftain] | ascendencia-comum | resistências, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `47486` | Regeneração de Vida, Dano Corpo a Corpo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `48480` | Tasalio, Água Purificadora [Chieftain] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/2 |
| `50692` | Ngamahu, Avanço da Chama [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `53095` | Tukohama, Arauto da Guerra [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `61355` | Ramako, Luz do Sol [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `1734` | Inabalável [Juggernaut] | ascendencia-notavel | cargas e fúria, afecções e chance no acerto | funcional | aplicado | ficha | 1/4 |
| `5819` | Incontrolável [Juggernaut] | ascendencia-notavel | velocidades, atordoamento, outros | funcional-aproximado | aplicado | ficha | 1/5 |
| `16093` | Armadura, Regeneração de Vida [Juggernaut] | ascendencia-comum | armadura e evasão, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `17988` | Incansável [Juggernaut] | ascendencia-notavel | vida, regeneração e dreno de vida, outros | funcional | aplicado | ficha | 0/2 |
| `23972` | Armadura, Duração da Carga de Tolerância [Juggernaut] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `32115` | Armadura, Velocidade de Ataque [Juggernaut] | ascendencia-comum | velocidades, armadura e evasão | funcional | validado | ficha | 2/2 |
| `44297` | Inegável [Juggernaut] | ascendencia-notavel | precisão, velocidades | funcional | aplicado | ficha | 2/3 |
| `49153` | Armadura, Duração da Carga de Tolerância [Juggernaut] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `51998` | Armadura, Resistência a Caos [Juggernaut] | ascendencia-comum | armadura e evasão, resistências | funcional | validado | ficha | 2/2 |
| `53816` | Inquebrável [Juggernaut] | ascendencia-notavel | armadura e evasão | parcial | aplicado | combate | 0/1 |
| `56789` | Implacável [Juggernaut] | ascendencia-notavel | cargas e fúria | funcional | aplicado | combate | 0/2 |
| `62349` | Armadura, Duração de Atordoamento [Juggernaut] | ascendencia-comum | armadura e evasão, atordoamento | funcional | validado | combate | 2/2 |
| `62595` | Inflexível [Juggernaut] | ascendencia-notavel | dano % (aumentado e "mais"), área e projéteis, atordoamento | funcional | aplicado | ficha | 0/4 |
| `63417` | Armadura, Velocidade de Movimento [Juggernaut] | ascendencia-comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `1729` | Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), lacaios e totens | funcional | aplicado | ficha | 1/2 |
| `2872` | Força Ocupante [Deadeye] | ascendencia-notavel | lacaios e totens | parcial | validado | combate | 1/1 |
| `5082` | Dano de Projétil, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `5443` | Ponto Focal [Deadeye] | ascendencia-notavel | outros, dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | combate | 0/4 |
| `22852` | Danod e Projétil, Velocidade de Ataque [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `23169` | Guarda do Vento [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `24848` | Ventania [Deadeye] | ascendencia-notavel | outros | parcial | aplicado | ficha | 0/1 |
| `26067` | Munições Infinitas [Deadeye] | ascendencia-notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `28995` | Dano de Projétil, Velocidade de Projétil [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `44482` | Avidez [Deadeye] | ascendencia-notavel | precisão, cargas e fúria | funcional | aplicado | ficha | 1/3 |
| `45313` | Tiro Distante [Deadeye] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/1 |
| `53086` | Dano de Projétil, Velocidade de Conjuração de Marca [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 1/2 |
| `55985` | Dano com Projéteis, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `56134` | Dano de Projétil, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `59837` | Dano de Projétil, Velocidade de Ataque [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `61627` | Ricochete [Deadeye] | ascendencia-notavel | área e projéteis | parcial | aplicado | combate | 0/1 |
| `62136` | Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), lacaios e totens | funcional | aplicado | ficha | 1/2 |
| `64028` | Dano de Projétil, Velocidade de Projétil [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `1697` | Mestre Toxista [Pathfinder] | ascendencia-notavel | efeito por evento | parcial | interpretado | condicional | 0/1 |
| `6038` | Mestre Destilador [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `14156` | Efeito e Duração do Frasco [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `20480` | Efeito do Frasco, Duração do Envenenamento [Pathfinder] | ascendencia-comum | frascos, afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `32640` | Efeito do Frasco e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `32662` | Efeito do Frasco, Dano de Caos [Pathfinder] | ascendencia-comum | dano % (aumentado e "mais"), frascos | funcional | aplicado | ficha | 0/2 |
| `36242` | Efeito e Duração do Frasco [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `40631` | Efeito do Frasco e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `40813` | Represália da Natureza [Pathfinder] | ascendencia-notavel | efeito por evento, outros | funcional | aplicado | combate | 0/2 |
| `51101` | Adrenalina da Natureza [Pathfinder] | ascendencia-notavel | frascos | funcional | aplicado | combate | 0/1 |
| `59800` | Efeito de Frascos e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `61805` | Mestre Alquimista [Pathfinder] | ascendencia-notavel | efeito por evento, frascos | funcional | aplicado | combate | 0/2 |
| `63293` | Mestre Cirurgiã [Pathfinder] | ascendencia-notavel | frascos | parcial | validado | combate | 1/1 |
| `65296` | Dádiva da Natureza [Pathfinder] | ascendencia-notavel | frascos | funcional-aproximado | aplicado | combate | 0/1 |
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
| `4194` | Berserker [Ascendant] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida, mana e custo, atordoamento, cargas e fúria | funcional | aplicado | ficha | 0/6 |
| `6778` | Trapaceiro [Ascendant] | ascendencia-comum | supressão de magia, dano % (aumentado e "mais"), escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 1/4 |
| `7618` | Caminho da Caçadora [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `8281` | Elementalista [Ascendant] | ascendencia-comum | outros, lacaios e totens | parcial | aplicado | ficha | 2/3 |
| `8656` | Protetora [Ascendant] | ascendencia-comum | supressão de magia, penetração | parcial | aplicado | ficha | 1/2 |
| `9327` | Desbravadora [Ascendant] | ascendencia-comum | velocidades, efeito por evento, frascos | funcional | aplicado | combate | 0/5 |
| `10099` | Necromante [Ascendant] | ascendencia-comum | lacaios e totens, área e projéteis | parcial | aplicado | combate | 1/3 |
| `12597` | Ocultista [Ascendant] | ascendencia-comum | outros, auras, maldições e reserva, escudo de energia, atordoamento | funcional | aplicado | combate | 1/4 |
| `15435` | Ascensão do Templário [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `17445` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `22551` | Força e Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `24755` | Caminho do Marauder [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `24798` | Ascensão do Duelista [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `30690` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `30919` | Guardião [Ascendant] | ascendencia-comum | auras, maldições e reserva, outros, bloqueio | funcional-aproximado | aplicado | combate | 0/4 |
| `31598` | Destreza [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33875` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `34567` | Atiradora [Ascendant] | ascendencia-comum | outros, área e projéteis | funcional-aproximado | aplicado | ficha | 0/4 |
| `34774` | Gladiador [Ascendant] | ascendencia-comum | afecções e chance no acerto, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 1/3 |
| `38689` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `39598` | Campeão [Ascendant] | ascendencia-comum | afecções e chance no acerto, auras, maldições e reserva, outros, dano % (aumentado e "mais") | funcional | aplicado | combate | 0/5 |
| `41534` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `41996` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `42144` | Hierofante [Ascendant] | ascendencia-comum | mana %, lacaios e totens, dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | ficha | 2/5 |
| `42546` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `42671` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `43122` | Assassino [Ascendant] | ascendencia-comum | crítico, efeito por evento | parcial | aplicado | ficha | 0/3 |
| `43195` | Executor [Ascendant] | ascendencia-comum | outros, área e projéteis | parcial | aplicado | combate | 1/3 |
| `43336` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `43962` | Inquisidor [Ascendant] | ascendencia-comum | penetração, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/5 |
| `45403` | Destreza e Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `49532` | Ascensão da Caçadora [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `51782` | Ascensão da Bruxa [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `53992` | Caminho do Sombra [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `54877` | Caminho do Templário [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `56722` | Caminho da Bruxa [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `57052` | Chefe Guerreiro [Ascendant] | ascendencia-comum | efeito por evento, outros, atributos (For/Des/Int) | funcional | aplicado | ficha | 0/5 |
| `57429` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `58029` | Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58827` | Sabotador [Ascendant] | ascendencia-comum | área e projéteis, outros, dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/4 |
| `61072` | Destruidor [Ascendant] | ascendencia-comum | precisão, outros, atordoamento, dano % (aumentado e "mais"), cargas e fúria | funcional | aplicado | ficha | 1/5 |
| `61437` | Ascensão do Marauder [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `62162` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `63357` | Caminho do Duelista [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `1564` | Guarda-costas Leal [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `1977` | Cintos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `15900` | Juramento de Fidelidade [Luminary] | ascendencia-notavel | mana e custo | parcial | aplicado | combate | 0/1 |
| `19993` | Botas Lendárias [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `25944` | Armas Lendárias [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `27123` | Vida de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `30675` | Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] | ascendencia-comum | velocidades | parcial | aplicado | combate | 0/1 |
| `31517` | Glória Dourada [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `32095` | Elmos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `32669` | Amuletos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `35877` | Dano de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `43645` | Anéis Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `46479` | Sangue Nobre [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `52633` | Luvas Lendárias [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `56292` | Sagração à Cavalaria [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `61133` | Vida de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `63954` | Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] | ascendencia-comum | velocidades | parcial | aplicado | combate | 0/1 |
| `2460` | Mostruário de Armas de Conjurador [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `2768` | União da Carne [Reliquarian] | ascendencia-comum | resistências | funcional | aplicado | combate | 0/4 |
| `8081` | As Areias do Tempo [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `8967` | Gritos dos Dessecados [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `9258` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `12003` | Mostruário de Armas Marciais [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `15544` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `16633` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `16994` | Carícia Vaal [Reliquarian] | ascendencia-comum | efeito por evento, outros | funcional | aplicado | combate | 0/2 |
| `17386` | Alavanca de Xirgil [Reliquarian] | ascendencia-comum | outros, efeito por evento | funcional | aplicado | combate | 0/2 |
| `18147` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `20160` | Espigão de Fidelitas [Reliquarian] | ascendencia-comum | afecções e chance no acerto, outros, auras, maldições e reserva | parcial | aplicado | ficha | 1/3 |
| `22441` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `22628` | Rompe-amanhecer [Reliquarian] | ascendencia-comum | outros | funcional | aplicado | combate | 0/3 |
| `25795` | Chamas de Ngamahu [Reliquarian] | ascendencia-comum | penetração | parcial | aplicado | ficha | 0/1 |
| `26055` | A Divindade Despedaçada [Reliquarian] | ascendencia-comum | atributos (For/Des/Int) | parcial | validado | ficha | 2/2 |
| `27054` | Lâmina de Cinturão Verde [Reliquarian] | ascendencia-comum | efeito por evento, cargas e fúria | funcional-aproximado | aplicado | combate | 0/2 |
| `33467` | Vínculo de Kaom [Reliquarian] | ascendencia-comum | atributos (For/Des/Int) | parcial | aplicado | ficha | 0/1 |
| `35448` | Raízes de Kaom [Reliquarian] | ascendencia-comum | vida, regeneração e dreno de vida, velocidades, outros, atordoamento | parcial | aplicado | ficha | 1/5 |
| `35936` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `35989` | Mostruário de Pedrarias [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `36072` | Presa Sombria [Reliquarian] | ascendencia-comum | área e projéteis | parcial | aplicado | combate | 0/1 |
| `36489` | Mostruário de Armaduras [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `37303` | O Bastão Negro [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `40276` | Autoridade de Cadigan [Reliquarian] | ascendencia-comum | crítico, bloqueio | funcional | aplicado | combate | 0/3 |
| `43857` | Presa de Arakaali [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `47058` | Poder de Ahn [Reliquarian] | ascendencia-comum | precisão, cargas e fúria, crítico | funcional | aplicado | ficha | 2/3 |
| `48040` | Ambição de Veruso [Reliquarian] | ascendencia-comum | supressão de magia, afecções e chance no acerto, efeito por evento | funcional | aplicado | ficha | 2/3 |
| `48410` | Devastação Polárica [Reliquarian] | ascendencia-comum | afecções e chance no acerto, efeito por evento | funcional | aplicado | ficha | 2/3 |
| `52094` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `54569` | Presença de Chayula [Reliquarian] | ascendencia-comum | atordoamento, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/2 |
| `54928` | O Cálice Sagrado [Reliquarian] | ascendencia-comum | efeito por evento, conversão / dano extra | funcional | aplicado | combate | 0/4 |
| `56940` | A Apóstata [Reliquarian] | ascendencia-comum | outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/2 |
| `59067` | Fêmures dos Santos [Reliquarian] | ascendencia-comum | bloqueio, velocidades, vida, regeneração e dreno de vida, mana e custo | funcional | interpretado | condicional | 0/5 |
| `60582` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `1945` | Infusão Mística [Assassin] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `4242` | Infusão Instável [Assassin] | ascendencia-notavel | crítico, cargas e fúria | funcional | aplicado | ficha | 1/3 |
| `6064` | Chance e Multiplicador de Crítico [Assassin] | ascendencia-comum | crítico | funcional | validado | ficha | 2/2 |
| `9014` | Chance e Multiplicador de Crítico [Assassin] | ascendencia-comum | crítico | funcional | validado | ficha | 2/2 |
| `12850` | Chance de Crítico, Duração da Carga de Poder [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | aplicado | ficha | 1/2 |
| `18335` | Na Jugular [Assassin] | ascendencia-comum | crítico, outros | funcional | aplicado | ficha | 0/3 |
| `19083` | Assassinar [Assassin] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | interpretado | condicional | 0/2 |
| `19598` | Entrega Tóxica [Assassin] | ascendencia-notavel | crítico, afecções e chance no acerto, efeito por evento | funcional | aplicado | ficha | 0/3 |
| `21192` | Toxinas Infundidas [Assassin] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/1 |
| `21264` | Apunhalada [Assassin] | ascendencia-comum | crítico, outros | funcional | aplicado | ficha | 1/3 |
| `23024` | Chance de Causar Golpe Crítico, Chance de Envenenamento [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `28782` | Andarilho da Névoa [Assassin] | ascendencia-notavel | efeito por evento, outros, crítico | funcional | aplicado | combate | 0/3 |
| `29844` | Sangue Sombreado [Assassin] | ascendencia-notavel | vida, regeneração e dreno de vida, outros | funcional | aplicado | combate | 0/5 |
| `33954` | Chance de Causar Golpe Crítico, Dano Mágico [Assassin] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 2/2 |
| `43215` | Chance de Golpes Críticos, Efeito Elusivo [Assassin] | ascendencia-comum | outros, crítico | funcional | aplicado | ficha | 1/2 |
| `46676` | Estilo de Assassinato [Assassin] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `47531` | Chance de Causar Golpe Crítico, Chance de Envenenamento [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `48239` | Mortífero [Assassin] | ascendencia-notavel | mana e custo, outros | parcial | aplicado | combate | 0/3 |
| `51402` | Chance de Causar Golpe Crítico, Vida [Assassin] | ascendencia-comum | vida %, crítico | funcional | validado | ficha | 2/2 |
| `55686` | Chance de Causar Golpe Crítico, Efeito de Marca [Assassin] | ascendencia-comum | outros, crítico | funcional | aplicado | ficha | 1/2 |
| `869` | Área de Efeito, Velocidade de Movimento [Saboteur] | ascendencia-comum | velocidades, área e projéteis | funcional | validado | ficha | 2/2 |
| `1953` | Área de Efeito, Velocidade de Arremessar Armadilhas e Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 1/3 |
| `5087` | Nascido nas Sombras [Saboteur] | ascendencia-notavel | dano % (aumentado e "mais"), auras, maldições e reserva, afecções e chance no acerto | parcial | aplicado | combate | 0/3 |
| `14103` | Risco Calculado [Saboteur] | ascendencia-notavel | crítico, dano % (aumentado e "mais") | parcial | aplicado | combate | 0/2 |
| `16212` | Área de Efeito, Velocidade de Arremesso de Armadilhas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 1/2 |
| `16940` | Ataque Cegante [Saboteur] | ascendencia-notavel | outros, vida, regeneração e dreno de vida | funcional | aplicado | combate | 0/4 |
| `25167` | Área de Efeito, Velocidade de Arremesso de Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 1/2 |
| `26446` | Área de Efeito, Velocidade de Arremesso de Armadilhas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 1/2 |
| `28535` | Crime Perfeito [Saboteur] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `38918` | Reação em Cadeia [Saboteur] | ascendencia-notavel | área e projéteis | parcial | aplicado | combate | 0/1 |
| `39834` | Especialista em Demolições [Saboteur] | ascendencia-notavel | auras, maldições e reserva, efeito por evento | funcional-aproximado | aplicado | combate | 0/2 |
| `41081` | Área de Efeito, Velocidade de Movimento [Saboteur] | ascendencia-comum | velocidades, área e projéteis | funcional | validado | ficha | 2/2 |
| `47366` | Área de Efeito, Velocidade de Arremesso de Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 1/2 |
| `47778` | Especialista em Bombas [Saboteur] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | aplicado | combate | 0/1 |
| `51462` | Como Relógio [Saboteur] | ascendencia-notavel | outros | parcial | aplicado | ficha | 0/1 |
| `57175` | Especialista de Estilhaços [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `62067` | Área de Efeito, Dano em Área [Saboteur] | ascendencia-comum | área e projéteis, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `63135` | Área de Efeito, Dano de Área [Saboteur] | ascendencia-comum | área e projéteis, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `64785` | Velocidade de Projétil, Dano de Projétil [Saboteur] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `64842` | Área de Efeito, Efeito de Cegamentos [Saboteur] | ascendencia-comum | área e projéteis, outros | funcional | aplicado | combate | 1/2 |
| `65085` | Velocidade de Projétil, Dano de Projétil [Saboteur] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `2336` | Evasão e Escudo de Energia, Dreno de Escudo de Energia [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia | funcional | aplicado | combate | 2/3 |
| `13219` | Evasão e Escudo de Energia, Dano [Trickster] | ascendencia-comum | dano % (aumentado e "mais"), armadura e evasão, escudo de energia | funcional | validado | ficha | 3/3 |
| `19587` | Evasão e Escudo de Energia, Velocidade de Movimento [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 3/3 |
| `23225` | Um Passo a Frente [Trickster] | ascendencia-notavel | velocidades, auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `28884` | Parada Cardíaca [Trickster] | ascendencia-notavel | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/2 |
| `29825` | Arte do Escape [Trickster] | ascendencia-notavel | armadura e evasão, escudo de energia | funcional | aplicado | combate | 0/2 |
| `32947` | Assassino Hábil [Trickster] | ascendencia-notavel | afecções e chance no acerto, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `35598` | Evasão e Escudo de Energia, Velocidade de Ataque e Conjuração [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 4/4 |
| `37191` | Evasão e Escudo de Energia, Duração de Cargas de Frenesi [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `41891` | Quebra-Feitiço [Trickster] | ascendencia-notavel | supressão de magia, efeito por evento | funcional | aplicado | combate | 0/2 |
| `48999` | Bebedor de Almas [Trickster] | ascendencia-notavel | escudo de energia | funcional | validado | combate | 2/2 |
| `55867` | Polímata [Trickster] | ascendencia-notavel | dano % (aumentado e "mais"), vida, regeneração e dreno de vida, efeito por evento, mana e custo | funcional | interpretado | condicional | 0/4 |
| `58454` | Evasão e Escudo de Energia, Recarga do Escudo de Energia [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia | funcional | validado | ficha | 3/3 |
| `63908` | Evasão e Escudo de Energia, Velocidade de Movimento [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 3/3 |
| `3458` | Marechal da Divindade [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `4494` | Cruzada Radiante [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5929` | Efeito da Chama Santificada [Guardian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `16745` | Armadura e Escudo de Energia, Dano do Lacaio [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, lacaios e totens | funcional | validado | combate | 3/3 |
| `19641` | Cruzada Implacável [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `20050` | Armadura e Escudo de Energia, Efeito de Aura [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `32364` | Armadura e Escudo de Energia, Regeneração de Vida [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `32992` | Armadura e Escudo de Energia, Recuperação do Bloqueio [Guardian] | ascendencia-comum | bloqueio, armadura e evasão, escudo de energia | funcional-aproximado | validado | combate | 3/3 |
| `37419` | Armadura e Escudo de Energia, Efeito de Aura [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `39728` | Baluarte da Esperança [Guardian] | ascendencia-notavel | bloqueio | funcional-aproximado | interpretado | condicional | 0/2 |
| `40010` | Armadura e Escudo de Energia, Dano do Lacaio [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, lacaios e totens | funcional | validado | combate | 3/3 |
| `42264` | Fé Radiante [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `46952` | Armadura e Escudo de Energia, Efeito de Bônus de Altar [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, outros | funcional | aplicado | combate | 2/3 |
| `55146` | Hora da Necessidade [Guardian] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/2 |
| `61372` | Harmonia do Propósito [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `64768` | Fé Inabalável [Guardian] | ascendencia-notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `922` | Orientação Divina [Hierophant] | ascendencia-notavel | mana %, dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/3 |
| `1105` | Busca da Fé [Hierophant] | ascendencia-notavel | lacaios e totens, velocidades | funcional | aplicado | combate | 1/3 |
| `11046` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `14870` | Regeneração de Mana, Velocidade de Posicionamento de Totem [Hierophant] | ascendencia-comum | mana e custo, velocidades | funcional | aplicado | ficha | 1/2 |
| `22637` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `25651` | Convicção de Poder [Hierophant] | ascendencia-notavel | cargas e fúria | funcional | aplicado | ficha | 2/4 |
| `26714` | Regeneração de Mana, Velocidade de Posicionamento de Totem [Hierophant] | ascendencia-comum | mana e custo, velocidades | funcional | aplicado | ficha | 1/2 |
| `29026` | Santuário do Pensamento [Hierophant] | ascendencia-notavel | mana e custo | parcial | aplicado | ficha | 0/2 |
| `29994` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `33167` | Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] | ascendencia-comum | mana e custo, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `34434` | Ritual do Despertar [Hierophant] | ascendencia-notavel | dano % (aumentado e "mais"), mana e custo, vida, regeneração e dreno de vida | funcional-aproximado | interpretado | condicional | 0/3 |
| `38387` | Regeneração de Mana, Dano da Runa [Hierophant] | ascendencia-comum | mana e custo, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40510` | Benção Arcana [Hierophant] | ascendencia-notavel | dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | combate | 0/2 |
| `44797` | Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] | ascendencia-comum | mana e custo, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `51492` | Sinal de Propósito [Hierophant] | ascendencia-notavel | cargas e fúria | parcial | aplicado | combate | 0/1 |
| `60462` | Devoção Iluminada [Hierophant] | ascendencia-notavel | afecções e chance no acerto, área e projéteis, vida, regeneração e dreno de vida | funcional | interpretado | condicional | 0/4 |
| `662` | Dano Elemental, Multiplicador de Crítico [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 4/4 |
| `3154` | Instrumentos de Justiça [Inquisitor] | ascendencia-notavel | crítico | funcional | aplicado | combate | 0/1 |
| `10635` | Dano Elemental, Regeneração de Vida [Inquisitor] | ascendencia-comum | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `13851` | Instrumentos do Fervor [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `19417` | Instrumentos da Virtude [Inquisitor] | ascendencia-notavel | dano % (aumentado e "mais") | funcional-aproximado | aplicado | combate | 0/2 |
| `27055` | Dano Elemental, Velocidade de Ataque e Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `32816` | Caminho Piedoso [Inquisitor] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/2 |
| `35739` | Dano Elemental, Ataque e Velocidade de Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `37486` | Dano Elemental, Multiplicador de Crítico [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 4/4 |
| `39790` | Santificar [Inquisitor] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/2 |
| `40059` | Presságio do Arrependimento [Inquisitor] | ascendencia-notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `43193` | Dano Elemental, Velocidade de Ataque e Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `48214` | Julgamento Inevitável [Inquisitor] | ascendencia-notavel | resistências | parcial | aplicado | combate | 0/1 |
| `53884` | Justa Providência [Inquisitor] | ascendencia-notavel | crítico, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `57222` | Dano Elemental, Regeneração de Vida [Inquisitor] | ascendencia-comum | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `60769` | Dano Elemental e Resistências [Inquisitor] | ascendencia-comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `258` | Arauto da Ruína [Elementalist] | ascendencia-notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
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
| `56461` | Suserano do Primordial [Elementalist] | ascendencia-notavel | lacaios e totens | parcial | aplicado | combate | 1/2 |
| `57197` | Coração da Destruição [Elementalist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `58998` | Dano Elemental, Efeito de Afecção de Raio [Elementalist] | ascendencia-comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 4/4 |
| `61259` | Gênio da Discórdia [Elementalist] | ascendencia-notavel | outros, mana e custo | funcional | aplicado | combate | 0/2 |
| `3554` | Gula por Essências [Necromancer] | ascendencia-notavel | escudo de energia, mana e custo, efeito por evento | funcional-aproximado | aplicado | combate | 0/4 |
| `5415` | Dano do Lacaio, Efeito de Aura [Necromancer] | ascendencia-comum | lacaios e totens, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `11490` | Portador da Infestação [Necromancer] | ascendencia-notavel | área e projéteis, lacaios e totens, dano % (aumentado e "mais") | funcional-aproximado | interpretado | condicional | 0/4 |
| `14603` | Barreira Óssea [Necromancer] | ascendencia-notavel | resistências, lacaios e totens, escudo de energia | funcional | aplicado | combate | 0/3 |
| `18309` | Dano de Lacaios, Duração de Habilidades [Necromancer] | ascendencia-comum | afecções e chance no acerto, lacaios e totens | funcional | validado | combate | 2/2 |
| `18574` | Dano de Lacaio, Mana [Necromancer] | ascendencia-comum | mana %, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23509` | Dano de Lacaio, Velocidade de Conjuração [Necromancer] | ascendencia-comum | velocidades, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23572` | Pacto Cadavérico [Necromancer] | ascendencia-notavel | velocidades | parcial | interpretado | condicional | 0/2 |
| `26298` | Vida e Dano de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `36017` | Comandante das Trevas [Necromancer] | ascendencia-notavel | resistências | parcial | validado | ficha | 3/3 |
| `39818` | Vida e Dano de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `48719` | Dama do Sacrifício [Necromancer] | ascendencia-notavel | afecções e chance no acerto | parcial | validado | combate | 1/1 |
| `54159` | Agressão Desmedida [Necromancer] | ascendencia-notavel | lacaios e totens, dano % (aumentado e "mais") | funcional | aplicado | combate | 0/2 |
| `55646` | Dano e Vida de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `60547` | Dano de Lacaios, Velocidade de Conjuração [Necromancer] | ascendencia-comum | velocidades, lacaios e totens | funcional | validado | ficha | 2/2 |
| `65153` | Força Sobrenatural [Necromancer] | ascendencia-notavel | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `5502` | Rito Profano [Occultist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `6728` | Escudo de Energia, Duração de Cargas de Poder [Occultist] | ascendencia-comum | escudo de energia, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `17018` | Escudo de Energia, Duração de Maldições [Occultist] | ascendencia-comum | escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `25309` | Presença Pútrida [Occultist] | ascendencia-notavel | resistências, dano % (aumentado e "mais"), outros | parcial | aplicado | ficha | 1/3 |
| `27096` | Farol do Além [Occultist] | ascendencia-notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/3 |
| `29161` | Escudo de Energia e Velocidade de Recarga do Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `31316` | Escudo de Energia, Dano de Caos [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 1/2 |
| `31344` | Autoridade Profana [Occultist] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `31984` | Escudo de Energia, Duração de Maldições [Occultist] | ascendencia-comum | escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `32417` | Escudo de Energia, Dano de Caos e Gelo [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 2/3 |
| `37127` | Florescer Profano [Occultist] | ascendencia-notavel | efeito por evento | funcional | aplicado | combate | 0/1 |
| `37492` | Bastião Vil [Occultist] | ascendencia-notavel | escudo de energia, atordoamento | funcional-aproximado | aplicado | combate | 0/3 |
| `43242` | Escudo de Energia, Dano de Gelo [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | validado | ficha | 2/2 |
| `47630` | Despertar Frígido [Occultist] | ascendencia-notavel | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 0/5 |
| `48124` | Escudo de Energia, Velocidade da Recarga de Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `50935` | Escudo de Energia, Velocidade da Recarga de Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `62504` | Poder Proibido [Occultist] | ascendencia-notavel | área e projéteis, dano % (aumentado e "mais"), outros, cargas e fúria | funcional | aplicado | ficha | 1/4 |
