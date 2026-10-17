# Árvore de passivas do PoE — o que falta e o que é parcial

Gerado por `game/tools/relatorio-arvore-poe.mjs` em 2026-10-17, a partir de `game/gamedata/itens-poe/arvore-poe.json` — o mesmo estado que o balão da árvore mostra em cada linha. Remontar a árvore (`node tools/montar-arvore-poe.mjs`, depois de mexer numa regra de `traducao.json`) atualiza o balão e este relatório juntos.

## Resumo

- Linhas: **6801** (nós, ascendências e opções das maestrias).
- ✓ Com efeito: **6003** — equivalente 1379, novo 4619, aproximado (parcial) 5.
- ✗ Sem efeito: **0** — na árvore principal 0, nas ascendências 0; sem regra de efeito (registrado) 0; habilidade/mecânica que falta no jogo 0; **0 estão nos blocos que o dono mandou implementar (12/10)**.
- – Não se aplica ao jogo: 33. Lembretes do PoE (entre parênteses, sem marca): 765.

## Implementado a pedido do dono (12/10)

| Bloco | Linhas com efeito agora | Sem efeito ainda | O que mudou no jogo |
|---|---:|---:|---|
| Modificadores de monstro e de mapa ligados (lote 2) | 71 | 0 | monstros que Cegam, Expõem, põem Sangue Corrompido, drenam vida e ganham cargas (modificadores de monstro); mapas com Cegar, Mutilar, Empalar, cargas por acerto, espinhos nos Raros e "Impossível Drenar"; o Golpe Crítico do monstro incendeia, congela e eletriza; o bloqueio do monstro contra Espada |
| Armadilhas e Minas plantadas (lote 3) | 41 | 0 | a gema de Armadilha/Mina planta no alvo; a Armadilha ativa com inimigo a 1 casa (dura 4 s, até 15); a Mina detona sozinha com você parado e inimigo perto, em sequência (dura 5 s, até 15); a magia em área do monstro destrói as plantadas |
| Runas presas ao inimigo (lote 4a) | 22 | 0 | a Runa (Brand) vincula ao inimigo e é Ativada a cada N segundos enquanto vinculada (5 s; solta, procura outro por 6 s); até 3 ativas, 1 por inimigo; o automático não reconjura com todas em campo |
| Vínculos (lote 4b) | 33 | 0 | as 6 gemas de Vínculo criadas: focam um jogador da party na sala (lacaios, com o nó), custam mana por segundo, quebram fora do alcance em 4 s e, se o alvo morre vinculado, você morre; os efeitos de cada uma (Fogo, bloqueio, menos dano e o seu Escudo, crítico, o seu Dreno no alvo) |
| Convocar o Aço (lote 5) | 26 | 0 | as gemas de Aço concedem o Convocar o Aço, automático: chama os empalamentos dos vivos e dos cadáveres a até 6 casas, reflete em volta de cada um o dano × os acertos que restavam e dá 1 Fragmento de Aço por empalamento; recarrega 4 Fragmentos a cada 0,5 s até 12; o Aço Perfurador, o Aço Violento e o Estraçalhador da Munição e a Balista gastam os Fragmentos como no PoE (mais projéteis, a divisão, a Proteção de Aço); a linha dos "Empalamentos removidos desta forma" é da remoção ao Acertar (a mesma opção da maestria), não do Convocar o Aço |
| Tinturas (lote 6) | 58 | 0 | as Tinturas criadas: caem (Normal, Mágica, Única), vão no cinto de frascos e ativam sozinhas em combate; ativas, põem Queima de Mana em você (1% da Mana máxima por segundo cada) e dão os mods delas nos ataques com Arma Corpo a Corpo; desativam com a mana acabando (ou abaixo do limite da regra), tiram a Queima de Mana e entram na recarga da base |
| Aliados de verdade (lote 7) | 26 | 0 | "Você e Aliados" vira a aura do nó (vale em você, nos companheiros da party na sala a até 3 casas e nos seus lacaios; a mesma aura de duas pessoas: a maior); "Auras das suas Habilidades concedem" entra por aura ligada; a Fortificação igual do Campeão; "aliado por perto" conta lacaios e a party; a Ichimonji nas auras |
| Mana reservada (lote 8) | 6 | 0 | Fé Radiante (Armadura e Escudo pela mana reservada, em você e nos aliados); Santuário do Pensamento (Área pela mana não reservada); Ego Supremo (as auras só em você, mais efeito pela reserva de cada uma, 40% mais reserva); o efeito do Frasco de Vida sai quando a vida não reservada enche (a regra do PoE), menos com a Mestre Cirurgiã — e o de mana passa a olhar a mana não reservada |
| Projéteis por projétil (lote 9) | 10 | 0 | cada projétil conta os inimigos que atravessou e as vezes que ricocheteou (o dano aumentado por cada um, somado aos outros aumentos); a difusão com a chance de um projétil a mais; o Caos extra nos que ricochetearam (a Presa Sombria); o Tiro Longo pela distância — e o dano pela distância (Animosidade Adjacente, Tiro Distante, Queima-Roupa) passa a valer também nas habilidades, não só no golpe básico |
| Lacaios (lote 10) | 2 | 0 | a Égide Necromântica passa os bônus do escudo aos lacaios (e tira a defesa da base de você); o golem morto volta sozinho em 4 s (o Suserano do Primordial); e a resistência a Fogo/Gelo/Raio dos lacaios, guardada e nunca lida, passa a valer no golpe |
| "Mais" e "menos" exatos (lote 11) | 13 | 0 | o "X% mais/menos" multiplica em vez de somar ao aumentado: a Área de Efeito (as habilidades, as auras, o Convocar o Aço), a Duração do Efeito de Habilidades (os buffs, os Vínculos, as Runas, a Proteção de Aço), a Vida Recuperada dos Frascos e o dano degenerativo das magias (o "mais" de verdade, o da Crueldade) |
| Correções das notas (lote 12) | 8 | 0 | o Efeito do Buff do Arauto Trovejante só nele (valia em todos os Arautos — e no único Cravo de Fidelitas); a Eficácia da Reserva dele (a gema está no jogo: o montador da árvore passou a carregar as gemas); A Apóstata (o nó e o único: o Escudo de Energia das armaduras vira Vida; o peitoral sem o Escudo da base); a Arte do Gladiador (a penalidade de movimento de peitorais e escudos ignorada); a Magia Sanguínea igual ao PoE (o "10% mais Vida" multiplica; a reserva de vida já existia, a nota estava errada); e o "Sem Dano Físico" dos únicos, que refazer a peça devolvia |
| Parciais exatos (lote 13) | 58 | 0 | os Clamores tiram todas as afecções de dano; o Frasco de Vida tira uma afecção não elemental (Sangramento ou Veneno) ao acaso; o Estandarte, qualquer uma ao acaso; a maldição que não é aura Cega só quem não estava amaldiçoado; o Mana por acerto só com a Garra na mão secundária; os prazos exatos ("nos últimos 10/2 segundos") e os frascos certos (de Vida, de Mana, os Utilitários Mágicos); a regeneração do Inspirador nos aliados na área do Estandarte e a do Ritual do Despertar nos totens; a Sobrecarga Elemental (40% mais dano elemental só na habilidade que causou um crítico nos últimos 8 s; as afecções nunca de crítico); o Avatar do Fogo (Gelo e Raio também viram Fogo, e só o Fogo causa dano); a Postura Inabalável (imune só a Atordoamento) |
| Parciais médios (lote 14) | 33 | 0 | a mana da Maestria de Mana volta ao longo do tempo (no clamor de Guarda); o dreno do "Dano de Ataques Físicos" só da parte física dos ataques (antes, de todo o dano — os anéis e amuletos com essa linha também); o "-X% extra" das Maestrias de Fogo/Gelo/Raio também na Exposição das gemas, das auras e dos Vínculos; o veneno "X% mais rápido" só no Veneno (antes, todas as afecções de dano); a Pândega (a marca do Orgulho nos inimigos, maior pelo efeito) |
| O Congelamento do PoE e a Geada (lote 15) | 1 | 0 | o Congelamento que você põe segue o dano de Gelo do acerto, como no PoE (60 ms por 1% da vida do monstro, até 3 s, × a Duração aumentada; abaixo de 0,3 s não congela — antes, 1,5 s fixos); a Geada do Juramento do Inverno (o acerto que falha em Congelar por duração curta: 10 s, acumula, +20% de Duração do Congelamento por Geada, sai ao Congelar); "Congela … como se causasse X% mais Dano" no dano da conta |
| Os altares do PoE (lote 16) | 2 | 0 | os 13 altares do sorteio do PoE (Aceleração, Brutal, Diamante, Ecoante, Sombrio, Impenetrável, Massivo, Reabastecimento, Resistência, Carregado e os Maiores Congelante, Eletrizante e Esquelético — as Novas e os Esqueletos pelas gemas do jogo); a Harmonia do Propósito (um altar ao acaso a cada 10 s, por 20 s) e o Gritos dos Dessecados (o Altar Impenetrável sem frascos ativos); o efeito e a duração dos buffs de altar das peças |
| O Warden (lote 17) | 9 | 0 | a Pele de Árvore (a Casca: +1 por segundo sem ser Acertado por um Ataque Recentemente, -1 por Ataque que acerta, até 10; -60 de Dano Físico dos Acertos de Ataque por Casca, 4% mais chance de Evadir por Casca abaixo do máximo); a Lição das Estações (-25 de cada tipo de dano dos Acertos de Magia por Casca, +3% do Dano Mágico Suprimido Impedido por Casca abaixo do máximo, -1 Casca por Dano Mágico); o Avatar Liberto (Fúria Liberta pelas Afecções Elementais; com 100, Liberto por 10 s: sempre Congela, Eletriza e Incendeia, 100% mais Dano Elemental) — as habilidades saem sozinhas; e o HUD mostra os buffs do PoE por nome, a Casca e a Fúria Liberta |
| O Guardian (lote 18) | 7 | 0 | a Chama Santificada (o acerto corpo a corpo a põe — 6 s, +1 Chama; o ATAQUE de um aliado — o companheiro da party ou o lacaio, até o seu — ganha 25% do Físico como Fogo extra e a tira; quem pôs ganha 10% do Físico como Raio extra por Chama removida recentemente, até 80%; a intensidade aumentada); o Sentinela do Resplendor (sai sozinho, segue você, ataca corpo a corpo, queima a até 2 casas — 20% da vida dele por segundo, como Fogo —, volta 0,75 s depois de morrer; 20% do dano dos acertos sofrido na vida dele antes da sua); a Relíquia Elemental (25% de chance quando você ou um aliado perto mata ou acerta um Raro/Único; 5 s com a aura Cólera, Ódio ou Ira nível 20 em você e nos aliados perto; a do mesmo elemento só renova; explode ao acabar); o Ódio passa a dar o "Físico como Gelo extra" dele |
| A árvore principal (lote 19) | 13 | 0 | o Poder Arcano (o "Dano Mágico aumentado" também nos ataques, no % dele — a Maestria de Varinhas com varinha e os únicos); Profanar e Desenterrar criam cadáveres (5 dos monstros da área / 1 Arqueiro de Ossos onde o projétil cai, até 10 de cada gema, +2 com o Coveiro); o Infestador (sai sozinho na barra: Incubando, 40% do dano esperado de cada Veneno no Valor da Praga — até o máximo do nível, × o "Valor Máximo aumentado" — e 20% menos Veneno fora do máximo; no máximo com um inimigo perto, Infesta: 12% do Valor do começo por segundo como Caos a até 2 casas, até acabar); o Feiticeiro (liga na barra reservando 20% da mana por magia ligada — com a eficácia da maestria —; o ataque de varinha ativa as magias ligadas, com o dano da varinha e o "menos dano" do nível, recarga 0,6 s ÷ a recuperação) |
| Égide e as pequenas (lote 20) | 7 | 0 | a Égide Primitiva do Elementalist (toma o dano de Fogo, Gelo e Raio dos acertos antes do Escudo e da Vida, 75 por Notável alocado; volta cheia 10 s depois do último dano elemental) — e as 5 Égides dos únicos pelo mesmo caminho, desligadas pela Primitiva; a Infusão Mística do Assassin (o crítico mágico Bifurca: duas rolagens, as duas dobram o dano extra do crítico; 30% menos chance de crítico mágico); os Robôs Ativadores do Saboteur (dois robôs que não tomam dano; as Magias Ativadas saem duas vezes, a segunda sem recarga); a Infusão Espiritual do Occultist (ao canalizar uma magia, um acúmulo a cada 0,5 s, até 10: 15% de início mais rápido da Recarga do Escudo, 5% mais Dano e 10% mais Custo nas Magias Canalizadas por acúmulo) |
| O Reliquarian (lote 21) | 5 | 0 | a Rajada Vulcânica (no acerto corpo a corpo, 4 projéteis de magma em área, 200% do golpe, 60% em Fogo); o Grande Emissário das Direções (sai sozinho; a cada 6 s, +2 Projéteis, +2 Ricochetes, +2 Perfurações, Difundir duas vezes, ou todos); o Poder Fantasmal (o dano de cada Fantasma vivo nas suas magias físicas) com o suporte Convocar Fantasma, que passa a convocar (no golpe fatal e no Raro/Único, até o máximo, 15 s); Erguer Aranhas (ao matar, 2 aranhas por cadáver perto, até 20, 30 s, +2% de Velocidade de Ataque e +15% de Dano com Veneno cada); Suspender no Tempo (a terceira Miragem solta as magias que as criaram, com menos dano) — e os únicos que dão essas habilidades |
| As que "não se aplicavam" — o lote rápido (lote 25) | 8 | 0 | o Pacto Cadavérico (os cadáveres de Profanar e Desenterrar dos últimos 4 s Resfriam e Eletrizam os inimigos a até 3 casas); o Alcance do Ricochete (a distância do salto); os projéteis que Retornam, Ricocheteiam no terreno (um ricochete a mais), vão em direções aleatórias (inimigos sorteados) e a barragem que não se propaga (toda no alvo); o Golpe que também mira o local anterior (mais um inimigo perto) |
| O mercenário do Luminary (lote 26) | 18 | 0 | o mercenário permanente (sai sozinho: a sua vida máxima, o golpe da sua arma; volta em 10 s); a vida e o dano dele, o "8% mais Dano por único" (os seus únicos nos tipos de peça liberados), o guarda-costas (20% do dano dos acertos nele com a vida dele maior; 40% do dano dele recuperado com ela menor), o provocar, as suas auras nele (+50%), o Vínculo nele (o Juramento: a morte dele não leva você) e os Vínculos com duração infinita |
| Os encaixes de joia (lote 27) | 2 | 0 | os 21 encaixes da árvore (15 Básicos e os 6 Grandes da borda) recebem as Joias Carmesim, Viridiana e Cobalto (e a Prismática, só Única), que passam a cair; com o encaixe alocado, os mods da joia valem como os de uma peça; o Chieftain (Ngamahu): com joia não única, os aumentos de Dano Físico, de Gelo, de Raio e de Caos dos nós alocados no Raio Grande (1800, como no PoE/PoB — lote 29) viram de Fogo e cada nó pequeno ou notável dá +4 de Força |
| Zerar a árvore — lote 30 (as contas e regras erradas) | 26 | 0 | a Precisão da Destreza passa a 3 por ponto (somava +3 em cima dos 2); "X% mais Dano de Caos/Gelo" só na parte daquele tipo; "Debuffs em você expiram X% mais rápido" = a duração ÷ (1 + X%) em todo debuff (afecções, maldições, os dos monstros); "menos Dano Físico Sofrido" multiplicativo; o Vento Favorável dá 8% de Velocidade de Ação; a Parada Cardíaca alterna (consecutivamente) os 5 s de menos dano de Acertos e os 5 s de menos dano Degenerativo; a Guarda do Vento e o "+0,75% de Chance de Crítico" já eram a conta do PoE (a nota estava errada) |
| Zerar a árvore — lote 31 (o abate de quem, as explosões, o Clamor, o golpe básico) | 10 | 0 | o abate é de quem deu o golpe fatal (o do lacaio e o do totem não dão o "ao Matar" nem o "Matou Recentemente" seus — dão os eventos deles e a Relíquia Elemental); o "ao Matar Corpo a Corpo" é o golpe fatal corpo a corpo; "Provocados por seus Clamores" só o do Clamor (a explosão, morto por qualquer um); as explosões com o tipo de dano da linha, pela defesa dos atingidos; o atordoamento "como se causasse mais Dano de Fogo" só na parte de Fogo; a Força Concussiva, o Azarado e a penetração no não crítico também no golpe básico; o adicional por Empalamento do Mestre do Metal entra no golpe como Físico adicional, com os aumentos |
| Zerar a árvore — lote 32 (o resto da lista A) | 20 | 0 | todo o "aumentado" de Armadura resolvido (o condicional também) na Recarga do Escudo; as Oferendas em você por inteiro (Conjuração, Movimento, bloqueio de Magia; a regeneração da Óssea só se bloqueou há pouco); o Dançarino do Vento 20% MENOS dano de Ataque (também no projétil do monstro); o teto de 50% em toda redução; as Forças Profanadas ao amaldiçoar, com a duração cheia; o Vínculo Ancestral também na Praga e no Aço; "não se moveu nos últimos N s"; os segundos seguidos sob um Buff de Clamor; o Desafio antes do acerto, da Vida não reservada; o Ritual da Ruína por Fúria, só enquanto ela não cai; o piso do movimento em toda redução; o Solo Sagrado do Inquisidor de 8 s; o adicionado às magias de todo tipo (Mago de Batalha); a Convergência só no Elemental; o Gladiador, o Bastião Vil e a Guarda do Vento já eram a conta do PoE/PoB |
| Zerar a árvore — lote 33 (os primeiros sistemas B) | 19 | 0 | o "Efeito de Afecções Não-Danificadoras" também no Causticar, no Fragilizar e no Exaurir (o bloqueio, a chance no acerto, a aura, o Segredos do Sofrimento, a Causticação do Warden); as rampas de distância do Path of Building (35 → 70 unidades; 1 casa = 2 m = 20) no crítico das flechas, no Tiro Longo, no Tiro Distante do Deadeye e na Animosidade Adjacente; a Queima-Roupa pela tabela do poedb; o Impacto pela proximidade do PoB (o máximo até 15 unidades, 0 em 40 — o vizinho colado, a 20, dá 80%); o Elusivo perde 20% de efeito por segundo (começa no efeito cheio, com o aumentado) e não se ganha outro enquanto há um |
| Zerar a árvore — lote 34 (as Minas plantadas e a Velocidade dos Clamores) | 17 | 0 | a Velocidade dos Clamores encurta o tempo de uso do Clamor (e a de Conjuração não vale nele — o Clamor não é ataque nem magia); a aura da Mina plantada nos inimigos a até 35 unidades (3,5 m, 1 casa), cada Mina somando até o teto ("Efeito de Auras das Minas" na de cada uma, não no teto; o "reduzido" é o dano que o inimigo causa); "por cada Mina Detonada Recentemente, até 100%/40%" pela detonação de verdade, nos últimos 4 s |
| Zerar a árvore — lote 35 (o alcance em metros e o bloqueio, pelas decisões do dono) | 33 | 0 | o alcance corpo a corpo em metros (a decisão "Medir em metros", 1 casa = 2 m): o da arma (a base do PoE, 1 a 1,4 m) + os "+X metros", o vizinho colado sempre ao alcance e cada casa a mais pedindo 2 m — no golpe básico e no golpe da gema corpo a corpo; a Recuperação de Bloqueio trava em todo bloqueio (a decisão "Como no PoE: todo bloqueio") |
| Zerar a árvore — lote 36 (a Área de Efeito em metros, pela decisão do dono) | 8 | 0 | a Área de Efeito como no PoE (a decisão "Toda área em metros"): o raio da forma × √(1 + o aumentado) × √ de cada "mais/menos", a fração como chance de uma casa, e a forma esticada até o raio novo; a Repetição Final soma o X no aumentado da última repetição |
| Zerar a árvore — lote 37 (o Mercenário completo, pelas decisões do dono) | 17 | 0 | o Mercenário completo (as decisões do dono): candidatos sorteados contratados por ouro (até 3, um ao seu lado), o nível preso no da contratação, o equipamento dele com as regras do PoE (70% do nível da peça, os atributos e as armas do arquétipo, únicos só nos tipos que os nós liberam), a ficha dele com o "aumentado" dos seus nós, as gemas fixas do arquétipo na caçada, morto só volta revivido por ouro; o "recuperado como vida" em 4 s |
| Zerar a árvore — lote 39 (a aura do mercenário e as gemas dele em área, pela decisão do dono) | 1 | 0 | a aura do arquétipo do mercenário (a decisão do dono "Uma aura por arquétipo": espadachim Precisão, bárbaro Determinação, arqueiro Graça, piromante Cólera, criomante Ódio, eletromante Ira) no nível dele, × o efeito da linha — vale nele e em você enquanto ele vive (a ficha e os efeitos; com a mesma aura sua, vale a sua); e as gemas dele acertam como a gema: a área, os saltos e os projéteis |
| Zerar a árvore — lote 40 (as decisões do dono: os raios registrados e o ricochete do PoE 2) | 15 | 0 | os raios que o PoE não publica viram exceções registradas ("Manter e registrar": os baús a até 4 casas, os "Próximos" a até 2 casas, a Furtividade ÷ (1 + X%)); o salto do ricochete das gemas do PoE pelo PoE 2 ("Ricochete pelo PoE 2": 6 m no projétil, 4 m nas outras cadeias, × o aumento em metros) |
| Zerar a árvore — lote 41 (os limites do motor: as áreas frias, o local anterior do Golpe, as magias nos lacaios) | 4 | 0 | as ÁREAS FRIAS das suas gemas de frio (o Solo Gelado: dentro, Resfriado 10% — a Geada Cortante lê); a Fúria Ancestral acerta quem está no local do uso anterior do Golpe; as MAGIAS dos monstros vão no lacaio mais perto deles que você, e o bloqueio mágico do lacaio vale (o golpe corpo a corpo do conjurador é ataque) |
| Zerar a árvore — lote 42 (os limites do motor: a canalização contínua, as direções aleatórias, o terreno) | 3 | 0 | a CANALIZAÇÃO CONTÍNUA (a mesma habilidade de Canalização usada em seguida continua o canalizar; outra interrompe — a Infusão Espiritual a cada 0,5 s canalizando); as DIREÇÕES ALEATÓRIAS (todos os projéteis saem em direções sorteadas e acertam o primeiro do caminho); o TERRENO (o projétil que erra e bate numa casa que não se anda ricocheteia, na chance, para o inimigo mais perto da batida) |
| Zerar a árvore — lote 43 (a Égide Necromântica: as defesas e os outros bônus do escudo nos lacaios) | 1 | 0 | as DEFESAS do escudo nos lacaios (a armadura, a evasão e o escudo de energia da base, com o "+X" e o "aumentado" do próprio escudo; a armadura no golpe pela conta do PoE, a evasão contra o ataque, a supressão contra a magia), a vida fixa, a redução física, o bloqueio aumentado, o dano mágico e o do elemento, o evitar afecções, o reflexo físico e a recarga do escudo |
| Zerar a árvore — lote 44 (os lacaios pelo Path of Building: o Sentinela, as Relíquias, as Aranhas, o Poder Fantasmal; a Égide Primitiva; os Robôs) | 6 | 0 | a vida, o golpe, o tempo de ataque, o escudo de energia, a armadura e as resistências dos lacaios pelo PoB (a tabela de aliados × o multiplicador do tipo — `gamedata/itens-poe/pob-lacaios.json`); o Poder Fantasmal pelo nível do suporte; o veneno das Aranhas em 4 s; a Égide Primitiva volta em 5 s; as magias ativadas saem do lugar de cada Robô, que corre até os inimigos |
| Zerar a árvore — lote 45 (a Rajada Vulcânica com o crítico e a área; o Detonar Minas com a recarga de 0,2 s) | 6 | 0 | a Rajada Vulcânica rola o crítico do ataque em cada acerto e a área de cada queda cresce com a "Área de Efeito aumentada"; o Detonar Minas automático respeita a recarga de 0,2 s; os raios que o PoE não publica e o uso automático, registrados como exceção do dono |

## Sem efeito (✗), pelo motivo

| Linhas | Motivo | Bloco a implementar (dono, 12/10) | Exemplos (nó — texto) |
|---:|---|---|---|

## Parcial (aproximado, ✓ com diferença do PoE), pelo motivo

| Linhas | A diferença | Exemplos (nó — texto) |
|---:|---|---|
| 2 | cada 100% é uma casa a mais; o resto, a chance de mais uma | Distância do Empurrão (nó) — Distância do Empurrão aumentada em 25% |
| 1 | a habilidade sai sozinha (o jogo usa as habilidades sozinho): o Emissário imortal segue você e, a cada 6 s, lança em você um buff de 6 s com um ao acaso — +2 Projéteis, +2 Ricochetes, Perfuram +2 alvos, ou Difundem e Difundem de novo — ou todos (1 em 5); o PoE não publica a frequência nem a duração do buff | A Divindade Despedaçada (asc. Reliquarian) — Concede a Habilidade Convocar Grande Emissário das Direções |
| 1 | as Novas e os Esqueletos dos altares Maiores saem como as gemas Nova Glacial, Nova Elétrica e Convocar Esqueleto nível 20, a cada 2 s (4 s os Esqueletos) — o PoE não publica o dano nem a frequência; o resto dos 13 altares, igual ao PoE | Harmonia do Propósito (asc. Guardian) — Ganha um buff de altar aleatório a cada 10 segundos |
| 1 | os bônus do escudo vão para os lacaios — o bloqueio (e o aumentado), as resistências, a vida (% e fixa), as DEFESAS da base (armadura, evasão e escudo de energia, com os do próprio escudo), a supressão, a redução física, o dano (o mágico no que conjura, o do elemento), as velocidades, o crítico, a regeneração, o movimento, o dreno, o evitar afecções, o reflexo físico e a recarga do escudo; o que o lacaio do jogo não tem — mana, atributos, precisão (ele não erra), atordoamento e recuperação de bloqueio, o crítico dos monstros nele, o máximo de UMA resistência, os efeitos ao bloquear — sai de você sem ir a ninguém | Égide Necromântica (keystone) — Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você |

## As joias dos encaixes da árvore (lotes 27 a 29)

- **Encaixes**: os 21 da árvore (15 Básicos e os 6 Grandes da borda); os Médios e Pequenos são das Ramificadoras. Raio na árvore como no PoE/PoB: Pequeno 960, Médio 1440, Grande 1800 (o Fio de Esperança em anéis).
- **Joias que caem**: Carmesim, Viridiana e Cobalto (Normal, Mágica, Rara e Única), a Prismática (só Única) e os 4 Olhos Abissais (nos encaixes da árvore e nos Encaixes Abissais das peças).
- **Mods das joias Carmesim/Viridiana/Cobalto/Prismática** (prefixos e sufixos, pelo peso de sorteio): 100% com efeito.
- **Mods das joias Abissais** (prefixos e sufixos, pelo peso de sorteio): 100% com efeito.
- **Linhas sorteadas** (o pool de cada única no poedb — `linhas-sorteadas.json`): Personalidade Dividida 9/9 com efeito · O Equilíbrio do Terror 18/18 com efeito · Olho do Vigia 79/87 com efeito (8 não se aplicam: as Fendas e os Grilhões Temporais não existem no jogo; os solos (ardente, sagrado, fúngico…) não existem no jogo) · Visão Sublime 17/17 com efeito · Limitado pelo Destino 54/54 com efeito · Fé Militante 15/16 com efeito (1 não se aplicam: não se aplica ao jogo: o golpe dos lacaios não erra (não rola a Precisão contra a Evasão do monstro)).

| Únicas | Linhas | ✓ Com efeito | – Lembrete / não se aplica | ✗ Sem efeito |
|---|---:|---:|---:|---:|
| Carmesim, Viridiana, Cobalto e Prismática (94) | 238 | 195 | 43 | 0 |
| Abissais (os 4 Olhos) (4) | 11 | 9 | 2 | 0 |
| Atemporais (6) | 19 | 8 | 11 | 0 |
| Ramificadoras (12) | 24 | 0 | 6 | 18 |

### As linhas dos nós das Ramificadoras (lote 63)

A joia gerada cria os nós dela na árvore: as pequenas concedem o encantamento e os "também concedem" da peça; os notáveis, os efeitos deles (a árvore 3.29 do poedb). As linhas pelo tradutor da árvore.

| Linhas | Total | ✓ Com efeito | – Lembrete / não se aplica | ✗ Sem efeito |
|---|---:|---:|---:|---:|
| Encantamentos (as pequenas) | 56 | 51 | 0 | 5 |
| "Também concedem" (as pequenas) | 160 | 75 | 0 | 85 |
| Notáveis | 685 | 465 | 1 | 219 |

<details><summary>As linhas sem efeito</summary>

- Medium Cluster Jewel: Dano de Caos Degenerativo — Dano de Caos Degenerativo aumentado em 12%
- Medium Cluster Jewel: Dano Físico Degenerativo — Dano Físico Degenerativo aumentado em 12%
- Medium Cluster Jewel: Dano de Gelo Degenerativo — Dano Degenerativo de Gelo aumentado em 12%
- Medium Cluster Jewel: Dano enquanto possuir um Arauto — Dano enquanto afetado por um Arauto aumentado em 10%
- Medium Cluster Jewel: Dano de Lacaio enquanto possuir um Arauto — Lacaios causam Dano aumentado em 10% enquanto você for afetado por um Arauto
- Robusta — +3 de Vida Máxima
- Saudável — +7 de Vida Máxima
- Sanguínea — +10 de Vida Máxima
- Berila — +5 de Mana Máxima
- Cobalto — +8 de Mana Máxima
- Índigo — +10 de Mana Máxima
- Brilhante — +5 de Escudo de Energia Máximo
- Cintilante — +9 de Escudo de Energia Máximo
- Radiante — +12 de Escudo de Energia Máximo
- da Núvem — +2 de Todos os Atributos
- do Céu — +3 de Todos os Atributos
- do Meteoro — +4 de Todos os Atributos
- do Tritão — Regenera 0.1% de Vida por Segundo
- do Lagarto — Regenera 0.15% de Vida por Segundo
- do Platelminto — Regenera 0.2% de Vida por Segundo
- Robusta — +13 de Vida Máxima
- Corpulenta — +16 de Vida Máxima
- Safira — +13 de Mana Máxima
- Cerúlea — +16 de Mana Máxima
- Radiante — +16 de Escudo de Energia Máximo
- Pulsante — +20 de Escudo de Energia Máximo
- do Cometa — +5 de Todos os Atributos
- dos Céus — +6 de Todos os Atributos
- do Peixe Estrela — Regenera 0.25% de Vida por Segundo
- da Hidra — Regenera 0.3% de Vida por Segundo
- AfflictionJewelSmallPassivesGrantAuraAreaOfEffect__ — Área de Efeito das Habilidades de Aura aumentado em 2%
- AfflictionJewelSmallPassivesGrantAuraAreaOfEffect2 — Área de Efeito das Habilidades de Aura aumentado em 4%
- AfflictionJewelSmallPassivesGrantAuraAreaOfEffect3 — Área de Efeito das Habilidades de Aura aumentado em 6%
- AfflictionJewelSmallPassivesGrantCurseAreaOfEffect — Efeito de Habilidades Feitiço aumentado em 1%
- AfflictionJewelSmallPassivesGrantCurseAreaOfEffect2 — Efeito de Habilidades Feitiço aumentado em 2%
- AfflictionJewelSmallPassivesGrantCurseAreaOfEffect3 — Efeito de Habilidades Feitiço aumentado em 3%
- AfflictionJewelSmallPassivesGrantWarcryDuration — Duração do Clamor aumentada em 2%
- AfflictionJewelSmallPassivesGrantWarcryDuration2 — Duração do Clamor aumentada em 3%
- AfflictionJewelSmallPassivesGrantWarcryDuration3 — Duração do Clamor aumentada em 4%
- AfflictionJewelSmallPassivesGrantCriticalStrikeMultiplier — +1% de Multiplicador de Golpes Críticos
- AfflictionJewelSmallPassivesGrantCriticalStrikeMultiplier2_ — +2% de Multiplicador de Golpes Críticos
- AfflictionJewelSmallPassivesGrantCriticalStrikeMultiplier3 — +3% de Multiplicador de Golpes Críticos
- AfflictionJewelSmallPassivesGrantMinionLifeRegen — Lacaios Regeneram 0.1% de Vida por Segundo
- AfflictionJewelSmallPassivesGrantMinionLifeRegen2 — Lacaios Regeneram 0.15% de Vida por Segundo
- AfflictionJewelSmallPassivesGrantMinionLifeRegen3 — Lacaios Regeneram 0.2% de Vida por Segundo
- AfflictionJewelSmallPassivesGrantProjectileSpeed — Velocidade de Projétil aumentada em 2%
- AfflictionJewelSmallPassivesGrantProjectileSpeed2 — Velocidade de Projétil aumentada em 3%
- AfflictionJewelSmallPassivesGrantProjectileSpeed3 — Velocidade de Projétil aumentada em 4%
- AfflictionJewelSmallPassivesGrantTrapAndMineSpeed_ — Velocidade de Arremesso de Armadilha e Mina aumentada em 1%
- AfflictionJewelSmallPassivesGrantTrapAndMineSpeed2 — Velocidade de Arremesso de Armadilha e Mina aumentada em 2%
- AfflictionJewelSmallPassivesGrantTrapAndMineSpeed3_ — Velocidade de Arremesso de Armadilha e Mina aumentada em 3%
- AfflictionJewelSmallPassivesGrantTotemPlacementSpeed — Velocidade de Posicionamento de Totem aumentada em 1%
- AfflictionJewelSmallPassivesGrantTotemPlacementSpeed2 — Velocidade de Posicionamento de Totem aumentada em 2%
- AfflictionJewelSmallPassivesGrantTotemPlacementSpeed3 — Velocidade de Posicionamento de Totem aumentada em 3%
- AfflictionJewelSmallPassivesGrantBrandAttachmentRange_ — Alcance de Vínculo de Marcas aumentado em 1%
- AfflictionJewelSmallPassivesGrantBrandAttachmentRange2 — Alcance de Vínculo de Marcas aumentado em 2%
- AfflictionJewelSmallPassivesGrantBrandAttachmentRange3____ — Alcance de Vínculo de Marcas aumentado em 3%
- AfflictionJewelSmallPassivesGrantChannelledAttackAndCastSpeed — Habilidades Canalizadas têm Velocidade de Ataque e Conjuração aumentada 1%
- AfflictionJewelSmallPassivesGrantChannelledAttackAndCastSpeed2 — Habilidades Canalizadas têm Velocidade de Ataque e Conjuração aumentada 2%
- AfflictionJewelSmallPassivesGrantChannelledAttackAndCastSpeed3 — Habilidades Canalizadas têm Velocidade de Ataque e Conjuração aumentada 3%
- AfflictionJewelSmallPassivesGrantFlaskChargesGained — Cargas de Frasco ganhadas aumentadas em 1%
- AfflictionJewelSmallPassivesGrantFlaskChargesGained2_ — Cargas de Frasco ganhadas aumentadas em 2%
- AfflictionJewelSmallPassivesGrantFlaskChargesGained3 — Cargas de Frasco ganhadas aumentadas em 3%
- AfflictionJewelSmallPassivesGrantFireSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades de Fogo aumentada em 1%
- AfflictionJewelSmallPassivesGrantFireSkillAttackAndCastSpeed2 — Velocidade de Ataque e Conjuração com Habilidades de Fogo aumentada em 2%
- AfflictionJewelSmallPassivesGrantFireSkillAttackAndCastSpeed3_ — Velocidade de Ataque e Conjuração com Habilidades de Fogo aumentada em 3%
- AfflictionJewelSmallPassivesGrantColdSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades de Gelo aumentada em 1%
- AfflictionJewelSmallPassivesGrantColdSkillAttackAndCastSpeed2_ — Velocidade de Ataque e Conjuração com Habilidades de Gelo aumentada em 2%
- AfflictionJewelSmallPassivesGrantColdSkillAttackAndCastSpeed3 — Velocidade de Ataque e Conjuração com Habilidades de Gelo aumentada em 3%
- AfflictionJewelSmallPassivesGrantLightningSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades de Raio aumentada em 1%
- AfflictionJewelSmallPassivesGrantLightningSkillAttackAndCastSpeed2 — Velocidade de Ataque e Conjuração com Habilidades de Raio aumentada em 2%
- AfflictionJewelSmallPassivesGrantLightningSkillAttackAndCastSpeed3 — Velocidade de Ataque e Conjuração com Habilidades de Raio aumentada em 3%
- AfflictionJewelSmallPassivesGrantChaosSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades de Caos aumentada em 1%
- AfflictionJewelSmallPassivesGrantChaosSkillAttackAndCastSpeed2____ — Velocidade de Ataque e Conjuração com Habilidades de Caos aumentada em 2%
- AfflictionJewelSmallPassivesGrantChaosSkillAttackAndCastSpeed3 — Velocidade de Ataque e Conjuração com Habilidades de Caos aumentada em 3%
- AfflictionJewelSmallPassivesGrantPhysicalSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades Físicas aumentada em 1%
- AfflictionJewelSmallPassivesGrantPhysicalSkillAttackAndCastSpeed2 — Velocidade de Ataque e Conjuração com Habilidades Físicas aumentada em 2%
- AfflictionJewelSmallPassivesGrantPhysicalSkillAttackAndCastSpeed3_ — Velocidade de Ataque e Conjuração com Habilidades Físicas aumentada em 3%
- AfflictionJewelSmallPassivesGrantElementalSkillAttackAndCastSpeed — Velocidade de Ataque e Conjuração com Habilidades Elementais aumentada em 1%
- AfflictionJewelSmallPassivesGrantElementalSkillAttackAndCastSpeed2_ — Velocidade de Ataque e Conjuração com Habilidades Elementais aumentada em 2%
- AfflictionJewelSmallPassivesGrantElementalSkillAttackAndCastSpeed3_ — Velocidade de Ataque e Conjuração com Habilidades Elementais aumentada em 3%
- AfflictionJewelSmallPassivesGrantMinionAttackAndCastSpeed — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 1%
- AfflictionJewelSmallPassivesGrantMinionAttackAndCastSpeed2 — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 2%
- AfflictionJewelSmallPassivesGrantMinionAttackAndCastSpeed3 — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 3%
- AfflictionJewelSmallPassivesGrantHeraldAttackAndCastSpeed — Velocidade de Ataque e Conjuração aumentada em 1% enquanto você for afetado por um Arauto
- AfflictionJewelSmallPassivesGrantHeraldAttackAndCastSpeed2_ — Velocidade de Ataque e Conjuração aumentada em 2% enquanto você for afetado por um Arauto
- AfflictionJewelSmallPassivesGrantHeraldAttackAndCastSpeed3 — Velocidade de Ataque e Conjuração aumentada em 3% enquanto você for afetado por um Arauto
- AfflictionJewelSmallPassivesGrantHeraldMinionAttackAndCastSpeed — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 1% enquanto você for afetado por um Arauto
- AfflictionJewelSmallPassivesGrantHeraldMinionAttackAndCastSpeed2_ — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 2% enquanto você for afetado por um Arauto
- AfflictionJewelSmallPassivesGrantHeraldMinionAttackAndCastSpeed3 — Lacaios têm Velocidade de Ataque e Conjuração aumentada em 3% enquanto você for afetado por um Arauto
- Lorde da Seca — Flamabilidade pode afetar Inimigos a Prova de Feitiços
- Lorde da Seca — Dano com Incêndios infligidos em Inimigos Amaldiçoados aumentado em 30%
- Cadáveres Monstruosos — Zumbis Erguidos têm 5% de chance de Provocar Inimigos ao Acertar
- Queimado Vivo — Inimigos Incendiados por você têm -5% de Resistêcia a Fogo
- Parede Conjurada — +8% de Chance de Bloquear Dano Mágico caso tenha Conjurado uma Magia Recentemente
- Cersidor de Selos — Habilidades Suportadas por Liberar têm frequência de ganho de Selo aumentada em 30%
- Limite — +15% de Multiplicador de Golpes Críticos com Garras ou Adagas
- Limite — 10% de chance de ganhar uma Carga de Poder em Golpes Não Críticos com uma Garra ou Adaga
- Espíritos Aprisionadores — Totens Desaceleram Inimigos próximos deles quando Convocados
- Elementos Corrosivos — Habilidades de Gelo têm chance de 25% de aplicar Exposição a Gelo ao Acertar
- Elementos Corrosivos — Habilidades de Fogo têm chance de 25% de aplicar Exposição a Fogo ao Acertar
- Elementos Corrosivos — Habilidades de Raio têm chance de 25% de aplicar Exposição a Raio ao Acertar
- Movimentação Marcial — Dano aumentado em 32% caso você tenha usado uma Habilidade de Deslocamento Recentemente
- Malícia Esmagadora — 10% de chance de ganhar Poder Profano por 4 segundos no Golpe Crítico
- Produzido para Potência — Recuperação de Vida e Mana de Frascos aumentada em 20%
- Vantagem do Peso — Ataques com Maça, Cetro ou Cajado causam Dano com Acertos e Afecções aumentado em 30%
- Vantagem do Peso — 4% de chance de causar Dano Dobrado enquanto portando uma Maça, Cetro ou Cajado
- Inspiração Líquida — 25% de chance de ganhar uma Carga de Poder quando usar um Frasco de Mana
- Abstinência  — Velocidade de Movimento aumentada em 10% enquanto não estiver sob Efeito de Frascos
- Projeção de Fardo — 8% de chance de Empurrar Inimigos ao Acertar com Dano Mágico
- Pura Agonia — +5 de Virulência Máxima
- Pura Agonia — Lacaios causam Dano aumentado em 20% enquanto você for afetado por um Arauto
- Infâmia Brutal — Dano com Acertos e Afecções contra Inimigos Únicos aumentado em 40%
- Grito Assustador — Inimigos Provocados por seus Clamores são Intimidados
- Demolir e Pilhar — Lacaios causam Dano com Acertos e Afecções aumentado em 20% contra Inimigos Incendiados
- Chamado Alarmante — Ganha Armadura aumentada em 25% por cada 5 de Poder por 8 segundos ao Clamar, máximo de 100%
- Tiro Arqueador — Flechas ganham Dano enquanto viajam adiante, causando Dano com Acertos em alvos aumentado em até 50%
- Égide Ardente — Chama Santificada infligida por você tem a intensidade aumentada em 1% por 2% de chance de bloquear ataques
- Mensageiro Sombrio — Habilidades de Arauto causam Dano aumentado em 20%
- Proteção Tolerante — +10% de Chance de Bloquear o Dano de Ataques enquanto no Máximo de Cargas de Tolerância
- Artista Sangrento — +6% de Multiplicador de Dano Físico Degenerativo se você Gastou Vida Recentemente
- Guarda-Costas — Lacaios têm 10% de chance de Empurrar Inimigos ao Acertar com Ataques
- Combatente Confiante — 1% de aumento de Dano por cada 1% de Chance de Bloquear o Dano de Ataques
- Atrofia Esqueletal — Esqueletos Convocados têm 10% de chance de Definhar Inimigos por 2 segundos ao Acertar
- Atrofia Esqueletal — Esqueletos Convocados possuem 30% do Dano Físico Convertido para Dano de Caos
- Assalto Poderoso — Habilidades em Área têm 10% de chance de Empurrar Inimigos ao Acertar
- Sofrimento Eterno — 50% de chance de infligir Definhar por dois segundos ao Acertar se houver 5 ou menos Debuffs de Definhar no Inimigo
- Domínio Assertivo — Efeito em Área aumentado em 25% caso você tenha Matado ao menos 5 Inimigos Recentemente
- Raios Barulhentos — 10% de chance de Provocar Inimigos ao Acertar com Projéteis
- Soberano — Dano com Maças, Cetros ou Cajados aumentado em 30%
- Soberano — Acertos Corpo a Corpo com Maças, Cetros ou Cajados Fortificam por 6 segundos _(a Fortificação não existe no jogo)_
- Restos Esfumaçados — 10% de chance de criar uma Núvem de Fumaça ao Matar
- Inspiração Ancestral — Ganhe Fúria Arcana ao Convocar um Totem
- Inspiração Ancestral — Magias conjuradas por Totens causam Dano aumentado em 25%
- Miséria Eterna — Desespero pode afetar Inimigos a Prova de Feitiços
- Miséria Eterna — Recupera 2% de Escudo de Energia quando você Matar um Inimigo Amaldiçoado
- Taumaturgo — Dano Mágico aumentado em 25% enquanto com Escudo de Energia Cheio
- Mestre do Medo — Inimigos Amaldiçoados por você são Enervados
- Maestria Marcial — Velocidade de Ataque aumentada em 10% caso você tenha ao menos 600 de Força
- Adepto Arcano — Velocidade de Ataque e Conjuração enquanto Canalizando aumentada em 5%
- Adepto Arcano — Ganhe Fúria Arcana após Canalizar por 1 segundo
- Apatia de Doedre — Grilhões Temporais pode afetar Inimigos a Prova de Feitiços _(as Fendas e os Grilhões Temporais não existem no jogo)_
- Apatia de Doedre — Inimigos Amaldiçoados por você são Enervados
- Garras Pútridas — Lacaios têm uma chance de 12% de Empalar ao Acertar com Ataques
- Líder do Culto — Lacaios causam Dano aumentado em 35% enquanto você for afetado por um Arauto
- Emissário Maximizado — Habilidades de Arauto causam Dano aumentado em 40%
- Demonstração Desorientadora — 10% de chance de Cegar Inimigos próximos ao usar uma Habilidade Elemental
- Tentando a Tormenta — Condutividade pode afetar Inimigos a Prova de Feitiços
- Tentando a Tormenta — Efeito de Eletrizações infligidas em Inimigos Amaldiçoados aumentado em 30%
- Impressões Duradouras — Dano Degenerativo aumentado em 30% enquanto afetado por um Arauto
- Impressões Duradouras — Habilidades de Arauto causam Dano Degenerativo aumentado em 50%
- Sem Testemunhas — 10% de chance de ganhar Elusivo ao Matar
- Dominador do Campo de Batalha — Efeito em Área aumentado em 15% caso você tenha Atordoado um Inimigo com uma Arma de Duas Mãos Corpo a Corpo Recentemente
- Despeito de Doedre — Debilitar pode afetar Inimigos a Prova de Feitiços
- Despeito de Doedre — Chance de Golpe Crítico contra Inimigos Amaldiçoados aumentada em 35%
- Hibernador — Você não pode ser Congelado se você foi Congelado Recentemente
- Hibernador — Inafetado por Solo Congelado _(os solos (ardente, sagrado, fúngico…) não existem no jogo)_
- Opressão Inspirada — Regeneração de Mana aumentada em 30% se você Congelou um Inimigo Recentemente
- Opressão Inspirada — Regeneração de Mana aumentada em 30% se você Eletrizou um Inimigo Recentemente
- Heroísmo Arcano — 10% de chance de ganhar Fúria Arcana ao Acertar um inimigo Único
- Fogo Lateral — Habilidades de Arco têm Área de Efeito aumentada em 25%
- Guerreiro Destemido — 25% de chance de Intimidar Inimigos próximos por 4 segundos ao Matar Corpo a Corpo
- Intransigente — Determinação tem Eficácia de Reserva de Mana aumentada em 50% _(esta variação da reserva ainda não tem efeito no jogo)_
- Capacitor — Você não pode ser Eletrizado se foi Eletrizado Recentemente
- Capacitor — Inafetado por Solo Eletrizado _(os solos (ardente, sagrado, fúngico…) não existem no jogo)_
- Sabotagem Surpresa — Dano da Armadilha Penetra 4% de Resistências Elementais
- Devastador — Inimigos mortos por seus Acertos de Ataques têm chance de 15% de Explodir, causando um décimo de sua vida máxima como Dano Físico
- Bebedor de Tormentas — 0.5% do Dano de Raio Drenado como Escudo de Energia
- Matador Sangue Frio — Recupera 2% de Vida ao Matar um Inimigo Resfriado
- Portal Rápido — Velociade de Movimento aumentada em 5% caso você tenha causado um Golpe Crítico Recentemente
- Finalizador — Dano enquanto afetado por um Arauto aumentado em 20%
- Discípulos — Lacaios causam Dano aumentado em 20% enquanto você for afetado por um Arauto
- Discípulos — Sentinelas Convocados têm Velocidade da Recarga aumentada em 25%
- Rítmo de Combate — Velocidade de Ataque aumentada em 10% caso você tenha Acertado com sua Arma da Mão Principal Recentemente
- Rítmo de Combate — Velocidade de Movimento aumentada em 10% caso você tenha Acertado com sua Arma da Mão Secundária Recentemente
- Táticas de Guerra — Velocidade de Movimento aumentada em 5% se você plantou uma Mina ou arremessou uma Armadilha Recentemente
- Composto Tonificado — Ganha Gênio Alquímico ao usar um Frasco
- Condução Gélida — Efeito das Afecções de Gelo infligidas por você em Inimigos Eletrizados aumentado em 25%
- Condução Gélida — Efeito das Afecções de Raio infligidas por você em Inimigos Resfriados aumentado em 25%
- Convocador da Nevasca — Congelabilidade pode afetar Inimigos a Prova de Feitiços
- Convocador da Nevasca — Duração dos Congelamentos infligidos por você em Inimigos Amaldiçoados aumentada em 30%
- Resposta Selvagem — +30% de Multiplicador de Golpes Críticos caso você tenha sofrido um Acerto Selvagem Recentemente
- Reduzir — Convocação de Runas concede alcance do Vínculo de Runas aumentado em 20% para Runas convocadas
- Reduzir — Convocação de Runas tem Recuperação da Recarga aumentada em 4%, máximo de 40%
- Proteção Poderosa — +10% de Chance de Bloquear Dano Mágico enquanto no Máximo de Cargas de Poder
- Retaliação Precisa — Chance de Acerto Crítico aumentada em 60% caso você não tenha Bloqueado Recentemente
- Retaliação Precisa — +30% de Multiplicador de Crítico se você Bloqueou Recentemente
- Heráldica — Inimigos Próximos têm Exposição a Gelo enquanto você estiver afetado por Arauto Glacial
- Heráldica — Inimigos Próximos têm Exposição a Fogo enquanto você estiver afetado por Arauto Flamejante
- Heráldica — Inimigos Próximos têm Exposição a Raio enquanto você estiver afetado por Arauto Trovejante
- Cutilada Perigosa — Efeito dos Empalamentos inflingidos por Acertos que também infligem Sangramento aumentado em 15%
- Mentalidade da Multidão — Clamores têm 5% de Chance de conceder uma Carga de Tolerância, Frenesi ou Poder por Poder
- Rugido Barulhento — Ataques Impelidos têm 8% de chance de causar Dano Dobrado _(os clamores do jogo são reforços: não Impelem ataques)_
- Mão da Tormenta — 25% do Dano Físico de Varinhas convertido para Dano de Raio
- Eco Ancestral — Velocidade de Ataque e Conjuração aumentada em 10% se você convocou um Totem Recentemente
- Paralisia — Habilidades de Raio têm Limite de Atordoamento Inimigo reduzido em 10%
- Estudante Teimoso — +1 de Armadura por cada 10 de Mana Máxima não Reservada _(esta variação da reserva ainda não tem efeito no jogo)_
- Adrenalina da Essência — Dano de Ataques aumentado em 40% enquanto Drenando Escudo de Energia
- Adrenalina da Essência — Velocidade de Ataque e Conjuração aumentada em 5% enquanto Drenando Escudo de Energia
- Força Explosiva — Inimigos mortos por seus Acertos com Varinhas têm chance de 10% de Explodir, causando um quarto de sua Vida como Dano de Caos
- Força Explosiva — Ganha 10% do Dano Físico de Varinhas como Dano de Caos Extra
- Provocador — Chance de Golpe Crítico contra Inimigos Provocados aumentada em 40%
- Provocador — +10% de Multiplicador de Golpes Críticos contra Inimigos Provocados
- Mestre do Fogo — Inimigos Próximos têm Exposição a Fogo
- Foco Estóico — +5% de Chance de Bloquar o Dano de Ataques enquanto Canalizando
- Foco Estóico — +5% de Chance de Bloquar Dano Mágico enquanto Canalizando
- Trovoada — Seus Golpes Críticos Empurram Inimigos Eletrizados
- Guarda Avançada — Velocidade de Movimento aumentada em 5% enquanto portando um Escudo
- Liderar pelo Exemplo — Quando você Clamar, você e Aliados próximos ganham Agressividade por 4 segundos _(esta variação de efeito em aliados ainda não tem efeito no jogo)_
- Runas Perseguidoras — Runas Desvinculadas ganham Alcance do Vínculo de Runas reduzido em 20% por segundo, até 100%
- Ferida Composta — Dano com Sangramento infligidos por você em Inimigos Mutilados aumentado em 35%
- Calvagando a Tormenta — 10% de chance de ganhar uma Carga de Poder ao Eletrizar um Inimigo Resfriado
- Calvagando a Tormenta — Dano de Gelo com Acertos contra Inimigos Eletrizados aumentado em 25%
- Calvagando a Tormenta — Dano de Raio com Acertos contra Inimigos Resfriados aumentado em 25%
- Gula de Doedre — Punição pode afetar Inimigos Infeitiçáveis
- Foco Inabalável — 50% de chance de Evitar ser Atordoado enquanto Canalizanndo
- Flechas Temperadas — Habilidades de Arco têm +6% de Multiplicador de Dano Degenerativo
- Flechas Temperadas — Habilidades de Arco têm Duração do Efeito de Habilidade aumentada em 10%
- Flechas Temperadas — Duração de Afecções infligidas enquanto portando um Arco aumentada em 10%
- Mal Inabalável — Habilidades de Caos ignoram interrupções de Atordoamentos
- Pontos de Pressão — Seus Golpes Críticos têm chance de 5% de causar Dano Dobrado
- Cheiro de Sangue — Ganhe 2 de Fúria no Acerto com Machados ou Espadas
- Rápido e Mortal — Dano do Ataque com a Mão Primária aumentado em 60% enquanto portando dois Tipos Diferentes de Armas
- Rápido e Mortal — Velocidade de Ataque da Mão Secundária aumentada em 30% enquanto portando Tipos de Armas diferentes
- Leque de Lâminas — Habilidades de Ataque disparam um Projétil adicional enquanto portando uma Garra ou Adaga
- Leque de Lâminas — Dano de Ataque de Projéteis com Garras ou Adagas aumentado em 20%
- Presságios Revigorantes — Lacaios causam Dano aumentado em 20% enquanto você for afetado por um Arauto
- Presságios Revigorantes — Lacaios têm Velocidade de Movimento aumentada em 10% para cada Arauto afetando você
- Ideação Sombria — Dano de Caos aumentado em 2% por cada 100 de Mana máxima, máximo de 80%
- Tormenta de Neve — Ganhe 8% do Dano de Raio como Dano de Gelo Extra contra Inimigos Resfriados
- Liderar a Destruição — Dano de Ataque quando em Vida Cheia aumentado em 25%
- Fonte do Reparador — Remove Sangramento ao usar um Frasco de Vida
- Acompanhamento — Projéteis causam dano com ataques e afecções aumentado em 20% por
cada propagação restante, até 100%
- Sadista — Dano Elemental aumentado em 15% caso você tenha Resfriado um Inimigo Recentemente
- Sadista — Dano Elemental aumentado em 20% caso você tenha Incendiado um Inimigo Recentemente
- Sadista — Dano Elemental aumentado em 25% caso você tenha Eletrizado um Inimigo Recentemente
- Renascimento Abençoado — Lacaios criados Recentemente não podem sofrer Dano
- Olho Perverso — Inimigos que você Amaldiçoa sofrem Dano aumentado em 6%
- Feridas Desorientadoras — 25% de chance de Cegar com Acertos contra Inimigos Sangrando
- Sintonia do Fogo — Você não pode ser Incendiado se foi Incendiado Recentemente
- Sintonia do Fogo — Inafetado por Solo Ardente _(os solos (ardente, sagrado, fúngico…) não existem no jogo)_
- Explorar a Fraqueza — Vulnerabilidade pode afetar Inimigos a Prova de Feitiços
- Exaurir a Psique — Regenera 1% do Escudo de Energia por segundo se você Amaldiçoou um Inimigo Recentemente
- Criador de Vítimas — Inimigos Amaldiçoados por você tem Esconjuro se 33% da Duração da Maldição expirou
- Palavra Sagrada — Seus clamores infligem Chama Santificada
- Castigue os Fracos — Dano de Ataque contra Inimigos Mutilados aumentado em 40%
- Mestre do Turbilhão — Fraqueza Elemental pode afetar Inimigos a Prova de Feitiços
- Mestre do Turbilhão — +1% de máximo das Resistências Elementais se você Matou um Inimigo Amaldiçoado Recentemente
- Lenha na Fogueira — Incêndios infligidos por você se espalham para outros Inimigos em um Raio de 1,5 metros
- Foco Irrestrito — Habilidades Canalizadoras possuem Velocidade de Ataque e Conjuração aumentada em 8%
- Foco Irrestrito — Não Afetado por Resfriamentos enquanto Canalizando
- Foco Tolerante — 25% de chance de ganhar uma Carga de Tolerância por segundo enquanto Canalizando
- Tormento Contínuo — +6% de Multiplicador de Dano Degenerativo por Sangramento infligido em Inimigos Envenenados
- Golpes Titânicos — Dano em Área aumentado em 20% enquanto portando uma Arma Corpo a Corpo de Duas Mãos
- Golpes Titânicos — Área de Efeito aumentada em 15% enquanto portando uma Arma Corpo a Corpo de Duas Mãos
- Poder Expansivo — Ataques com Maça, Cetro ou Cajado causam Dano com Acertos e Afecções aumentado em 20%
- Poder Expansivo — Efeito em Área aumentado em 10% por segundo que você estiver parado, máximo de 50%
- Toque da Crueldade — Magias de Caos têm 10% de chance de Desacelerar Inimigos ao Acertar
- Toque da Crueldade — Inimigos Desacelerados por você sofrem Dano de Caos aumentado em 10%
- Aflição Surpreendente — Dano com Acertos e Afecções contra Inimigos afetados por Afecções aumentado em 20%
- Emissário do Propósito — Auras das suas Habilidades têm Efeito reduzido em 8% em você
para cada Arauto te afetando, até 40%
- Pirotecnias Arcanas — Ganhe Fúria Arcana quando sua Mina for Detonada focando em um Inimigo
- Pirotecnias Arcanas — Ganhe Fúria Arcana quando sua Armadilha for Ativada por um Inimigo
- Saboreie o Momento — Regenera 3.00% de Escudo de Energia por segundo enquanto parado
- Olho por Olho — Projéteis causam Dano aumentado em 35% com Acertos contra Inimigos próximos
- Guia Ancestral — Totens Regeneram 2% de Vida por segundo
- Foco Vital — Regenera 1.5% de Vida por segundo enquanto Canalizando
- Completamente Frio — Dano de Gelo aumentado em 1% por cada 25 de Destreza
- Completamente Frio — Dano de Gelo aumentado em 1% por cada 25 de Inteligência
- Completamente Frio — Dano de Gelo aumentado em 1% por cada 25 de Força
- Chamado da Carnificina — Lacaios criados Recentemente têm Velocidades de Ataque e Conjuração aumentadas em 10%
- Chamado da Carnificina — Lacaios Criados Recentemente têm Velocidade de Movimento aumentada em 30%
- Foco Preciso — Chance de Acerto Crítico aumentada em 30% enquanto Canalizando
- Foco Preciso — +20% de Multiplicador de Golpes Críticos caso você tenha Canalizado por ao menos 1 segundo
- Terapia de Exposição — +30% de Resistência a Caos contra Dano Degenerativo
- Preservação Ancestral — Totens ganham +25% de Resistência a Caos
- Cremador — Inimigos Incendiados Mortos por seus Acertos são destruídos
- Vetor de Doenças — Inimigos Envenenados por você não podem Regenerar Vida
- Vetor de Doenças — +6% de Multiplicador de Dano Degenerativo para Envenenamentos enquanto portando uma Garra ou Adaga
- Alcance Ancestral — Alcance do Posicionamento de Totens aumentado em 25%
- Sentinelas Incansáveis — Você tem Agressividade se Convocou um Totem Recentemente
- Vínculo Primordial — Dano aumentado em 10% por Golem Convocado
- Atravessar — Ataques com Machados ou Espadas causam Dano com Afecções aumentado em 15%
- Atravessar — 10% de chance de Empalar Inimigos ao Acertar com Machados ou Espadas
- Atravessar — Dano Físico com Machados e Espadas aumentado em 15%
- Renovação — Lacaios têm 5% de chance de causar Dano Dobrado enquanto estiverem em Vida Cheia
- Notável — Habilidades que criam Runas têm 35% de chance de criarem uma Runa adicional
- Forma Sublime — Graça tem Eficácia de Reserva de Mana aumentada em 50% _(esta variação da reserva ainda não tem efeito no jogo)_
- Poder Ancestral — Dano de Totens aumentado em 30% caso você tenha Convocado um Totem nos últimos 2 segundos
- Agravar Ferimento — Ataques com Machados ou Espadas causam Dano com Afecções aumentado em 20%
- Agravar Ferimento — Dano Físico com Machados e Espadas aumentado em 20%
- Agravar Ferimento — +5% de Multiplicador de Dano Físico Degenerativo enquanto portando um Machado ou Espada
- Golpeador Certeiro — 5% de chance de causar Dano Dobrado caso tenha causado um Golpe Crítico com uma Arma de Duas Mãos Corpo a Corpo Recenemente
- Palavras Proibidas — Efeito em Área de Habilidades de Maldição aumentado em 25%
- Presença Volátil — Cólera tem Eficácia de Reserva de Mana aumentada em 50% _(esta variação da reserva ainda não tem efeito no jogo)_
- Presença Volátil — Duração das Afecções de Fogo aumentada em 20%
- Agente da Destruição — 10% de chance de Congelar, Eletrizar e Incendiar enquanto afetado por um Arauto
- Agente da Destruição — Dano Elemental aumentado em 25% enquanto afetado por um Arauto
- Vida da Morte — Regenera 2% de Vida por segundo se um Lacaio Morreu Recentemente
- Presença Revigorante — Você e Aliados próximos Regeneram 1.00% de Vida por segundo _(esta variação de efeito em aliados ainda não tem efeito no jogo)_
- Elixir Anestésico — Efeito das Maldições em você reduzido em 40% durante o Efeito de Qualquer Frasco de Mana
- Elixir Anestésico — Efeito das Afecções Não-Danificadoras infligidas por você reduzido em 40% durante o Efeito do Frasco de Vida
- Vasto Poder — Efeito em Área aumentado em 3% por Carga de Poder, máximo de 50%
- Revigoração Vil — Regenera 2% de Escudo de Energia por segundo se você Matou um Inimigo Recentemente
- Quebra-Maldições — Velocidade de Ataque e Conjuração enquanto Canalizando aumentada em 8%
- Quebra-Maldições — Remove uma Maldição após Canalizar por 2 segundos
- Dispensabilidade — 10% de chance de Arremessar até 1 Armadilha ou Mina adicional
- Profecia Auto-Cumprida — +1% de Chance de Golpe Crítico de Habilidades Arauto
- Profecia Auto-Cumprida — +15% de Multiplicador de Golpes Críticos caso você tenha causado um Golpe Crítico com uma Habilidade Arauto Recentemente

</details>

### O que ainda não funciona nas joias únicas, pelo lote previsto

| Lote | Única — linha |
|---|---|
| Ramificadoras (raspar os encantamentos e notáveis no poedb) (18) | Vozes — Adiciona 3 Habilidades Passivas de Encaixe de Joia<br>Vozes — Adiciona 7 Pequenas Habilidades Passivas que não concedem nada<br>Vozes — Adiciona 3 Habilidades Passivas de Encaixe de Joia<br>Vozes — Adiciona 5 Pequenas Habilidades Passivas que não concedem nada<br>Vozes — Adiciona 3 Habilidades Passivas de Encaixe de Joia<br>Vozes — Adiciona 3 Pequenas Habilidades Passivas que não concedem nada<br>Vozes — Adiciona 3 Habilidades Passivas de Encaixe de Joia<br>Vozes — Adiciona 1 Pequenas Habilidades Passivas que não concedem nada<br>Megalomaníaco — Adiciona 4 Habilidades Passivas<br>Megalomaníaco — Pequenas Habilidades Passivas Adicionadas não conedem Nada<br>Megalomaníaco — [Three random notable modifiers] _(descrição do catálogo para mods sorteados por um sistema que o jogo não tem (Síntese, mods aleatórios))_<br>Aquele Sem Nada — Adiciona Técnica da Palma Oca<br>Ensinamentos de Kitava — Adiciona Discípulo de Kitava<br>A Interrogação — Adiciona Segredos do Sofrimento<br>Visões Calamitosas — Adiciona Mensageiro<br>Afinidade Natural — Adiciona Paciência da Natureza<br>O Cerco — Adiciona Cineticismo<br>A Linha de Frente — Adiciona Astúcia do Veterano |
