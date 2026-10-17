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

### G8 — as linhas de buff das auras, arautos, guardas e clamores (17/10)

- `linhas-das-gemas.atributosDoBuff`: "Buff concede…" e "Você e aliados próximos ganham/têm/são…" viram os atributos do buff (`GemasPoe.buffNoNivel`) — frases próprias (o dano adicionado dos Arautos aos ataques e às magias, o "mais Armadura", o máximo de resistência das Purezas, a duração da Malevolência, as imunidades, a Postura de Areia) e, sem regra própria, o tradutor das peças com o começo tirado ("Buff concede Imunidade a Sangramento", "Dano não pode ser Refletido").
- O status do ARAUTO diz que o efeito ao matar (a explosão do Gelo, a tempestade do Trovão, o fogo das Cinzas) ainda não existe — antes o Arauto de Gelo saía "funciona" porque o compilador lia o dano da explosão.
- A Postura de SANGUE do Sangue e Areia segue pendente (no jogo o buff ligado é a Areia; o atributo do buff não vale com ele desligado).
- Teste: `buffs-das-gemas-poe.test.mjs` (2: os números e o Arauto de Gelo ligado na ficha). Ativas parciais 390 → 384.

## Pendências conhecidas (por ordem de prioridade)

1. ~~G3~~ feito. Resto das Minas: a reserva ("Reserva Base igual ao Custo Base"), o Locus (arco, "sempre focam na sua localização", 30% menos projéteis) e o Alto Impacto (dano dobrado perto das Minas). **Antes: os suportes de Armadilha e Mina** (14 suportes travados por "armadilhas e minas ainda não existem no jogo": as plantadas existem desde 12/10). O Suporte de Armadilha e as Minas (Explosão em Cadeia, Alto Impacto, Locus) transformam a habilidade suportada em Armadilha/Mina (`Plantadas.tipoDaGema(entry, efeito)`); Armadilhas Múltiplas/Agrupadas, Montagem Ágil (as 3 faixas de chance), Dano de Armadilha e Mina, Armadilhas Avançadas e Carregadas, Minas Carregadas, Invenção. A reserva das minas ("Reserva Base igual ao Custo Base") precisa de `reserva.mjs`.
2. **A qualidade que falta** (332 de 540 linhas): "Lacaios têm Recuperação da Recarga", "Efeito do Buff aumentado", "Velocidade de Projéteis", "Projéteis que Atravessaram causam X% mais Dano", "mais Vida de Totens", "Máximo de Armas Animadas/Esqueletos", o estágio máximo…
3. **As afecções que saem do acerto final.** O jogo deriva a afecção do dano do acerto já multiplicado ("mais Dano com Acertos" também cresce o Incêndio). No PoE a afecção usa o dano-base com os modificadores DELA. Até mudar isso, "mais Dano com Acertos" (só acertos) não entra como linha local.
4. **As mecânicas compartilhadas maiores:** canalização por estágios (12 gemas), repetições do golpe (11), uso de cadáveres (11), deslocamento (21, hoje "golpe na área"), armadilhas/minas nos suportes (14 suportes: "armadilhas e minas ainda não existem no jogo" — conferir, porque as ativas já plantam), buffs sem equivalente (22: Marcas, Manto Arcano, Desgraça…).
5. **"Dano Físico Base como a Mão Secundária"** (8 gemas de escudo) e os bônus do escudo (crítico pelo Escudo de Energia, dano pela armadura do escudo).
6. **Os outros suportes:** 157 parciais e 31 sem efeito; gatilhos que faltam (Conjurar ao Morrer, ao ser Atordoado, enquanto Canaliza), totens (velocidade de posicionamento), auras (efeito), maldições (efeito em área, duração).
7. **A interface:** o balão da gema mostra as linhas da qualidade que não valem; marcar cada linha (feita / não feita) e o motivo, nos encaixes e na barra.
8. **Testes parametrizados** de todas as gemas `funciona` (ativação, dano > 0, custo) e de todos os suportes `funciona` (o efeito muda o resultado).

## Próximo passo exato

1. G9: o efeito dos Arautos ao matar (Gelo: a explosão no Congelado morto; Trovão: a tempestade no Eletrizado morto; Cinzas: o fogo do dano excedente) — o dano da gema no nível dela.
2. G10: os estágios de canalização (Lâminas Velozes, Ciclone, Flecha Flagelante, Rajada de Chamas — 12 gemas) e as repetições do golpe (11): `hunt.canalizacao` já existe (lote 42 da árvore).
3. G11: as afecções que saem do acerto final.
4. Depois, as mecânicas próprias das gemas de ataque, por quantidade: Ruptura (Ondas de Choque), Estilhaçar a Terra (Estacas), Perfurar, Chuva Tempestuosa, Tempestade de Lâminas, Esmagaossos (Traumatismo).
