# Checklist de módulos — Ravox Idle restaurado

Cada ícone da barra (e mais alguns sistemas fora dela) verificado um a um, ao vivo, no
servidor local (`server/`). Estado em 2026-09-22, depois de duas rodadas de correção
ampla (ver "Correções que desbloquearam vários módulos de uma vez", no fim).

Legenda:
- ✅ **abre limpo** — sem erro no console, com dado real ou estado vazio correto
- 🟡 **abre, mas trava** — o painel aparece, mas fica em "carregando..." esperando uma
  resposta de comando que o servidor ainda não implementa
- 🔴 **crash confirmado** — erro no console, específico e já identificado
- ⚪ **não testado ainda**

## Barra de ferramentas (21 botões, ordem da barra)

| # | Ícone | Abre (arquivo) | Comandos do protocolo | Status | Observação |
|---|---|---|---|---|---|
| 1 | Banco | `openBank` panels.mjs:17312 (+ clique na carteira do topo, + NPC Banker) | `bank` (`deposit`/`withdraw`/`transfer`), `falarComNpc` | ✅ | **Implementado em 2026-09-24** (`server/sistemas/banqueiro.mjs`; antes nenhum comando tinha handler). O código do banco no client ao vivo é idêntico ao nosso. Respostas iguais às medidas no original: tudo como `notice` ("Depositou N gold", "Sacou N gold", "valor inválido", "personagem não encontrado", "você não pode transferir para si mesmo"), quantia truncada e limitada ao saldo. A transferência sai do BANCO e cai no banco do outro, online ou offline (texto de sucesso não capturado). O Banker responde `npcFala` com a fala real e abre o banco. A morte agora cobra 20% do ouro carregado (`ouroFracao` real) e manda `{t:'death'}`; a perda de exp ainda NÃO existe. A moeda do loot cai direto no banco (medido no original). Testes: `server/testes/banco.test.mjs` + clique real. |
| 2 | Depósito | `openLocker` panels.mjs:14082 | `reward`, `depot`, `pouch`, `store` (cofre-vagas) | ✅ | Caixa "Recompensa de Boss" mostra vazio corretamente. |
| 3 | Prey | `openPrey` panels.mjs:4709 | `prey` (`choose`/`rerollBonus`/`rerollList`/`option`/`selectAll`) | ✅ | **Sistema completo em 2026-09-24** (`server/sistemas/prey.mjs`). Os 5 comandos têm handler; `character.prey` é por personagem (não mais o molde). Calibrado nos 2 personagens reais capturados: % por estrela do Tibia (dano 7–25, defesa 12–30, exp/loot 13–40), lista nova = 200×level de ouro, grátis a cada 20h por slot, lista de 9 criaturas (bestiário com exp, sem boss). Trocar bônus (1 wildcard, nunca piora as estrelas), escolher qualquer criatura (5 wildcards), Renovar sozinho / Travar bônus (cobram na renovação), 3º slot pela Ravox Store. O relógio de 2h só corre dentro da hunt; os 4 bônus valem só contra a criatura do slot (dano em `Ficha.rolarCritico`, defesa no golpe do bicho, exp e chance de loot na morte). Testes: `npm test` (`server/testes/prey.test.mjs`) + clique real no painel. |
| 4 | Forja | `openForja` panels.mjs:21137 | `forja`, `forjaSubir`, `forjaTransferir`, `forjaAfixos` + 9 de afixos, `craft`, `craftFazer`, `desmanche`, `desmancharPeca` | ✅ | **As 4 abas completas em 2026-09-24.** Craft (`sistemas/craft.mjs`) e Desmanche (`sistemas/desmanche.mjs`) eram novos: receitas reais das 5 vocações (Craftado + V2) e os 7 grupos reais da máquina, tirados das fichas capturadas. O craft consome a peça-base mais rica e a nova HERDA tier, imbuements e afixos, no mesmo lugar. O desmanche só leva cópias limpas, é tudo-ou-nada e paga Dismantle Token. Confronto com o original: o servidor gera fichas IDÊNTICAS às capturadas (Tier 139/139 peças, Afixos 145/145, Craft nas 5 vocações, Desmanche). Isso achou 3 divergências, já corrigidas: o Tier não listava a bolsa de loot; os Afixos não listavam a mochila; e "torto" em arma vale para toda perícia que não seja a da própria arma. Ícones das abas e selos de tier baixados do site. Testes: `server/testes/forja.test.mjs` + craft/desmanche clicados no jogo. |
| 5 | Árvore | `openArvore` arvore.mjs:37 | `arvore` (`aplicar`/`zerar`/`escolherHabilidade`/`tirarHabilidade`/`guardarMontagem`/`usarMontagem`/`apagarMontagem`) | ✅ | **Implementado em 2026-09-24** (`server/sistemas/arvore.mjs`). Catálogo REAL das 5 vocações capturado no original (`api-mapeada/servidor/arvore-<voc>.json` → `gamedata/arvore/<voc>.json`; paladin do Biro, sorcerer/druid/monk de personagens temporários "Tmparv *" criados na conta do dono) + as 5 artes `arvore2-<voc>.png`. Regras medidas: pontos = ⌊(level−8)/2⌋; refazer 100k/level, tirar habilidade 20k/level, usar montagem que tira 30k/level (carteira e depois banco); 1 vaga a cada 700 levels (máx. 3); tirar só fora da caçada. Os 10 textos de erro são os do original, na mesma ordem de conferência; montagem `{nome,pontos,habilidades,plano,tira,preco}` idem. A vista do Zoros (knight 407) bate campo a campo com a captura. Bônus ligados no jogo: crítico, dano crítico, leech, perícias, dano por elemento, "Dano", tempo entre golpes, custo de mana, vida/mana máx., regeneração, absorção, dano recebido, força de cura, flecha que atravessa; e as 15 habilidades de medalhão (menos o `julgamento` do paladin, e a penetração de armadura: aqui o bicho não tem resistência/armadura contra o jogador). Testes: `server/testes/arvore.test.mjs`. |
| 6 | Gem Atelier | `openGemas` gemas.mjs:132 | `gemas` (`destruir`/`revelar`/`triturar`/`encaixar`/...) | 🟡 | Abre, "carregando..." — sem handler de `gemas`. |
| 7 | Charms | `openCharms` panels.mjs:8730 | `charms` (`assign`/`upgrade`) | 🟡 | Abre, "carregando..." — sem handler de `charms`. |
| 8 | Proficiência | `openProficiency` panels.mjs:8439 | `proficiency` (request/`itemId`/`action:'perk'`) | ✅ | Abre limpo, mostra "nenhum a arma com esse filtro" e "0 de 0 armas" (texto correto, só quebrado em várias linhas — CSS, não crash). |
| 9 | Imbuements | `openImbuements` panels.mjs:4714 | `imbuements` (request), `imbue` (`{slot,id}`/`remove`) | ✅ | Corrigido nesta rodada. Mostra o equipamento real (Steel Axe, Dwarven Shield, etc.) com nome de verdade. **Nota do agente**: `main.mjs` não tem `case 'imbuements'` no switch — verificar se a resposta do servidor precisa entrar como campo extra de `state` em vez de mensagem própria, antes de implementar o handler. |
| 10 | Hunts | `openHunts` panels.mjs:387 | `store`, `favorita`, `limites`, `autoBoss`, `lobby`, `settings`, `itemRule`, `lootPreset` | 🟡 | **Era um crash**, depois um catálogo vazio — os dois corrigidos. O `catalog` inteiro agora é o REAL, capturado ao vivo do site original (ainda no ar): **48 hunts de verdade** (Troll Cave, Glooth Pyramid, Mistrock Cyclops, ...), 87 bosses, 36 hunts vip, com nome/level/blurb reais. **Combate implementado em 2026-09-23** (ver `server/sistemas/cacadas.mjs` e a seção "Combate e hunts" no fim) — mas só `troll-cave` e `amazon-camp` têm terreno real capturado E são apropriadas pro nível de um personagem novo; as outras 46 abrem (protocolo `startHunt` funciona) mas ou recusam por falta de terreno real, ou (as de nível altíssimo) matam instantaneamente um personagem novo — esperado dado o gap de nível, não um bug. |
| 11 | Voltar à cidade | — | `stopHunt` | ⚪ | Trivial (um envio só); não testado à parte. |
| 12 | Personagem | `openCharacter` main.mjs:7655 → sheet.mjs | `vocation`, `outfit`, `mount`, `mounts` | ✅ | **Era um crash** (`character.bestiary`/`skills[x].value`/`magic` undefined) — corrigido com o molde de personagem real. Ficha inteira renderiza: HP/mana/stamina, skills em 10, capacidade 470oz real, velocidade 234 real, progresso "faltam 2.200 de exp". **Aba Aparência corrigida em 2026-09-23** (o dono reportou "a parte de aparência não está funcionando"): `renderAppearance` manda `{t:'mounts'}` e trava em "carregando..." pra sempre se não responder — não havia handler nenhum. Criado `server/sistemas/aparencia.mjs`: `mounts` devolve o outfit da própria vocação como o único "dono" (sem loja, é o único outfit real que existe) e nenhuma montaria; `outfit` salva as cores (head/body/legs/feet) recusando trocar de `type` pra um outfit que não tem; `mount` só aceita `id:0` (tirar montaria) — qualquer id de montaria dá erro de verdade ("Você não tem essa montaria."), já que nenhuma foi capturada/comprada ainda. Testado via WS: `mounts` sai da tela de loading, cor salva, outfit-type inválido recusado, `mount:0` aceito, `mount` de montaria inexistente recusado. |
| 13 | Inventário | inventory.mjs (janela flutuante) | `usar`, `equip`, `unequip`, `pouch`, `largar`, `destroy`, `juntar`, `organizar`, `trocar`, `split`, `pegar`, `tierUp`, `itemRule`, `joias`, `ammo`, `aljava` | ✅ | "Cap 367.00 / 470 oz" — peso real, correto (confirmado por `get_page_text`; um screenshot pequeno tinha feito o ponto decimal parecer um bug que não existe). |
| 14 | Cyclopedia | `openCyclopedia` panels.mjs:15414 | nenhum (lê `state.catalog.itens`/`bestiary`/`magias`, carregado no login) | ✅ | **O grande vencedor desta lista**: mostra os 6.178 itens reais, com nome, preço e categoria, busca e filtros funcionando. |
| 15 | Quests | `openQuests` panels.mjs:5207 | `tasksDeBicho`, `entrega`, `marco`, `presente`, `diario`, `diarioEscolher` | ✅ | Abre com as 5 abas, mostra o aviso real de "Auto Task desligado", trava em "Consultando as tasks..." (comando sem handler) — mas não crasha. |
| 16 | Amigos | `openFriends` panels.mjs:16843 | `friends` (`list`/`add`/`accept`/`decline`/`remove`), `grupo` (`convidar`) | ✅ | Abre limpo, "Sua lista está vazia. Escreva o nome de alguém acima." — estado vazio real e correto. |
| 17 | Highscores | `openRanking` panels.mjs:16977 | `ranking` (`category`) | ✅ | Abre com as 9 abas de categoria, tabela vazia (correto — `ranking: []`). |
| 18 | Party | janela flutuante, panels.mjs:18730 | `friends`, `grupo`, `party`, `settings` | ✅ | Abre vazia, sem crash. |
| 19 | Bolsa de loot | inventory.mjs:2917 (janela) | nenhum ao abrir; `pouch`/`settings`/`itemRule`/`destroy`/`largar` nas interações | ✅ | Visível por padrão desde o começo, "0/1000" correto. |
| 20 | Chat | chat.mjs:1508 (janela) | `chat` (`channel`/`text`/`to`), `presenca` | ✅ | Visível por padrão, abas Local/Global/Servidor/Combate funcionando. |
| 21 | Analisador | main.mjs:6755 (janela) | `resetAnalyzer` | ✅ | Abre com os três analisadores zerados corretamente ("fora da caçada"). |

## Fora da barra (nível de importância)

| Sistema | Abre | Comandos | Status | Observação |
|---|---|---|---|---|
| Ravox Store | `openStore` panels.mjs:9011 | `store`, `historicoDaLoja`, `caixa`, `outfit`/`mount`, `transfer` | 🟡 | **Parcialmente implementado em 2026-09-23** (`server/sistemas/loja.mjs`, novo): abre e mostra 2 das 11 prateleiras com dado 100% real — **Serviços** (premium 7/15/30/90, prey-slot, wildcards ×5/×25, bless-pack, passe de auto-boss/auto-task nos dois prazos, todos com preço real de `CATALOGO.storePrices`) e **Buff Power** (os 3 itens reais do personagem capturado, 200 coins cada ou 500 o trio — preço citado no próprio comentário do dono em `panels.mjs:10103`). As outras 9 prateleiras (itens, exercises, montarias, outfits, pacotes, utilities, upgrades, extras, boosts) ficam de propósito vazias ("Nada por aqui ainda.") — nenhum preço/nome/aparência real foi capturado para elas, e o dono escolheu não inventar. `historicoDaLoja`/`transfer`/`redeem` (compra com dinheiro real) ainda não têm handler. Testado via WS: cada compra debita coins e aplica o efeito de verdade (wildcards soma, blessings aplica as 7, passe estende `passeAte`, premium soma dias, buff power entrega o item pra mochila e liga o `tem`); produto inexistente e saldo insuficiente devolvem erro sem debitar. Um bug achado e corrigido durante o teste: o id do Buff Power na prateleira usava a chave de string do catálogo (`poder`/`exp`/`loot`), mas o código que aplica o efeito tentava ler um número dali — a compra cobrava e não entregava nada. |
| Mercado | `openMarket` panels.mjs:9051 | `market`, `coinMarket` | 🟡 | Abre com filtros/abas completos, "carregando..." — sem handler de `market`. |
| Blessings | `openBlessings` panels.mjs:4962 | `blessings`, `store`, `bless` | ⚪ | Não testado; provavelmente igual ao padrão (abre, trava). |
| Bestiary | aba de Cyclopedia | nenhum | ✅ | Testado como parte do Cyclopedia (item 14). |
| Loja de Task/Boss Token | panels.mjs:3842/3896 | `taskToken`, `bossToken` | ⚪ | Não testado. |
| Exercise / Treino offline | panels.mjs:4029/17491 | `training`, `settings` | ⚪ | Não testado — mas os bonecos de treino JÁ aparecem na cidade real (visual). |
| Presente / Diário | panels.mjs:17906/22097 | `marco`, `presente`, `diario`, `diarioEscolher` | ✅ | **Implementado e testado ponta a ponta**: escolher a arma de treino do level 8 entrega o item real no inventário e o botão desaparece; coletar o dia do calendário dá a recompensa real e avança pro dia seguinte. Dois bugs achados e corrigidos: (1) faltava zerar `presentes.pendentes`/`marcosAbertos` depois de resgatar — o botão continuava achando que ainda tinha presente; (2) **a recompensa diária podia ser coletada infinitas vezes no mesmo "dia"** (achado pelo dono) — não havia relógio nenhum, só um `podePegar: true` fixo que a coleta religava na hora. Agora `podePegar`/`jaPegouHoje` são calculados a cada envio a partir de `diario.ultimoColetadoEm` (nunca guardados prontos), com uma janela de 20h entre coletas (`R.INTERVALO_DIARIO_MS`) — testado: coletar duas vezes em sequência dá `error` na segunda e não avança o dia. `marco` (recompensa de equipamento, ex. level 50/100) tem a mesma lógica de resgate mas não foi clicado ainda (nenhum personagem de teste chegou no level). |
| Loja de NPC (Zuma etc.) | panels.mjs:21569 | `falarComNpc` | ⚪ | Não testado; os NPCs reais (Banker, Zuma Magehide) já aparecem na cidade. |
| Filtro de loot | panels.mjs:7889 | `itemRule` | ⚪ | Não testado. |
| Largar / destruir / pegar do chão | inventory.mjs (menu de item + drag-drop) | `largar`, `destroy`, `pegar` | ✅ | **Implementado e testado**: `largar` tira do inventário e empilha no chão da casa; `pegar` (com `indice:null` = topo da pilha) tira do chão e devolve ao inventário; `destroy` remove de vez. O chão é um `Map` compartilhado (`server/sistemas/inventario.mjs`), semeado no boot com os itens REAIS que estavam largados no spawn quando a cidade foi capturada (sun fruit, sword, mace, brass helmet...) — pegar e largar mexem nesse mesmo mapa, não em algo separado por personagem. Casos de erro testados: destruir peça que não tem, pegar de casa vazia, largar mais do que tem — todos devolvem `{t:'error'}` sem corromper o inventário. **Bug achado pelo dono e corrigido em 2026-09-22**: arrastar uma peça que já estava no chão para OUTRA casa (mudar de lugar sem passar pela mochila) mandava `{t:'largar', de:{x,y}, x, y, deIndice}` — sem `id` nenhum — e o servidor só sabia ler o formato `{id,count,x,y}` da mochila; a peça nunca saía do lugar, sempre com "Você não tem essa peça." Corrigido com um ramo `de`/`deIndice` em `largar()` que move direto de uma pilha do `CHAO` para outra. Testado ponta a ponta via WS: mochila→chão, chão→chão (novo), chão→mochila, e o caso de erro (mover de casa vazia). **Segundo pedido, 2026-09-23**: o dono reportou que o arrastar mochila→chão às vezes não vai (arrasto nativo do navegador é frágil — falha se algo cobrir o alvo do drop) e pediu uma alternativa por botão direito + "soltar". Essa opção já existia no menu do item (`itemMenu`, linha "Jogar no chão"), mas só abria com Ctrl+direito — o direito sozinho só usava/vestia a peça, ou não fazia nada. Perguntado se queria reverter essa trava (que ele mesmo tinha pedido antes, documentado no comentário da função `acaoDoDireito`), a resposta foi trocar de vez: **direito sozinho agora sempre abre o menu completo** (`assets_raw/client/src/inventory.mjs`), inclusive em poção — usar fica um clique a mais ("Usar X" no topo do menu) em troca de nunca faltar a opção de soltar. Testado disparando um `contextmenu` de verdade no item da mochila via JS (sem Ctrl): o menu abriu com "Jogar no chão", e clicar nele tirou o item da mochila (2/20 → 1/20). **Terceiro pedido, 2026-09-23**: o dono perguntou se para pegar precisa estar do lado do item ou encima — resposta honesta na hora: NENHUM alcance era checado, `pegar`/`largar` (o ramo `de`) funcionavam a qualquer distância do mapa. Adicionado `noAlcance()` em `server/sistemas/inventario.mjs` (distância de Chebyshev ≤ 1 — a própria casa ou qualquer uma das 8 vizinhas), aplicado em `pegar()` e no ramo `de` de `largar()`; erro novo: `{t:'error', message:'Está muito longe.'}`. Testado via WS: pegar na própria casa (distância 0) ✅, numa vizinha (distância 1) ✅, a 4 casas de distância ❌ "Está muito longe."; o mesmo na mudança de casa do chão (`de`). |

## Correções que desbloquearam vários módulos de uma vez

Duas causas-raiz explicavam a maioria dos crashes, e corrigir cada uma de uma vez só
desbloqueou vários painéis simultaneamente — mais eficiente do que corrigir painel por
painel:

1. **`catalog` do `hello` só tinha 3 campos.** Uma varredura em todo `catalog.X`/
   `catalog?.X` do cliente achou ~25 chaves — `hunts`, `bosses`, `bestiary`,
   `especiais`, `vips`, `skills`, `imbuements`, `preyBonuses`, etc. —, várias lidas
   **sem** `?.` (`catalog.hunts.length` em `openHunts`, por exemplo). Sem a chave, não
   dá `undefined` tratado — dá `Cannot read properties of undefined`. Corrigido com um
   `CATALOGO` completo em `sessao.mjs` (defaults vazios, mas do TIPO certo — `preyBonuses`
   precisou ser array, não objeto, por exemplo).
2. **`character` só tinha ~15 campos; o cliente lê ~90.** Em vez de adivinhar cada um,
   usamos **um personagem REAL capturado ao vivo** (`character-template.json`, o mesmo
   arquivo de `api-mapeada/character-real-example.json`) como MOLDE — `characterParaCliente`
   espalha esse molde por baixo e só sobrescreve os campos que este servidor calcula de
   verdade (hp/mana reais por vocação, equipamento real, ouro, nível). Isso deu de
   graça: `skills` todos em 10 (base do level 8), `wildcards: 5`, `progress.toNext:
   2200`, `derived.armor/defense/damage` plausíveis, `bestiary: {}`, `blessings: []`.

## Bugs conhecidos que sobraram (não são crash, mas estão errados)

- **`character.efeitos.buffPower[0].resumo`** no molde tem um caractere corrompido
  (`cr�tico` em vez de `crítico`) — veio da captura, provavelmente um problema de
  encoding no meio do caminho. Baixo impacto (só aparece se alguém abrir esse item
  específico), mas vale corrigir o arquivo `character-template.json` se for reusado.
- ~~`character.derived.expBonus: 48` do molde~~ — **não era bug**: é
  `levelBonus(level)` de `formulas.mjs` (decai de 50% no level 1 a 0% no level 200),
  e 48% é exatamente o valor real no level 8. Ainda assim, trocado por
  `R.levelBonus(estado.level)` calculado (em vez do número fixo do molde), porque o
  fixo ficaria errado no primeiro level up.

## Combate e hunts (2026-09-23)

Primeira versão funcional, pedida explicitamente pelo dono depois de uma captura ao
vivo real de combate (`api-mapeada/captura-combate-real.json` — Troll batendo 4 de
dano, Amazon batendo 1, ambos numa Knight nível 33, capturados abrindo o navegador
dele e observando o WebSocket com sua permissão e login).

**O que é real:**
- As fórmulas de dano do jogador (`attackDamage`/`armorReduction`, de
  `assets_raw/packages/shared/src/formulas.mjs`) — já existiam validadas, só nunca
  tinham sido importadas em `server/nucleo/regras.mjs`. Usam `attack`/`skill` reais do
  item equipado e do personagem.
- Os monstros: 1.840 no bestiary real (`hp`, `armor`, `exp`, `loot` com chance real por
  item) — nenhum stat de monstro é chutado.
- **O terreno de 2 hunts, agora 100% real de verdade (não aproximado)**: `troll-cave`
  e `amazon-camp` tinham só um polígono aproximado (`catalog.hunts[].limite.andares`)
  até 2026-09-23 à tarde — nesse dia, capturamos o `state.hunt.map` COMPLETO de
  verdade (o mesmo formato do `city-map.json`: atlas próprio, paleta, `stacks`/
  `blocked` tile a tile, e até `route`, o caminho real que a Caça Automática seguia)
  usando o comando `pedirMapa` enquanto o dono estava dentro de cada uma no site
  original — o mesmo comando que o cliente já manda quando perde a paleta. As 5
  imagens dos atlas (`gamedata/sprites/hunts/<id>.png`) são arquivos estáticos
  públicos — essas baixamos direto por URL, SEM precisar entrar em nenhuma hunt.
  Guardado em `assets_raw/gamedata/hunts/<id>-map.json` +
  `assets_raw/gamedata/sprites/hunts/<id>.png`; `server/sistemas/cacadas.mjs` usa
  esse arquivo quando existe, e só cai no polígono aproximado + atlas da cidade
  quando não existe. `dark-thais`, `infernatil-seal`, `walking-pillar` têm as
  imagens já baixadas, mas ainda só o polígono aproximado — nível 800/950/1200,
  não confirmado se o personagem do dono (level 70) consegue entrar pra capturar o
  layout completo.
- As posições de spawn de cada monstro (`catalog.hunts[].posicoes`) são as reais
  daquela sessão capturada — os monstros nascem exatamente onde nasceram de verdade.

**O que é aproximado, documentado como tal no código (`R.ataqueDoMonstro`, em
`regras.mjs`):**
- **Quanto um monstro bate.** O bestiary real nunca teve esse campo — confirmado
  batendo numa hunt de verdade em produção e vendo o wire: só chega o dano JÁ
  CALCULADO, nunca o ataque bruto. A fórmula usada (proporcional ao `hp` real do
  bicho) foi calibrada à mão contra as duas amostras reais capturadas, não inventada
  do nada, mas não é a fórmula real do jogo original.
- Morte do personagem é simplificada (volta pra cidade com vida cheia) — a morte real
  perde exp/gold/blessing, só descrita nos comentários do cliente, nunca vista no wire.
- Chão da hunt: as outras 43 hunts (sem polígono capturado) recusam `startHunt` com um
  erro honesto ("Esta hunt ainda não tem terreno capturado.") em vez de inventar chão —
  no jogo original a maioria delas é gerada de novo a cada sessão, e esse gerador não
  existe em nenhum arquivo extraído.

Testado via WS: `startHunt`/`stopHunt`/`huntTarget`/`huntWalk`, combate corpo a corpo
completo (dano ida e volta, bloqueio, morte de monstro, exp real creditado, loot real
sorteado pela chance do bestiary), e os quatro casos de erro (alvo inexistente, hunt
sem terreno, hunt inexistente, hunt de nível incompatível).

**Bug achado pelo dono na hora ("quando entro na hunt fica tudo preto") e corrigido**:
o `state.hunt` nunca mandava `map` — o comentário do próprio `map.mjs` avisa que sem
isso, num `mapId` novo, "a tela fica preta". Corrigido montando um `map` real no mesmo
formato do `CITY_MAP` (`width/height/atlas/palette/stacks/blocked...`), reaproveitando
o atlas e a paleta da cidade (já carregados no cliente) — só precisava de UM índice de
paleta simples pra piso/bloqueio. Primeira tentativa usou um índice que PARECIA parede
pela frequência real nas células bloqueadas da cidade, mas era `f:14` (sprite animado,
provavelmente vegetação) — a hunt inteira piscava de moitas em vez de mostrar rocha.
Trocado pelo índice `40`, o mais comum dos dois lados (chão E bloqueado) no
`city-map.json` real e sem animação — vira um piso de tijolo uniforme (real, mas sem
distinguir visualmente andável de bloqueado ainda; a colisão do servidor continua
certa). `map` só viaja uma vez por hunt (ou de novo se o cliente pedir com
`pedirMapa`), do mesmo jeito que a cidade já fazia. Confirmado visualmente no
navegador: chão de tijolo aparece, Troll desenha certo em cima dele.

**Segundo bug achado pelo dono na mesma hora ("o mapa da caça esta errado e nem
aparece mob") — a causa de verdade era outra**: testando pela UI real (não só WS),
o personagem entrou em **Caça Automática** (o botão real, `mode:'auto'` no
`startHunt`) e ficou parado no spawn pra sempre — `tique()` só andava quando havia
`hunt.rumo`, e isso só existe depois de um `huntWalk` explícito, que a Caça
Automática NUNCA manda (só a Caça Online manda, andando na mão). Sem andar, o
personagem nunca chegava perto de nenhum monstro — daí "nem aparece mob", eles
sempre estavam lá, só longe demais para a câmera. Corrigido: `entrar()` agora guarda
o `mode` do pedido (`hunt.modo`), e em `tique()`, fora do modo `'online'`, sem rumo
manual válido, o SERVIDOR calcula um rumo sozinho na direção do alvo mais próximo
vivo — a caçada automática de verdade. Testado pela UI real: personagem andou do
spawn, matou 10 Trolls sozinho, e a vida foi descontada de verdade pelos golpes
recebidos no caminho.

**Terceiro bug achado pelo dono no PRÓPRIO personagem real (Teste) — "olha como ta
zuado", mochila em 57/20 e 891/470 oz**: o loot de `round()` chamava `darItem` direto
a cada Troll morto, sem checar se cabia na mochila — numa caçada automática matando
vários bichos sem parar, isso estourou rápido. Corrigido: agora para de dar loot
quando `inventory.length` chega na capacidade real do `container` da mochila
equipada (20, pra backpack padrão) — a peça que não coube é perdida (não cai no
chão; o jogo real levaria pela Bolsa de Loot, que ainda não existe aqui), mas pelo
menos não empilha infinito. `largar`/`pegar` (em `inventario.mjs`) continuam sem essa
checagem — pré-existente, a caçada só expôs mais rápido por matar muito mais rápido
que um jogador manual largando/pegando um item por vez. Personagem Teste do dono
ajeitado manualmente depois (mochila voltou a 20, vida para 220/220 — com permissão
pedida antes de tocar em dado real da conta dele).

**Mapa real de verdade (não só o polígono) para Troll Cave e Amazon Camp — "quero
100% igual do oficial as hunts"**: descoberto que `pedirMapa` (o mesmo comando de
recuperação que o cliente já manda quando perde a paleta) faz o servidor original
mandar o `state.hunt.map` COMPLETO — atlas próprio da hunt, paleta real, `stacks`/
`blocked` tile a tile, e até `route` (o caminho real que a Caça Automática seguia
naquela sessão). Capturado assim, com o dono dentro de cada uma no site original, pra
`troll-cave` e `amazon-camp`; as 5 imagens de atlas (`gamedata/sprites/hunts/<id>.png`)
são arquivos ESTÁTICOS públicos — essas baixamos direto por URL sem precisar entrar
em nenhuma hunt (`dark-thais`/`infernatil-seal`/`walking-pillar` já têm a imagem, só
falta o layout — nível 800/950/1200, não confirmado se o personagem do dono consegue
entrar). Guardado em `assets_raw/gamedata/hunts/<id>-map.json` +
`assets_raw/gamedata/sprites/hunts/<id>.png`; `cacadas.mjs` usa esse arquivo quando
existe (inclusive o `route[0]` real como ponto de entrada), caindo no polígono
aproximado + atlas da cidade só quando não existe.

**Monstro persegue e ataca de volta — "ta faltando os mobs andar e atacar"**: até
aqui só o monstro ESCOLHIDO como alvo brigava, e só se o jogador chegasse nele —
outros bichos adjacentes (perseguição rodeando o jogador) não faziam nada, o que
tornava cerco inofensivo. Agora todo monstro dentro de 8 casas do jogador persegue
sozinho (`moverMonstros`), e QUALQUER bicho adjacente ataca de volta no fim do round
— não só o alvo — igual ao jogo de verdade, onde ficar rodeado dói mais.

**Bug sério achado testando com o mapa real: o passo "guloso" travava em beco sem
saída de verdade.** A primeira versão só apontava `Math.sign(dx/dy)` pro alvo; numa
sala de teste vazia isso bastava, mas a caverna REAL capturada tem corredor sinuoso
com becos — precisar andar num sentido que por um instante AFASTA do alvo pra
contornar uma parede, e um passo guloso nunca escolhe isso. Resultado: personagem e
monstro ficavam batendo na mesma parede por segundos, andando 1-2 casas em 10s.
Corrigido com BFS de verdade: um mapa de distância a partir do destino (calculado uma
vez, reaproveitado por todo bicho perseguindo no mesmo tique), e o próximo passo é
sempre o vizinho com menor distância — acerta qualquer curva do mapa real, nunca
trava. Mapas de hunt têm ~1-2 mil casas andáveis; rodar isto a 4x/s não pesa nada.
Testado via WS: personagem andou de verdade pela Troll Cave real (não mais preso em 2
casas), matou 5 Trolls em 12s, tomou dano real no caminho.

## Barra de ação: magias, alvo marcado, animação e lure (2026-09-23)

O dono relatou, com print da própria barra ("Alvo"/"Distância"/"Lurar até" + os
slots + "Salvar hk"): não tinha animação, o alvo não ficava marcado, o lure não
funcionava, e "tem que funcionar como tbm todas magias e skills". Investigando:
o CLIENTE já tinha a barra inteira construída (`actionbar.mjs`, ~2600 linhas —
ícones, leque de cooldown, editor de condições, presets, hotkeys) mas o
**servidor não tratava nenhuma mensagem dela** — `actions`/`actionPreset`/
`huntAction`/`lure`/`huntAssist` caíam todas no `default` silencioso do
`despachar()`. `characterParaCliente` também espalhava `...CHARACTER_TEMPLATE`
por cima do que quer que o jogador tivesse configurado — todo personagem via
para sempre os 22 slots vazios do molde. `targetUid`/`clock`/`cooldowns` nunca
viajavam no `state.hunt` (o client já sabia desenhar a moldura vermelha e o
leque, só nunca recebia os dados). Nenhum evento `fx`/`shot` saía do combate —
por isso "sem animação", mesmo o client já sabendo desenhar os dois
(`effect-sprites.json`/`missile-sprites.json`, reais). E não existia NENHUM
número de magia/runa/poção no repositório inteiro.

Escopo combinado com o dono: motor completo e de verdade, catálogo pequeno e
curado (não as dezenas de magias reais do Tibia) — 1 poção de vida, 1 de mana,
Exura (cura, todas as vocações), Sudden Death Rune (ataque, todas), e uma magia
de ataque própria só pra quem tem uma bem conhecida e confiável (Exori pro
knight — AoE corpo a corpo real; Exevo Con Flam/Con Frigo pro sorcerer/druid —
fireball/ice strike). Paladin e monk ficam com arma equipada + runa + Exura —
sem magia de ataque inventada em nome deles.

**Construído**: `server/sistemas/acoes.mjs` (novo) — catálogo filtrado por
vocação/level, `definir`/`trocarTecla`/`trocar` dos 22 slots (validando papel
do slot E vocação/level — ver o bug abaixo), presets, e `disparar()` (cooldown,
mana, alcance de 7 casas pra ataque à distância, dano por `R.magicDamage`/
`R.attackDamage` — as fórmulas reais que já existiam em `formulas.mjs` sem
nenhum caminho que as chamasse). `cacadas.mjs` ganhou o relógio da hunt
(`hunt.clock`), o loop de auto-disparo (`autoDisparo`, dentro de `tique`),
`targetUid`/`cooldowns` no `snapshotDaHunt`, e o lure de verdade: `hunt.leva`/
`levaAlvo`/`lurando` — enquanto lurando, o passo automático anda até o próximo
bicho FORA do alcance de percepção (junta um de cada vez) em vez de brigar com
o primeiro; ao juntar a leva pedida, para e briga como sempre.

**Bug achado testando via WS** (personagem de teste, sorcerer level 8): o
`definir()` de slot só validava o PAPEL (vida/mana vs ataque), não a vocação
nem o level da magia — deu pra configurar Exevo Con Flam (level 12) num
personagem level 8, e o `disparar()` deixava sair. Corrigido nos dois lugares
(configurar E disparar, defesa em profundidade — um preset salvo antes de subir
de level não passa pelo `definir()` de novo). Achado um segundo, do mesmo teste:
nada limitava o alcance de uma magia/runa — um Sudden Death acertou um bicho a
84 casas de distância. Corrigido com o alcance real de magia (7 casas).

Verificado end-to-end via WS numa conta descartável: catálogo certo por
vocação/level, slot configurado e persistido (sobrevive a reabrir), hunt real
(troll-cave) com `targetUid` chegando, disparo manual e automático acertando
dano real, cooldown reaproveitável (`faltaDoCooldown`), morte + loot + XP pelo
caminho da magia (não só do corpo a corpo), e as duas rejeições (level baixo
demais, alvo fora de alcance) com a mensagem certa. Conta e personagem de
teste apagados do banco ao final.

**Fora do escopo, nomeado**: o catálogo completo de magias/runas reais (dezenas
por vocação, todos os níveis), curar amigo/party pela barra, exeta res
(desafiar), resistência elemental entrando na escolha automática de magia,
exercise weapons batendo sozinhas. Mesmo motor, mesmo `disparar()` — só falta
digitar o catálogo maior, se um dia isso for pedido.

**Bug reportado logo depois, testando com um druid**: "criei um druid e n ta
dando atk magico, cada classe tem um dano especifico" — e tinha razão. O golpe
BÁSICO (`round()`, fora da barra de ação) sempre usava a fórmula de arma física
(`R.golpeDoJogador`), mesmo pra sorcerer/druid, cuja arma inicial é um wand/rod
(`item-catalog.json`: `wand:{min,max,element,mana}`, sem `attack` nenhum — o
golpe saía sempre no piso mínimo). O spear inicial do paladin tinha o mesmo
problema pela metade: tem `attack` (não saía zerado), mas é arma de distância
(`range:3`) e o personagem era obrigado a andar pro corpo a corpo em vez de
atirar de longe. Corrigido em `cacadas.mjs` (`categoriaDaArma`/`alcanceDaArma`/
`golpeDaWand`): wand/rod agora atira magia de verdade com o dano/elemento REAIS
do próprio item capturado (nem é aproximado — `wand.min/max` é dado real), gasta
a mana real do item por tiro, e para no alcance da arma em vez de colar no
bicho. Verificado ao vivo: druid nova, arma inicial (`snakebite rod`, elemento
earth), matou 3 Trolls a distância com dano real (cor/elemento certos), gastando
2 de mana por tiro como o item define.

## Editor de mapas (`/editor`, 2026-09-23)

Pedido original era um editor completo estilo Tiled com painel Admin, papéis/
permissões, WebGL/Phaser, geração procedural, banco de mapas com versionamento/
publish e chunking — nada disso existia no projeto (zero rota HTTP com verbo, zero
conceito de admin no banco, zero bundler/build step, renderização sempre canvas 2D
simples). Escopo reduzido de propósito pra um MVP real, combinado com o dono antes de
implementar (ver plano salvo na sessão): canvas comum, sem login, salva no MESMO
formato que uma hunt real capturada já usa.

**O que faz**: pintar andável/bloqueado com um punhado de índices REAIS da paleta da
cidade (`CITY_MAP.palette` — os mesmos que `cacadas.mjs::construirMapa` já reaproveita
pro placeholder de hunt); marcar spawn de monstro escolhendo pelo nome real do
bestiary (`CATALOGO.bestiary` — nunca inventado); salvar grava
`assets_raw/gamedata/hunts/<id>-map.json`, o MESMO arquivo que `cacadas.mjs` já sabe
carregar — a hunt fica jogável na hora, sem passo extra.

**Peças**: `assets_raw/editor.html` + `assets_raw/client/src/editor.mjs` (canvas 2D
puro, sem framework, desenho ESQUEMÁTICO por cor — não a sprite real; ver a aparência
de verdade é entrar na hunt pelo cliente de sempre depois de salvar).
`server/sistemas/mapas.mjs` (novo, mesmo contrato `{ok,erro?}` dos outros sistemas):
`validar`/`salvar`/`carregar`/`listar`, e os dados pro editor (`PALETA_DO_EDITOR`,
`bestiarioParaEditor`). `server/index.mjs`: primeira rota HTTP com verbo do projeto
(`GET`/`POST /api/mapas...`) — três `if` bastam, sem framework novo.
`server/sistemas/cacadas.mjs::entrar()`: agora aceita um `huntId` que não existe no
`catalog.hunts` real, desde que exista o arquivo — usa os `posicoes` (spawn) de
DENTRO do próprio arquivo custom em vez do catálogo. Sem autenticação — é o servidor
local do próprio dono; criar um sistema de permissões só pra isto seria a mesma
over-engineering já descartada na conversa.

**Bug sério achado no primeiro teste — derrubou o servidor inteiro**: `tique()`/
`snapshotDaHunt()` procuravam a hunt no catálogo real (`CATALOGO.hunts.find(...)`)
sem checar se ela existia — pra um mapa custom isso dá `undefined`, e
`gradeDaHunt(undefined)` quebra tentando ler `.id`. Como o tique roda dentro de um
`setInterval` sem `try/catch` em lugar nenhum, essa exceção não ficou só com quem
tinha aquele personagem — **derrubou o processo Node inteiro, desconectando todo
mundo que estava online**. Corrigido em duas frentes: (1) `huntOuMapaCustom(huntId)`
substitui as três chamadas que assumiam catálogo, caindo num `{id: huntId}` mínimo
quando não acha; (2) `Sessao.tique()` ganhou um `try/catch` — um bug numa hunt agora
só tira aquele personagem dela (log no servidor + volta pra cidade), nunca mais o
processo inteiro. Testado depois: mapa custom carrega, monstro real spawna, sem
crash, servidor continua respondendo.

## Próximo passo

Os 🟡 (Forja, Árvore, Gemas, Charms, Store, Market, Quests) têm UI e catálogo prontos —
o que falta em cada um é o handler do(s) comando(s) da tabela acima devolver dados de
verdade (mesmo que provisórios) em vez de deixar o cliente esperando para sempre. Isso é
trabalho de sistema de jogo (a mesma lista de "Próximos passos" do README), não mais de
"o cliente quebra ao abrir".

## Captura do servidor (2026-09-23, noite)

`tools/capturar-servidor.js` (+ `tools/receptor.mjs`, que grava direto no disco)
rodou no site original, logado no Zotod (knight), só com pedidos de LEITURA — os
mesmos `send({t:...})` sem `action` que o cliente manda ao abrir cada painel.
715 pedidos, nenhum sem resposta. Resultado em `api-mapeada/servidor/`, um
arquivo por sistema: `actionCatalog` (114 magias das 5 vocações, 18 runas, 12
poções, papéis reais dos 22 slots), `forja`, `craft-por-vocacao`, `desmanche`,
`forjaAfixos`, `arvore`, `gemas`, `charms`, `store`, `market-browse`,
`coinMarket`, `blessings`, `bossToken`, `taskToken`, `tasksDeBicho`, `mounts`,
`proficiency` (lista + perks de 678 armas), `npc-zuma`/`npc-naji`, `ranking`.

Tudo isso é a VISÃO desse personagem (ouro, progresso, `blocked`, e o `damage`
das magias já calculado para o level/skill dele) — as regras continuam do lado
do servidor. `server/sistemas/acoes.mjs` já usa o `actionCatalog` real.

O cliente do site também mudou desde o primeiro download (aba Desmanche na
Forja, arena de bosses, `loot-do-bicho.mjs`, `traduz.mjs`, 1 outfit e 5 itens
novos) — atualizado em `assets_raw/`, versão antiga em `_versao-anterior-2026-09-22/`.

**Mapas de hunt** (`tools/capturar-hunts.js`, com autorização do dono, no
Zotod level 90): `stopHunt` → `startHunt` modo online → mapa → próxima, e no fim
volta para a troll-cave. 7 mapas novos completos em `gamedata/hunts/`
(dark-pyramid, port-hope-corym-dungeons, mistrock-cyclops, hive-surface,
mother-of-scarabs-lair, cults-carlin, drefia-wyrm-caves) — 9 de 48 no total.
As outras 39 o servidor recusa por nível ("precisa de level N",
`api-mapeada/servidor/hunts-resultado.json`): precisam de um personagem mais
alto. Os mapas novos são da variante ONLINE (`atlas: hunts/<id>-online`); os
atlas das 48 hunts nas duas variantes (`<id>.png` e `<id>-online.png`, 96
arquivos) são públicos e já estão todos em `gamedata/sprites/hunts/`.

**Segunda rodada** (conta Zoros, Elite Knight level 343): mais 19 mapas —
28 de 48. As 20 restantes pedem level 350 a 1200. Também o `actionCatalog`
dessa conta (`gamedata/action-catalog-lvl343.json`), que dá o segundo ponto
da reta de dano por level (`danoNoLevel`, em `server/sistemas/acoes.mjs`).

**Ícones**: 74 ícones de UI que faltavam (estados `st-*` da barra, `el-*`,
`ficha-*`, abas, patentes da Arena x1, treino...) — achados testando no site
cada nome que aparece no código e nos dados capturados.

**Cliente de novo** (update "Arena x1 e Guildas", 2026-09-23): 8 arquivos
mudaram + `guildas.mjs` novo; anterior em `_versao-anterior-2026-09-23b/`.

Ainda faltam: 20 mapas de hunt (nível), 8 andares da cidade, e os handlers de
servidor dos sistemas acima usando esses dados.

## Servidor local: jogo de verdade (2026-09-23, noite)

- **Lag**: o `state` levava o personagem inteiro (~60 KB) 10x/s. Agora vai só o
  que mudou (`charDelta`, como o original); `city`/`hunt` iguais nem vão.
  Na cidade ~0 KB/s, caçando ~26 KB/s (antes ~600 KB/s). BFS de caminho com
  profundidade limitada (caçada offline 6,5x mais rápida).
- **Poções e cura**: testadas (health/mana potion, Wound Cleansing, Light
  Healing). Sem condição no slot, a cura só sai se faltar a cura mínima;
  poções dividem a recarga de 1s.
- **Up**: personagem novo nascia com 0 de exp no level 8 (real: 4200) — a barra
  não andava. Corrigido + migração. Perícias e magic level sobem com as
  fórmulas reais (`sistemas/treino.mjs`); dano físico usa a perícia real.
- **Mochila/ficha**: `equip`, `unequip`, `usar`, `split`, `juntar`, `trocar`,
  `organizar`, `settings` (grava as preferências), `lootFiltro`.
- **Bolsa de loot** (`sistemas/bolsa.mjs`): loot cai na bolsa (1000 vagas),
  auto-venda a cada 120s na caçada, `itemRules` (noLoot/noSell/soAfixo),
  `lootPreset`, Vender, Limpar, mover bolsa<->mochila, `pouchValue`.
- **Analisador**: `hunt.startedAt` + `hunt.session` no formato real (exp,
  kills, gold, lootValue, supplies, byMonster, expPorNome, damageDealt,
  porElemento, loot, perdido, gastos) + `resetAnalyzer`.
- **Ravox Store**: a loja REAL inteira (`gamedata/store-real.json`) — 8 pacotes,
  14 serviços, 31 exercises, 5 boosts, 12 itens, 4 buff power, 5 upgrades,
  12 extras, 242 montarias, 115 outfits. Comprar montaria/outfit libera
  (aparência usa `gamedata/mounts-real.json`, 250 montarias/260 outfits);
  item vai para a mochila (exercise com as cargas); boosts/upgrades/extras
  ficam registrados em `estado.compras` (efeito ainda não aplicado).
