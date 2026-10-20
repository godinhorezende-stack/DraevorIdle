# Gemas do PoE: progresso da auditoria e da implementação

Arquivo de progresso do pedido do dono de 17/10/2026 ("Auditoria completa e fidelidade ao PoE 1": todas as gemas de habilidade e de suporte, compatibilidade, cálculos, imagens, interface, testes). Atualizar a cada lote: o que foi feito, os números antes/depois e o próximo passo exato.

- **Relatório automatizado:** `cd game && ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` → `docs/gemas-poe-implementacao.md` (+ `.json`); `--resumo` só mostra os totais. Ele lê o código: o status no jogo (`itens-poe/gemas-poe.mjs`, `itens-poe/suportes-poe.mjs`), os ícones, a compatibilidade (`suportes-compat.json`), os testes que citam cada gema e o catálogo do poedb (cache do Scrapling em `/home/deploy/scrapling/saida/html`).
- **Branch:** `claude/skill-gem-atk-lines-report-690ea5` (a partir da `main` 072f8186). Outro branch aberto e não mergeado, `claude/isolated-worktree-implementation-279037` (lotes 49–62 da árvore), mexe em `mods-poe.mjs`, `lacaios-poe.mjs`, `skills/gemas.mjs` e `condicoes-poe.mjs`: cuidado com conflito.

## Inventário inicial (17/10, antes do lote G1)

| | Total | Implementada e testada | Sem teste próprio | Limitação do idle | Parcial | Sem efeito |
|---|---|---|---|---|---|---|
| Gemas de habilidade | 562 | 41 | 63 | 42 | 405 | 11 |
| Ataques (dentro delas) | 210 | 13 | 35 | 11 | 151 | 0 |
| Suportes | 262 | 23 | 51 | — | 157 | 31 |

- Variantes: 52 Vaal (43 parciais), 198 alternativas (156 parciais).
- Catálogo × poedb (Skill_Gems + Support_Gems em pt): 824 = 824. Nenhuma gema faltando, nenhuma sobrando.
- Imagens: 562/562 ativas com ícone da gema e da habilidade, 262/262 suportes. Os 15 desenhos repetidos entre bases diferentes são os mesmos no poedb (o Pacifismo usa o desenho da Chance de Fuga, a Matança dos Fracos o do Golpe de Misericórdia…). Nenhuma troca.
- Compatibilidade: 562 ativas com regra, 260 de 262 suportes (58.049 pares).
- Linhas faltando: 957 distintas (215 em duas ou mais gemas).

## Lotes

### G1 — linhas locais das gemas e a qualidade das ativas (17/10, commit ad4a7e54)

- Novo `itens-poe/linhas-das-gemas.mjs`: a linha de gema que é um modificador que o jogo já calcula vira atributo do PoE (`poder_arcano`, `mais_dano%carga:frenesi`, `atk_speed_mais%carga:frenesi`, `crit_chance_inc@alvoEletrizado`, `area_mais@posturaAreia`, `mais_dano@maoPrincipal`…) e entra no uso DAQUELA gema como condicional de golpe (`ficha.porTag` com a tag `habilidade`). As regras próprias ficam primeiro e o tradutor dos mods das peças e da árvore (`traduzir.traduzirParte`) entra depois. Só conta como feita a linha cujos atributos o uso lê (`LIDOS_NO_USO`).
- **A qualidade das gemas ativas passou a valer** (`GemasPoe.linhasLocaisNoNivel(slug, nivel, qualidade)`): antes só o "mais Dano por cada tipo de Afecção" do Acerto Elemental. Agora 113 de 536 linhas de qualidade (as que viram atributo lido no uso).
- `acoes.comAsLinhasDaGema` liga as linhas no `contaDoDano` (dano e crítico), no `temposDaGemaPoe` (velocidade, + o `atk_speed_mais` condicional) e no `comOsAlvosDaGema` (área).
- Teste: `game/testes/gemas-linhas-locais-poe.test.mjs` (4 testes: os números, o status, o Poder Arcano no dano — 24% → 124% de aumento com 50% de Dano Mágico — e o Frenesi na velocidade e no "mais dano"). Gemas/velocidade/balão/suportes: 33 passam, 0 falham.
- Depois: parcial 405 → 398 nas ativas, ataques 151 → 146, linhas distintas 957 → 936.

### G2 — a qualidade no compilador, a área no raio do PoE e a Velocidade de Clamor (17/10, commit ad4a7e54 com G1)

- `compilarHabilidade(gema, nivel, extras)` e `GemasPoe.compilada(slug, nivel, qualidade)`: as linhas da qualidade entram com as do nível (o raio, a duração — "+N segundos à duração base" —, a recarga, os projéteis). `alvosNoNivel`, `temposNoNivel`, `buffNoNivel` e `degenerativoNoNivel` recebem a qualidade, e o `acoes` a passa. A "Área de Efeito aumentada" da gema virou `areaInc` (soma com a das peças e dos suportes: `comOsAlvosDaGema`); o "mais/menos Área" segue `areaMais`.
- **A área no raio do PoE** (`acoes.formaNoRaioDoPoe`, decisão do dono "Aplicar raio do PoE"): a forma da magia-molde vai ao raio da gema (o raio-base do PoE + os "+X metros de raio" × √ do "mais Área" da gema), com 1 casa = 2 m e a fração como chance. Antes a Nova de Gelo pegava 5 casas (10 m); no PoE são 3 m. Das 161 gemas de área com raio publicado, 134 encolhem, 8 crescem e 19 ficam iguais. As que o PoE não publica seguem com a forma do molde. Vale no `disparar` (e nas Armadilhas/Minas) e no golpe do mercenário.
- **Velocidade de Clamor** (decisão do dono "Corrigir e ajustar o P008"): o compilador lia "Velocidade de Clamor aumentada em X%" como recuperação da recarga (o Clamor Resistente saía com 5,8 s; no PoE são 8 s). Agora ela encurta o tempo de uso do clamor (`temposNoNivel.velClamor`, somada à `velocidade_clamor` da ficha).
- Linhas locais novas: "Duração do Efeito de Habilidades aumentada" (`duracao_habilidades`, também no `duracaoDasPecas`), "Velocidade de Conjuração aumentada" (`cast_speed_tag`), "Efeito do Empalamento aumentado".
- A qualidade das ativas: 208 de 540 linhas valem (eram ~2 antes do G1, 113 depois dele).
- Testes: 2 novos em `gemas-linhas-locais-poe.test.mjs` (o raio da Nova de Gelo e a média de 1,5 casa em 2.000 usos; a qualidade no raio, na recarga, nos projéteis, na duração, no raio da aura e na conjuração). **5 testes antigos ajustados com o aval do dono**: `zerar-arvore-lote34` (P008), `zerar-arvore-lote36` (×2: a Nova com 1,4 casa), `zerar-arvore-lote39` (a Nova do criomante), `passivas-poe-suportes-sem-regra` (a Repetição Final).

### G3 — os suportes de Armadilha e Mina e a compatibilidade pelo tipo acrescentado (17/10, commit 2e6c50c8 com G4)

- Saiu a trava "armadilhas e minas ainda não existem no jogo" (`SEM_SISTEMA`). Regras novas em `suportes-poe.mjs`: o Suporte de Armadilha e as Minas (Explosão em Cadeia, Alto Impacto, Locus) transformam a habilidade em Armadilha/Mina (`plantaArmadilha`/`plantaMina`, a duração e o tempo de detonação do suporte — `Plantadas.tipoDaGema(entry, efeito)`); Armadilhas/Minas a mais e o limite (Múltiplas, Agrupadas, Locus); as 3 faixas de chance da Montagem Ágil; a velocidade de arremesso ("aumentada" soma, "mais/menos" multiplica, só no tipo plantado); a recuperação da recarga do arremesso (Avançadas); as cargas ao ativar/detonar (Carregadas); a Invenção (mais dano e área por segundo plantada); a Explosão em Cadeia (mais dano por Mina anterior na sequência); as restrições de arma (ataque sem arma corpo a corpo; a Rajada só com Arco/Varinha); a Rajada (em sequência, mais tempo por projétil).
- Sem regra própria, a linha do suporte vira modificador local do uso (`af:<atributo>` → `Acoes.comAsLinhasDaGema`): "chance de Mutilar", "Fortificam", "Efeito do Cegamento"…
- **Compatibilidade pelo tipo acrescentado** (`engine/sockets-de-gema.compativelNoGrupo`, `compat-suportes.ADICIONA_TIPOS`): o Suporte de Armadilha torna a habilidade Armadilha e os de Mina a tornam Mina, como no PoE — no mesmo grupo, os suportes que exigem o tipo passam a valer (as Armadilhas Múltiplas na Bola de Fogo); o de "Armadilha e Mina" vale com uma das duas.
- Defeito corrigido no leitor das tabelas dos suportes (`textosDoNivel`): colunas com o mesmo texto e números fixos diferentes ("até 2" / "até 3 Armadilhas") caíam numa só e uma linha sumia.
- Teste novo: `suportes-armadilha-mina-poe.test.mjs` (6). Ajustado com o aval do dono: `itens-poe-gemas` (o Suporte de Armadilha agora "funciona").

### G4 — as gemas de escudo e a Retaliação (17/10)

- `GemasPoe.escudoDaGema`: a base da mão secundária ("X a Y de Dano Físico Base como a Mão Secundária", de Fogo/Gelo nas transfiguradas) no lugar do golpe da arma; o adicional "por cada 15 de Armadura (ou Evasão) no Escudo" × a defesa do escudo vestido × a eficácia; "+0,1% de Chance de Golpe Crítico por cada 10 de Escudo de Energia no Escudo"; sem escudo a gema não sai (`ARMA`).
- Defeito corrigido no compilador: "… de Dano Físico Adicional por cada 15 de Armadura no escudo" era lido como dano adicional fixo de todo ataque.
- A linha da Retaliação ("Se Torna Utilizável uma vez por 2 segundos quando você Bloquear um Acerto") é reconhecida: a janela de 2 s já existia.
- Teste novo: `gemas-de-escudo-poe.test.mjs` (3).
- Depois de G3+G4: ativas parciais 397 → 394 (ataques 145 → 142); suportes sem efeito 31 → 17, testados 23 → 29.

### G5 — os clamores pelo Poder (17/10, commit 05112a6c com G6 e G7)

- `GemasPoe.clamorPeloPoder(slug, nivel, poder)`: o Poder contado no uso (`ModsPoe.poderDoClamor`) vira os atributos do buff "por cada N de Poder, contando um máximo de M" — a vida regenerada (Resistente), as resistências e o máximo delas (Ancestral), o "mais Armadura" (Sísmico), a Fúria por segundo, o máximo e "impede a perda inerente" (Vingativo) —, as Cargas de Tolerância por Poder (Resistente) e o "Ataques Impelidos causam Dano Dobrado" (Intimidador). Teste: `clamores-poder-poe.test.mjs` (2).

### G6 — as Marcas contra o amaldiçoado (17/10)

- As linhas "Acertos contra Inimigos Amaldiçoados ganham…", "…concedem X% de Dreno de Vida/Mana quando Acertados por Ataques", "…concedem N de Vida/Mana quando Acertados por Ataques", "…uma Carga de X quando mortos", "…N de Vida/Mana quando Mortos", "Adiciona X a Y de Dano Físico aos Acertos contra Inimigos Amaldiçoados" e "…N de Fúria quando Atordoados" ficam na maldição do bicho (`contra`, `Reforcos.marcar`) e valem no golpe nele (`fichaDoGolpe`, `golpeNoAlvo`), no abate (`hunt/combate`) e no atordoamento (`mods-poe.aoAcertar`). As Marcas do Assassino, do Senhor da Guerra e do Caçador saem de "nenhum efeito do buff".

### G7 — o alvo nos acertos das gemas (17/10)

- **Lacuna sistêmica corrigida:** a ficha da gema é montada sem alvo, e os condicionais com tag de alvo da soma ("contra Inimigos em Vida Cheia", "contra Eletrizados", os da árvore e das peças) e as escalas do alvo não entravam nos acertos das gemas, só no golpe básico. `ModsPoe.golpeNoAlvo` soma, alvo a alvo, o que depende dele (+ as Marcas): o "aumentado" (somado ao do golpe), o "mais", o crítico, o roubo (na conta do roubo, pela fração do dano) e as tags do golpe para o `valor` do acerto.
- A Vida/Mana por Inimigo Acertado passa a valer nos acertos das gemas de ataque (antes só no golpe básico).
- Teste: `gemas-alvo-e-marcas-poe.test.mjs` (3: o "mais" contra Vida Cheia no acerto da Bola de Fogo, o "aumentado" de alvo, as Marcas).

### G8 — as linhas de buff das auras, arautos, guardas e clamores (17/10, commit fe26433e)

- `linhas-das-gemas.atributosDoBuff`: "Buff concede…" e "Você e aliados próximos ganham/têm/são…" viram os atributos do buff (`GemasPoe.buffNoNivel`) — frases próprias (o dano adicionado dos Arautos aos ataques e às magias, o "mais Armadura", o máximo de resistência das Purezas, a duração da Malevolência, as imunidades, a Postura de Areia) e, sem regra própria, o tradutor das peças com o começo tirado ("Buff concede Imunidade a Sangramento", "Dano não pode ser Refletido").
- O status do ARAUTO diz que o efeito ao matar (a explosão do Gelo, a tempestade do Trovão, o fogo das Cinzas) ainda não existe — antes o Arauto de Gelo saía "funciona" porque o compilador lia o dano da explosão.
- A Postura de SANGUE do Sangue e Areia segue pendente (no jogo o buff ligado é a Areia; o atributo do buff não vale com ele desligado).
- Teste: `buffs-das-gemas-poe.test.mjs` (2: os números e o Arauto de Gelo ligado na ficha). Ativas parciais 390 → 384.

### G9 — o efeito dos Arautos ao matar (17/10, commit 3ae0ee93)

- `Acoes.aoMatarComArautos` (no abate, `hunt/combate`) e `Acoes.tiqueDosArautos` (no tique da caçada): **Gelo** — o Congelado morto explode com o dano de Gelo da gema no raio dela (1,2 m), sem os modificadores de dano mágico; **Trovão** — o Eletrizado morto cria a tempestade (a duração da gema, 6 s): um raio a cada 0,25 s num inimigo a até 3,2 m de você; **Cinzas** — o abate por ATAQUE queima os inimigos a até 1 m do morto com 25% do dano excedente por segundo, pela duração (4 s), só com os modificadores de dano degenerativo.
- Teste: 3 novos em `buffs-das-gemas-poe.test.mjs`. Do G8, saiu a asserção "o Trovão ainda não tem o efeito ao matar" (agora tem).
- Ativas parciais 384 → 382.

### G10 — os estágios de canalização (17/10, commit 115e35b4)

- `GemasPoe.estagiosDaGema` + `Acoes.estagioDaCanalizacao`: o uso seguido da mesma habilidade canalizada ganha 1 estágio (até o máximo; outra habilidade no meio zera). **No máximo a canalização se libera sozinha** — a abstração do idle (no PoE, soltar o botão). `carrega` (Rajada de Chamas, Flecha Flagelante): os usos só carregam (sem dano, sem precisar de alvo na área) e a liberação causa o "X% mais Dano por estágio" × os estágios; `intensifica` (Lâminas Velozes, Incinerar): cada uso acerta com o "mais Dano" do estágio, e a liberação solta um golpe por estágio (Lâminas Velozes) ou a onda final ("A onda final causa X% mais Dano com Acertos" — Incinerar); `tempo` (Ciclone do Tumulto): um estágio a cada 0,4 s canalizando, "25% mais Velocidade de Ataque por Estágio". O raio cresce "+X metros ao raio por estágio" (até o máximo da linha); "X% mais Chance de Crítico por Estágio" (Incisão).
- A Rajada de Chamas passou ao formato de explosão no lugar mirado (antes, a onda que sai de você — `FORMATO_PROPRIO`).
- Compilador: "Área de Efeito aumentada em 15% por cada 0,1 metro de Alcance" (Ciclone do Tumulto) não é mais +15% fixo; "Raio Base é de N metros" e "-0.2 metros ao raio por Estágio" (transfiguradas da Rajada de Chamas) lidos.
- Pendentes: os esporos da Flecha Flagelante, o ângulo do Incinerar ("100% de aumento do ângulo por estágio"), o "mais Dano com Afecções por estágio" separado do acerto (as afecções saem do acerto — G11), o Orbe Invernal, a Runa da Maré Invernal.
- Teste: `canalizacao-estagios-poe.test.mjs` (3). Ativas parciais 382 → 377.

### G11 — a sequência de áreas e os golpes repetidos no tempo (17/10, commit 7efa08b6; push e PR em 17/10)

- **Ruptura** (`GemasPoe.sequenciaDaGema`, `golpesDaSequencia` no `disparar`): "Onda causa Dano em N Áreas" em linha à frente, o raio crescendo "+X metros para cada área anterior", cada área um acerto (a mesma criatura pode levar de mais de uma), e as Ondas de Choque dos primeiros M acertados de cada área ("40% menos Dano"; o raio da Onda de Choque é o da área — o PoE não publica). O "delay entre Áreas" e o "não pode parar antes de N Áreas" são do tempo da onda e da interrupção pelo novo uso: o idle resolve a onda inteira no uso.
- **Armadilha de Torre Elétrica** (`GemasPoe.torreDaGema`, `Acoes.tiqueDasTorres`): ativada, vira uma torre que golpeia N áreas a cada intervalo pela duração da gema — cada área é a habilidade saindo do lugar da torre num inimigo a até 2 casas; a velocidade de arremesso de armadilhas encurta o intervalo.
- Pendentes: a Ruptura de Trarthus ("Onda pode recomeçar até 3 vezes"), as Lâminas Cadentes (as rajadas), o Estilhaçar a Terra (fissuras e Estacas).
- Teste: `sequencia-de-areas-poe.test.mjs` (3). Ativas parciais 377 → 372.

### G12 — o uso de cadáveres (17/10, commit 6bcde0b6)

- O cadáver da caçada guarda a Vida Máxima do morto (os criados pelo Profanar: a do monstro da área). `GemasPoe.cadaverDaGema` + `Acoes.explodirCadaveres`: a explosão "X% da Vida Máxima do Cadáver" como dano de Fogo, sem os modificadores de dano mágico, no raio da explosão; o cadáver some. **Detonar os Mortos** (o cadáver mais perto do alvo, ao alcance, e o dano mágico em volta dele; a do Saque só a explosão e não mira os criados; a de Reação em Cadeia como a normal), **Vaal** (todos os cadáveres a até 3 casas do primeiro), **Mortos Voláteis** (até N cadáveres; o orbe de cada um vai ao inimigo mais perto — o dano mágico ali × os cadáveres consumidos, a abstração do idle: os orbes vão juntos), **Cremação** (o gêiser no lugar do cadáver: N projéteis a cada intervalo pela duração, até o máximo de gêiseres — `tiqueDosGeiseres`). Sem cadáver ao alcance, a gema não sai (`SEM_CADAVER`).
- Pendentes: a Troca de Corpo (o deslocamento e o "6% da sua Vida Máxima"), o Golpe Infernal (as cargas do debuff), a Reação em Cadeia dos cadáveres que a própria explosão cria.
- Teste: `cadaveres-poe.test.mjs` (4). Ativas parciais 372 → 365.

### G13 — Runas, Estandartes e Minas (17/10, commit 5b6da156)

- O status passa a reconhecer as linhas que o sistema das Runas (`runas-vinculadas.daGema`: "É Ativado a cada", "Pode ser Vinculada/Desvinculada por N segundos", a troca de alvo, as Runas adicionais, a Ativada uma vez) e o do Estandarte (`mods-poe.plantarEstandarte`: o "mais Área / Efeito de Aura por Valor consumido", o ganho de Valor) já faziam.
- A Runa: "Causa X% mais/menos Dano com Acertos contra o Inimigo Vinculado" — só no inimigo a que ela está vinculada (`plantada.vinculado`).
- O Estandarte: "Estandarte concede … a Você e Aliados" vira atributo do buff (a supressão, a velocidade, o bloqueio); a "Precisão aumentada" fica pendente (o jogo não tem a precisão aumentada em %).
- As Minas da gema: "Dispara um Projétil adicional para cada N Minas anteriores na Sequência de Detonação" (`plantada.anteriores`); a aura "Cada Mina aplica Chance de Golpe Crítico aumentada em X% contra Inimigos próximos, até Y%" (Mina de Gelo — `minaCritico`, lido no golpe) e "Cada mina aplica Dano aumentado em X% aos Inimigos próximos" (Mina de Tempestade — o dano sofrido, `minaFragil`).
- Teste: `runas-estandartes-minas-poe.test.mjs` (2). Ativas parciais 365 → 358.

### G14 — suportes do uso, da maldição e da aura (17/10, commit a5c385b3)

- Regras novas em `suportes-poe.mjs`: a duração das afecções, o empurrão (a chance e a distância), o ponto de atordoamento reduzido e a duração dobrada (Atordoar), a Vida por Inimigo Acertado (só ataques), a Velocidade de Clamor (Ordens Urgentes), o multiplicador degenerativo das afecções de crítico, o alcance do ricochete (Encadear), o "Efeito das Auras aumentado" e a área das auras (Arrogância, Generosidade), "Auras Suportadas não afetam você" (Generosidade — a aura vale só nos companheiros) e a duração das maldições (Toque Maldito).
- A Vida/Mana por acerto das gemas de ataque passa a sair do `valor` do acerto (a da soma, a da Marca no alvo e a local do suporte).
- Teste: `suportes-uso-e-aura-poe.test.mjs` (3). Suportes sem efeito 17 → 12; testados 29 → 36.

### G15 — os gatilhos que faltavam e os suportes de canalização (17/10, commit 3b393ea5; push no PR)

- Saiu a trava "esse gatilho ainda não existe no jogo". `gatilhoDe` lê: **Conjurar enquanto Canaliza** (`canalizar` — as magias do grupo saem a cada intervalo enquanto a habilidade de Canalização do grupo canaliza: `Acoes.tiqueDaCanalizacao`, no tique da caçada; nos grupos, quem dispara é a habilidade canalizada), **Conjurar ao ser Atordoado** (`atordoado`, com a chance — o atordoamento que o acerto pôs: `Acoes.depoisDeSerAcertado`) e **Conjurar ao Morrer** (`morte` — a vida chegou a 0; o "mais Dano enquanto Morto"). O `ativarGatilhos` passou a respeitar a chance do gatilho.
- **Canalização Focada**: "X% mais dano / custo por segundo canalizando, até Y%" pelo tempo de `hunt.canalizacao`. **Canalização Infundida**: "sofra X% menos Dano dos Acertos" enquanto canaliza a habilidade suportada (`Acoes.menosDanoDaCanalizacao`, no golpe do bicho).
- Pendente: o "Conjurar ao ser Atordoado" no Bloquear um Acerto Atordoante e nas magias do bicho (só no golpe corpo a corpo); o "Ignora Atordoamentos" do Desperto.
- Teste: `gatilhos-canalizacao-poe.test.mjs` (4). Suportes sem efeito 12 → 6.

### G16 — o teste geral de todas as gemas "funciona" (17/10, commit ea9d58ad; push no PR)

- `testes/gemas-todas-funcionam-poe.test.mjs`: cada uma das 151 ativas `funciona` é usada de verdade numa caçada, com a primeira arma (de seis: varinha, arco, espada com escudo, maça de duas mãos, adaga, cajado) que ela aceita, contra um alvo imortal colado. A de uso precisa causar dano no alvo; a de buff, ligar o buff. Na Retaliação a janela fica aberta; no Vínculo há um aliado perto; a Rajada de Chamas carrega até explodir; armadilhas, minas, gêiseres e torres rodam pelo tique. Cada suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa aparecer no código do jogo (fora as `af:`, que a ficha do uso lê).
- **Dois defeitos reais que o teste achou:**
  - **Os suportes de Penetração (Fogo, Gelo, Raio) não faziam nada.** O efeito era `penetracaoPct`, que nenhum código lia. Agora é o atributo da ficha (`af:fire_pen`, `af:ice_pen`, `af:energy_pen`), que a ficha do golpe soma em `ficha.penetracao`. A Penetração Elemental (antes parcial) entra junto, como `af:elem_pen`. Medido no jogo: a Bola de Fogo com o suporte baixa em 34 pontos a resistência a Fogo efetiva do alvo.
  - **O cone esticado perdia a fileira da frente.** `Areas.escalarForma` levava o cone de 1 casa (`spell-front-sweep`) para 3 casas ou mais sem as casas coladas em quem usa. O Golpe de Escudo Glacial, de 8 m, não pegava o monstro colado à frente; vale para todo ataque corpo a corpo em área com raio de 6 m ou mais. Agora a forma que sai de quem usa (sem a casa do centro) começa colada: 3 casas na frente, a largura toda atrás. As formas com centro (a Nova, o losango) não mudam.
- O relatório cita o teste geral. "Sem teste próprio" passa a querer dizer que só o teste geral cobre a gema.
- Teste: `gemas-todas-funcionam-poe.test.mjs` (4). Suportes parciais 160 → 159; testados 41 → 42.

### G17 — o dano só do acerto e o só das afecções, nos suportes (17/10, commit 2578a5c5; push no PR)

Referência: o PoB recalcula o dano-base de cada afecção de dano com um `dotCfg` próprio, sem as flags Hit, Spell, Attack, Melee, Projectile e Area (CalcOffence: `calcAilmentSourceDamage`). Antes do lote, o "mais/menos" de todo suporte virava `maisDanoPct`, multiplicava o acerto e chegava à afecção pelo dano do acerto. Uma revisão com agentes (o PoB, o patch e a varredura das linhas, com verificação adversarial) confirmou 21 de 23 achados.
- **Só no acerto** (`maisDanoAcertoPct`, multiplica entre os suportes, a afecção sai sem ele): o "X% mais/menos Dano com Acertos" (as Afecções Mortais, 80% menos; o Encadear; a Crueldade) e o "mais/menos" com qualificador de acerto: Mágico, de Projétil, Corpo a Corpo, de Ataque, em Área. No `acertar`, também saem da afecção, alvo a alvo: o "mais Dano Corpo a Corpo" do Golpe Impiedoso, a Intensidade, o Aço, a Proximidade, a Runa contra o vinculado, o Toxinas Vis e a Sede de Sangue.
- **Só nas afecções e no degenerativo:**
  - o "mais Dano de/com Afecções" (`maisAfeccaoPct`);
  - o de cada afecção (`maisIncendioPct`, `maisSangramentoPct`, `maisVenenoPct`);
  - o "mais Dano Degenerativo" (`maisDotPct`), que também vale no degenerativo da gema;
  - o de um tipo: "de Caos degenerativo", "Físico degenerativo", "de Gelo Degenerativo" e o "Incendiário", que é o Fogo degenerativo (`maisDot<Tipo>Pct`);
  - o "aumentado" só das afecções: `af:dot_dmg_inc`, `af:ignite_dmg_inc`, `af:poison_dmg_inc`, `af:bleed_dmg_inc`.
- **As chances de afecção dos suportes** (Chance de Sangramento, Chance de Envenenar, Combustão, Proliferação Elemental — esta agora com as três) entram nas afecções do PoE (`af:chance_*`). Antes iam ao estado antigo do Draevor, que punha um dano 0.
- **Mecânicas novas:**
  - o "mais" de cada repetição do Golpe Múltiplo vale só nela (`repeticaoMaisPct:<n>`);
  - o "+X% de dano mágico por repetição" do Eco de Magia Maior;
  - a Volatilidade, nas pontas da faixa de cada parte do ataque;
  - o Toxinas Vis, por Veneno no alvo até o teto;
  - o Sobre-esforço, só no golpe Impelido;
  - a Sede de Sangue, contra quem sangra;
  - Decapitar e Hipotermia, só no alvo em Vida Baixa ou Resfriado;
  - o "não pode" do Foco Elemental e da Sede de Sangue;
  - o Sadismo, mais rápido e com a duração "menos" multiplicando;
  - as Afecções Desenfreadas, no efeito das não danificadoras;
  - a Aflição Ágil, na duração da habilidade e das afecções de dano.
- **Honestidade:** o "por cada …" sem mecânica (Flechas Manaforjadas, Labareda Controlada, "por cada Clamor" do Sobre-esforço), o Retorno e a Onda de Choque e a Tormenta do Vazio viram linha não feita, em vez de um "mais" fixo. Duas linhas do mesmo suporte na mesma chave de "mais" multiplicam, em vez de somar. O "Dano Físico" num ataque vale sem a tag Físico, porque o físico vem da arma.
- Números: Projéteis Viciosos de 147% mais no acerto para 49% no acerto + 49% no Caos degenerativo + 49% no Físico degenerativo; Fortificar de 38% para 19% no acerto + 19% nas afecções corpo a corpo. Suportes "funciona" 97 → 104 (o Sobre-esforço desce a parcial); testados 42 → 51.
- Teste: `afeccoes-acerto-poe.test.mjs` (10), medido no jogo: Bola de Fogo + Afecções Mortais (acerto ×0,2, Incêndio ×1,44); Dano Incendiário (acerto igual, Incêndio ×1,34); Sangramento do PoE; Flecha Cáustica (degenerativo igual com as Afecções Mortais, ×1,49 com os Projéteis Viciosos); Golpe Múltiplo (×0,8, ×1,22, ×1,44); Volatilidade; Toxinas Vis; Foco Elemental; Sadismo.

### G18a — as linhas das ativas que o compilador lia e ninguém usava (17/10, commit dbfdb10e; push no PR)

Achado da revisão do G17: o compilador gravava em `stats.maisDano`, `afeccaoMais`, `danoPorEstagio`, `danoPorRicochete` e `afeccaoDuracao`, que nenhum código lia. A linha contava como "aplicada" e sumia do status (cerca de 40 ativas, umas 25 como "funciona"). Um workflow de desenho (5 analistas, um por família, mais um crítico, todos pelo PoB) deu 79 itens. Este lote faz três famílias.
- **Afecções da gema:**
  - "X% menos Dano de Afecções" (Punho Esmagador, Golpe de Escudo Glacial, Descarga, Pacto Sombrio) e "X% mais Dano com Sangramento" (Punctura, Laceração, Perfuração, Tempestade de Lâminas), com nível e qualidade somados, como no PoE, entram nas afecções pelo `fatoresDoDano` do G17 (`GemasPoe.maisNasAfeccoesDaGema`).
  - "Eletriza/Resfria/Congela como se causasse X% mais Dano" (Tiro Gélido, Flecha Relampejante, Nova de Gelo do Congelamento Profundo, Martelo Glacial Vaal), o Efeito da Eletrização e das afecções de Gelo (Armadilha de Raio, Martelo Glacial) e a Duração das afecções de Gelo passam a linhas locais, lidas em `afeccoes.daSoma`.
  - O terceiro golpe seguido do Martelo Glacial ganhou a tag de golpe `terceiroGolpe`, com contador por uso: "Congela como se houvesse causado 390% mais", e o crítico do Despedaçamento.
  - A explosão dos cadáveres agora põe afecções (é um acerto de Fogo no PoB). O Detonar Mortos da Limpeza leva 70% menos.
  - A Troca de Corpos do Sacrifício (lacaio, não acerta) fica com a linha não feita.
- **"Mais Dano" da gema:**
  - "até X% mais Dano com Acertos aos alvos próximos" (Golpe no Chão, Caminho Consagrado; o Esmagar com Escudo pela rampa do corpo a corpo) vale só no acerto e só no alvo perto, até 2 casas (o Curto Alcance).
  - "Projéteis causam X% …" vale nos projéteis secundários do Golpe Vulcânico e das Lâminas Gélidas; o golpe direto é o corpo a corpo do PoB. O quinto ataque do Zênite dispara 5 projéteis a mais com 600% mais.
  - O "Concede X% mais Dano Mágico" do Fogo Justo fica não feito até a queima em você existir. A revisão mostrou que, como aura, ele ia aos aliados, crescia com o Efeito de Aura e saía de graça. O motor ganhou o atributo só do acerto `mais_dano_acerto`, que o Zelotismo usa no G18b.
  - As regras 84 e 85 saíram: nenhuma linha "X% mais Dano" pura de ativa.
- **Estágios:**
  - O "mais" de cada estágio segue a flag do PoB: "com Acertos e Afecções" (os dois), "Mágico por estágio" da Rajada (só o acerto), "com Afecções por estágio" (só as afecções).
  - A onda final do Incinerar: "com Acertos" só no acerto, "com Incêndio" só no Incêndio, e "sempre Incendeia".
  - A qualidade entra nos estágios. Só libera quem tem o que liberar (o Incinerar da Exaustão fica no máximo).
  - O Chicote da Naja: "8% mais por Ricochete restante" no golpe direto e em cada ricochete.
  - Snipe, Ira Divina, Rajada de Chamas Vaal e Marca da Maré Invernal (estágios que o jogo não tem) ficam parciais, com as linhas não feitas; antes pareciam feitos.
- **Revisão adversarial do lote** (3 lentes: PoB, motor, status), que confirmou 13 achados, todos corrigidos:
  - o golpe direto do Golpe Vulcânico e das Lâminas Gélidas não ocupa mais um dos projéteis (4 bolas além dele);
  - o máximo de estágios com a qualidade passou a inteiro;
  - a qualidade dupla da onda final do Incinerar da Expansão (`partirQualidade` corta na frase repetida);
  - o Chicote da Naja também na perfuração e na volta;
  - o contador do terceiro golpe zera com qualquer habilidade no meio;
  - a coluna mal rotulada do Martelo Glacial Vaal (o "terceiro golpe" contava em dobro);
  - o degenerativo das gemas com "Modificadores de Dano Mágico aplicam-se ao Dano Degenerativo" (o `dotIsSpell` do PoB) leva o "mais Dano Mágico" (`maisDanoMagicoPct`).
  - Aproximação que fica: o "como se causasse" soma com o das outras fontes; no PoB cada fonte multiplica. Só muda junto de um único que também dê "como se".
- Teste: `ativas-linhas-lidas-poe.test.mjs` (16), medido no jogo: Punho Esmagador (Sangramento por acerto ×0,4), Punctura (a qualidade soma), Tiro Gélido (a força do Resfriamento pelo Gelo × 2,95), Golpe no Chão (perto ×1,49), Golpe Vulcânico (projéteis ×0,4) e Zênite (o quinto ×2,8 e 5 projéteis a mais), Fogo Justo (acerto ×1,39, Incêndio igual), Incinerar (onda final: acerto ×6, Incêndio ×3,5, sempre Incendeia), Rajada de Chamas (Incêndio por acerto 7 ÷ 17,5), Chicote da Naja, explosão do Detonar Mortos da Limpeza, terceiro golpe do Martelo Glacial.
- Pendente do G18 (os planos estão no workflow `g18-ativas-desenho`): a tabela do Fogo Justo Vaal (19% e 3 m no PoE; os dados copiam a do comum) e a do Impacto Sísmico Vaal (só 2 níveis); a Ira Divina (zaps e o dado da afecção do poedb), o Snipe, a Rajada Vaal e a Maré Invernal; o raio por estágio da Rajada (a partir do 2º); depois o G18b e o G18c.

### G18b — o status com a qualidade, as maldições, as auras e as chaves do compilador sem leitor (18/10)

- **O status das ativas passa a ser avaliado com a qualidade 20.** As linhas da qualidade que o jogo não faz entram nos motivos, como as do nível; no lacaio, as da qualidade não se escondem atrás do filtro das do nível. São 40 ativas de "funciona" para "parcial", cada uma com a linha que falta: é o status honesto.
- **O raio da qualidade:** "O raio Base é de 0,3 metros" da qualidade SOMA no do nível (o mesmo stat no PoB). Antes o compilador o tomava pelo raio, e a Bola de Fogo com qualidade 20 ficava com 0,3 m em vez de 2,1.
- **A qualidade lida:**
  - as chances da gema (o Golpe Selvagem: 20% de Congelar, Eletrizar e Incendiar); o "Não Pode aplicar Eletrizar" vira o "não pode" (antes, −1 na chance);
  - o "contra o Inimigo Vinculado" das Marcas;
  - a duração base dos Vínculos;
  - o "mais Dano com Incêndio/Veneno" da gema (a Flecha Ardente, o Golpe da Víbora da Mamba);
  - o Dano Dobrado contra quem sangra (o Golpe Duplo).
- **As maldições contra o amaldiçoado** (`CONTRA`): as chances de Incendiar/Eletrizar/Congelar (Inflamabilidade, Condutividade, Queimadura de Gelo), o Sangramento dos ataques (Vulnerabilidade), a duração das afecções da qualidade e o dobrar o atordoamento (Marca do Comandante). O acerto da gema soma nas afecções o que o alvo dá (`extrasDoAlvo`).
- **A Vulnerabilidade e o Orgulho só no Físico** (antes, todo tipo), com o aval do dono para o teste. O Orgulho sobe de 19% a 39% em 4 s na aura. O Enfraquecer é menor no Raro, no Único e no chefe (18% contra 29%).
- **As auras pela flag do PoB:**
  - Malevolência: só no degenerativo (`dano_dot_mais`);
  - Ira: só o Raio das magias (`mais_dano_raio@magia`; o teste antigo ajustado com o aval do dono);
  - Zelotismo: só o acerto das magias;
  - Precisão e Zelotismo: a Chance de Crítico AUMENTADA (antes +58 pontos absolutos na Precisão).
- **O dano sofrido de um tipo:** o Chamado Imortal (35% menos Físico, 34% menos Elemental, o Caos nunca; antes 84% menos em tudo) e a Armadura Ártica (Físico e Fogo, parado).
- **As chaves do compilador sem leitor:**
  - o Golpe de Misericórdia (`culling`);
  - as linhas de atordoamento (o ponto, a duração, o dobrar);
  - o crítico das Concocções (`crit_chance`);
  - o tempo de ataque extra (o Salto Esmagador, a Cutilada Vaal);
  - os vizinhos da Flecha Relampejante (até N a 1 casa).
  - A lentidão de movimento nos monstros, o Definhado do Definhar, a Armadilha de Urso, a espiral e os secundários dos projéteis ficam não feitos. O "Buff concede … chance" (o Arauto da Agonia, o Campo Galvânico) também, até o buff do dono existir.
- A qualidade da Armadilha de Torre Elétrica ("Golpeia +1 Área adicional") passou a valer: o SYSTEM pegou a linha como não feita depois do status com qualidade.
- O dano mostrado (o balão e a ficha do mercenário, `danoMostrado`) leva o "X% mais Dano de <tipo>" (a Ira) pela fração de cada parte. No acerto ele já entrava (`fatorRecebidoPeloBicho`), mas o balão o deixava de fora.
- Teste: `ativas-status-qualidade-poe.test.mjs` (12). Com o aval do dono: `itens-poe-gemas.test.mjs` (a Ira), `passivas-poe-maldicoes-dreno.test.mjs` (a Vulnerabilidade no Físico) e `zerar-arvore-lote39.test.mjs` (o ×1,5 da aura do mercenário conferido no `mais_dano_raio@magia`).

### G20a — os totens usam a gema como você (18/10)

- **O totem usa a habilidade da gema pelo MESMO caminho do seu uso**, do lugar dele (`Acoes.usarComoTotem` → `dispararSemMarcar` com `plantada` do tipo `totem`). É a regra do PoB: a skill do totem é a sua, com os seus modificadores. Antes, o totem dava o dano do balão no alvo, sem crítico, área nem afecções. Agora entram a área em volta dele (o Sísmico acerta os 3 bichos colados), o crítico da gema, as afecções, as linhas locais (o Empurrar sai do lugar do totem), os suportes ligados e os fragmentos do Aço.
- **Os acertos do totem não são seus** (CalcPerform.lua:264). O abate é `matarTotem`, inclusive o do dano degenerativo que ele põe (a `fonte` do Dot). Não vêm para você: o dreno, a vida e a mana no acerto, as cargas, a Fúria, a Fortificação, o Valor, a Convergência, os "Acertou/Criticou/Empalou Recentemente", os eventos "ao Acertar", a Crueldade e o Elusivo dos suportes, os espinhos e o reflexo do monstro. Vale o "X% do Dano dos seus Totens é Drenado como Vida". O que o acerto faz no inimigo vale igual.
- **Colocar o totem** é o seu uso da gema: 0,6 s, ou 0,5 s na Balista (CalcSetup.lua:58-59), ÷ a Velocidade de Posicionamento (a das peças e da árvore, a da gema — os ancestrais, 50% — e o "mais" dos suportes, como a Balista Focada). A "Velocidade de Posicionamento do Totem aumentada" das peças deixou de acelerar a conjuração do próprio totem. A velocidade dos totens ("Ataques utilizados por Totens…", "Magias Conjuradas por Totens…") passou a valer no uso dele.
- **A vida do totem pelo PoB** (CalcOffence.lua:316-318): a tabela de aliados no nível do totem × o multiplicador do tipo (×1,2 no Chamariz, Devorador, Rejuvenescedores e Flamejante Sagrado) × a "Vida do Totem aumentada" (gema, suportes e peças) × o "mais Vida de Totens" da qualidade. O Chamariz nível 20 com qualidade 20 tem 3745. Os modificadores de lacaio não valem no totem (vida, velocidade, defesas). A duração é só a do totem, sem a "Duração de Habilidade". O máximo lê a qualidade (o Vínculo Abrasador q20: 5).
- O alcance do totem ancestral é o do seu golpe corpo a corpo: 1 + ⌊metros/2⌋ casas, com o "+X metros ao Alcance" da gema (o Protetor com espada: 2 casas, antes 7). A Balista de Cerco Fragmentadora difunde de novo, com 40% de chance de 1 filho a mais na qualidade.
- **O totem sem golpe** (Chamariz, Devorador, os dois Rejuvenescedores, os dois Vínculos Abrasadores) não acerta ninguém. Antes "acertava" por no mínimo 1. O efeito próprio de cada um vem no G20c; até lá as linhas vão nos motivos.
- **O status honesto dos totens:** sai o motivo genérico de "limitação do idle". Ficam só as linhas que o totem consome (`ehLinhaDoTotem`) e as do uso; o resto vai nos motivos (o buff do Chefe Guerreiro, a aura do Rejuvenescedor, a Artilharia em linha, o Trarthus). As linhas "mais Velocidade de Projétil" e "+N metros ao Alcance de Golpes Corpo a Corpo" não tinham leitor no jogo e contavam como feitas (o Golpe Gélido, a Lança de Gelo, as Facas Etéreas…); agora ficam não feitas.
- A revisão adversarial (3 lentes) achou 9 problemas, todos corrigidos: a ficha refeita com a posição do totem ficava no cache (agora é esquecida no fim do uso); o ataque do totem levava o Impelir do seu Clamor; o revezamento das mãos e o "local anterior" das Habilidades de Golpe eram compartilhados com os seus; os eventos "quando você Amaldiçoar" vinham do acerto do totem (a maldição vale, os eventos não); o dreno dos seus Totens ignorava os monstros com "Vida Não Pode ser Drenada"; a Fúria do atordoado amaldiçoado; o totem de área acertava o alvo fora da área; o Sísmico da Autoridade faz a nova em volta de VOCÊ (act_str.lua:10211); os mods de lacaio "de qualquer tipo" ainda valiam no totem. O status lista também a mecânica que está só na descrição (a provocação do Chamariz, as flechas da Balista Estilhaçante no mesmo inimigo, a Artilharia em linha).
- A velocidade de posicionamento dos suportes é AUMENTADA no PoB (`summon_totem_cast_speed_+%`; o "mais" do texto em português é da tradução): soma com a das peças e a da gema.
- Relatório: ativas implementadas 114 (64 testadas), parcial 426 (+4 pelo status honesto), limitação do idle 11 (−4: o totem deixou de ser desculpa); suportes implementados 108 (55 testados, +4), parcial 148 (−4).
- Teste: `totens-uso-poe.test.mjs` (13). Com o aval do dono: o teste geral do G16 ganhou o fluxo do totem (o totem usa a habilidade uma vez e o dano tem de vir dele).

### G20b — os suportes que viram totem (18/10, no mesmo commit do G20a)

- O Totem de Magia, o Totem Balista e o Devastador (`viraTotem`): o seu uso da habilidade suportada COLOCA um totem (0,6 s; 0,5 s na balista) que a usa sozinho, com o "menos Dano/Velocidade" do suporte só no uso dele. A Bola de Fogo com o Totem de Magia nível 20: o totem lança com 50% do dano a cada 1250 ms (750 ÷ 0,6). O máximo (1, +2 no Totem Balista), a duração ("Totem dura N segundos"), a vida pela tabela do PoB no requisito da ativa (×1 pela cor). A habilidade fica com o tipo Totem (os Totens Múltiplos, a Balista Focada e a Chuva Ardente ligam nela) e a tag `totem` no uso do totem ("Dano do Totem" vale).
- Os Totens Múltiplos põem dois totens por uso. A Balista Focada só ataca depois de um projétil de ataque seu (o da gema ou o golpe de longe), uma vez por projétil.
- O Devastador: o totem ancestral só usa a habilidade com você a até 7 m (o PoB: `ancestor_totem_parent_activiation_range` 70). Fica não feito o "Área de Efeito aumentada perto do totem" da descrição: o valor não está nos dados do PoB.
- Teste: `totens-suportes-poe.test.mjs` (6).

### G20c — os totens específicos (18/10)

- **Os ancestrais:** o Chefe Guerreiro e o Protetor só atacam, e o buff deles só vale em você, com você a até 8 m e 8,5 m (a wiki no poedb salvo: "active as long as the player remains within a 80/85 unit radius"; a Vaal usa a do Chefe). A qualidade do Chefe soma "Distância de Ativação aumentada em 30%" (10,4 m). O buff Ativo ("18% mais Dano Corpo a Corpo", "20% mais Velocidade de Ataque") entra na sua ficha sem somar entre totens ("does not stack when multiple totems are summoned").
- **O Rejuvenescedor:** aura de "317,5 de Vida Regenerada por segundo" num raio de 4 m (act_str.lua:9343), com o Efeito de Aura (a wiki). Não soma entre totens. A Vaal tem 30% menos área e leva 40% do dano dos acertos em você antes (o desvio para o totem que já existia).
- **O Flamejante Sagrado:** o Solo Sagrado em volta do totem (1,6 m — act_str.lua:5869; a Ira com +40% de área na qualidade), que some com ele e dá imunidade a maldições a quem está em cima.
- **A Balista de Cerco:** "+5% de Velocidade de Ataque por Totem máximo" da qualidade (4 totens → +20%).
- **O Devorador:** com você ferido (ou sem mana cheia), a cada uso ele consome o cadáver mais perto, a até 3 casas, e o dreno de 299 de Vida e 59 de Mana vem para você. O raio do consumo não está no PoB; usei o alcance-base do totem, 60 unidades = 6 m (decisão a confirmar com o dono).
- O "não podem Evadir" do Chamariz: o totem do jogo não tem evasão (os mods de lacaio não valem nele desde o G20a).
- Fica para o G20d: o Vínculo Abrasador (o feixe e a Detonação), a Artilharia em linha/cruz/foco, o Trarthus e a provocação do Chamariz (pede a IA dos monstros ir atrás do totem).
- Relatório: ativas implementadas 122 (72 testadas), parcial 418 (−7).
- Testes: `totens-especificos-poe.test.mjs` (5). Com o aval do dono: duas asserções do G20a atualizadas (as linhas feitas saíram dos motivos) e o teste geral do G16 confere os totens sem golpe pelo efeito deles.

### G20d — o Vínculo Abrasador (18/10)

- **O feixe** (act_str.lua:9494): cada totem lança o feixe a você e a cada outro totem dele; quem está na reta (Bresenham) e nas 8 casas em volta de cada ponta ("perto das pontas" não tem número no PoB) sofre a queima da gema, renovada a cada 0,5 s. A queima usa a conta do uso: os suportes, o Dano Mágico (`spell_damage_modifiers_apply_to_skill_dot`) e o "mais" do degenerativo. É uma por inimigo (não soma entre feixes) e não é acerto (nada de "ao acertar").
- **A Detonação** (act_str.lua:9570): o máximo é 1 + 1 por Carga de Poder máxima; ao chegar a ele, todos os totens da gema detonam e queimam no raio de cada um (2,7 m, × √ da Área de Efeito) pela duração da gema (4 s), com "+30% (+0,5 por % de qualidade) mais dano por totem detonado".
- O cálculo do degenerativo virou uma função só (`totalDoDegenerativo`), usada pelo acerto da gema e pelo feixe.
- Relatório: os dois Vínculos "funciona".
- Testes: +2 em `totens-especificos-poe.test.mjs`. Com o aval do dono (o mesmo do G20c): uma asserção do G20a e o teste geral do G16 confere o feixe.

### A3 — os projéteis (19/10, decisões D1–D10 do dono; F8 fica para o A3b)

Os três erros: o Suporte de Atravessar ("Atravessam N Alvos adicionais"), o Pulso Congelante (5 projéteis; a linha da queda virou a rampa do PoB) e o Ponto Cego (a flag do Queima-Roupa). Mais: a velocidade de projétil do uso (`Acoes.velocidadeDoProjetil`), as rampas do Pulso e do Olho, o atravessar e o retorno (Arremesso Espectral, Giro Venenoso, Suporte de Retorno), a divisão do PoE (do alvo atingido), as rebatidas (Hélice só em parede; Vaal Flecha Relampejante nos mais perto), o salto no solo, a Nova de Flechas, a Saraivada, a Fuzilaria, o Localizar, a perfuração que soma. Revisão adversarial: 10 achados corrigidos (salto no solo, difusão sem rebater/retornar, atravessados da Materialização, simultâneos da Saraivada de Projéteis, Hélice em parede, Fuzilaria no alvo, Raio Cinético sem Difusão, Vaal Flecha Relampejante pelo PoB, Flecha Galvânica parcial, testes). Teste: `testes/projeteis-a3.test.mjs`.

**Exceções do dono (escolhas sem fonte, aceitas em 19/10):** (1) a Hélice só atravessa, sem retorno; (2) o salto no solo é o quadrado de 1 casa de raio; (3) a divisão: dano inteiro, alvo no alcance da habilidade a partir do ponto atingido, os que sobram em leque de π/8; (4) as origens laterais da Saraivada a 1 casa por ponto, alternando os lados; (5) na Nova de Flechas o principal cai no alvo e os outros não repetem bicho; (6) a Fuzilaria: "+8% dano" como "mais", somado aos +4% da qualidade; (7) a Mina Locus arredonda para baixo; (8) as rebatidas não contam como Ricochete; (9) na volta que atravessa, um golpe por bicho.

Pendente: a velocidade nas gemas de totem (ramo do totem), a espiral de 100 projéteis da Vaal Faísca, os capturados do Giro Venenoso (D8), a área no impacto dos projéteis com raio-base (item à parte, decisão do dono), o ricochete aleatório da Concocção Venenosa, a Armadilha Relampejante das Faíscas, a Nuvem do Tiro Tornado, o raio dos feixes do Orbe de Tempestades, Windburst/Gula/Pacto, o solo eletrizado da Vaal Armadilha Relampejante, a Flecha Galvânica (velocidade na área).

### A3c — a área no impacto dos projéteis com raio-base (19/10, decisão do dono "Fazer como o PoE")

Todo projétil cuja gema tem raio no impacto no PoB explode em área: `GemasPoe.areaNoImpacto` (a tabela `AREA_NO_IMPACTO`, com a linha do PoB de cada gema), `Acoes.areaNoImpactoDoUso` (o raio em casas = metros × √ da Área de Efeito do uso ÷ 2, a fração como chance) e `Secundarios.resolver` (`areaNoImpacto`: cada impacto do projétil que acerta — o principal, os extras, a perfuração, a divisão, a difusão, o ricochete, a rebatida e o retorno — acerta em área os vivos do andar; o atingido leva um acerto só; o mesmo projétil não acerta duas vezes o mesmo bicho na ida; o golpe da área tem o dano do projétil que o causou — `doImpacto`). Vale no seu uso, no do totem (Totem de Magia, Balista) e no golpe do mercenário.

Gemas (o raio-base no nível 20): Bola de Fogo e a Vaal 1,8 m; Bola de Magma 1,4 + 0,4 m (o primeiro impacto; os saltos no solo seguem a exceção 2 do A3); Salva Ardente 1,6 m; Ritual Proibido e o do Sacrifício de Almas 0,8 m; Fuzilamento Cinético 1,2 m e a da Detonação 2,4 m; Aço Violento 1,2 m e o da Munição 1,8 m; Flecha Ardente Vaal 1,6 m; Flecha Cáustica e a do Veneno 1,2 + 0,6 m (a explosão, não o chão); Acerto Elemental do Espectro 1,5 m; os Compostos Venenoso e Explosivo (e as transfiguradas) 1,8 m; o Golpe Vulcânico (e o do Zênite) 0,9 m e o Vaal 1,3 m, só nas bolas. Fora (o PoB dá o raio a outra coisa): a Esfera Trovejante, a Geada Rastejante, o Drenar Essência, o Rasgalma, a Flecha Explosiva, a Explosão Cinética, o Trovão Estrondoso, a Concha Somática, a Chuva Cinética, os cones, a Flecha Relampejante, o Golpe Selvagem e a Flecha Cáustica Vaal.

**Exceções do dono (escolhas sem fonte, aceitas em 19/10):** (1) a área é o quadrado do raio (Chebyshev), não um círculo; (2) o raio é sorteado uma vez por uso; (3) com o raio de 0 casa, só o atingido; (4) quem a área pegou entra nos alvos já acertados do projétil na ida (a perfuração, o ricochete, a rebatida e os filhos não o acertam depois); (5) no retorno a área acerta de novo os vizinhos, uma vez, e quem uma área da volta pegou não leva o retorno direto de novo; (6) o Aço Violento explode só nos impactos que acertam (não no fim do voo das divisões que erram); (7) no Golpe Vulcânico o golpe direto não tem área, só as bolas; (8) o teto de 60 áreas no impacto por uso; (9) a área pega os bonecos de treino como as outras áreas de gema, sem checagem própria de zona segura; (10) o totem e o mercenário explodem igual ao seu uso.

Teste: `testes/area-no-impacto-a3c.test.mjs`. Com o aval do dono: `itens-poe-unicos-rodada3.test.mjs` (os gatilhos das peças — os bichos imortais, para o vizinho seguir vivo depois da área).

### A4 — as repetições do golpe e os estágios, os ângulos e a canalização (19/10, decisões D1–D10 do dono)

- **D1 — as repetições seguem o PoB:** o uso com repetições dura (1 + r) tempos de uso (`Acoes.fatorDoTempoDoUso`, o balão também); as repetições saem dentro dele, cada uma com o "mais" dela. Vale para o Eco de Magia, o Golpe Múltiplo, o Altar Ecoante e o "Ataques executados por você se repetem".
- **R1:** a Nova Elétrica da Procissão (2 repetições, cada uma 1 raio da nova à frente, até o alcance +50% — D2, exceção do dono); a Nova de Gelo Vaal (até 5 explosões a partir dos acertados, o raio 15% menor a cada uma, sem gastar tempo); o Eco Desperto (Dano Dobrado na Repetição Final); o Golpe Cintilante Vaal (D3: 25 golpes nos vivos perto, os ferimentos somados no fim, 25 tempos de ataque, afecções −70%).
- **R2:** a sequência de áreas generalizada (`GemasPoe.sequenciaDaGema`: `linha` — a Ruptura —, `retangulo` — a Chuva de Lâminas, D4 —, `concentrica` — a Colisão de Gelo —, `estrela` — o Estilhaçar a Terra, D5: as estacas em `hunt.poeEstacas`, explodidas pelo Impacto ou pelo Clamor com −30%, a Fragilidade no fim da duração). As Excepcionais do Vazio: a Onda de Choque (no acerto corpo a corpo, com as repetições dos acertados a −50%) e a Tormenta (onde o ataque cai; estágios a cada 0,2 s; explode quando um inimigo entra) — pelo acerto sem golpe, como a Torre Óssea (fica a nota).
- **E1/E2:** o máximo do PoB (`GemasA4.MAX_DO_POB`: Rajada de Chamas Vaal 15, Ira Divina 10, Atirar 6 + qualidade, Lâminas Velozes Vaal 16, Devastar 8 — D6); a Ira Divina (os toques ao ganhar estágio, a explosão e o feixe, o "após o primeiro" com a afecção do PoB — D8); o Atirar (D10: a flecha própria ou 1 suportada por estágio pelo `ativarGatilhos`); as Lâminas Velozes (o "mais" no máximo), as Vaal (o círculo e os 50% menos dano sofrido canalizando); as Gavinhas da Escalada (+1 m por segundo); os esporos da Flecha Flagelante; o Devastar (por acerto; 2 s sem acertar zeram) e o Golpe Duplo do Ímpeto (a cada ataque par; mover zera). A canalização que continua não paga a recarga de novo (as Vaal passavam só do primeiro estágio).
- **A/C:** `Areas.abrirForma` (D7) — o Golpe no Chão do Tremor, as Lacerações, o Incinerar por estágio e o cone novo do Tiro Gélido (todo o Físico do cone como Gelo); a área do Ciclone pelo alcance a mais e o "menos Velocidade de Movimento" canalizando.
- **Objetos no tempo:** o Orbe Invernal (`hunt.poeOrbes`), os debuffs com estágios da Maré Invernal e do Raio Abrasador (a Exposição a Fogo no máximo).
- Teste novo: `game/testes/repeticoes-estagios-a4.test.mjs` (os sorteios travados).
- **Revisão (19/10):** a Vaal canalizada paga a recarga a cada ciclo (depois da liberação o canal recomeça — `hunt.canalizacao.liberou`); a Rajada de Chamas Vaal explode a cada 3 estágios até 15 e cai no local mirado (aprovado pelo dono); o totem, a estaca e o orbe não repetem (o totem fica sem as repetições até a sessão do totem dar o (1 + r) ao intervalo dele); o balão só põe o (1 + r) no golpe; o Devastar Vaal vai a 8 e começa com 4; cada repetição do Estilhaçar deixa as estacas dela; o Tiro Gélido da Penetração com os dois cones perpendiculares; a qualidade do Raio Abrasador −0,25% por ponto; o Orbe Invernal decai estágio por estágio.
- **Exceções do dono (as escolhas sem fonte do lote, aceitas em 19/10):** (1) a Procissão anda até floor(7 casas × 1,5) = 10 casas, do centro ao alvo (sem alvo, para onde você olha); (2) a Nova de Gelo Vaal sai de um acertado vivo sorteado, sem repetir o centro, e o raio −15% vale no raio em casas (a fração como chance); (3) o Golpe Cintilante Vaal: "perto" = até 3 casas de onde você pousou, você não se move entre os golpes, as afecções saem a cada golpe (−70%); (4) o Dano Dobrado do Eco Desperto é sorteado uma vez na Repetição Final e não dobra o golpe já Dobrado; (5) a Chuva de Lâminas sai a i+1 casas de você no eixo do alvo, a largura é o "radius 44+6" do poedb/PoB, e o bônus das Saraivadas é × a ordem desde 0; (6) a Colisão de Gelo: o centro é a casa ao seu lado na direção do alvo, áreas quadradas; (7) o Estilhaçar a Terra: a fissura tem o diâmetro da área da gema, as N das 8 direções mais perto do alvo, um acerto da fissura por inimigo, a explosão da estaca com 1 casa de raio, o Impacto explode as estacas nas casas dele e o Clamor as do raio dele; (8) a Onda de Choque do Vazio sai do primeiro acertado e repete dos outros acertados, o "Dano Corpo a Corpo aumentado" da qualidade dela multiplica; (9) a Tormenta do Vazio: 3 m = 2 casas, a explosão acerta todos dentro, o raio sorteado uma vez por estágio; (10) a Ira Divina: os toques nos N mais perto no raio de 3,8 m, o feixe de 1 casa até 7 casas, um acerto por inimigo na explosão e no feixe, o toque com o dano cheio; (11) a liberação do Atirar e das Lâminas Velozes Vaal no máximo de estágios, as suportadas do Atirar alternadas, um acerto por inimigo no círculo das Lâminas Vaal; (12) os esporos da Flecha Flagelante espalhados na linha até o alvo, disparando na hora, em vivos a até 2 casas; (13) o Golpe Duplo do Ímpeto: mover-se = mudar de casa entre os usos; (14) o ângulo: cada casa testada por 5 pontos, aberto depois da área do uso; a Laceração comum não muda no raio de 1 casa; (15) o cone do Tiro Gélido: o cone de onda dos moldes, a ponta no alvo, 4 lados, o alvo sem o próprio cone, a Vaal com 2,4 m, a parte convertida rola com o "aumentado" de Gelo; (16) o alcance adicional do Ciclone é o `alcance_corpo_m` das peças e da árvore; (17) o Orbe Invernal: os alvos sorteados a até 4 casas, o impacto de 1,6 m, a Velocidade de Conjuração somada ao +20% por estágio; o decaimento: 1 estágio no fim da duração do estágio; (18) a Maré Invernal conta o estágio desde a 1ª Ativação, o Raio Abrasador após o primeiro; a Exposição dura o mesmo que o debuff; (19) o teto de 3 das repetições dos suportes e da ficha fica, a da Procissão soma por cima.
- Depois: parcial 389 → 358 nas ativas (ataques 136 → 118), suportes 136 → 135; 32 gemas saíram de parcial; linhas distintas faltando 903 → 844. Ajustados com o aval do dono: `ativas-linhas-lidas-poe.test.mjs:88` (Atirar, Ira Divina e Rajada Vaal saíram da lista do "por estágio" pendente) e `itens-poe-unicos-rodada8.test.mjs:453` (D1: cada uso com a repetição dá 2 golpes e dura o dobro do tempo de uso).
- Fica: a Investida Carregada (D9, A1b), as Lâminas Persistentes da Chuva de Lâminas, a ramificação da Lança Crepitante (lote dos feixes) e as linhas fora do lote nas mesmas gemas.

### A3b — os projéteis e os objetos que ficam no chão ou no tempo (19/10, decisões D1–D14 do dono)

- **O mecanismo único `hunt.poeObjetos`** (`itens-poe/gemas-a3b.mjs`, `Acoes.criarObjetosDoUso`, `Acoes.tiqueDosObjetos` no tique das plantadas): cada objeto se move (parado, reta, persegue, órbita, em você) e faz um efeito — `pulso` (a habilidade da gema acerta todos no raio, pelo caminho de sempre: `dispararSemMarcar` com a `plantada` de tipo `objeto`, sem repetição), `emitir` (os projéteis da gema do lugar dele, nos ângulos da espiral — `Secundarios.resolver` com `efeito.angulos`), `solo` (o chão: o dano exato pelo tempo, a conta do Solo Ardente numa função só — `queimarNoSolo`) e `inerte` (fica até ser consumido). Tetos (D12): 60 golpes por objeto por tique, 20 ativos por gema. Você e o totem deixam objeto (D3: o golpe do objeto do totem é do totem); o mercenário, a armadilha e a mina acertam na hora.
- **D4:** a Bola Relampejante anda 2 s (40 u/s × 1,33 × o mod de velocidade de projétil) e acerta a cada 0,15 s todos no raio; a Orbital gira em você; a Estática fica no alvo (13 golpes).
- **D1/D2:** o Disparo Congelante deixa o marcador no fim do voo (2 s ÷ o mod); a Nova Glacial dos Disparos explode de até 2 (50% mais dano, sem destruir), o Vórtice da Projeção de até 5 (50% mais área e dano, destrói, o chão em cada um).
- **D5/D6:** o Vórtice e a Geada Rastejante são chão (o degenerativo sai do acertado); a Geada persegue (1 casa a cada 0,5 s, até 4 casas; as Banquisas com o "+%"), teto 10/5; a área fria anda com ela.
- **D7:** o Tornado (para a frente 1,5 s, persegue 4 s, a cada 0,25 s, 1 por vez; a Turbulência 3, só persegue), o Tolhimento no raio, a absorção de até 20 dos seus projéteis na fase inicial (10% do dano médio deles, somado a cada golpe da perseguição).
- **D8:** as Lâminas Persistentes da Chuva de Lâminas (uma por saraivada) e das Facas Etéreas (uma a cada N facas), 6 s, até 40; a Explosão de Lâminas detona as que toca, em cadeia, até 50 — `Acoes.laminasPersistentes(hunt)` e `Acoes.consumirObjetos(hunt, lista)` ficam prontas para a Arma Animada dos Arcos.
- **D9:** a Espiral Venenosa captura os projéteis (até 30 + 0,5 por qualidade, 12 s); as Lâminas Giratórias soltam todos em leque, sem voltar, e 40% ficam; a Vaal cria 50 na hora + 15/s por 6 s.
- **D10/D11:** as espirais da Faísca Vaal (100 em 3 s + os "+N"), da Bola de Fogo Vaal (32, −720°), do Rasgalma da Espiral (5, 300°) e do Arremesso Espectral Vaal (8 + 8 espelhados, −15°); o Olho Invernal (sem dano; 1 fragmento a cada 0,1 s no voo e 8 / 16 / 12 no fim).
- **D13:** o retrato da caçada leva os objetos (`poeObjetos`) e o cliente os desenha (`frontend/client/src/objetos-do-poe.mjs`, no `map.mjs`): formas e cores, sem imagem nova.
- **A3b-2 (o mesmo mecanismo):** a Esfera do Vazio (as duas), a Tormenta Flamejante e a das Saraivadas, o Vórtice de Lâminas (o comum, o da Foice e o Vaal).
- **Exceções do dono (escolhas sem fonte, aceitas em 19/10):** (1) a unidade do PoE = 1/10 m (a casa = 20 u); (2) a Orbital gira a 2 casas de você (a do totem, dele) na velocidade da bola; (3) a Estática fica no alvo; (4) o raio do Tornado é 1 casa e ele procura até 7 casas; (5) o "+%" do Tornado soma a linha da gema e a da qualidade; (6) o raio do chão é o "alcance secundário" × √ da Área do uso; (7) o dano guardado pelo Tornado é o médio do acerto do projétil absorvido (antes da resistência), e ele absorve também na casa em que nasceu; (8) o olho voa a 4 casas/s × o mod, até 7 casas, os fragmentos do voo a 36° um do outro; (9) o marcador do Disparo a 7 casas no rumo de cada projétil; (10) o marcador e a captura são só seus; (11) só a Faísca Vaal soma os "+N projéteis" à espiral; (12) as Lâminas Giratórias soltam no rumo do vivo mais perto; (13) a bola e o olho acabam no terreno, o tornado para nele, o objeto de outro andar some; (14) o Tolhimento da Esfera do Vazio cai linear com a distância, os impactos da Tormenta Flamejante caem uniformes no quadrado da área; (15) o raio da Esfera e do Vórtice de Lâminas é ao menos 1 casa, a Vaal do Vórtice anda 1 casa a cada 0,5 s até o vivo mais perto a até 7 casas.
- **Revisão (20/10, a revisão adversarial — 12 achados):** o golpe do objeto não passa pelo "bicho por perto" medido em você; os chãos da mesma gema não somam no mesmo bicho (só o mais forte queima); a Orbital do totem gira em volta dele; a instância nova começa sem objetos; o chão e o guardado do Tornado respeitam a Safe Zone (o guardado só com o golpe saído); as Lâminas Giratórias soltam no máximo 30 (`snapping_adder_maximum_projectiles_released`); o Tolhimento do Tornado é o do PoE, 30% (o "-1 %" é a bandeira `tornado_hinder`); o Olho Invernal da Transitoriedade solta os 12 durante o voo, sem a espiral do fim; a tela recebe o fim (`ate`, para o quadro em delta), só os objetos da tela, e os dos aliados da sala (`poeObjetosDoGrupo`); o que acompanha você vai na posição andando do boneco. A Espiral Venenosa Vaal é "funciona" (com o aval do dono, o G16 a confere seguida das Lâminas Giratórias).
- Teste novo: `game/testes/objetos-no-chao-a3b.test.mjs` (os sorteios travados). Com o aval do dono: `itens-poe-gemas-degenerativo.test.mjs` (os 2 testes do Vórtice medem o chão) e `gemas-todas-funcionam-poe.test.mjs` (a gema cujo dano sai por outra — a Espiral Venenosa Vaal — usada seguida das Lâminas Giratórias).
- Fica (A3b-2 e afins): a Chuva Tempestuosa (os feixes entre as flechas), a Esfera Trovejante (a canalização perto do orbe, a divisão do feixe), a Explosão de Lâminas do Descarrego (as lâminas do Vórtice), a Tormenta Flamejante Vaal (o Solo Ardente), a Flecha Relampejante da Eletrocussão, a Varrida dos Martelos Cadentes, a Invocar Tormenta Vaal, a Rajada Divina do Esplendor.

### A1b — a Investida Carregada e o resto das gemas de movimento (19/10, decisões I1–I7 e D-a–D-f do dono)

- **A Investida Carregada** (`itens-poe/movimento-a1b.mjs`, `GemasPoe.miragemDaGema`, `Acoes.planoDaMiragem`): a miragem (`hunt.miragem`) nasce em você e anda a 3,8 m/s × a velocidade de movimento × 1,3 (I2; a Projeção 1,5) rumo ao alvo, contorna-o até 6,2 m e para na parede (I3); 1 estágio por uso em que andou, até 15; o pulso em volta dela nos usos 1, 3, 5… (I4/I5) no raio de 1,2 m + 0,2 m por estágio até 2,2 m (I6); a liberação (I1: quando ela para; com "Segurar a miragem no alvo", parada pulsa com +150% enquanto houver inimigo na área) dá a onda final (75% × estágios; a Projeção 125% + a qualidade) e o teleporte para ela sem "moveu" (a Projeção não teleporta); outra habilidade no meio, ou o canalizar que acaba, libera (I7 — `Acoes.soltarMiragem`).
- **D-a:** o Golpe Súbito (Frenesi), o do Poder (Poder) e o Caminho Sagrado da Tolerância (Tolerância) na recarga gastam a carga e saem; a recarga em curso não recomeça (`CargasPoe.gastar`). O Golpe Súbito: a Velocidade de Ataque por Frenesi e a Chance de Crítico por Poder (linhas locais), a Frenesi no acerto e o Poder no crítico.
- **D-b:** a Emboscada (o buff de 1,5 s e a cegueira de 3 s) Impele o próximo ataque corpo a corpo com arma de uma mão — a gema e o golpe básico —, +25% (+ a qualidade) na chance base e +138% de multiplicador, sem gastar o Impelir do Clamor.
- **D-c:** a fila do Teleporte Relampejante (até 50): na espera, o Teleporte de novo entra na fila (`hunt.filaDoTeleporte`), parte do destino do anterior e espera o atraso dele depois.
- **D-d:** Trespassar (a Corrida de Fase, o Passo Definhante): o passo de perseguir, seguir a party e o clique pula por cima do bicho (`Acoes.passoTrespassando`).
- **D-e:** a Corrida de Fase gasta as Frenesis (1,8 s × (1 + 1 por Frenesi)) e o próximo uso seu a troca pelos 30% de Dano Físico Corpo a Corpo por 0,2 s (o próprio uso os recebe).
- **D-f:** o Avanço Ardente do Retorno: a chance de Causticar (a Causticação do jogo — `afeccoes.mjs`).
- O Teleporte Gélido da Explosão Invernal (15% mais por 5% de Resfriamento, tira o Resfriamento, não resfria, a conjuração na recarga se ativada), a Corrente com Gancho (+0,1 m por 5 de Fúria) e a Investida com Escudo (75% × casas ÷ máximo de Redução do Ponto de Atordoamento).
- Teste novo: `game/testes/movimento-a1b.test.mjs` (os sorteios travados). Com o aval do dono: `repeticoes-estagios-a4.test.mjs:255` (a Investida Carregada agora é simulada).
- **Exceções do dono (as escolhas sem fonte do lote, aceitas em 19/10):** (1) a casa da miragem é a do caminho em round(metros ÷ 2) (1 casa = 2 m, Chebyshev); o contorno do alvo vai no sentido horário, a partir da casa que segue o rumo; (2) o canalizar novo só começa com o alvo a até 4 casas; (3) o pulso e a onda caem numa área quadrada, a fração do raio como chance de uma casa a mais, × √ da Área de Efeito; (4) na liberação, o pulso (no uso ímpar) e a onda final saem no mesmo uso; (5) o teleporte vai para a casa livre mais perto no caminho da miragem, de trás para a frente; (6) a velocidade de movimento da miragem é a razão da ficha (a velocidade ÷ a do nível, entre 0,25 e 2), como o atraso do Teleporte do A1; (7) o canalizar acaba um tique (250 ms) depois do último uso; na troca de andar a miragem some sem onda; (8) a Emboscada conjurada não guarda o alvo: o cegado é o bicho colado (o alvo da caçada, ou o mais perto); (9) a fila do Teleporte Relampejante cai inteira se um deles falhar ou a conjuração for interrompida; (10) Trespassar vale no passo de perseguir, de seguir a party, no clique e na tecla; pula até 3 casas; (11) a Corrida de Fase usa a base de 1,8 s (sem o piso de 2 s dos buffs de guarda: sem Frenesi, 2,0 → 1,8 s); os 30% também valem no golpe básico e, nos 0,2 s, no totem; (12) o Resfriamento da Explosão Invernal é o `lento` do bicho (o mesmo campo do Mutilar e do Desacelerar); (13) a carga que pula a recarga é gasta antes do golpe.
- **Revisão (19/10, a revisão adversarial — 7 achados):** o ataque Impelido pela Emboscada leva a tag `impelidoEmboscada`, não a `impelido` do Clamor (os bônus de Impelido do Clamor não valem nele); andar encerra o canalizar da Investida (a onda sai, sem o teleporte de volta — `naCasaDoCanalizar`), e o teleporte nunca vem de longe; o teleporte acompanha `hunt.poeUltimaPos` (o tique das condições não marca "moveu"); o Trespassar aceita o destino livre logo atrás do bicho, é tentado antes do vigia de travado e vale também na tecla; o plano do Teleporte enfileirado vê a party (`Object.create(hunt)`) e guarda o alvo dele.
- Depois: parcial 334 → 321 nas ativas (ataques 115 → 108); as 13 gemas saíram de parcial. Com o aval do dono: `gemas-todas-funcionam-poe.test.mjs:149` (a Emboscada colada no alvo é conferida pelo buff dela, `hunt.emboscada`).
- Fica: a Mina de Fumaça (minas), a Troca de Corpos (cadáver), a Stormbind (Marca), as Correntes de Anzol e de Trarthus, as Flechas Cintilante/Espelhada (lacaios).

### A5 — os suportes simples e as linhas das famílias 1–4 (20/10, todas as recomendações dos planos f12 e f34 aceitas)

- **Família 1** (`linhas-das-gemas.mjs`, `suportes-poe.mjs`, `mods-poe.mjs`): o Dreno de Vida do PoE (D3: `af:life_leech` nos ataques, `af:vida_leech_magia` nas magias) e o de Energia; o dreno das Soulrend; a Eficácia; a Fortificação do uso (a base de 8 s da Golpe Vigilante, a duração da qualidade do Fortificar; um acerto não encurta a que corre); o Empalar e a Queda de Lâminas do Empalamento (empala no crítico, crítico sem dano extra); o Golpe de Misericórdia e o Abater o Fraco (Normal/Mágico); a Vida ao matar; a janela de Retaliação por gema (D8); a qualidade acima de 20 pelo Aprimorar/Desperto/Eclipse, linear (D2 — também no bônus por afecção e no balão); o nível de Caos do Vazio Desperto; o reflexo elemental pela ficha do uso; o Empalamento refletido no golpe final, a 1 casa (D4 — também quando o Golpe de Misericórdia mata).
- **Família 2:** o alcance corpo a corpo das linhas (Lâminas Gélidas, Decapitar); as restrições de arma da Fissura, do Trauma, da Onda de Choque e do Combate Próximo (D6: a mão principal); a Víbora e a Mamba com duas armas (D5); o tempo da secundária do Golpe Duplo da Ambidestria; a Lâmina Mágica (como o PoB: a principal corpo a corpo de uma mão; com arma na secundária, 60% de cada) e a Detonação da Adaga (D7).
- **Família 3:** o máximo da Eletrização das linhas e o "Anel sempre Eletriza" (D3); o Condutor Elétrico (D1: por cada 5%; D2: tira a Eletrização — só a base; só acerta o Eletrizado e a Eletrização não expira na conjuração); o "mais Efeito de Resfriamento" do Estalo Gélido, também no chão (D4), e o raio do Solo Resfriado pela linha; a Sobrecarga; o Resfriamento Ósseo (D5); a Hipotermia; o Coursing Current (D6).
- **Família 4:** a Exposição das Penetrações Despertas; a resistência invertida (Golpe Selvagem dos Extremos, Inversão de Regras — D7); a Bomba Congelante (D9); a Onda de Convicção (D8 — segue parcial: depende da conversão do Físico das magias, lote próprio); a Combustão; a Chuva Explosiva; a Exposição numa função só (D10, `ModsPoe.porExposicao` — corrige o Raio Abrasador).
- **Revisão (20/10, a revisão adversarial — 14 achados):** a dos Céus não tira a Eletrização; a Fortificação não encurta; a Lâmina Mágica como o PoB; a qualidade sem teto no bônus por afecção e no balão; o reflexo depois do culling; o Golpe Selvagem dos Extremos paga Mana, Vida e Escudo de Energia (`recursoDoCusto` → `todos`); a Onda de Convicção parcial; o Dreno de Energia ("mais Dano com Escudo de Energia Completo" — `escudoCheio` — e "aumentado enquanto Drenando Escudo de Energia" — `drenandoEs`) e o de Vida (`drenandoVida`); a Manipulação do Vazio tira só a parte elemental (`semDanoElemental`/`semDanoCaos`); o relatório casa o slug inteiro; o Golpe Vigilante pula a recarga com Tolerância; o Condutor só no Eletrizado.
- **Exceções do dono (as escolhas sem fonte do lote, aceitas em 20/10 — também no topo de `itens-poe/gemas-a5.mjs`):** (1) a Lâmina Mágica e a Detonação usam o físico da arma com locais e qualidade (a secundária também com a qualidade) e o elemental da própria peça; a Detonação com duas adagas, 60% de cada (o texto; o PoB, 50%); (2) a Ambidestria: o intervalo da ficha × (o da secundária ÷ a média das duas); (3) o Coursing Current: a duração base com os modificadores, a força do outro no teto dele; (4) a área fria: 10% × (1 + o aumentado do uso) × (1 + o "mais"), até 30%, só as linhas da gema e dos suportes; (5) o `fragilGelo` dura o mesmo que o Resfriamento; (6) a Exposição da gema soma o "aplica X% extra"; com uma ativa, o maior % e o fim mais longe; (7) o abate pelo Empalamento refletido é de quem golpeou; (8) o Dreno de Vida em gema ataque e magia vale nos dois.
- Teste novo: `game/testes/suportes-a5.test.mjs` (os sorteios travados). Com o aval do dono: `totens-uso-poe.test.mjs:187` (o alcance das Lâminas Gélidas agora é feito).
- Depois: parcial 321 → 306 nas ativas; 135 → 112 nos suportes. A Precisão Adicional segue parcial (a D1 do f12 é o sublote A5b).
- Fica: a conversão do Físico das magias (lote próprio — a Onda de Convicção e outras 23); Galvânico, Hidroesfera, Trindade, Inervação, Vínculo Frígido, Escudo Tempestuoso, Armadura Ártica (D12).

### A5b — a precisão nas gemas de ataque (20/10, decisão do dono "fazer como o PoE" + a revisão adversarial)

- **A conta do acerto do PoE 1 pelo PoB** (`combate/formulas.mjs` `chanceDeAcertoPoe`, `formulas.json` acerto.poe): min(1, max(0,05, round(1,25 × precisão / (precisão + (evasão / 5)^0,9) × 100) / 100)) — o seu acerto, o dos lacaios e o dos monstros em você (a esquiva). Antes: precisão / (precisão + (evasão / 4)^0,8), de 5% a 95%.
- **A gema de ATAQUE rola o acerto por alvo** (`acoes.mjs`, `acertar`): a precisão do uso (a ficha do golpe com o "+X de Precisão" e o "% aumentada" da gema e dos suportes — `condicoes-poe.fichaDoGolpe`, `precisaoDaConta`) contra a evasão do bicho, por `Defesa.errou`. Também o ataque do totem (a sua precisão) e os acertos de ataque por fora do uso (a Onda de Choque e a Tormenta do Vazio, a Torre Óssea — `acertoDoArauto({ ataque })`). A magia, os Arautos e a Onda Arcana não rolam.
- **As exceções:** "Acertos não podem ser Evadidos" (peça), a Técnica Resoluta, o "Não pode ser Evadido" das gemas (18 — deixou de ser informativo; `nunca_erra` local), os Provocados por você.
- **O erro:** o evento do golpe básico (`block`/`errou`), sem dano, afecções, efeitos do acerto nem o que o acerto gasta. O bloqueio vem depois do acerto: o bloqueado conta como acertado. O que sai no acerto dentro de um passe (a propagação, os próximos do alvo, o cone) olha os acertados do passe; o do fim do uso (Rajada Vulcânica, Onda do Vazio, Devastar, Fantasma, Empurrão do Salto Impactante) os acertados em algum passe.
- **A precisão LOCAL da arma** ("+X de Precisão" na arma → `accuracy_local`, tradução 72): só na mão dela (`fichaDaMao`; o golpe das duas, a média). **A Técnica Precisa por uso** (a precisão do uso contra a vida máxima). **O simulador** usa a precisão do uso e a mesma isenção do motor.
- A Precisão Adicional saiu de parcial. Teste novo: `game/testes/precisao-a5b.test.mjs`. Com o aval do dono: `suportes-a5.test.mjs:104-105`.

### B1 — as ativas de área, nova, chuva e orbe que reusam o que já existe (20/10, as recomendações do plano aceitas)

- **O plano tinha 24 gemas; depois do A5, A5b, A5c e A5d sobraram 18.** Saíram as 18 de parcial (15 no primeiro commit; as 3 que dependiam do dono, no segundo).
- **A Descarga e a da Miséria** (`gemas-b1.mjs`, `acoes.mjs`, `GemasPoe.partesDaMagia` com `basePor`): o dano base de cada elemento × as cargas do tipo dele (Raio × Poder, Fogo × Tolerância, Gelo × Frenesi). A área ganha 15% mais (20% na Miséria) × o total de cargas, um "mais" só. As cargas saem depois do golpe, salvo a chance da qualidade (10% na 20). Sem carga, a gema não sai (`SEM_CARGAS`).
- **O Condutor Elétrico:** o tempo de conjuração vai para a recarga do uso ativado por gatilho (a mesma linha da Explosão Invernal, agora pelo leitor da linha). **O dos Céus:** acerta até 15 (+4 da qualidade 20), os mais perto do centro da área, e não exige mais a Eletrização. O PoB só a exige na base ("strikes all Shocked enemies"); o A5 a exigia nas duas.
- **As Bombas Congelantes:** a Regeneração de Vida −75% no debuff, junto da Exposição e pela mesma duração (`regenMenosDebuff`, `skills/estados.mjs`). A da Aproximação (D-B1.3): ⌊duração final ÷ 0,1 s⌋ × 10% mais nos acertos e × 3% nas afecções. Com 2 s, 200% e 60%; com a qualidade 20 (2,5 s), 250% e 75%.
- **Os Estalos Gélidos** (D-B1.6/D-B1.7, `condicoes-poe.criarAreaFria` com `cresce`, `aoMorrer`, `porSegundo`):
  - o chão cresce linear do raio inicial ao final pela duração (1,5 → 3 m em 5 s; o Vaal, 2 → 3,6 m em 4 s), em casas por m × √Área ÷ 2, a fração sorteada uma vez;
  - o inimigo que morre no chão dá 25% de Frenesi (o Vaal: o Poder), e o Vaal dá 1 Frenesi por segundo com inimigo no chão;
  - o do Poder: 50% (+20% da qualidade) de Poder no crítico.
- **Os cadáveres:** o Detonar Mortos e o Vaal detonam um cadáver adicional na chance da qualidade (15% e 30%). A Limpeza saiu do "sem dano direto": o efeito dela é a explosão (29,5% + 5% da qualidade). A Cremação dispara 15% mais rápido na qualidade 20 (1 s ÷ 1,15).
- **As linhas locais** (`linhas-das-gemas.mjs`):
  - a Mutilação da Chuva de Flechas Vaal: 30% × 2,5 = 75% de lentidão (`efeito_mutilacao`, `ModsPoe.aoAcertar`);
  - o "10% mais Velocidade de Conjuração" da Nova Elétrica da Procissão (`cast_speed_mais`, `Acoes.temposDaGemaPoe`);
  - a Chuva Explosiva de Trarthus: "Dispara 1 Flecha" (o singular no leitor dos alvos).
- **Escolhas sem fonte, para o dono conferir:**
  1. o dos Céus escolhe os mais perto do centro;
  2. a Descarga tira as cargas depois do golpe (o dano e o crítico contam com elas);
  3. o cadáver adicional do Detonar soma só a explosão dele, como o Vaal já fazia com os cadáveres a mais.
- **As decisões do dono (20/10, o segundo commit):**
  - D-B1.8, a Chuva de Flechas Vaal: as 4 sequências adicionais são anéis concêntricos iguais no raio da área, a partir do alvo. O PoE e o poedb não publicam o passo. Cada inimigo leva só o golpe do anel em que está, e a tela recebe um anel por sequência;
  - D-B1.9, a Chuva Tóxica do Definhamento: 1 Definhamento de 2 s por uso em cada inimigo acertado;
  - D-B1.10, a Invocar Tormenta: o marcador no alvo (`hunt.poeObjetos`, tipo `tormenta`) e o raio cai nele depois da duração (1,5 s × os modificadores), na área da gema. Quando um marcador cai, os outros da gema caem junto ("causing lightning strikes at any other markers", o PoB). A qualidade (15% na 20) faz o raio cair na hora, sem marcador;
  - os Estalos Gélidos pulam a recarga gastando uma carga: Frenesi no comum, Poder no do Poder (o PoB; `CARGA_QUE_PULA_A_RECARGA`).
- Teste novo: `game/testes/ativas-b1.test.mjs` (18 casos, os sorteios travados).
- **Testes ajustados com o aval do dono (20/10):**
  - `gemas-todas-funcionam-poe.test.mjs` (G16): a montagem dá Poder, Frenesi e Tolerância à Descarga e à da Miséria, e Eletriza o alvo do Condutor Elétrico;
  - `suportes-a5.test.mjs:532`: o Condutor Elétrico completo (motivos `[]`).
- **Teste que quebra pelo progresso, para o aval:** `itens-poe-gemas.test.mjs:36` exige `st.parcial > 300`; agora são 298 (287 parciais + 11 de limitação do idle).
- Depois: parcial 305 → 287 nas ativas; 111 → 111 nos suportes.

## Pendências conhecidas (por ordem de prioridade)

1. ~~G3~~ feito. Resto das Minas: a reserva ("Reserva Base igual ao Custo Base"), o Locus (arco, "sempre focam na sua localização", 30% menos projéteis) e o Alto Impacto (dano dobrado perto das Minas). **Antes: os suportes de Armadilha e Mina** (14 suportes travados por "armadilhas e minas ainda não existem no jogo": as plantadas existem desde 12/10). O Suporte de Armadilha e as Minas (Explosão em Cadeia, Alto Impacto, Locus) transformam a habilidade suportada em Armadilha/Mina (`Plantadas.tipoDaGema(entry, efeito)`); Armadilhas Múltiplas/Agrupadas, Montagem Ágil (as 3 faixas de chance), Dano de Armadilha e Mina, Armadilhas Avançadas e Carregadas, Minas Carregadas, Invenção. A reserva das minas ("Reserva Base igual ao Custo Base") precisa de `reserva.mjs`.
2. **A qualidade que falta** (332 de 540 linhas): "Lacaios têm Recuperação da Recarga", "Efeito do Buff aumentado", "Velocidade de Projéteis", "Projéteis que Atravessaram causam X% mais Dano", "mais Vida de Totens", "Máximo de Armas Animadas/Esqueletos", o estágio máximo…
3. ~~As afecções que saem do acerto final~~ — os suportes feitos no G17 (o "mais" só do acerto e o só das afecções); as ativas no G18; a soma do "aumentado", o crítico, o "mais" geral e as cargas no G19.
4. **As mecânicas compartilhadas maiores:** canalização por estágios (12 gemas), repetições do golpe (11), uso de cadáveres (11), deslocamento (21, hoje "golpe na área"), armadilhas/minas nos suportes (14 suportes: "armadilhas e minas ainda não existem no jogo" — conferir, porque as ativas já plantam), buffs sem equivalente (22: Marcas, Manto Arcano, Desgraça…).
5. **"Dano Físico Base como a Mão Secundária"** (8 gemas de escudo) e os bônus do escudo (crítico pelo Escudo de Energia, dano pela armadura do escudo).
6. **Os outros suportes:** 157 parciais e 31 sem efeito; gatilhos que faltam (Conjurar ao Morrer, ao ser Atordoado, enquanto Canaliza), os suportes que viram totem (G20b; a velocidade de posicionamento e a vida do totem feitas no G20a), auras (efeito), maldições (efeito em área, duração).
7. **A interface:** o balão da gema mostra as linhas da qualidade que não valem; marcar cada linha (feita / não feita) e o motivo, nos encaixes e na barra.
8. ~~Testes parametrizados~~ feito no G16 (uso real e dano/buff de toda ativa `funciona`; efeito lido de todo suporte `funciona`). Falta: medir o efeito de CADA suporte num uso (com e sem), não só que o código o lê.
9. **O "Dano de Fogo/Gelo/Raio aumentado" dos suportes** vale para todo o dano da habilidade que tem a tag (`valeParaOTipo` → `danoPct`): numa habilidade de dano misto, o PoE só aumenta a parte daquele elemento. Trocar por `af:fire_dmg`… (a ficha do golpe aplica por elemento).
10. **Acertos secundários de ataque de itens** (A5b, revisão): a Rajada Vulcânica e outros acertos de ataque que vêm de itens não rolam a precisão.

## Próximo passo exato

1. G20e — os totens que faltam: a Artilharia (linha, cruz, foco), o Trarthus e a provocação do Chamariz (a IA dos monstros). (G20c feito: os ancestrais (a ativação pela wiki no poedb salvo: o Chefe Guerreiro 80 u = 8 m, o Protetor 85 u = 8,5 m; o buff "enquanto o Totem estiver Ativo", que não soma entre totens), a aura do Rejuvenescedor, o Solo Sagrado do Flamejante, o feixe do Vínculo Abrasador e a Detonação, a Artilharia em linha/cruz/foco, a provocação do Chamariz, o Devorador, o Trarthus, a velocidade por totem máximo da Balista de Cerco.
2. Depois, pelos planos do workflow `g19-familias-desenho`: lacaios, buffs sem equivalente, a cauda dos suportes e a das ativas (com a velocidade de projétil como família própria).
3. G19 — as afecções pela conta do PoB (ver o fim do G17).
