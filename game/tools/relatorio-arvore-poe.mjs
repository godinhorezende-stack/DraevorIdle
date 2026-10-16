// O RELATÓRIO da árvore de passivas do PoE (dono, 12/10: "veja o que ainda não está implementado na árvore de habilidades e parcial…
// faça um relatório, atualizando o status do tooltip sempre que implementar"): lê `gamedata/itens-poe/arvore-poe.json` — o mesmo estado de
// cada linha que o balão da árvore mostra (✓ equivalente/novo/aproximado, ✗ registrado/inerte, – "não se aplica ao jogo") — e escreve
// `docs/arvore-poe-pendencias.md`: os números, o que NÃO funciona e o que é PARCIAL, agrupados pelo motivo (a nota da regra), com os nós.
// `tools/montar-arvore-poe.mjs` chama no fim: remontar a árvore (depois de mexer numa regra) atualiza o balão E o relatório juntos.
//
// Uso: node tools/relatorio-arvore-poe.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARVORE = new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url);
const DESTINO = new URL('../../docs/arvore-poe-pendencias.md', import.meta.url);
const NAO_SE_APLICA = /^não se aplica ao jogo:/i;
const FALTA_NO_JOGO = /^falta no jogo:/i;
/**
 * Os blocos que eram DECISÃO do dono (memória do ciclo 7 da árvore), pela nota da linha. Dono, 12/10: implementar os cinco ("Tintura,
 * Runas e Vínculos, Armadilhas e Minas, Convocar o Aço" e "ligar os modificadores" de monstro e de mapa).
 */
const DECISAO_DO_DONO = [
  // (os blocos com nome primeiro: a nota do Convocar o Aço fala em empalamentos, que o último pegaria)
  [/Tinturas/i, 'criar a Tintura'],
  [/Runas e os Vínculos|Runas do jogo|habilidades de Vínculo/i, 'Runas e Vínculos presos ao alvo'],
  [/Armadilha e a Mina/i, 'Armadilhas e Minas plantadas (limite, duração, detonação)'],
  [/Convocar o Aço/i, 'o Convocar o Aço (Call of Steel)'],
  [/monstro|reflexo|Empal|Mutil|Drenar Vida De Você/i, 'ligar os modificadores de monstro/mapa (reflexo, Cegueira, Sangue Corrompido, Mutilar, Empalar em você…)'],
];

/**
 * Os blocos JÁ implementados a pedido do dono (12/10), pelo texto da linha: quantas linhas da árvore passaram a ter efeito e o que mudou no
 * jogo. Um bloco novo entra aqui quando é feito (o relatório conta as linhas sozinho).
 */
const IMPLEMENTADOS = [
  {
    bloco: 'Modificadores de monstro e de mapa ligados (lote 2)',
    re: /refletid|Refletid|Evitar Cegueira|Não pode ser Cegado|Sangue Corrompido|Exposições em você|ganhar Cargas de Poder, Frenesi ou Tolerância|Bloquearem Ataques com Espada|Drenar Vida De Você|não pode ser Mutilado|ser Empalado|Afecções Elementais de forma Inerente/,
    fora: /Convocar o Aço|Empalamentos removidos/,
    jogo: 'monstros que Cegam, Expõem, põem Sangue Corrompido, drenam vida e ganham cargas (modificadores de monstro); mapas com Cegar, Mutilar, Empalar, cargas por acerto, espinhos nos Raros e "Impossível Drenar"; o Golpe Crítico do monstro incendeia, congela e eletriza; o bloqueio do monstro contra Espada',
  },
  {
    bloco: 'Armadilhas e Minas plantadas (lote 3)',
    re: /plantadas por vez|Armadilhas adicionais|não podem ser Danificadas|Detonar Minas é Ativado|Velocidade de Detonação|Duração da Mina|Armadilhas próximas também Ativam|Uso de Recarga|Ativarem uma vez adicional|Detonadas uma Vez Adicional|quando são Plantadas/,
    jogo: 'a gema de Armadilha/Mina planta no alvo; a Armadilha ativa com inimigo a 1 casa (dura 4 s, até 15); a Mina detona sozinha com você parado e inimigo perto, em sequência (dura 5 s, até 15); a magia em área do monstro destrói as plantadas',
  },
  {
    bloco: 'Runas presas ao inimigo (lote 4a)',
    re: /Alcance do Vínculo de Runas|Runas Adicionais|Runas se Vinculam|quando uma Runa expira|Runas Vinculadas a eles|Marca adicional Vinculada|Frequência de Ativação se|caso \d+% da Duração do Vínculo/,
    jogo: 'a Runa (Brand) vincula ao inimigo e é Ativada a cada N segundos enquanto vinculada (5 s; solta, procura outro por 6 s); até 3 ativas, 1 por inimigo; o automático não reconjura com todas em campo',
  },
  {
    bloco: 'Vínculos (lote 4b)',
    re: /focar em Lacaios Danificáveis|Feixes de Vínculo|alvos Vinculados têm Exposição|Vínculos demoram|alvo aleatório adicional|Alvos Vinculados compartilham|entre os Jogadores Vinculados|alvov?s Vinculados$|Duração do Vínculo que tenha Expirado|ao invés dos alvos Vinculados/,
    jogo: 'as 6 gemas de Vínculo criadas: focam um jogador da party na sala (lacaios, com o nó), custam mana por segundo, quebram fora do alcance em 4 s e, se o alvo morre vinculado, você morre; os efeitos de cada uma (Fogo, bloqueio, menos dano e o seu Escudo, crítico, o seu Dreno no alvo)',
  },
  {
    bloco: 'Convocar o Aço (lote 5)',
    re: /Convocar o Aço|Chamado do Aço|Empalamentos removidos desta forma/,
    jogo: 'as gemas de Aço concedem o Convocar o Aço, automático: chama os empalamentos dos vivos e dos cadáveres a até 6 casas, reflete em volta de cada um o dano × os acertos que restavam e dá 1 Fragmento de Aço por empalamento; recarrega 4 Fragmentos a cada 0,5 s até 12; o Aço Perfurador, o Aço Violento e o Estraçalhador da Munição e a Balista gastam os Fragmentos como no PoE (mais projéteis, a divisão, a Proteção de Aço); a linha dos "Empalamentos removidos desta forma" é da remoção ao Acertar (a mesma opção da maestria), não do Convocar o Aço',
  },
  {
    bloco: 'Tinturas (lote 6)',
    re: /Tintura|Queimas? de Mana|Ferimentos Abertos/,
    jogo: 'as Tinturas criadas: caem (Normal, Mágica, Única), vão no cinto de frascos e ativam sozinhas em combate; ativas, põem Queima de Mana em você (1% da Mana máxima por segundo cada) e dão os mods delas nos ataques com Arma Corpo a Corpo; desativam com a mana acabando (ou abaixo do limite da regra), tiram a Queima de Mana e entram na recarga da base',
  },
  {
    bloco: 'Aliados de verdade (lote 7)',
    re: /[Aa]liad/,
    jogo: '"Você e Aliados" vira a aura do nó (vale em você, nos companheiros da party na sala a até 3 casas e nos seus lacaios; a mesma aura de duas pessoas: a maior); "Auras das suas Habilidades concedem" entra por aura ligada; a Fortificação igual do Campeão; "aliado por perto" conta lacaios e a party; a Ichimonji nas auras',
  },
  {
    bloco: 'Mana reservada (lote 8)',
    re: /Mana Reservada|Mana Máxima Não Reservada|que Reservarem|Reserva de Mana de Habilidades Aura|Frascos de Vida não são removidos/,
    jogo: 'Fé Radiante (Armadura e Escudo pela mana reservada, em você e nos aliados); Santuário do Pensamento (Área pela mana não reservada); Ego Supremo (as auras só em você, mais efeito pela reserva de cada uma, 40% mais reserva); o efeito do Frasco de Vida sai quando a vida não reservada enche (a regra do PoE), menos com a Mestre Cirurgiã — e o de mana passa a olhar a mana não reservada',
  },
  {
    bloco: 'Projéteis por projétil (lote 9)',
    re: /Inimigo Atravessado|vez que Ricochetearam|quando Difundindo|Projéteis que Ricochetearam|conforme viajam adiante/,
    jogo: 'cada projétil conta os inimigos que atravessou e as vezes que ricocheteou (o dano aumentado por cada um, somado aos outros aumentos); a difusão com a chance de um projétil a mais; o Caos extra nos que ricochetearam (a Presa Sombria); o Tiro Longo pela distância — e o dano pela distância (Animosidade Adjacente, Tiro Distante, Queima-Roupa) passa a valer também nas habilidades, não só no golpe básico',
  },
  {
    bloco: 'Lacaios (lote 10)',
    re: /bônus do Escudo equipado se aplicam aos seus Lacaios|Reconvocados/,
    jogo: 'a Égide Necromântica passa os bônus do escudo aos lacaios (e tira a defesa da base de você); o golem morto volta sozinho em 4 s (o Suserano do Primordial); e a resistência a Fogo/Gelo/Raio dos lacaios, guardada e nunca lida, passa a valer no golpe',
  },
  {
    bloco: '"Mais" e "menos" exatos (lote 11)',
    re: /mais Área de Efeito enquanto empunhando|menos Vida Recuperada de Frascos|de dano degenerativo com habilidades mágicas|(mais|menos) Duração do Efeito de Habilidades/,
    jogo: 'o "X% mais/menos" multiplica em vez de somar ao aumentado: a Área de Efeito (as habilidades, as auras, o Convocar o Aço), a Duração do Efeito de Habilidades (os buffs, os Vínculos, as Runas, a Proteção de Aço), a Vida Recuperada dos Frascos e o dano degenerativo das magias (o "mais" de verdade, o da Crueldade)',
  },
  {
    bloco: 'Correções das notas (lote 12)',
    re: /^Arauto Trovejante tem|Itens de Proteção Equipados|Penalidades de Movimento das Armaduras|^Remove toda a mana$|^10% mais Vida Máxima$|^Habilidades (Custam|Reservam) Vida ao invés de [mM]ana$/,
    jogo: 'o Efeito do Buff do Arauto Trovejante só nele (valia em todos os Arautos — e no único Cravo de Fidelitas); a Eficácia da Reserva dele (a gema está no jogo: o montador da árvore passou a carregar as gemas); A Apóstata (o nó e o único: o Escudo de Energia das armaduras vira Vida; o peitoral sem o Escudo da base); a Arte do Gladiador (a penalidade de movimento de peitorais e escudos ignorada); a Magia Sanguínea igual ao PoE (o "10% mais Vida" multiplica; a reserva de vida já existia, a nota estava errada); e o "Sem Dano Físico" dos únicos, que refazer a peça devolvia',
  },
  {
    bloco: 'Parciais exatos (lote 13)',
    re: /^Remove todas as Afecções Danificadoras quando você Clamar$|^Remove uma Afecção não Elemental aleatória quando você usar um Frasco de Vida$|^Remove uma Afecção aleatória de você quando você consumir|^Inimigos Não Amaldiçoados que você inflija|Garras na Mão Secundária$|se você usou um Frasco de Mana nos últimos|se a Recarga do Escudo de Energia iniciou nos últimos|se você usou um Frasco de Vida nos últimos|durante o Efeito de qualquer Frasco de Mana$|^Frascos de Vida ganham|^Frascos Utilitários Mágicos aplicados em você|Aliados próximos dos seus Estandartes Regeneram|^Você e seus Totens Regeneram|^Habilidades que causaram um Golpe Crítico nos últimos 8 segundos|^Seus Golpes Críticos não causam Dano extra$|^Afecções nunca contam como sendo de um Golpe Crítico$|de Dano Físico, Gelo e Raio Convertidos para Dano de Fogo$|^Não causa Dano que não seja de Fogo$|^Não Evade Ataques inimigos$|^Não pode ser Atordoado$/,
    jogo: 'os Clamores tiram todas as afecções de dano; o Frasco de Vida tira uma afecção não elemental (Sangramento ou Veneno) ao acaso; o Estandarte, qualquer uma ao acaso; a maldição que não é aura Cega só quem não estava amaldiçoado; o Mana por acerto só com a Garra na mão secundária; os prazos exatos ("nos últimos 10/2 segundos") e os frascos certos (de Vida, de Mana, os Utilitários Mágicos); a regeneração do Inspirador nos aliados na área do Estandarte e a do Ritual do Despertar nos totens; a Sobrecarga Elemental (40% mais dano elemental só na habilidade que causou um crítico nos últimos 8 s; as afecções nunca de crítico); o Avatar do Fogo (Gelo e Raio também viram Fogo, e só o Fogo causa dano); a Postura Inabalável (imune só a Atordoamento)',
  },
  {
    bloco: 'Parciais médios (lote 14)',
    re: /da Mana por \d+ segundos? quando você usar uma Habilidade de Guarda$|do Dano de Ataques Físicos é Drenado como (Vida|Mana)$|^Exposição a (Fogo|Gelo|Raio) infligida por você aplica|^Envenenamentos infligidos por você causam Dano|^Efeito de Auras Não-Maldição de suas Habilidades aumentado em/,
    jogo: 'a mana da Maestria de Mana volta ao longo do tempo (no clamor de Guarda); o dreno do "Dano de Ataques Físicos" só da parte física dos ataques (antes, de todo o dano — os anéis e amuletos com essa linha também); o "-X% extra" das Maestrias de Fogo/Gelo/Raio também na Exposição das gemas, das auras e dos Vínculos; o veneno "X% mais rápido" só no Veneno (antes, todas as afecções de dano); a Pândega (a marca do Orgulho nos inimigos, maior pelo efeito)',
  },
  {
    bloco: 'O Congelamento do PoE e a Geada (lote 15)',
    re: /^Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada$/,
    jogo: 'o Congelamento que você põe segue o dano de Gelo do acerto, como no PoE (60 ms por 1% da vida do monstro, até 3 s, × a Duração aumentada; abaixo de 0,3 s não congela — antes, 1,5 s fixos); a Geada do Juramento do Inverno (o acerto que falha em Congelar por duração curta: 10 s, acumula, +20% de Duração do Congelamento por Geada, sai ao Congelar); "Congela … como se causasse X% mais Dano" no dano da conta',
  },
  {
    bloco: 'Os altares do PoE (lote 16)',
    re: /^Ganha um buff de altar aleatório a cada|^Você tem o bônus do Altar Impenetrável/,
    jogo: 'os 13 altares do sorteio do PoE (Aceleração, Brutal, Diamante, Ecoante, Sombrio, Impenetrável, Massivo, Reabastecimento, Resistência, Carregado e os Maiores Congelante, Eletrizante e Esquelético — as Novas e os Esqueletos pelas gemas do jogo); a Harmonia do Propósito (um altar ao acaso a cada 10 s, por 20 s) e o Gritos dos Dessecados (o Altar Impenetrável sem frascos ativos); o efeito e a duração dos buffs de altar das peças',
  },
  {
    bloco: 'O Warden (lote 17)',
    re: /Pele de Árvore|Avatar Liberto|Fúria Liberta|enquanto Liberto$|[Cc]asca/,
    jogo: 'a Pele de Árvore (a Casca: +1 por segundo sem ser Acertado por um Ataque Recentemente, -1 por Ataque que acerta, até 10; -60 de Dano Físico dos Acertos de Ataque por Casca, 4% mais chance de Evadir por Casca abaixo do máximo); a Lição das Estações (-25 de cada tipo de dano dos Acertos de Magia por Casca, +3% do Dano Mágico Suprimido Impedido por Casca abaixo do máximo, -1 Casca por Dano Mágico); o Avatar Liberto (Fúria Liberta pelas Afecções Elementais; com 100, Liberto por 10 s: sempre Congela, Eletriza e Incendeia, 100% mais Dano Elemental) — as habilidades saem sozinhas; e o HUD mostra os buffs do PoE por nome, a Casca e a Fúria Liberta',
  },
  {
    bloco: 'O Guardian (lote 18)',
    re: /Chamas? Santificadas?|Sentinela do Resplendor|Relíquia Elemental/,
    jogo: 'a Chama Santificada (o acerto corpo a corpo a põe — 6 s, +1 Chama; o ATAQUE de um aliado — o companheiro da party ou o lacaio, até o seu — ganha 25% do Físico como Fogo extra e a tira; quem pôs ganha 10% do Físico como Raio extra por Chama removida recentemente, até 80%; a intensidade aumentada); o Sentinela do Resplendor (sai sozinho, segue você, ataca corpo a corpo, queima a até 2 casas — 20% da vida dele por segundo, como Fogo —, volta 0,75 s depois de morrer; 20% do dano dos acertos sofrido na vida dele antes da sua); a Relíquia Elemental (25% de chance quando você ou um aliado perto mata ou acerta um Raro/Único; 5 s com a aura Cólera, Ódio ou Ira nível 20 em você e nos aliados perto; a do mesmo elemento só renova; explode ao acabar); o Ódio passa a dar o "Físico como Gelo extra" dele',
  },
  {
    bloco: 'A árvore principal (lote 19)',
    re: /Poder Arcano|Portador da Praga|Profanar e Desenterrar|Suportadas por Feiticeiro/,
    jogo: 'o Poder Arcano (o "Dano Mágico aumentado" também nos ataques, no % dele — a Maestria de Varinhas com varinha e os únicos); Profanar e Desenterrar criam cadáveres (5 dos monstros da área / 1 Arqueiro de Ossos onde o projétil cai, até 10 de cada gema, +2 com o Coveiro); o Infestador (sai sozinho na barra: Incubando, 40% do dano esperado de cada Veneno no Valor da Praga — até o máximo do nível, × o "Valor Máximo aumentado" — e 20% menos Veneno fora do máximo; no máximo com um inimigo perto, Infesta: 12% do Valor do começo por segundo como Caos a até 2 casas, até acabar); o Feiticeiro (liga na barra reservando 20% da mana por magia ligada — com a eficácia da maestria —; o ataque de varinha ativa as magias ligadas, com o dano da varinha e o "menos dano" do nível, recarga 0,6 s ÷ a recuperação)',
  },
  {
    bloco: 'Égide e as pequenas (lote 20)',
    re: /Égide Primitiva|Outras Habilidades de Égides|golpe mágico crítico|Robôs Ativadores|Infusão Espiritual/,
    jogo: 'a Égide Primitiva do Elementalist (toma o dano de Fogo, Gelo e Raio dos acertos antes do Escudo e da Vida, 75 por Notável alocado; volta cheia 10 s depois do último dano elemental) — e as 5 Égides dos únicos pelo mesmo caminho, desligadas pela Primitiva; a Infusão Mística do Assassin (o crítico mágico Bifurca: duas rolagens, as duas dobram o dano extra do crítico; 30% menos chance de crítico mágico); os Robôs Ativadores do Saboteur (dois robôs que não tomam dano; as Magias Ativadas saem duas vezes, a segunda sem recarga); a Infusão Espiritual do Occultist (ao canalizar uma magia, um acúmulo a cada 0,5 s, até 10: 15% de início mais rápido da Recarga do Escudo, 5% mais Dano e 10% mais Custo nas Magias Canalizadas por acúmulo)',
  },
  {
    bloco: 'O Reliquarian (lote 21)',
    re: /Rajada Vulcânica|Emissário das Direções|Poder Fantasmal|Erguer Aranhas|Suspender no Tempo/,
    jogo: 'a Rajada Vulcânica (no acerto corpo a corpo, 4 projéteis de magma em área, 200% do golpe, 60% em Fogo); o Grande Emissário das Direções (sai sozinho; a cada 6 s, +2 Projéteis, +2 Ricochetes, +2 Perfurações, Difundir duas vezes, ou todos); o Poder Fantasmal (o dano de cada Fantasma vivo nas suas magias físicas) com o suporte Convocar Fantasma, que passa a convocar (no golpe fatal e no Raro/Único, até o máximo, 15 s); Erguer Aranhas (ao matar, 2 aranhas por cadáver perto, até 20, 30 s, +2% de Velocidade de Ataque e +15% de Dano com Veneno cada); Suspender no Tempo (a terceira Miragem solta as magias que as criaram, com menos dano) — e os únicos que dão essas habilidades',
  },
  {
    bloco: 'As que "não se aplicavam" — o lote rápido (lote 25)',
    re: /cadáveres Criados por você Recentemente|Alcance do Ricochete|Barragens de Projéteis|Ricochetear ao colidirem|Retornarem a você|direções aleatórias|local anterior que foram/,
    jogo: 'o Pacto Cadavérico (os cadáveres de Profanar e Desenterrar dos últimos 4 s Resfriam e Eletrizam os inimigos a até 3 casas); o Alcance do Ricochete (a distância do salto); os projéteis que Retornam, Ricocheteiam no terreno (um ricochete a mais), vão em direções aleatórias (inimigos sorteados) e a barragem que não se propaga (toda no alvo); o Golpe que também mira o local anterior (mais um inimigo perto)',
  },
  {
    bloco: 'O mercenário do Luminary (lote 26)',
    re: /mercenário|conexão têm duração/i,
    jogo: 'o mercenário permanente (sai sozinho: a sua vida máxima, o golpe da sua arma; volta em 10 s); a vida e o dano dele, o "8% mais Dano por único" (os seus únicos nos tipos de peça liberados), o guarda-costas (20% do dano dos acertos nele com a vida dele maior; 40% do dano dele recuperado com ela menor), o provocar, as suas auras nele (+50%), o Vínculo nele (o Juramento: a morte dele não leva você) e os Vínculos com duração infinita',
  },
  {
    bloco: 'Os encaixes de joia (lote 27)',
    re: /^Joias Não Únicas/,
    jogo: 'os 21 encaixes da árvore (15 Básicos e os 6 Grandes da borda) recebem as Joias Carmesim, Viridiana e Cobalto (e a Prismática, só Única), que passam a cair; com o encaixe alocado, os mods da joia valem como os de uma peça; o Chieftain (Ngamahu): com joia não única, os aumentos de Dano Físico, de Gelo, de Raio e de Caos dos nós alocados no Raio Grande (1800, como no PoE/PoB — lote 29) viram de Fogo e cada nó pequeno ou notável dá +4 de Força',
  },
  {
    bloco: 'Zerar a árvore — lote 30 (as contas e regras erradas)',
    re: /Bônus de Precisão da Destreza|% mais Dano de Caos|^15% mais Dano de Gelo|Debuffs em você expiram|menos Dano Físico Sofrido enquanto em Escudo|menos Dano sofrido por Força dos Ventos|Você e Aliados próximos têm Vento Favorável|menos Dano de Acertos por|menos Dano Degenerativo por 5|^\+0\.75% de Chance de Golpe Crítico/,
    jogo: 'a Precisão da Destreza passa a 3 por ponto (somava +3 em cima dos 2); "X% mais Dano de Caos/Gelo" só na parte daquele tipo; "Debuffs em você expiram X% mais rápido" = a duração ÷ (1 + X%) em todo debuff (afecções, maldições, os dos monstros); "menos Dano Físico Sofrido" multiplicativo; o Vento Favorável dá 8% de Velocidade de Ação; a Parada Cardíaca alterna (consecutivamente) os 5 s de menos dano de Acertos e os 5 s de menos dano Degenerativo; a Guarda do Vento e o "+0,75% de Chance de Crítico" já eram a conta do PoE (a nota estava errada)',
  },
  {
    bloco: 'Zerar a árvore — lote 31 (o abate de quem, as explosões, o Clamor, o golpe básico)',
    re: /ao Matar Corpo a Corpo|Provocados por seus Clamores|Sangramento Explodem quando você|para cada Empalar no Inimigo|Atordoam como se causassem|Incêndios de Acertos Corpo a Corpo Atordoantes|^Dano com Acertos é Azarado|Acertos Não Críticos penetram/,
    jogo: 'o abate é de quem deu o golpe fatal (o do lacaio e o do totem não dão o "ao Matar" nem o "Matou Recentemente" seus — dão os eventos deles e a Relíquia Elemental); o "ao Matar Corpo a Corpo" é o golpe fatal corpo a corpo; "Provocados por seus Clamores" só o do Clamor (a explosão, morto por qualquer um); as explosões com o tipo de dano da linha, pela defesa dos atingidos; o atordoamento "como se causasse mais Dano de Fogo" só na parte de Fogo; a Força Concussiva, o Azarado e a penetração no não crítico também no golpe básico; o adicional por Empalamento do Mestre do Metal entra no golpe como Físico adicional, com os aumentos',
  },
  {
    bloco: 'Zerar a árvore — lote 32 (o resto da lista A)',
    re: /Armadura também se aplicam à Recarga|Habilidades de Oferenda também afetam|menos dano de Ataque sofrido se você não foi|Redução de Dano Máxima para qualquer|Redefine a duração de esfriamentos|não pode causar Dano com Habilidades por si|não se moveu nos últimos|afetado por um Buff de Clamor|vida não reservada faltante antes|por Fúria enquanto não estiver perdendo|Velocidade de Movimento não pode ser modificada|criar Solo Sagrado ao Acertar um Inimigo Raro|^Mago de Batalha|Ganha Convergência ao Acertar|Chance de Bloquear com o Escudo Equipado ao invés|Chance de bloquear magias aumenta|Perde toda a sua Força dos Ventos/,
    jogo: 'todo o "aumentado" de Armadura resolvido (o condicional também) na Recarga do Escudo; as Oferendas em você por inteiro (Conjuração, Movimento, bloqueio de Magia; a regeneração da Óssea só se bloqueou há pouco); o Dançarino do Vento 20% MENOS dano de Ataque (também no projétil do monstro); o teto de 50% em toda redução; as Forças Profanadas ao amaldiçoar, com a duração cheia; o Vínculo Ancestral também na Praga e no Aço; "não se moveu nos últimos N s"; os segundos seguidos sob um Buff de Clamor; o Desafio antes do acerto, da Vida não reservada; o Ritual da Ruína por Fúria, só enquanto ela não cai; o piso do movimento em toda redução; o Solo Sagrado do Inquisidor de 8 s; o adicionado às magias de todo tipo (Mago de Batalha); a Convergência só no Elemental; o Gladiador, o Bastião Vil e a Guarda do Vento já eram a conta do PoE/PoB',
  },
  {
    bloco: 'Zerar a árvore — lote 33 (os primeiros sistemas B)',
    re: /Efeito de Afecções Não-Danificadoras aumentado|Flechas ganham Chance de Golpe Crítico enquanto viajam|aos alvos no início de seu movimento|ao viajar adiante, causando até|conforme viajam adiante, causando|baseado na proximidade|chance de ganhar Elusivo/,
    jogo: 'o "Efeito de Afecções Não-Danificadoras" também no Causticar, no Fragilizar e no Exaurir (o bloqueio, a chance no acerto, a aura, o Segredos do Sofrimento, a Causticação do Warden); as rampas de distância do Path of Building (35 → 70 unidades; 1 casa = 2 m = 20) no crítico das flechas, no Tiro Longo, no Tiro Distante do Deadeye e na Animosidade Adjacente; a Queima-Roupa pela tabela do poedb; o Impacto pela proximidade do PoB (o máximo até 15 unidades, 0 em 40 — o vizinho colado, a 20, dá 80%); o Elusivo perde 20% de efeito por segundo (começa no efeito cheio, com o aumentado) e não se ganha outro enquanto há um',
  },
  {
    bloco: 'Zerar a árvore — lote 34 (as Minas plantadas e a Velocidade dos Clamores)',
    re: /Velocidade dos Clamores aumentada|Cada Mina aplica|por cada Mina Detonada|Minas Detonadas Recentemente/,
    jogo: 'a Velocidade dos Clamores encurta o tempo de uso do Clamor (e a de Conjuração não vale nele — o Clamor não é ataque nem magia); a aura da Mina plantada nos inimigos a até 35 unidades (3,5 m, 1 casa), cada Mina somando até o teto ("Efeito de Auras das Minas" na de cada uma, não no teto; o "reduzido" é o dano que o inimigo causa); "por cada Mina Detonada Recentemente, até 100%/40%" pela detonação de verdade, nos últimos 4 s',
  },
  {
    bloco: 'Zerar a árvore — lote 35 (o alcance em metros e o bloqueio, pelas decisões do dono)',
    re: /metros ao Alcance de Golpes Corpo a Corpo|Recuperação de Bloqueio aumentada/,
    jogo: 'o alcance corpo a corpo em metros (a decisão "Medir em metros", 1 casa = 2 m): o da arma (a base do PoE, 1 a 1,4 m) + os "+X metros", o vizinho colado sempre ao alcance e cada casa a mais pedindo 2 m — no golpe básico e no golpe da gema corpo a corpo; a Recuperação de Bloqueio trava em todo bloqueio (a decisão "Como no PoE: todo bloqueio")',
  },
];

/** Todas as linhas da árvore: os nós (com as ascendências) e as opções das maestrias. */
export function linhasDaArvore(arvore) {
  const saida = [];
  for (const n of Object.values(arvore.nos ?? {})) {
    const pegar = (o, maestria) => (o.textos ?? []).forEach((texto, i) => saida.push({
      // (a linha da keystone aproximada: a nota é a da keystone — `keystone.nota`, que o balão mostra.)
      id: n.id, no: n.nome, tipo: n.tipo, asc: n.ascendencia ?? null, maestria, texto, estado: o.estados?.[i] ?? null,
      nota: o.notas?.[i] ?? (o.estados?.[i] === 'aproximado' ? n.keystone?.nota : null) ?? null,
    }));
    pegar(n, false);
    for (const op of n.opcoes ?? []) pegar(op, true);
  }
  return saida;
}
const semEfeito = (l) => l.estado === 'registrado' || (l.estado === 'inerte' && !NAO_SE_APLICA.test(l.nota ?? ''));
const parcial = (l) => l.estado === 'aproximado';

function agrupar(linhas) {
  const g = new Map();
  for (const l of linhas) {
    const k = (l.nota ?? '(sem nota)').replace(/\s+/g, ' ').trim();
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(l);
  }
  return [...g].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
const ondeE = (l) => (l.asc ? `asc. ${l.asc}` : l.maestria ? 'maestria' : l.tipo === 'keystone' ? 'keystone' : l.tipo === 'notable' ? 'notável' : 'nó');
const escapar = (t) => String(t).replace(/\|/g, '\\|');

/** O relatório em Markdown (e os números). */
export function relatorio(arvore, hoje = new Date()) {
  const linhas = linhasDaArvore(arvore);
  const n = (f) => linhas.filter(f).length;
  const se = linhas.filter(semEfeito);
  const pa = linhas.filter(parcial);
  const decisao = (nota) => DECISAO_DO_DONO.find(([re]) => re.test(nota ?? ''))?.[1] ?? null;
  const numeros = {
    linhas: linhas.length,
    comEfeito: n((l) => ['equivalente', 'novo', 'aproximado'].includes(l.estado)),
    equivalente: n((l) => l.estado === 'equivalente'), novo: n((l) => l.estado === 'novo'), aproximado: pa.length,
    semEfeito: se.length, registrado: n((l) => l.estado === 'registrado'), faltaNoJogo: n((l) => semEfeito(l) && FALTA_NO_JOGO.test(l.nota ?? '')),
    decisaoDoDono: se.filter((l) => decisao(l.nota)).length,
    naoSeAplica: n((l) => l.estado === 'inerte' && NAO_SE_APLICA.test(l.nota ?? '')), lembrete: n((l) => l.estado === 'nota'),
    semEfeitoPrincipal: se.filter((l) => !l.asc).length, semEfeitoAscendencias: se.filter((l) => l.asc).length,
  };
  const md = [];
  md.push('# Árvore de passivas do PoE — o que falta e o que é parcial', '');
  md.push(`Gerado por \`game/tools/relatorio-arvore-poe.mjs\` em ${hoje.toISOString().slice(0, 10)}, a partir de \`game/gamedata/itens-poe/arvore-poe.json\` — o mesmo estado que o balão da árvore mostra em cada linha. Remontar a árvore (\`node tools/montar-arvore-poe.mjs\`, depois de mexer numa regra de \`traducao.json\`) atualiza o balão e este relatório juntos.`, '');
  md.push('## Resumo', '');
  md.push(`- Linhas: **${numeros.linhas}** (nós, ascendências e opções das maestrias).`);
  md.push(`- ✓ Com efeito: **${numeros.comEfeito}** — equivalente ${numeros.equivalente}, novo ${numeros.novo}, aproximado (parcial) ${numeros.aproximado}.`);
  md.push(`- ✗ Sem efeito: **${numeros.semEfeito}** — na árvore principal ${numeros.semEfeitoPrincipal}, nas ascendências ${numeros.semEfeitoAscendencias}; sem regra de efeito (registrado) ${numeros.registrado}; habilidade/mecânica que falta no jogo ${numeros.faltaNoJogo}; **${numeros.decisaoDoDono} estão nos blocos que o dono mandou implementar (12/10)**.`);
  md.push(`- – Não se aplica ao jogo: ${numeros.naoSeAplica}. Lembretes do PoE (entre parênteses, sem marca): ${numeros.lembrete}.`, '');
  md.push('## Implementado a pedido do dono (12/10)', '');
  md.push('| Bloco | Linhas com efeito agora | Sem efeito ainda | O que mudou no jogo |', '|---|---:|---:|---|');
  for (const b of IMPLEMENTADOS) {
    const ls = linhas.filter((l) => b.re.test(l.texto) && !b.fora?.test(l.texto));
    md.push(`| ${escapar(b.bloco)} | ${ls.filter((l) => ['equivalente', 'novo', 'aproximado'].includes(l.estado)).length} | ${ls.filter(semEfeito).length} | ${escapar(b.jogo)} |`);
  }
  md.push('');
  md.push('## Sem efeito (✗), pelo motivo', '');
  md.push('| Linhas | Motivo | Bloco a implementar (dono, 12/10) | Exemplos (nó — texto) |', '|---:|---|---|---|');
  for (const [nota, ls] of agrupar(se)) {
    const ex = [...new Map(ls.map((l) => [l.texto, l])).values()].slice(0, 3).map((l) => `${escapar(l.no)} (${ondeE(l)}) — ${escapar(l.texto)}`).join('<br>');
    md.push(`| ${ls.length} | ${escapar(nota)} | ${decisao(nota) ? escapar(decisao(nota)) : '—'} | ${ex} |`);
  }
  md.push('', '## Parcial (aproximado, ✓ com diferença do PoE), pelo motivo', '');
  md.push('| Linhas | A diferença | Exemplos (nó — texto) |', '|---:|---|---|');
  for (const [nota, ls] of agrupar(pa)) {
    const ex = [...new Map(ls.map((l) => [l.texto, l])).values()].slice(0, 3).map((l) => `${escapar(l.no)} (${ondeE(l)}) — ${escapar(l.texto)}`).join('<br>');
    md.push(`| ${ls.length} | ${escapar(nota)} | ${ex} |`);
  }
  md.push('');
  return { md: md.join('\n'), numeros };
}

/*
 * ---- (15/10) AS JOIAS dos encaixes da árvore (lotes 27 a 29) ----
 * O dono mandou fazer as joias e "as pendências e os efeitos que não funcionam" (15/10): a seção mostra o que já vale (os encaixes, as
 * joias que caem, os mods delas e as linhas de cada única) e o que falta, com o lote previsto. Os estados são os do balão da peça (a
 * tradução de `traducao.json`, linha a linha).
 */
const LOTE_PREVISTO = [
  [/^(Split_Personality|The_Balance_of_Terror|Rational_Doctrine|Watchers_Eye|Sublime_Vision|Bound_By_Destiny|Forbidden_Flame|Forbidden_Flesh|Impossible_Escape)$/, 'lote 31 — os mods sorteados da única (raspar os pools no poedb)'],
];
const GRUPOS_DE_JOIA = [
  ['Carmesim, Viridiana, Cobalto e Prismática', (u) => ['Joia Carmesim', 'Joia Viridiana', 'Joia Cobalto', 'Joia Prismática'].includes(u.base)],
  ['Abissais (os 4 Olhos)', (u, classe) => classe === 'Abyss_Jewels' && !!u.base],
  ['Atemporais', (u) => u.base === 'Joia Atemporal'],
  ['Ramificadoras', (u) => /Ramificadora/.test(u.base ?? '')],
];
const loteDa = (slug, grupo) => (grupo === 'Atemporais' ? 'Atemporais (as tabelas do PoB, com a autorização do download)' : grupo === 'Ramificadoras' ? 'Ramificadoras (raspar os encantamentos e notáveis no poedb)' : LOTE_PREVISTO.find(([re]) => re.test(slug))?.[1] ?? 'lote 30 — as outras linhas dos únicos de joia');

async function secaoDasJoias() {
  process.env.ITENS_POE ??= '1';
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  const T = await import('../systems/itens-poe/traduzir.mjs');
  const cat = Catalogo.catalogo();
  if (!cat?.classes?.Jewels) return [];
  const md = ['## As joias dos encaixes da árvore (lotes 27 a 29)', ''];
  md.push('- **Encaixes**: os 21 da árvore (15 Básicos e os 6 Grandes da borda); os Médios e Pequenos são das Ramificadoras. Raio na árvore como no PoE/PoB: Pequeno 960, Médio 1440, Grande 1800 (o Fio de Esperança em anéis).');
  md.push('- **Joias que caem**: Carmesim, Viridiana e Cobalto (Normal, Mágica, Rara e Única), a Prismática (só Única) e os 4 Olhos Abissais (nos encaixes da árvore e nos Encaixes Abissais das peças).');
  for (const [nome, classe, fora] of [['Jewels', 'Jewels', /^(Timeless_Jewel)$/], ['Abissais', 'Abyss_Jewels', null]]) {
    const c = cat.classes[classe];
    const r = T.cobertura({ classes: { [classe]: { ...c, paginas: Object.fromEntries(Object.entries(c.paginas).filter(([p]) => !fora?.test(p))) } } });
    md.push(`- **Mods das joias ${nome === 'Jewels' ? 'Carmesim/Viridiana/Cobalto/Prismática' : 'Abissais'}** (prefixos e sufixos, pelo peso de sorteio): ${r.comEfeitoNoCombate}% com efeito.`);
  }
  md.push('', '| Únicas | Linhas | ✓ Com efeito | – Lembrete / não se aplica | ✗ Sem efeito |', '|---|---:|---:|---:|---:|');
  const faltam = [];
  for (const [grupo, f] of GRUPOS_DE_JOIA) {
    const conta = { total: 0, efeito: 0, lembrete: 0, sem: 0 };
    let unicas = 0;
    for (const classe of ['Jewels', 'Abyss_Jewels']) {
      for (const u of cat.classes[classe]?.unicos ?? []) {
        if (!f(u, classe) || !u.modificadores?.length) continue;
        unicas++;
        for (const m of u.modificadores) {
          const t = T.traduzirMod({ modelo: m.modelo, valores: (m.faixas ?? []).map((x) => x[0]) });
          const nota = t.partes.find((p) => p.nota)?.nota ?? '';
          conta.total++;
          if (['equivalente', 'novo', 'aproximado'].includes(t.estado)) conta.efeito++;
          else if (t.estado === 'lembrete' || (t.estado === 'inerte' && /^não se aplica/i.test(nota))) conta.lembrete++;
          else {
            conta.sem++;
            faltam.push({ grupo, unica: u.nome, slug: u.slug, texto: m.texto, nota });
          }
        }
      }
    }
    md.push(`| ${escapar(grupo)} (${unicas}) | ${conta.total} | ${conta.efeito} | ${conta.lembrete} | ${conta.sem} |`);
  }
  md.push('', '### O que ainda não funciona nas joias únicas, pelo lote previsto', '');
  md.push('| Lote | Única — linha |', '|---|---|');
  const porLote = new Map();
  for (const x of faltam) {
    const lote = loteDa(x.slug, x.grupo);
    if (!porLote.has(lote)) porLote.set(lote, []);
    porLote.get(lote).push(x);
  }
  for (const [lote, xs] of porLote) md.push(`| ${escapar(lote)} (${xs.length}) | ${xs.map((x) => `${escapar(x.unica)} — ${escapar(x.texto)}${x.nota ? ` _(${escapar(x.nota)})_` : ''}`).join('<br>')} |`);
  md.push('');
  return md;
}

/** Lê a árvore montada, escreve o relatório (com a seção das joias) e devolve os números. */
export async function gravarRelatorio(hoje = new Date()) {
  const r = relatorio(JSON.parse(readFileSync(ARVORE, 'utf8')), hoje);
  const joias = await secaoDasJoias();
  writeFileSync(DESTINO, joias.length ? `${r.md}\n${joias.join('\n')}` : r.md);
  return r.numeros;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const numeros = await gravarRelatorio();
  console.log(JSON.stringify(numeros), '→', DESTINO.pathname);
}
