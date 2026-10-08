# Matriz de migração dos testes — Draevor → PoE oficial

Gerada em 07/10/2026 a partir da suíte completa no modo oficial (`node --test testes/*.test.mjs`, sem variável nenhuma), ANTES das correções desta etapa: **538 falhas em 106 arquivos** (2.122 testes). Diagnóstico e estratégia: [`migracao-poe-oficial.md`](migracao-poe-oficial.md).

Categorias: **A** bug real do PoE (corrigir) · **B** teste antigo, regra do Draevor (marcar para atualizar/substituir; o PoE não muda) · **C** teste a adaptar ao modelo do PoE · **D** remover (o comportamento deixou de existir) · **E** regressão da mudança de arquitetura (corrigir).

**Resumo:** A 0 · B 292 · C 243 · D 1 · E 2 (as 2 E corrigidas nesta etapa).

**Prova cruzada no modo clássico** (`DRAEVOR_CLASSICO=1`, a mesma suíte): 534 das 538 PASSAM — o motor do Draevor está inteiro e essas falhas são de regra/fixture do Draevor, não de código quebrado. As 4 que falham nos dois modos estão marcadas na coluna "Clássico".

Colunas: **Linha** = onde a falha foi apontada (às vezes a linha de um ajudante do arquivo, por isso se repete); **Clássico** = o mesmo teste com `DRAEVOR_CLASSICO=1`; **Agora** = depois das correções desta etapa.

## Índice

| Arquivo | Falhas | B | C | D | E |
|---|---:|---:|---:|---:|---:|
| [passivas.test.mjs](#passivastestmjs) | 35 | 22 | 13 |  |  |
| [atributos-efeito.test.mjs](#atributos-efeitotestmjs) | 19 | 19 |  |  |  |
| [campanha.test.mjs](#campanhatestmjs) | 19 | 12 | 7 |  |  |
| [regras-do-slot.test.mjs](#regras-do-slottestmjs) | 18 | 7 | 11 |  |  |
| [boss-do-ato.test.mjs](#boss-do-atotestmjs) | 17 | 16 | 1 |  |  |
| [pocoes.test.mjs](#pocoestestmjs) | 15 | 15 |  |  |  |
| [gemas-combinacoes.test.mjs](#gemas-combinacoestestmjs) | 13 | 12 | 1 |  |  |
| [atos-runtime.test.mjs](#atos-runtimetestmjs) | 12 |  | 12 |  |  |
| [gemas-skill.test.mjs](#gemas-skilltestmjs) | 12 | 7 | 5 |  |  |
| [bonus-online.test.mjs](#bonus-onlinetestmjs) | 11 | 11 |  |  |  |
| [encontros-bau.test.mjs](#encontros-bautestmjs) | 11 |  | 11 |  |  |
| [especializacoes.test.mjs](#especializacoestestmjs) | 11 | 11 |  |  |  |
| [orbes-de-socket.test.mjs](#orbes-de-sockettestmjs) | 11 | 11 |  |  |  |
| [classes.test.mjs](#classestestmjs) | 10 | 1 | 9 |  |  |
| [combo.test.mjs](#combotestmjs) | 10 | 6 | 4 |  |  |
| [historico-da-loja.test.mjs](#historico-da-lojatestmjs) | 10 |  | 10 |  |  |
| [modos-das-magias.test.mjs](#modos-das-magiastestmjs) | 10 |  | 10 |  |  |
| [recompensas-de-nivel.test.mjs](#recompensas-de-niveltestmjs) | 10 | 10 |  |  |  |
| [editor-conteudo.test.mjs](#editor-conteudotestmjs) | 9 | 4 | 5 |  |  |
| [magias-fase-a.test.mjs](#magias-fase-atestmjs) | 9 | 6 | 3 |  |  |
| [sets-de-marco.test.mjs](#sets-de-marcotestmjs) | 9 | 9 |  |  |  |
| [chao-e-troca.test.mjs](#chao-e-trocatestmjs) | 8 |  | 8 |  |  |
| [consolidacao-offline.test.mjs](#consolidacao-offlinetestmjs) | 8 |  | 8 |  |  |
| [conta-char.test.mjs](#conta-chartestmjs) | 8 |  | 8 |  |  |
| [mapa-editor.test.mjs](#mapa-editortestmjs) | 8 | 8 |  |  |  |
| [ondas.test.mjs](#ondastestmjs) | 8 |  | 8 |  |  |
| [projeteis.test.mjs](#projeteistestmjs) | 8 | 3 | 5 |  |  |
| [dano-elemental-atributo.test.mjs](#dano-elemental-atributotestmjs) | 7 | 7 |  |  |  |
| [decisao.test.mjs](#decisaotestmjs) | 7 |  | 7 |  |  |
| [reforcos.test.mjs](#reforcostestmjs) | 7 | 7 |  |  |  |
| [bosses-unicos.test.mjs](#bosses-unicostestmjs) | 6 |  | 6 |  |  |
| [encontros-etapa6.test.mjs](#encontros-etapa6testmjs) | 6 |  | 6 |  |  |
| [encontros.test.mjs](#encontrostestmjs) | 6 |  | 6 |  |  |
| [relatorio-da-ausencia.test.mjs](#relatorio-da-ausenciatestmjs) | 6 |  | 6 |  |  |
| [areas.test.mjs](#areastestmjs) | 5 | 4 | 1 |  |  |
| [biblioteca.test.mjs](#bibliotecatestmjs) | 5 | 4 | 1 |  |  |
| [regras-de-uso.test.mjs](#regras-de-usotestmjs) | 5 |  | 5 |  |  |
| [simulador-de-rotacao.test.mjs](#simulador-de-rotacaotestmjs) | 5 |  | 5 |  |  |
| [xp-da-hunt.test.mjs](#xp-da-hunttestmjs) | 5 | 3 | 2 |  |  |
| [captura.test.mjs](#capturatestmjs) | 4 |  | 4 |  |  |
| [combate-formulas.test.mjs](#combate-formulastestmjs) | 4 | 1 | 3 |  |  |
| [conteudo-dos-atos.test.mjs](#conteudo-dos-atostestmjs) | 4 | 4 |  |  |  |
| [defesas-novas.test.mjs](#defesas-novastestmjs) | 4 | 2 | 2 |  |  |
| [simulacao-offline.test.mjs](#simulacao-offlinetestmjs) | 4 |  | 4 |  |  |
| [supports-etapa4.test.mjs](#supports-etapa4testmjs) | 4 | 4 |  |  |  |
| [andares.test.mjs](#andarestestmjs) | 3 |  | 3 |  |  |
| [arma-base.test.mjs](#arma-basetestmjs) | 3 | 2 | 1 |  |  |
| [atos-armazem.test.mjs](#atos-armazemtestmjs) | 3 | 3 |  |  |  |
| [atos-vip-especial.test.mjs](#atos-vip-especialtestmjs) | 3 | 3 |  |  |  |
| [balanceamento-das-gemas.test.mjs](#balanceamento-das-gemastestmjs) | 3 | 3 |  |  |  |
| [campanha-editor.test.mjs](#campanha-editortestmjs) | 3 | 3 |  |  |  |
| [dano-ao-longo-do-tempo.test.mjs](#dano-ao-longo-do-tempotestmjs) | 3 | 2 | 1 |  |  |
| [dano-fisico-variacao.test.mjs](#dano-fisico-variacaotestmjs) | 3 | 3 |  |  |  |
| [economia.test.mjs](#economiatestmjs) | 3 |  | 3 |  |  |
| [equipamento-slots.test.mjs](#equipamento-slotstestmjs) | 3 |  | 3 |  |  |
| [filtro-decisao.test.mjs](#filtro-decisaotestmjs) | 3 | 3 |  |  |  |
| [hunts-painel.test.mjs](#hunts-paineltestmjs) | 3 | 2 | 1 |  |  |
| [minimapa.test.mjs](#minimapatestmjs) | 3 |  | 3 |  |  |
| [motor-de-dano.test.mjs](#motor-de-danotestmjs) | 3 |  | 3 |  |  |
| [regen-na-cidade.test.mjs](#regen-na-cidadetestmjs) | 3 | 3 |  |  |  |
| [server-save.test.mjs](#server-savetestmjs) | 3 |  | 3 |  |  |
| [setores.test.mjs](#setorestestmjs) | 3 |  | 3 |  |  |
| [site.test.mjs](#sitetestmjs) | 3 |  | 3 |  |  |
| [amigos.test.mjs](#amigostestmjs) | 2 |  | 2 |  |  |
| [avancar-em-grupo.test.mjs](#avancar-em-grupotestmjs) | 2 |  | 2 |  |  |
| [combate-limites.test.mjs](#combate-limitestestmjs) | 2 | 2 |  |  |  |
| [conjuntos.test.mjs](#conjuntostestmjs) | 2 | 2 |  |  |  |
| [ficha-de-dano.test.mjs](#ficha-de-danotestmjs) | 2 |  | 2 |  |  |
| [ficha-origens.test.mjs](#ficha-origenstestmjs) | 2 | 2 |  |  |  |
| [hot-reload-conteudo.test.mjs](#hot-reload-conteudotestmjs) | 2 | 1 | 1 |  |  |
| [implicitos.test.mjs](#implicitostestmjs) | 2 | 2 |  |  |  |
| [item-power-editor.test.mjs](#item-power-editortestmjs) | 2 | 2 |  |  |  |
| [item-power.test.mjs](#item-powertestmjs) | 2 | 2 |  |  |  |
| [itens-compat.test.mjs](#itens-compattestmjs) | 2 | 2 |  |  |  |
| [melee.test.mjs](#meleetestmjs) | 2 | 1 | 1 |  |  |
| [morte.test.mjs](#mortetestmjs) | 2 | 2 |  |  |  |
| [overrides-itens.test.mjs](#overrides-itenstestmjs) | 2 | 2 |  |  |  |
| [poder-da-arma.test.mjs](#poder-da-armatestmjs) | 2 | 2 |  |  |  |
| [recarga.test.mjs](#recargatestmjs) | 2 | 2 |  |  |  |
| [tarefas.test.mjs](#tarefastestmjs) | 2 | 2 |  |  |  |
| [validacao.test.mjs](#validacaotestmjs) | 2 |  |  |  | 2 |
| [andar-por-clique.test.mjs](#andar-por-cliquetestmjs) | 1 | 1 |  |  |  |
| [arena.test.mjs](#arenatestmjs) | 1 | 1 |  |  |  |
| [atos-modelo.test.mjs](#atos-modelotestmjs) | 1 | 1 |  |  |  |
| [atos-recompensas.test.mjs](#atos-recompensastestmjs) | 1 |  | 1 |  |  |
| [atos-versoes.test.mjs](#atos-versoestestmjs) | 1 |  | 1 |  |  |
| [atributos-do-mob.test.mjs](#atributos-do-mobtestmjs) | 1 |  | 1 |  |  |
| [balanceamento-1-100.test.mjs](#balanceamento-1-100testmjs) | 1 | 1 |  |  |  |
| [base-por-raridade.test.mjs](#base-por-raridadetestmjs) | 1 | 1 |  |  |  |
| [bolsa-mover.test.mjs](#bolsa-movertestmjs) | 1 | 1 |  |  |  |
| [chegadas.test.mjs](#chegadastestmjs) | 1 | 1 |  |  |  |
| [equipamento.test.mjs](#equipamentotestmjs) | 1 |  | 1 |  |  |
| [escalonamento.test.mjs](#escalonamentotestmjs) | 1 |  | 1 |  |  |
| [familiar-combate.test.mjs](#familiar-combatetestmjs) | 1 |  | 1 |  |  |
| [itens-novos-sprites.test.mjs](#itens-novos-spritestestmjs) | 1 |  | 1 |  |  |
| [itens-poe-combate.test.mjs](#itens-poe-combatetestmjs) | 1 | 1 |  |  |  |
| [itens-poe.test.mjs](#itens-poetestmjs) | 1 |  |  | 1 |  |
| [loot-moeda.test.mjs](#loot-moedatestmjs) | 1 |  | 1 |  |  |
| [mobs-mecanicas.test.mjs](#mobs-mecanicastestmjs) | 1 |  | 1 |  |  |
| [modo-beta.test.mjs](#modo-betatestmjs) | 1 | 1 |  |  |  |
| [party-follow-independente.test.mjs](#party-follow-independentetestmjs) | 1 |  | 1 |  |  |
| [prey-combate.test.mjs](#prey-combatetestmjs) | 1 | 1 |  |  |  |
| [tooltip-dos-buffs.test.mjs](#tooltip-dos-buffstestmjs) | 1 | 1 |  |  |  |
| [tooltip-gemas.test.mjs](#tooltip-gemastestmjs) | 1 | 1 |  |  |  |
| [velocidade-de-ataque.test.mjs](#velocidade-de-ataquetestmjs) | 1 | 1 |  |  |  |
| [world-dados.test.mjs](#world-dadostestmjs) | 1 |  | 1 |  |  |

## passivas.test.mjs

35 falha(s) — B 22 · C 13

**B** — Árvore do Draevor (5 inícios por vocação, clusters v2, migração v1, Arqueiro Arcano, vessels do Gem Atelier, especialização); no oficial a árvore é a do PoE (arvore-poe.json).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-arvore).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 49 | a árvore do jogo é válida: ids únicos, conexões dos dois lados, tudo alcançável, 5 inícios | passa | falha |
| 68 | 1-2: personagem novo começa no início da classe e ganha pontos pelo level (a conta de antes) | passa | falha |
| 31 | 4-5: alocar um NOTABLE e um KEYSTONE pelo caminho | passa | falha |
| 194 | 12-16: knight começa no início dele, a poucos nós (um caminho de atributo) de physical/armour/life/melee | passa | falha |
| 194 | 12-16: paladin começa no início dele, a poucos nós (um caminho de atributo) de physical/holy/ranged/accuracy | passa | falha |
| 194 | 12-16: sorcerer começa no início dele, a poucos nós (um caminho de atributo) de fire/energy/death/spell | passa | falha |
| 194 | 12-16: druid começa no início dele, a poucos nós (um caminho de atributo) de ice/earth/holy/spell | passa | falha |
| 194 | 12-16: monk começa no início dele, a poucos nós (um caminho de atributo) de energy/melee/mobility/evasion | passa | falha |
| 213 | 17-20: cross-build Knight → Fire/Spell — dá para chegar, e o dano da tag sobe | passa | falha |
| 213 | 17-20: cross-build Paladin → Spell — dá para chegar, e o dano da tag sobe | passa | falha |
| 213 | 17-20: cross-build Druid → Ice — dá para chegar, e o dano da tag sobe | passa | falha |
| 213 | 17-20: cross-build Monk → Energy — dá para chegar, e o dano da tag sobe | passa | falha |
| 222 | 17b: o Knight chega ao Fire pelo anel, e o Sorcerer chega MAIS PERTO (o início define onde começa) | passa | falha |
| 31 | 22: árvore + gema — o dano da skill (o mesmo do balão) sobe com Fire da árvore | passa | falha |
| 31 | 23: árvore + especialização da classe somam na mesma afinidade (Physical do Knight + Physical da árvore) | passa | falha |
| 31 | 24: árvore + buff — o Blood Rage (+15% melee) soma por cima da árvore no termo do golpe, sem substituir | passa | falha |
| 31 | keystones de regra: Arqueiro Arcano (INT → Ranged) e Guerreiro de Sangue (Life Leech ×1,5) | passa | falha |
| 31 | keystone de habilidade liga o gancho do combate (os 15 da árvore antiga valem na nova) | passa | falha |
| 31 | vessels do Gem Atelier contam os nós da árvore nova por domínio | passa | falha |
| 406 | v2: entre os clusters há nós de atributo (+STR/+DEX/+INT), e eles dão o atributo de verdade | passa | falha |
| 424 | v2: na fronteira entre classes de atributos diferentes há nós HÍBRIDOS (dois atributos) | passa | falha |
| 445 | v2: migração — quem tinha a árvore da versão 1 perde só o que ficou sem caminho, com os pontos de volta e 1 respec grátis | passa | falha |

**C** — Regra da engine da árvore (só aloca ligado, sem ponto não aloca, keystone com nível, respec, servidor recusa inválido, árvore na ficha/balão/comparação/combate) — vale para a árvore do PoE; o teste usa nós da árvore do Draevor (armour_na, life_na…).  
**Ação:** Reescrever sobre arvore-poe.json (início da classe do PoE, nós reais); itens-poe-arvore cobre só conversão, início, maestrias e keystones.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 81 | 3: alocar um nó ligado ao início (o 1º do caminho de atributo) — o ponto sai | passa | falha |
| 102 | 6: nó sem conexão com um nó seu é recusado (não basta mandar "unlock node X") | passa | falha |
| 109 | 7: sem pontos, não aloca | passa | falha |
| 114 | 8: keystone pede level mínimo | passa | falha |
| 123 | 29: o servidor recusa o inválido — nó que não existe, repetido, início de outra classe, pedido desconhecido | passa | falha |
| 31 | 9: respec — não tira nó que ilharia outros (a não ser junto); devolve o ponto e cobra o ouro | passa | falha |
| 31 | 9b: full respec (o grátis da migração primeiro) e só fora da caçada | passa | falha |
| 31 | 10-11: os stats são refeitos ao alocar e ao tirar (Life % na vida máxima, Armour % na armadura) | passa | falha |
| 232 | 21: árvore + equipamento somam no mesmo número (STR da árvore + STR do item) | passa | falha |
| 31 | 25: a ficha mostra a árvore (afinidades, origem e keystones) | passa | falha |
| 31 | 26: o balão da skill (catálogo) reflete a árvore | passa | falha |
| 31 | 27: a comparação de item enxerga a árvore (o personagem da comparação já tem os nós) | passa | falha |
| 31 | 28: o combate usa a árvore — golpe da arma com Physical e o keystone de conversão (físico → fogo) | passa | falha |

## atributos-efeito.test.mjs

19 falha(s) — B 19

**B** — Atributos de afixo do Draevor (crit_dmg, elem_pen, *_dmg holy/death/energy/earth, exp_bonus, gem_level…) e magia do Draevor (spell-energy-strike); no PoE os mods vêm traduzidos dos mods do PoE.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-mods, condicoes-poe).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 297 | dex: com o atributo, o efeito muda (menos) | passa | falha |
| 107 | int: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | crit_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 107 | elem_pen: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | life_leech: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | mana_leech: com o atributo, o efeito muda (mais) | passa | falha |
| 134 | cast_speed: com o atributo, o efeito muda (menos) | passa | falha |
| 134 | cooldown_recovery: com o atributo, o efeito muda (menos) | passa | falha |
| 146 | skill_cost: com o atributo, o efeito muda (menos) | passa | falha |
| 92 | gem_level: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | fire_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | energy_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | earth_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | ice_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | death_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | holy_dmg: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | life_regen_pct: com o atributo, o efeito muda (mais) | passa | falha |
| 296 | exp_bonus: com o atributo, o efeito muda (mais) | passa | falha |
| 107 | resistência do bicho vale na magia (troll resiste 20% a energia) e o elemental dos atributos passa por ela | passa | falha |

## campanha.test.mjs

19 falha(s) — B 12 · C 7

**B** — Campanha do Draevor (48 fases, 4 atos de 12, Fácil/Médio/Difícil, Troll Cave, fase travada/pular); no oficial a campanha é a do PoE (10 atos + Epílogo, sem dificuldades).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-campanha, itens-poe-atos).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 25 | configuração: 48 fases, 4 atos de 12, e o level alvo sobe dentro de cada faixa | passa | falha |
| 40 | começa na fase 1 do Fácil: só ela abre; Médio e Difícil fechados | passa | falha |
| 19 | fim do ato: o boss abre com as 12 fases; a 1ª vitória libera o ato seguinte | passa | falha |
| 141 | boss de ato fechado: não entra sem as 12 fases | passa | falha |
| 19 | terminou o Fácil (boss do Ato 4): abre o Médio; as hunts quebradas contam sozinhas | passa | falha |
| 166 | a força dos bichos: a mesma Troll Cave é fraca no Fácil e muito forte no Difícil | passa | falha |
| 178 | o loot da fase usa o ato e a dificuldade dela, e o Item Level é o level alvo da fase | passa | falha |
| 199 | a tela: a campanha inteira por dificuldade e a fase atual no quadro da caçada | passa | falha |
| 19 | "Seguir" no fim do ato não entra no boss; e pula a hunt quebrada/travada | passa | falha |
| 294 | fase travada (pular): ninguém entra — nem pelo servidor —, e ela conta como completa | passa | falha |
| 310 | Infernatil Seal, Jaded Roots e Walking Pillar têm mapa (replicado de outro) e abrem com os bichos DELAS | passa | falha |
| 340 | a fase depois de uma travada NÃO abre de graça: exige a última fase de verdade antes dela | passa | falha |

**C** — Regra da engine de fase/instância (limpar conclui e libera a seguinte, sem respawn, instância nova após o Hunt Clear, offline em loop, Ficar/Avançar) — vale nas áreas do PoE; o teste lê CAMPANHA.fases do Draevor (vazia no oficial).  
**Ação:** Reescrever sobre as áreas do Ato 1 do PoE (poe-a1-*).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 52 | limpar a instância completa a fase e libera a seguinte (com o "Hunt Clear!" na tela) | passa | falha |
| 72 | sem respawn; depois da pausa do "Hunt Clear!", uma instância NOVA (outro id, bichos sorteados de novo) | passa | falha |
| 105 | a instância nasce dos SPAWNS DO MAPA, igual em toda dificuldade, e o progresso é o % limpo | passa | falha |
| 187 | caçada offline: limpa a instância (conta para a fase) e fica em loop mesmo com "Seguir" | passa | falha |
| 221 | caçada de antes da instância: fase liberada entra de novo como instância; fechada termina com aviso | passa | falha |
| 256 | "Ficar na fase" (padrão) fica em loop; "Avançar sozinho" vai para a próxima com a fase completa | passa | falha |
| 19 | fase "completa" por carona (party) sem a anterior NÃO abre as seguintes: a liberação olha a cadeia inteira do ato | passa | falha |

## regras-do-slot.test.mjs

18 falha(s) — B 7 · C 11

**C** — Regras do slot (condições, mana mínima, mínimo/máximo de criaturas, Vida/Mana, "Não usar quando", motivo na tela) valem na barra do PoE; o teste põe magia do Draevor em slot do Draevor ("Slot inválido.").  
**Ação:** Adaptar: gemas do PoE nos slots da barra do PoE (BARRA_DO_POE), sem o global do Draevor.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 45 | definir guarda todos os campos da tela (e limpa os fora da faixa) | passa | falha |
| 45 | condições gravadas são higienizadas: tipo desconhecido sai, número em texto vira número | passa | falha |
| 45 | slot desligado não sai | passa | falha |
| 45 | mana mínima (%): abaixo dela a magia não sai; acima sai | passa | falha |
| 45 | mínimo de criaturas na magia de ALVO ÚNICO: conta quem está a até 4 sqm | passa | falha |
| 45 | máximo de criaturas: com mais que o teto a magia não sai (0 = sem teto) | passa | falha |
| 45 | condição Vida/Mana: sua ou do alvo, em % ou em número, ≤ e ≥ | passa | falha |
| 45 | cura com condição do ALVO: o bicho mirado conta (não fica sempre falso) | passa | falha |
| 45 | o resto da tela: prioridade (trocar), tecla, limpar o slot, conjuntos salvos | passa | falha |
| 45 | "Não usar quando": a condição ao contrário — "Não usar quando Você · Mana ≤ 20%" | passa | falha |
| 45 | o motivo de o slot não sair vai para a tela (qual condição), e some quando ele sai | passa | falha |

**B** — Magias/papéis do Draevor (utamo/exana vita, cura de aliado, Chivalrous Challenge); não existem no PoE.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 45 | curar amigo — "Eu mesmo": cura quem lança | passa | falha |
| 45 | curar amigo — "o mais ferido": cura o aliado da caçada, e só abaixo do "até %" | passa | falha |
| 45 | curar amigo — "pelo nome": só essa pessoa; fora da caçada, não sai | passa | falha |
| 45 | desafio — "quando alguém da party estiver apanhando": conta os bichos colados NELE | passa | falha |
| 45 | desafio — "no máximo uma vez a cada N s" | passa | falha |
| 45 | utamo vita com "tirar o escudo quando mana ≤ 25%": o tique tira o escudo e não relança | passa | falha |
| 45 | exana vita com "só se o utamo vita já puder voltar" | passa | falha |

## boss-do-ato.test.mjs

17 falha(s) — B 16 · C 1

**B** — Boss de fim de ato do Draevor (4 bosses, portal após as 12 fases, recarga); no PoE o chefe do ato está na área e conclui a missão.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-atos: "matar o chefe").

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 41 | B1. o catálogo: os 4 bosses de fim de ato saem SEM recarga (cooldownHours 0, semEspera); os outros bosses mantêm a recarga real | passa | falha |
| 60 | B2. recarga antiga (72 h do The Primal Menace, 12 h dos outros) não bloqueia; limparRecargasDeAto zera só o carimbo dos bosses de ato | passa | falha |
| 77 | B3. tentativas ilimitadas: entrar, sair, morrer e entrar de novo, dez vezes seguidas, sem nenhuma espera gravada | passa | falha |
| 93 | B4. o boss de ato sem as fases completas continua fechado (a recarga saiu, a progressão não) | passa | falha |
| 35 | P1. o portal NÃO aparece antes de concluir a última fase, e entrar nele é recusado | passa | falha |
| 35 | P2. concluir a última fase abre o portal (uma vez, com o boss do ato), avisa na tela e o cliente recebe o marcador e o botão | passa | falha |
| 35 | P3. instância nova (reinício) fecha o portal: a limpeza antiga não vale; só o portal aberto passa pela gravação | passa | falha |
| 35 | P4. entrar no portal leva à arena do boss (sem a recarga), e um segundo pedido igual é recusado (idempotente) | passa | falha |
| 35 | P5. fase já completa e boss já vencido NÃO dão portal: entrar na última fase de novo exige limpar de novo; sem espera | passa | falha |
| 182 | N1. startHunt direto no boss de ato (cartão/atalho/cliente) é recusado: só o portal da limpeza atual leva à arena | passa | falha |
| 35 | N2. limpar só parte dos bichos não abre o portal; o mesmo evento de morte repetido não adianta a limpeza | passa | falha |
| 35 | N3. sair antes de limpar não deixa portal; a instância espera o portal aberto por um tempo antes de recomeçar | passa | falha |
| 216 | N4. todos os atos: a última jogável antes do boss é a que abre o portal; as outras não | passa | falha |
| 35 | N5. Caça Automática: a sessão entra sozinha no portal uma vez; falha não vira laço; manual (online) não entra sozinho | passa | falha |
| 243 | P6. só abre na ÚLTIMA fase do ato (fases de antes não abrem portal), e a validação é do servidor (cliente não força) | passa | falha |
| 262 | P7. party: o portal vive na sala do dono; cada integrante entra por conta própria, só se ELE tem o ato liberado; ninguém é levado junto | passa | falha |

**C** — Idempotência da vitória no boss (evento repetido não paga de novo) vale para os chefes do PoE (pináculos na arena).  
**Ação:** Reescrever com um chefe pináculo do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 293 | V1. a vitória no boss é registrada UMA vez por luta: evento repetido não paga outra sacola nem outra conclusão; outra luta paga a sua | passa | falha |

## pocoes.test.mjs

15 falha(s) — B 15

**B** — Poções do Draevor pela barra; no PoE são os frascos (cinto, cargas).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-frascos). Vira D quando o modo clássico for aposentado.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 44 | health potion (266) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | mana potion (268) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | small health potion (7876) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | strong health potion (236) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | strong mana potion (237) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | great mana potion (238) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | great health potion (239) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | great spirit potion (7642) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | ultimate health potion (7643) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | ultimate mana potion (23373) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | ultimate spirit potion (23374) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 44 | supreme health potion (23375) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga | passa | falha |
| 93 | a recarga é de todas as poções: vida e mana não saem no mesmo instante | passa | falha |
| 115 | quantidade 1 some da mochila; quantidade 0 não cura nem cria item | passa | falha |
| 134 | trocar a poção do slot troca a que é gasta | passa | falha |

## gemas-combinacoes.test.mjs

13 falha(s) — B 12 · C 1

**B** — Suportes do Draevor (Explosion, Returning…) combinados em magia do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 60 | explosão sem outras supports: alvo sozinho leva o direto E a explosão; o evento é UM, no ponto do impacto, 3×3 | passa | falha |
| 60 | explosão 3×3: as 9 casas levam; a 2 casas, não | passa | falha |
| 60 | explosão em coordenadas diferentes: sempre no bicho do impacto | passa | falha |
| 60 | explosão: dano ~40% de um golpe direto (rolagem própria) e passa pela resistência do bicho (teto de resistência do bicho) | passa | falha |
| 60 | Explosion + Pierce: cada impacto da reta explode no ponto dele; o projétil segue depois da explosão | passa | falha |
| 60 | Explosion + Multiple Projectiles: cada projétil explode no seu impacto | passa | falha |
| 60 | Explosion + Pierce + Multiple Projectiles: os extras também perfuram e explodem | passa | falha |
| 60 | Explosion + Fork: o projétil se divide no impacto e cada filho explode onde acerta | passa | falha |
| 60 | Explosion + Chain: cada salto explode uma vez; com 2 bichos a cadeia acaba (não volta para quem já pegou) | passa | falha |
| 60 | Explosion + Returning: na volta acerta cada um UMA vez e explode de novo | passa | falha |
| 60 | explosões sobrepostas acumulam: o vizinho de dois impactos leva duas explosões | passa | falha |
| 295 | caçada automática (idle/offline usam o mesmo tique): as explosões das supports saem no combate de verdade | passa | falha |

**C** — Pierce existe no PoE e a mecânica de projétil é da engine; o teste usa gema do Draevor.  
**Ação:** Reescrever com gema de projétil do PoE + Pierce do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 60 | Pierce sem explosão: atravessa na reta, até o limite de perfurações | passa | falha |

## atos-runtime.test.mjs

12 falha(s) — C 12

**C** — O editor de Atos é o mesmo no PoE (gamedata/atos/poe-ato-N.json); o teste monta um ato com hunts do Draevor, que o oficial ignora (campanha.mjs:639) — "Esta hunt não existe".  
**Ação:** Adaptar o ato de teste para poe-ato-* com áreas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 48 | R1. o ato do editor entra na campanha (fases com grafo, boss final, cliente vê o ato 5) e os legados seguem iguais | passa | falha |
| 62 | R2. a porta do ato: sem o boss do ato anterior vencido nada abre; com ele, só a fase inicial | passa | falha |
| 39 | R3. progressão pelo grafo de verdade: bifurcação (2→3 e 2→4), ramal opcional, convergência em 5, e o boss só com as obrigatórias | passa | falha |
| 39 | R4. portal do boss final do ato do editor: só abre limpando a hunt NESTA execução, entra pelo portal, sem recarga, e a vitória não mexe na dificuldade | passa | falha |
| 39 | R5. "Seguir" (Caça Automática) anda pelo grafo: a próxima aberta e ainda não feita | passa | falha |
| 120 | R6. estado beta só vale com o modo beta ligado; desligado, o ato some do cliente e fecha | passa | falha |
| 130 | R7. ato inválido NÃO entra (nenhum efeito): hunt de outro ato, boss repetido, ordem de legado, ciclo | passa | falha |
| 164 | P1. recompensa da fase: a primeira limpeza paga ouro/exp UMA vez por personagem; a repetição não paga a 1ª vez de novo | passa | falha |
| 182 | P2. drops da fase: item com chance 100% cai a cada limpeza (repetível), pelo loot normal; chance 0 é recusada pela validação | passa | falha |
| 200 | P3. recompensa do boss final: paga na vitória (1ª vitória uma vez por personagem), sem pagar duas vezes por evento repetido | passa | falha |
| 219 | P4. alertas da validação: duplicado, mesma fonte dupla e recompensa vazia viram aviso; erro bloqueia a publicação | passa | falha |
| 230 | P5. party: a primeira vez paga cada personagem da sala uma vez; chamar de novo (evento duplicado) não paga ninguém de novo | passa | falha |

## gemas-skill.test.mjs

12 falha(s) — B 7 · C 5

**C** — Regra da engine de gemas (link do suporte, XP pela morte, gema entra sozinha no slot, configuração guardada) vale para as gemas do PoE; o teste usa gemas do Draevor.  
**Ação:** Reescrever com gemas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 68 | 12–13. support LIGADA à gema ativa modifica a skill; a mesma support sem link, não | passa | falha |
| 179 | Multiple Projectiles: os bichos ao alcance levam o projétil também | passa | falha |
| 219 | a XP das gemas vem da morte de verdade (matarMonstro) | passa | falha |
| 522 | barra: gema encaixada entra sozinha no slot livre do papel dela; gema tirada (ou peça desvestida) esvazia o slot | passa | falha |
| 621 | barra: a configuração do slot fica guardada quando a gema sai, e volta igual (mesmo slot) quando ela volta | passa | falha |

**B** — Regra das gemas do Draevor (nível como bônus, sem trava de atributo, runa virou gema, migração v5, XP pelo level do personagem, Forked Glacier); no PoE vale a tabela de cada gema.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-gemas).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 68 | o nível da gema é um bônus a mais no dano da skill (a progressão dela) | passa | falha |
| 246 | conjuração de verdade: a skill só sai no fim do Cast Time; durante ela nada mais sai; cancela se o alvo morre | passa | falha |
| 288 | runa virou gema: não gasta mais item nem ouro | passa | falha |
| 319 | migração v5: peças que existiam ganham todos os sockets abertos e ligados; as magias/runas da barra viram gemas encaixadas | passa | falha |
| 68 | sem trava: qualquer personagem usa qualquer gema; o dano base escala pelo level e pelo ML (melee nas físicas) | passa | falha |
| 639 | XP da gema pelo level ATUAL do personagem: o mesmo nível pede a mesma fração de UM level dele | passa | falha |
| 669 | cadeia (Forked Glacier): salta de bicho em bicho a até a distância do salto, até o número de alvos; cada um leva o golpe | passa | falha |

## bonus-online.test.mjs

11 falha(s) — B 11

**B** — Bônus da Caça Online (+15%): o dono tirou no PoE (decisão de 07/10).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE. Vira D quando o modo clássico for aposentado.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 41 | a regra existente: o bônus é o `bonusOnline` do catálogo (15%) | passa | falha |
| 54 | A/C/F. caça online solo: a morte paga a exp base + 15% | passa | falha |
| 66 | B. caça automática: nenhum bônus online (a XP base não mudou) | passa | falha |
| 82 | B2. caçada OFFLINE de quem saiu da Caça Online: sem bônus online | passa | falha |
| 103 | D. party online: cada membro recebe a parte dele com o bônus do PRÓPRIO modo | passa | falha |
| 118 | E. vários bichos: cada morte com o bônus, uma vez só | passa | falha |
| 139 | G/J. pelo tique de verdade: exp, sessão e ficha batem, e o bônus não é aplicado duas vezes | passa | falha |
| 156 | G2. o bônus pode fazer subir de level — pela mesma conta do resto | passa | falha |
| 169 | H/I. persistência e o que vai ao cliente: a exp com bônus é gravada e é a do `character` | passa | falha |
| 230 | loot: a Caça Online dá 15% mais CHANCE em cada linha; a automática não | passa | falha |
| 262 | loot na sala do boss (vitória): online 15% mais chance, automática não | passa | falha |

## encontros-bau.test.mjs

11 falha(s) — C 11

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 33 | baú comum no idle: abre sozinho, paga pelo loot de sempre e termina UMA vez (reavaliar não paga de novo) | passa | falha |
| 33 | primeira conclusão paga o prêmio UMA vez por personagem; a repetição (outra instância) só dá o loot normal | passa | falha |
| 33 | armadilha: sai pela semente (mesma resposta sempre), assusta mas tem teto de % da vida | passa | falha |
| 33 | baú raro com guardiões: os guardiões nascem, o baú só abre quando o último cai, e a recompensa é paga uma vez | passa | falha |
| 33 | baú amaldiçoado SEMPRE invoca; baú comum com chanceDeInvocacao invoca pela semente (e não re-rola) | passa | falha |
| 33 | requisitos: nível e chave negam sem tocar no baú (que segue disponível); a chave só é gasta ao abrir; no idle sem requisito ele fica fechado e não trava a fase | passa | falha |
| 33 | altar: liga os efeitos (os mesmos afixos do equipamento) por um tempo do RELÓGIO DA SALA, não empilha o mesmo altar e respeita o teto | passa | falha |
| 33 | altar com penalidade: efeitos negativos e inimigos invocados; e vale para a PARTY toda | passa | falha |
| 33 | party: o loot do baú é SORTEADO entre os membros (o mesmo do loot de bicho) e a primeira conclusão paga cada membro | passa | falha |
| 33 | "interagir": o clique duplo e dois membros pedindo juntos abrem UMA vez; longe, sem requisito ou sem encontro, recusa com mensagem | passa | falha |
| 33 | persistência: baú com guardiões e altar ligado sobrevivem a gravar e carregar (sem re-sortear, sem pagar de novo) | passa | falha |

## especializacoes.test.mjs

11 falha(s) — B 11

**B** — Especializações das vocações do Draevor; no PoE não existem (decisão do dono; ficha-poe cobre "sem especialização").  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE. Vira D quando o modo clássico for aposentado.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 80 | 1. Knight usando skill Physical (Brutal Strike, melee): +Physical +Melee | passa | falha |
| 80 | 2. Sorcerer usando Fire (Flame Strike): +Fire +Spell | passa | falha |
| 80 | 3. Knight usando Fire (Flame Strike): pode (não bloqueia), mas sem afinidade natural | passa | falha |
| 80 | 4. Paladin usando skill ranged (Ethereal Spear e o arco): +Physical +Ranged | passa | falha |
| 80 | 5. Paladin usando Fire (Flame Strike e Fireball rune): pode, sem afinidade natural | passa | falha |
| 80 | 6. Druid usando Ice (Ice Strike): +Ice (e não Spell — a do druid é Healing) | passa | falha |
| 169 | 7. Monk usando skill melee (golpe básico e Swift Jab): +Physical +Melee; Mobility na ficha | passa | falha |
| 80 | 8. dano antes/depois de equipar um item: Fire Damage do anel soma com a afinidade (mesma conta da comparação) | passa | falha |
| 195 | 9. ficha: a classe, as especializações naturais e os efeitos derivados | passa | falha |
| 213 | 10. a origem dos bônus (o que a ficha e o balão mostram): base, equipamento, especialização | passa | falha |
| 258 | etapa 6: cada bônus de STAT das especializações (os valores do prompt) chega na ficha — com vs sem a especialização | passa | falha |

## orbes-de-socket.test.mjs

11 falha(s) — B 11

**B** — Orbes de socket do Draevor vendidos na loja e a capacidade por peso; no PoE são Joalheiro/Fusão/Cromático e a mochila de 20 vagas.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-sockets, sockets-cores-poe, filtro-poe).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 202 | campos extras do `soquetes` (cores, no futuro) sobrevivem às operações dos orbes | passa | falha |
| 211 | drop: a chance dos orbes é ZERO por enquanto (a fonte é a loja); com valor na config, sai | passa | falha |
| 221 | loja: os dois orbes aparecem, a 10.000.000 de gold cada, com nome e ícone (id do item) | passa | falha |
| 243 | compra de 1 e de várias unidades: desconta o total exato e empilha na mochila | passa | falha |
| 259 | compra: o ouro vem do bolso e depois do banco; a pilha passa de 100 em outra pilha | passa | falha |
| 271 | compra sem saldo: recusada por inteiro — nem ouro nem item mexem | passa | falha |
| 284 | compras seguidas (concorrência): cada uma confere o saldo da anterior — não gasta o mesmo ouro duas vezes | passa | falha |
| 294 | produto fora da loja ou indisponível: recusado; o teto por compra vale | passa | falha |
| 315 | inventário cheio: o que passa da capacidade vai para o depósito (o mais pesado primeiro), sem perder nada | passa | falha |
| 340 | o pedido repetido (mesmo `pedido`) é ignorado pela sessão: um duplo clique compra uma vez só | passa | falha |
| 354 | persistência da compra: depois do save, os orbes e o saldo continuam | passa | falha |

## classes.test.mjs

10 falha(s) — B 1 · C 9

**B** — A fábrica esperada são as 5 classes do Draevor; no oficial a fábrica são as 7 do PoE.  
**Ação:** Atualizar a expectativa para as 7 classes do PoE (itens-poe-classes).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 36 | CL1. a fábrica é o que o jogo JÁ tem: 5 classes (nome de classes.json, atributos de atributos-principais.json), bônus de fábrica idênticos aos de antes, sem inventar valores | passa | falha |

**C** — Regras do Editor de Classes (validação, override, hot reload, rotas, criação valida a classe) valem para as classes do PoE; o teste usa ids do Draevor (knight) — "vocação-base undefined".  
**Ação:** Adaptar para ids das classes do PoE (marauder, ranger…).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 61 | CL2. validação: ID, nome, cor, ícone, ativo, vocação-base, atributos negativos/não inteiros, ganho por level, bônus fora do limite, classe de fábrica apagada, nenhuma ativa | passa | falha |
| 70 | CL3. ID duplicado não existe: o ID é a chave (uma classe com ID de fábrica EDITA a de fábrica); minimizar grava só o diferente; classe criada vai inteira | passa | falha |
| 78 | CL4. atributos na ENGINE: inicial + ganho por level × (level − 1), derivado a cada cálculo (nunca somado duas vezes); classe criada usa os dela; personagem antigo (sem classe) usa a vocação | passa | falha |
| 94 | CL5. bônus por ponto: vida (STR), precisão e evasão (DEX), mana (INT) saem de UMA tabela; mudar no editor muda a ficha; sem duplicar; os 2 bônus % novos entram em Evasion e Energy Shield | passa | falha |
| 124 | CL6. prévia dos efeitos pelas regras configuradas (Força 20 → +10 vida, +4%; Destreza 20 → +40 precisão, +4% evasão; Inteligência 20 → +10 mana, +4% ES) e igual ao que a engine calcula | passa | falha |
| 129 | CL7. override do editor: propor não grava; salvar grava só o diferente com versão; conflito 409; reverter; restaurar versão; comparar versões; apagar classe com personagens é recusado; desativar avisa | passa | falha |
| 151 | CL8. Hot Reload: a estratégia aplica sem reiniciar, mantém a última versão válida se o arquivo for inválido e volta à fábrica quando o override some; validação central, Git e rotas reconhecem o módulo | passa | falha |
| 169 | CL9. rotas: configuração com personagens por classe, prévia, validar/salvar/reverter/restaurar/comparar; migração exige banco, confirmação, classe ativa e destino diferente; ACL | passa | falha |
| 206 | CL11. criação de personagem: o servidor VALIDA a classe (existe e está ativa), a vocação sai da classe, a classe vai no estado e no banco; tela de criação e rota pública usam as classes ativas; sem confiar no cliente | passa | falha |

## combo.test.mjs

10 falha(s) — B 6 · C 4

**B** — Medem o global do Draevor; no PoE não há global (cada gema tem o próprio tempo — itens-poe-gemas).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 29 | a primeira magia disponível SEMPRE sai: com o slot 1 pronto a cada global, só ele executa | passa | falha |
| 29 | com as 11 magias: a prioridade vale em toda execução, nunca duas no mesmo instante, nunca antes do global | passa | falha |
| 29 | a recarga individual de cada skill continua valendo junto com o global | passa | falha |
| 29 | uma execução recusada não conta: o global mede da última que saiu de verdade | passa | falha |
| 29 | o clique manual também respeita o global (o servidor decide); fora da ordem só se o jogador escolher | passa | falha |
| 245 | cura e suporte não esperam o global de ataque (decisão do dono) | passa | falha |

**C** — Prioridade/recarga/pular sem mana ou fora do alcance valem na barra do PoE (pedido do dono: rotação, limite e prioridade com várias skills).  
**Ação:** Adaptar: gemas do PoE nos slots da barra do PoE (BARRA_DO_POE), sem o global do Draevor.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 29 | slot 1 em recarga: sai o próximo disponível; quando o 1 volta, ele recupera a prioridade | passa | falha |
| 29 | sem mana: as caras são puladas com o motivo, e a prioridade segue entre as baratas | passa | falha |
| 29 | fora de alcance: as de alcance 3 são puladas, as de alcance 7 executam | passa | falha |
| 29 | slots vazios no meio da fileira não quebram a prioridade | passa | falha |

## historico-da-loja.test.mjs

10 falha(s) — C 10

**C** — O personagem de teste não tem a marca do PoE e virou legado arquivado: "não entrou no jogo".  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 23 | A/H. sem compras: responde (não fica em "Carregando") com a lista vazia | passa | falha |
| 23 | B. uma compra: a linha tem o produto, o preço cobrado, o personagem e a hora | passa | falha |
| 23 | C/E/J. várias compras: todas, a mais recente primeiro — e a nova aparece na hora | passa | falha |
| 23 | D/E. compras antigas entram na ordem pela data, não pela ordem de gravação | passa | falha |
| 23 | F. limite: só as últimas `LIMITE`, as mais recentes | passa | falha |
| 23 | o histórico é da CONTA: compras de outro personagem dela aparecem, de outra conta não | passa | falha |
| 23 | compra recusada (sem saldo, produto inexistente) não vira linha | passa | falha |
| 23 | a linha é gravada na MESMA transação da compra: falhou a gravação, a compra volta | passa | falha |
| 23 | G. erro no banco ao ler: a resposta vem assim mesmo, com `erro` (a janela não trava) | passa | falha |
| 23 | I. abrir a loja e comprar respondem a prateleira (`store`) — é o que dispara a recarga da janela aberta | passa | falha |

## modos-das-magias.test.mjs

10 falha(s) — C 10

**C** — Os modos Prioridade/Limite/Rotação valem na barra do PoE (pedido do dono); o teste usa magias do Draevor.  
**Ação:** Adaptar: gemas do PoE nos slots da barra do PoE (BARRA_DO_POE), sem o global do Draevor.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 17 | sem escolher nada, o modo é Prioridade: o slot de cima sai sempre que puder | passa | falha |
| 17 | definirModo: só os três modos e limite de 1 a 3; trocar de modo zera a memória do anterior | passa | falha |
| 17 | Limite 1: cada magia uma vez por volta, e a volta começa sempre pelo slot 1 | passa | falha |
| 17 | Limite 2: o slot 1 sai até 2 vezes a cada 4, e as outras entram nas brechas | passa | falha |
| 17 | Limite 3: o slot 1 domina (3 de cada 4) | passa | falha |
| 17 | Limite: se nenhuma outra pode sair, a que bateu o limite sai mesmo assim (a janela não fica vazia) | passa | falha |
| 17 | Rotação: todas se revezam, pulando a que não pode sair | passa | falha |
| 17 | em todos os modos: nunca duas magias no mesmo instante, nunca antes do global, recarga individual respeitada | passa | falha |
| 17 | Regras de Uso + Limite: a preferida vai na frente, mas o limite vale também para ela | passa | falha |
| 17 | o modo fica no personagem: sai e entra de novo na caçada com o mesmo modo | passa | falha |

## recompensas-de-nivel.test.mjs

10 falha(s) — B 10

**B** — As 4 recompensas de nível do Draevor (montaria, outfit, baús); no PoE há um marco só, o Frasco de Vida Pequeno (decisão do dono, recompensas.mjs).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 41 | cadastro: as 4 recompensas (sem a trilha de treino), cada uma com um ID único | passa | falha |
| 51 | desbloqueio: cada uma abre no level dela, na ordem da fila | passa | falha |
| 66 | resgate de TODAS, uma a uma, e a entrega de cada uma | passa | falha |
| 28 | montaria: entregue no sistema de Aparência, aparece como dona e dá para montar | passa | falha |
| 28 | outfit: Blade Dancer nos dois sexos, com os DOIS addons, e dá para vestir com eles | passa | falha |
| 28 | persistência: depois de gravar e ler (o save é JSON), resgates e liberações continuam | passa | falha |
| 28 | resgate repetido: a segunda chamada é recusada, sem cobrar nem entregar de novo | passa | falha |
| 28 | erro na entrega: nada é cobrado nem marcado como resgatado | passa | falha |
| 28 | tela: os estados vêm do servidor — bloqueada, disponível, resgatada e, na montaria, entregue/em uso | passa | falha |
| 188 | compatibilidade: quem resgatou a montaria/outfit ANTES (pagou e não recebeu) recebe na entrada, sem pagar de novo | passa | falha |

## editor-conteudo.test.mjs

9 falha(s) — B 4 · C 5

**B** — Dados das 48 fases do Draevor (campanha-conteudo.json).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 54 | as fases e a visão geral: 48 fases, nenhum problema nos dados atuais, e as opções para os formulários | falha | falha |
| 157 | dados da fase (descrição, ambiente, conexões, requisitos): valida e grava em campanha-conteudo.json, sem tocar na campanha | passa | falha |
| 219 | o índice do WORLD: salvar encontros o grava em campanha-conteudo.json (boss principal, obrigatórios, todos); salvar dados da fase o preserva; ficar desatualizado vira aviso | passa | falha |
| 240 | requisitos "exige": só fases ANTERIORES e abertas (senão fecharia ciclo com a cadeia do ato) | passa | falha |

**C** — Editor de encontros da fase (validar ponto, gravar só o arquivo da fase, rotas, roda no jogo de verdade) vale para as áreas do PoE; o teste usa fase do Draevor.  
**Ação:** Adaptar para uma área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 85 | encontros: o ponto precisa ser andável (e alcançável); obrigatório inalcançável é erro, opcional é aviso | passa | falha |
| 104 | salvar encontros: grava SÓ o arquivo da fase (gamedata/encontros/), o mapa fica byte a byte igual, recusa o inválido sem criar nada, e lista vazia remove o arquivo | passa | falha |
| 144 | compatibilidade: sem arquivo próprio vale o bloco `encontros` do mapa (formato antigo); com arquivo, o arquivo manda | passa | falha |
| 190 | rotas HTTP: só sob /api/mapas/_conteudo (o prefixo que o nginx tranca), com o corpo validado pelo servidor | passa | falha |
| 203 | o editor roda sobre o jogo de verdade: encontros salvos pelo editor entram numa instância e funcionam | passa | falha |

## magias-fase-a.test.mjs

9 falha(s) — B 6 · C 3

**B** — Global do Draevor contado do início da conjuração / Cast Speed do Draevor; no PoE não há global.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-gemas: "os tempos do PoE").

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 24 | o global conta do INÍCIO da conjuração: com 400 ms de conjuração, o ciclo é 2 s (era 2,5 s) | passa | falha |
| 24 | Cast Speed: cada valor dá o ciclo do global dele (média exata, sem degraus do tique) | passa | falha |
| 24 | Cast Speed muito alto: no máximo uma magia por tique, e a recarga individual ainda segura | passa | falha |
| 24 | online e offline coerentes: tique oscilando (240–260 ms) e tique exato dão o mesmo ritmo | passa | falha |
| 24 | conjuração cancelada devolve o global: a magia seguinte não paga pela que não saiu | passa | falha |
| 24 | a conclusão da conjuração não é barrada pelo global que ela mesma começou | passa | falha |

**C** — Regra da engine (morto não lança, clique repetido sai uma vez, mira no chão) vale para gemas do PoE.  
**Ação:** Reescrever com gemas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 24 | morto não lança nada: nem pelo clique manual, nem pelo automático | passa | falha |
| 24 | cliques repetidos no mesmo instante: sai UMA magia (ataque pelo global, cura pela recarga) | passa | falha |
| 24 | mira no chão: a área cai na casa escolhida, e fora do alcance não sai | passa | falha |

## sets-de-marco.test.mjs

9 falha(s) — B 9

**B** — Baús de marco (level 50/100) com itens do Draevor por vocação.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 17 | os marcos 50 e 100 são BAÚS de item; cada vocação vê e sorteia entre os itens dela | passa | falha |
| 47 | o item do baú sai do gerador: raridade e faixa de valores como num drop | passa | falha |
| 56 | druid não recebe itens de knight do baú | passa | falha |
| 65 | set antigo AINDA NÃO PEGO vira baú; o já pego fica como set | passa | falha |
| 82 | o marco só abre no level dele (antes bastava ter o ouro) | passa | falha |
| 89 | marco já pego não é reescrito | passa | falha |
| 103 | level 50: o BAÚ do 50 abre (sem a trilha de treino na frente) | passa | falha |
| 112 | só a PRIMEIRA que falta abre: level alto, nada pego — só o baú do 50 | passa | falha |
| 120 | pegar o baú abre a próxima da fila (o do 100) quando o level chega | passa | falha |

## chao-e-troca.test.mjs

8 falha(s) — C 8

**C** — Sem duplicar no chão é da engine; a expectativa usa a capacidade por peso do Draevor (no PoE: 20 vagas).  
**Ação:** Adaptar a capacidade para a mochila do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 84 | chão: sem duplicar — dois pegando a mesma peça, só um leva; sem capacidade, a peça fica no chão e nada some | passa | falha |

**C** — O personagem de teste é legado arquivado: "entrou em …" falha.  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 116 | trade: convite, aceite, ofertas (mítica + ouro), as duas confirmações — entrega exata e GRAVADA no banco para os dois | passa | falha |
| 116 | trade: mudar a oferta depois de uma confirmação desmarca as duas — e só entrega com as duas de novo | passa | falha |
| 116 | trade: o servidor recusa — item fixo, mais do que tem, item que sumiu da mochila antes de fechar, ouro que não tem | passa | falha |
| 116 | trade: quem recebe sem capacidade — recusa e nada se move | passa | falha |
| 116 | trade: cancelar, desconectar e uma segunda troca com quem já está trocando | passa | falha |
| 116 | trade: caçando não troca; recusar o convite avisa quem convidou | passa | falha |
| 116 | chão pela sessão: largar a mítica, outro jogador pega, sai do jogo e volta — continua mítica (gravada no banco) | passa | falha |

## consolidacao-offline.test.mjs

8 falha(s) — C 8

**C** — Verificado: as 7 regras de consolidação/stamina/tempo PASSAM numa área do PoE com personagem do PoE; falham com knight level 200 na troll-cave (morre/0 abates) e, as de banco, porque o personagem é legado.  
**Ação:** Adaptar a fixture: personagem do PoE (sistema "poe", nível ≤ 100, kit do PoE) numa área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 65 | em pedaços depois dos 30 min simulados: soma o mesmo que projetar tudo na volta | passa | falha |
| 103 | pedaços DENTRO dos 30 min simulados: o tique continua de onde parou, e o total fecha | passa | falha |
| 139 | consolidarUm: grava o avanço, ainda ausente, com o ganho no dia de hoje | passa | falha |
| 155 | consolidarUm: alguém mexeu no personagem no meio — desiste, sem passar por cima | passa | falha |
| 199 | o tempo caçando offline CONTA inteiro (não só os 30 min simulados), e a stamina gasta junto | passa | falha |
| 209 | acabou a stamina: a caçada offline para ali, e no login ele está na cidade | passa | falha |
| 242 | stamina caindo abaixo de 14 h: a exp projetada daí em diante vale metade | passa | falha |
| 264 | banco: toda gravação leva as colunas; a rodada ignora quem já acabou | passa | falha |

## conta-char.test.mjs

8 falha(s) — C 8

**C** — Os chars de teste da conta são legados arquivados: "entrou em …" falha.  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 53 | ⚙ Config de um char FORA do mundo: os dados chegam e a mudança vai para o banco | passa | falha |
| 53 | de outra conta, ou o próprio char: recusado | passa | falha |
| 53 | + Party num char caçando OFFLINE: ele volta ao mundo sem aba, entra na party e sai quando ela acaba | passa | falha |
| 53 | ➜ Hunt: traz para a party E para a sua caçada; sem caçada, recusa | passa | falha |
| 53 | o teto de chars da conta vale: sem Slot de party, o terceiro não vem | passa | falha |
| 53 | com Slots: a conta leva até cinco chars para a mesma party | passa | falha |
| 53 | ➜ Hunt num char que caçava em OUTRO lugar: a caçada dele acaba e o extrato vem para quem chamou | passa | falha |
| 53 | ➜ Hunt direto num char caçando offline: UMA janela só, a do que ele rendeu fora | passa | falha |

## mapa-editor.test.mjs

8 falha(s) — B 8

**B** — Mapa da campanha do Draevor (posição/tipo das 48 fases); no oficial a tela é a "Campanha do PoE" (itens-poe-telas).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 23 | lerMapa: cada fase com o que o editor grava e o que a tela deduz | passa | falha |
| 23 | salvarMapa: grava posição/tipo/conexões/Atos e preserva descrição, requisitos e o índice do mundo | passa | falha |
| 23 | salvarMapa: null/vazio/"comum" voltam ao automático (apaga o campo); Ato vazio some | passa | falha |
| 23 | salvarMapa recusa tudo (e não grava nada) se algo é inválido | passa | falha |
| 23 | validar sem gravar: o editor valida ao vivo (rota mapa/validar) e só "mapa" grava | passa | falha |
| 23 | o jogo entrega o que o editor gravou (posição, tipo, Atos) e ignora posição inválida | passa | falha |
| 114 | auditoria: aponta mapa inconsistente do arquivo (posição fora, conexão quebrada, Ato desconhecido) | passa | falha |
| 23 | opções do editor: tipos de nó, temas, espaço do mapa e os Atos gravados | passa | falha |

## ondas.test.mjs

8 falha(s) — C 8

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 31 | sobrevivência (manual): onda por onda, pausa entre elas, recompensa por onda e a conclusão paga a primeira vez UMA vez | passa | falha |
| 31 | sobrevivência no IDLE (Caça Automática): o idle inicia sozinho e as ondas rodam até o fim — nunca trava a fase | passa | falha |
| 31 | fenda: o relógio fecha a passagem, remove o que sobrou, mantém o que as ondas vencidas pagaram — e o CLEAR da fase não fica preso | passa | falha |
| 31 | a fenda vencida dentro do tempo conclui; e libera quem depende dela (a "passagem") | passa | falha |
| 31 | persistência: gravar e carregar no meio de uma onda mantém o estado, e a próxima onda nasce uma vez só | passa | falha |
| 31 | party: cada onda paga o loot a quem está na luta NAQUELE momento (o que sai antes não leva as ondas seguintes) | passa | falha |
| 31 | projeção offline: ondas em andamento ao zerar a instância expiram sem pagar (a regra de sempre dos encontros) | passa | falha |
| 31 | custo: dez ondas de dez monstros num encontro, mil passos, ficam baratos | passa | falha |

## projeteis.test.mjs

8 falha(s) — B 3 · C 5

**C** — O suporte existe no PoE e a mecânica é da engine; o teste usa Flame Strike do Draevor.  
**Ação:** Reescrever com gema/suporte do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 48 | Extra Projectile / Greater Multiple Projectiles: mais bichos levam o projétil, com menos dano cada | passa | falha |
| 48 | Pierce: o projétil atravessa o alvo e acerta quem está atrás, na mesma reta | passa | falha |
| 48 | Fork: no alvo, o projétil se divide em dois; Chain: salta de bicho em bicho | passa | falha |
| 48 | Returning Projectile: o projétil volta e acerta o alvo de novo | passa | falha |
| 48 | Area of Effect no disparo de verdade: a Fire Wave pega mais bichos com a support | passa | falha |

**B** — Suportes só do Draevor (Explosion, Impact) e a combinação com Flame Strike.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 48 | Explosion: o golpe explode 3×3 em volta do impacto — o alvo (direto + explosão) e os vizinhos | passa | falha |
| 48 | Impact: skill física corpo a corpo de alvo único bate também em volta do alvo | passa | falha |
| 48 | COMBINAÇÃO: Flame Strike + Multiple Projectiles + Pierce + Explosion — todos os efeitos juntos | passa | falha |

## dano-elemental-atributo.test.mjs

7 falha(s) — B 7

**B** — Dano elemental dos atributos no golpe (regra do Draevor); no PoE os atributos não dão elemento.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (ficha-poe).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 49 | fire: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 49 | energy: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 49 | earth: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 49 | ice: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 49 | death: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 49 | holy: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza | passa | falha |
| 61 | percentual minúsculo: o elemento nunca bate menos que 1 | passa | falha |

## decisao.test.mjs

7 falha(s) — C 7

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 26 | o idle não decide: na Caça Automática a área secreta e a escolta ficam disponíveis (e a fase fecha sem elas) | passa | falha |
| 26 | área secreta: a decisão de entrar faz os ocupantes nascerem; limpar paga uma vez | passa | falha |
| 26 | recusar descarta o encontro (não volta) e não paga nada | passa | falha |
| 26 | escolta: as emboscadas desgastam o protegido; vencer todas as ondas conclui e paga | passa | falha |
| 26 | escolta: o protegido cai (vida zerada) → falha, as sobras saem, o que as ondas pagaram fica | passa | falha |
| 26 | persistência: a vida do protegido grava e volta | passa | falha |
| 26 | sessão: "decidir" — sozinho, quem joga é o decisor: aceitar abre, recusar descarta, e o que não pede decisão é recusado | passa | falha |

## reforcos.test.mjs

7 falha(s) — B 7

**B** — Reforços do Draevor (Master of Flames, Blood Rage, Haste, Shared Conservation, Chivalrous Challenge, Cancel Magic Shield).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-gemas: auras e maldições).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 32 | postura: Master of Flames sobe o dano das skills de fogo (e só delas) enquanto ligada | passa | falha |
| 32 | Blood Rage sobe o golpe corpo a corpo (tag melee) — o golpe básico e as skills físicas de perto | passa | falha |
| 32 | o nível, a raridade e a qualidade da gema escalam o efeito (e a velocidade) | passa | falha |
| 32 | auras: quem você atinge fica vulnerável (+% de fogo/gelo/energia/terra) ou enfraquecido (bate menos) | passa | falha |
| 32 | Shared Conservation: a cura recebida vale mais | passa | falha |
| 32 | provocação: Chivalrous Challenge faz os bichos a até 7 sqm (até 6) virem atrás de você | passa | falha |
| 134 | cancelamento por dados: o Cancel Magic Shield só sai com o escudo ligado, e o desliga | passa | falha |

## bosses-unicos.test.mjs

6 falha(s) — C 6

**C** — Chefe de encontro (nascer com a escala da fase, obrigatório/opcional/secreto) é da engine; o teste usa fase do Draevor.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 97 | nascer: a vida, a escala da fase, o dano, a resistência, o loot e a identidade do chefe | passa | falha |
| 279 | encontro de boss OBRIGATÓRIO: o idle o ativa, o boss nasce UMA vez e a fase só fecha quando ele cai | passa | falha |
| 279 | encontro de boss OPCIONAL e SECRETO: não conta para o CLEAR; a luta em andamento segura a instância; terminada, libera | passa | falha |
| 279 | probabilidade: o miniboss de 20% e o secreto de 5% saem pela semente — mesmo resultado a cada reconexão | passa | falha |
| 398 | compatibilidade: bosses e bichos comuns (sem `boss`) seguem exatamente como antes | passa | falha |
| 279 | encontro de boss ATIVO cujo boss sumiu (projeção offline, sem o gancho de morte) conclui: nada espera por um boss que não existe | passa | falha |

## encontros-etapa6.test.mjs

6 falha(s) — C 6

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 93 | o editor avisa (>30%) e RECUSA (>100%) encontros que valem mais que a fase, com os números | passa | falha |
| 38 | party: quem saiu antes de o encontro acabar NÃO leva a recompensa; quem entrou antes do fim leva; o aviso chega a todos | passa | falha |
| 38 | ativação SIMULTÂNEA (dois membros no mesmo instante): um encontro, um boss, uma recompensa | passa | falha |
| 38 | falha e cancelamento: abandonar a caçada no meio do encontro, ou morrer, não paga nada e a próxima instância é nova | passa | falha |
| 183 | caçada offline de verdade com encontros no mapa (obrigatório de idle, baú, boss obrigatório): não trava, conta limpezas, não paga em dobro | passa | falha |
| 38 | carga: 150 caçadas simultâneas com cinco encontros cada custam quase o mesmo que sem encontros | passa | falha |

## encontros.test.mjs

6 falha(s) — C 6

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 176 | fase: encontro OBRIGATÓRIO trava o CLEAR mesmo com os bichos mortos; concluído, libera (e só uma vez) | passa | falha |
| 176 | fase: encontro OPCIONAL (baú, boss secreto...) nunca bloqueia a conclusão | passa | falha |
| 176 | idle: na Caça Automática o idle ativa e resolve sozinho — um obrigatório nunca deixa o personagem preso | passa | falha |
| 176 | idle: decisão do jogador não é ativada pelo idle; opcional expira, e obrigatório desse tipo nem é aceito pelo validador | passa | falha |
| 176 | persistência: a caçada com a instância e os encontros sobrevive a gravar e carregar, sem re-sortear | passa | falha |
| 268 | compatibilidade: a campanha sem encontros se comporta como sempre (CLEAR só pelos bichos) | passa | falha |

## relatorio-da-ausencia.test.mjs

6 falha(s) — C 6

**C** — O personagem de teste é legado arquivado (5 delas surgiram com o arquivamento); "duas sessões" usa a morte do Draevor.  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra; conferir a penalidade de morte do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 75 | morre offline SEM loot: uma mensagem só, com a morte e as penalidades, gravada até o OK | passa | falha |
| 116 | morre depois de caçada offline LONGA (5 h fora): a morte vale, o período do relatório é o da caçada | passa | falha |
| 126 | NÃO morre: o relatório volta com o loot, sem morte, e some depois do OK | passa | falha |
| 142 | reconecta ANTES do OK: o mesmo relatório, e a morte e o loot não são aplicados de novo | passa | falha |
| 165 | duas sessões entrando ao mesmo tempo no mesmo personagem: a penalidade e o loot valem UMA vez | passa | falha |
| 180 | relatório pendente não vaza para o cliente dentro do `character` | passa | falha |

## areas.test.mjs

5 falha(s) — B 4 · C 1

**B** — Formas das magias de área do Draevor (Rage of the Skies, 39 skills).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 114 | Rage of the Skies: as 85 casas levam dano — a parte de CIMA também — e a tela recebe exatamente as mesmas | passa | falha |
| 114 | Rage of the Skies: a mesma área em várias posições do mapa (bordas, perto de x/y = 0) e com o personagem virado para qualquer lado | passa | falha |
| 114 | todas as 39 skills de ataque com forma: o dano cai exatamente nas casas desenhadas, nos quatro lados | passa | falha |
| 208 | explosão das gemas: o quadrado que leva dano é o mesmo que a tela desenha | passa | falha |

**C** — Increased Area of Effect/Concentrated Effect existem no PoE; o teste usa Rage of the Skies.  
**Ação:** Reescrever com gema de área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 114 | gemas de área: Area of Effect aumenta e Concentrated Effect reduz — e a tela acompanha | passa | falha |

## biblioteca.test.mjs

5 falha(s) — B 4 · C 1

**B** — A Biblioteca no oficial mostra só as bases do PoE (biblioteca.mjs:104); o teste espera hunt VIP, raridade "lendário", sockets e o ato-1 do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 37 | L3. detalhe da hunt VIP, da especial e do boss: dados reais, e o que falta sai como null (nada inventado) | passa | falha |
| 83 | L7. filtros combináveis: raridade + tipo + texto, e paginação por deslocamento sem repetir | passa | falha |
| 102 | L8. onde é usado: monstro da hunt, item no loot, hunt na campanha, boss final do ato — e o detalhe traz a lista | passa | falha |
| 114 | L9. itens por slot, com o máximo de sockets do slot e o nível mínimo do catálogo | passa | falha |

**C** — Desenho de cada linha só do atlas: vale para as bases do PoE.  
**Ação:** Adaptar para as bases do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 78 | L6. desenho de cada linha: só o que existe nos atlas do cliente (nada inventado) | passa | falha |

## regras-de-uso.test.mjs

5 falha(s) — C 5

**C** — Regras de uso (área com ≥3 bichos, só alvo único no boss, sem buff com pouca mana) valem na barra do PoE.  
**Ação:** Adaptar: gemas do PoE nos slots da barra do PoE (BARRA_DO_POE), sem o global do Draevor.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 25 | sem regra, a rotação é a de sempre (o 1º slot sai primeiro) | passa | falha |
| 25 | "Se bichos por perto ≥ 3 → preferir ÁREA": com 4 bichos, a área sai antes; com 1, a rotação normal | passa | falha |
| 25 | "Se boss → só ALVO ÚNICO": na sala de boss a área não sai | passa | falha |
| 25 | "Se mana ≤ 20% → não usar BUFF": bloquear vale fora do ataque; cura nunca é barrada | passa | falha |
| 25 | regra desligada não vale | passa | falha |

## simulador-de-rotacao.test.mjs

5 falha(s) — C 5

**C** — O simulador de rotação deve medir as gemas do PoE; o teste usa magias do Draevor ("Sem slot de attack").  
**Ação:** Adaptar: gemas do PoE nos slots da barra do PoE (BARRA_DO_POE), sem o global do Draevor.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 11 | a mesma semente dá o mesmo resultado; o relógio de 30 s e o intervalo global limitam as execuções | passa | falha |
| 11 | um suporte de dano aumenta o dano da gema; com suporte de custo a mana sobe/cai como diz o suporte | passa | falha |
| 11 | mais alvos só ajudam o dano de área; o de alvo único não ganha | passa | falha |
| 11 | a mana medida mostra quem não se sustenta (gasto por segundo contra a regeneração) | passa | falha |
| 11 | a prioridade é a ordem dos slots: a magia de recarga curta no 1º slot ocupa todo o intervalo global | passa | falha |

## xp-da-hunt.test.mjs

5 falha(s) — B 3 · C 2

**C** — Falha do ARQUIVO world.test.mjs inteiro (8 testes escondidos): o topo do arquivo lê CAMPANHA.fases[0] do Draevor (huntId de undefined).  
**Ação:** Adaptar o topo para a primeira área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 57 | testes/world.test.mjs | passa | falha |

**C** — XP concedido = conta independente vale no PoE; usa o Cyclops de uma fase do Draevor.  
**Ação:** Adaptar para monstro de área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 62 | XP concedido = conta independente = estimativa da ficha, em cada faixa de stamina (Cyclops, level 60 e 30) | passa | falha |

**B** — Estágio de XP do Draevor (x3 até 50, x2 até 100) e escala de fase do Draevor; no PoE vale a tabela de XP do PoE (nível máx. 100).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 84 | o ESTÁGIO de level: x3 até o 50, x2 até o 100, x1 depois — passar do 100 corta o XP pela metade (é esperado) | passa | falha |
| 95 | a escala da FASE: o Cyclops da Mistrock vale 150 no bestiário e outro número na fase (e a ficha mostra os dois) | passa | falha |
| 108 | o servidor manda o fator de stamina e o estágio para a ficha e a régua (elas não recalculam) | passa | falha |

## captura.test.mjs

4 falha(s) — C 4

**C** — Sistema de encontros da engine (baú, altar, ondas, decisão, captura, boss de encontro); no oficial a hunt do Draevor não é fase e não tem instância ("semente" em null). A área do PoE tem instância, mas nenhuma tem encontros cadastrados.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores com um encontro de teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 27 | aprisionado: interagir faz os captores nascerem; o último cair liberta, paga e abençoa — uma vez só | passa | falha |
| 27 | invasor: chega sozinho (mesmo no modo manual) quando a condição libera; vencer paga; não precisa de interação | passa | falha |
| 27 | invasor obrigatório trava o CLEAR até ser repelido; idle (auto) resolve ambos sem travar | passa | falha |
| 27 | persistência e projeção offline: em andamento ao gravar continua; instância zerada expira | passa | falha |

## combate-formulas.test.mjs

4 falha(s) — B 1 · C 3

**B** — Crítico base 3% + Onslaught do Draevor; no PoE o crítico vem da base da arma/gema.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-jogo).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 110 | o crítico base e o Onslaught vêm da configuração (3%, +60%, ×1,6) — a ficha de um personagem novo não mudou | passa | falha |

**C** — Registro de golpe e simulador de dano são ferramentas da engine; o teste usa a ficha do Draevor.  
**Ação:** Adaptar para personagem do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 136 | o registro de golpe fica DESLIGADO por padrão (produção) e, ligado, guarda o que a conta fez | passa | falha |
| 136 | o simulador: min, máx, médio, crítico, DPS teórico e efetivo, golpes para derrotar — e o DPS TEÓRICO bate com o MEDIDO no motor | passa | falha |
| 136 | o simulador: a penetração e a resistência do alvo mudam o dano efetivo; a mitigação do personagem mostra a proteção e a armadura | passa | falha |

## conteudo-dos-atos.test.mjs

4 falha(s) — B 4

**B** — Pacote de conteúdo dos atos do Draevor (15 minibosses, 47 fases, Dark Thais).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 29 | o cadastro de bosses do pacote é válido: 15 minibosses e 4 secretos, todos usados por um encontro | passa | falha |
| 33 | as 47 fases jogáveis têm descrição, ambiente e encontros; a travada (Dark Thais) segue sem nada | passa | falha |
| 47 | todo o conteúdo passa na validação do editor (pontos andáveis e alcançáveis, economia) — sem erros; a economia fica abaixo do alvo | passa | falha |
| 72 | o pacote cabe nos limites: probabilidades de minibosses (20%) e segredos (5%), segredo só depois de um baú raro, e nada de arquivo órfão | passa | falha |

## defesas-novas.test.mjs

4 falha(s) — B 2 · C 2

**B** — Atributos-base e efeitos do Draevor (STR 50, INT dá dano mágico); no PoE vale a tabela do PoE.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (ficha-poe).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 61 | STR/DEX/INT: base da vocação + por level (automático) + itens | passa | falha |
| 86 | STR dá Life e dano físico; DEX Accuracy, Evasion e Attack Speed; INT Mana e dano mágico — na ficha | passa | falha |

**C** — Verificado: o ES absorve antes da vida e recarrega no PoE; o valor muda porque a INT do PoE aumenta o ES (200 → 213 com 32 de INT).  
**Ação:** Atualizar a expectativa com o ES aumentado pela INT.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 147 | Energy Shield: absorve antes da vida, reinicia a espera e recarrega depois dela | passa | falha |
| 177 | Energy Shield no combate: o golpe do bicho sai do ES antes da vida; a regeneração da caçada recarrega | passa | falha |

## simulacao-offline.test.mjs

4 falha(s) — C 4

**C** — Personagem de teste acima do nível 100: a XP do nível é Infinity na tabela do PoE.  
**Ação:** Adaptar a fixture: personagem do PoE (sistema "poe", nível ≤ 100, kit do PoE) numa área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 55 | na thread à parte: a caçada rende, e a thread do jogo segue respondendo | passa | falha |

**C** — O personagem de teste é legado arquivado e não carrega.  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 100 | play com caçada offline: carrega sem personagem, e entra com o relatório | passa | falha |
| 118 | saiu no meio da simulação: nada é gravado, e a próxima entrada simula de novo | passa | falha |
| 137 | a outra aba entra no meio: a primeira é solta e só a segunda recebe o personagem | passa | falha |

## supports-etapa4.test.mjs

4 falha(s) — B 4

**B** — Suportes do Draevor (Ignite, Slow, Life Cost, Skill Duration).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-afeccoes, itens-poe-gemas).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 46 | Ignite: o bicho atingido queima — o % do acerto sai em pulsos no tique | passa | falha |
| 46 | Slow: o bicho lento anda e ataca mais devagar (fator > 1); com a support, o acerto põe lento | passa | falha |
| 46 | Life Cost: o custo sai da vida, não da mana; Life/Mana Leech devolvem parte do dano | passa | falha |
| 46 | Skill Duration: o reforço dura mais | passa | falha |

## andares.test.mjs

3 falha(s) — C 3

**C** — Andares/escadas são da engine e valem nas áreas do PoE que usam mapas com andares; o teste entra na hunt do Draevor sem instância.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 46 | Amazon Camp: cada bicho da instância nasce numa casa alcançável do andar dele, e só os do andar atual vão para o cliente | passa | falha |
| 74 | Caça Automática sobe e desce e passa por todos os andares com bicho, e dá a volta completa | passa | falha |
| 104 | quantidade: a do mapa — a soma das `quantidade` dos spawns (Winter Dream Court: 107 pontos × 2) | passa | falha |

## arma-base.test.mjs

3 falha(s) — B 2 · C 1

**B** — Ficha "idêntica à de antes" do Draevor e crítico da arma somado ao do personagem; no PoE o crítico da arma é a base.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 98 | AB7. REGRESSÃO: sem qualidade nem locais a ficha é IDÊNTICA à de antes (dano 24–46 da relic sword, intervalo 2 s) e `ficha.arma` descreve a arma; sem arma, `arma` é null | passa | falha |
| 129 | AB9. APS próprio da base (override) vira o intervalo da engine (1000/APS), com os aumentos globais DEPOIS e o limite do projeto preservado | passa | falha |

**C** — Qualidade aplicada uma vez na engine vale para as armas do PoE.  
**Ação:** Reescrever com arma do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 115 | AB8. qualidade na ENGINE: dano da ficha e intervalo usam o valor final UMA vez (não duplica); equipar/desequipar; troca de arma não herda a qualidade | passa | falha |

## atos-armazem.test.mjs

3 falha(s) — B 3

**B** — Os 4 atos legados do Draevor no armazém.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 21 | A1. lista os 4 legados (somente leitura) e nenhum arquivo é gravado fora da pasta do armazém | passa | falha |
| 44 | A4. duplicar um legado cria rascunho novo e não altera o original; as hunts em uso aparecem como erro | passa | falha |
| 61 | A5. rotas HTTP: lista, detalhe com validação, validar sem gravar, 404 | passa | falha |

## atos-vip-especial.test.mjs

3 falha(s) — B 3

**B** — Fases VIP/especiais do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 44 | VE2. a fase VIP/especial vira instância (sala gerada) que LIMPA, pela regra do jogo: precisa de acesso e, com o beta ligado, o acesso é livre | passa | falha |
| 62 | VE3. com premium de verdade (sem beta) a fase VIP entra e limpa; a especial pede também o pergaminho e o level | passa | falha |
| 77 | VE4. a última fase do ato sendo especial: limpar abre o portal do boss como em qualquer ato do editor | passa | falha |

## balanceamento-das-gemas.test.mjs

3 falha(s) — B 3

**B** — Balanceamento das gemas do Draevor (DPS do Monk, Flame Strike + GMP + Explosion).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 55 | trava de balanceamento: o melhor DPS do Monk fica na faixa das demais classes, em alvo único e em área | passa | falha |
| 73 | o custo dos suportes se MULTIPLICA (Multiple Projectiles +30% e Explosion +30% = ×1,69), o custo extra não cresce com a raridade e a mana cobrada é a do catálogo × isso | passa | falha |
| 88 | trava: a combinação barata (Flame Strike + Greater Multiple Projectiles + Explosion + Greater Damage) não supera a melhor área nativa gastando menos mana | passa | falha |

## campanha-editor.test.mjs

3 falha(s) — B 3

**B** — Editor da campanha do Draevor (48 fases, 4 bosses de ato).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 25 | CE1. ler: as 48 fases e os 4 bosses de ato editáveis; escala e dificuldades vêm só para leitura; nada foi tocado no arquivo real | passa | falha |
| 38 | CE2. pré-visualizar: o impacto é a MESMA conta do jogo (Campanha.escala), sem gravar; mudança grande de vida vira aviso de balanceamento | passa | falha |
| 107 | CE6. o que o editor SALVA é o que o JOGO LÊ: um processo novo do jogo, apontado para o arquivo salvo, enxerga os levels e a escala novos | passa | falha |

## dano-ao-longo-do-tempo.test.mjs

3 falha(s) — B 2 · C 1

**B** — Gemas de dano contínuo do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-afeccoes).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 184 | toda gema de dano contínuo do catálogo vira um EFEITO do tipo certo (sem golpe na hora), com o dano dela como total | passa | falha |
| 184 | gema de dano contínuo: o total sai nos pulsos e a resistência do bicho vale em cada um | passa | falha |

**C** — Chance to Poison/Bleed existem no PoE; o teste usa gemas do Draevor.  
**Ação:** Reescrever com suportes do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 184 | os suportes Chance de Envenenar e Chance de Sangrar põem veneno e sangramento no acerto (do dano antes da resistência) | passa | falha |

## dano-fisico-variacao.test.mjs

3 falha(s) — B 3

**B** — Fórmula do Draevor (ataque × perícia + level/5); no PoE o dano é a faixa da arma, sem perícia.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 67 | o golpe real (golpeDoJogador) respeita a faixa e a média é a de antes | passa | falha |
| 152 | o mínimo E o máximo sobem com a perícia da arma: Magic Level (wand/rod), Distance (arma de longe), Melee (arma de perto e punho) — e não com a perícia dos outros | passa | falha |
| 174 | estilo PoE: a arma 48–61 dá mínimo 48 e máximo 61 ANTES dos modificadores; a perícia e o level entram igual nas duas pontas (sem fração arbitrária) | passa | falha |

## economia.test.mjs

3 falha(s) — C 3

**C** — O personagem de teste é legado arquivado: "não entrou no jogo".  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 28 | mercado: anunciar e comprar deixam o banco certo sem esperar o autosave | passa | falha |
| 28 | olhar o mercado não abre transação nem grava ninguém | passa | falha |
| 28 | erro no meio: nada do comando fica no banco (ROLLBACK) | passa | falha |

## equipamento-slots.test.mjs

3 falha(s) — C 3

**C** — Slots valem no PoE, que tem luvas; a amostra de peças não tem luvas ("sem peça de teste para gloves").  
**Ação:** Pôr uma peça de luvas do PoE na amostra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 41 | a amostra tem uma peça real para cada slot do jogo | passa | falha |
| 63 | nenhuma peça entra em slot de outra categoria: recusa com a frase certa e NADA muda (mochila e corpo intactos) | passa | falha |
| 144 | persistência: o equipamento sobrevive ao salvar e carregar (JSON); peça em slot errado de antes volta para a mochila sem perda | passa | falha |

## filtro-decisao.test.mjs

3 falha(s) — B 3

**B** — Filtro de loot do Draevor (Draevor Knight Helmet comum sem atributo); no PoE é o filtro do PoE.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (filtro-poe).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 143 | caçando: "Comum sem atributo → não coletar" deixa essas peças no chão e coleta o resto | passa | falha |
| 152 | regras vindas do cliente são limpas; mais de 12 não entram | passa | falha |
| 160 | a prévia da tela usa a mesma decisão, e o filtro da conta leva as regras | passa | falha |

## hunts-painel.test.mjs

3 falha(s) — B 2 · C 1

**C** — A lista de hunts por categoria deve contar as áreas do PoE.  
**Ação:** Adaptar para as áreas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 15 | H1. a lista cobre todas as categorias de hunt e diz quantas têm spawns no mapa | passa | falha |

**B** — Painel da fase do Draevor e a dificuldade Cruel.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 30 | H2. painel da hunt da campanha: mapa, spawns, monstros, distribuição e dificuldade conferem com o jogo | passa | falha |
| 56 | H4. a escala da dificuldade entra na conta: o ouro esperado sobe no Cruel (exp dos bichos escalada) | passa | falha |

## minimapa.test.mjs

3 falha(s) — C 3

**C** — Minimapa é da engine; o teste percorre CAMPANHA.fases do Draevor (vazia no oficial: "0 fases conferidas").  
**Ação:** Percorrer as áreas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 37 | todas as fases da campanha: a geometria monta, e todo monstro e o jogador caem DENTRO do mapa | passa | falha |
| 72 | desempenho: montar a geometria do maior mapa é rápido (é feito só ao trocar de fase/andar) | passa | falha |
| 151 | buracos e escadas: só os que FUNCIONAM, pela mesma regra do servidor, em todas as fases | passa | falha |

## motor-de-dano.test.mjs

3 falha(s) — C 3

**C** — O motor de medida de dano é ferramenta da engine; mede gemas do Draevor.  
**Ação:** Adaptar para gemas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 30 | a medida é repetível (semente) e o nível 20 bate mais que o 1 | passa | falha |
| 45 | o boneco não tem resistência: mesmo personagem, magias de elementos diferentes e mesmo dano de catálogo batem igual | passa | falha |
| 50 | cura: toda gema de cura cura no nível 1; o nível 20 cura mais; o level do personagem também escala | passa | falha |

## regen-na-cidade.test.mjs

3 falha(s) — B 3

**B** — Regeneração do Draevor na cidade; no PoE a cidade enche vida/mana/ES/frascos e a vida não tem regeneração de base (ficha-poe cobre).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 63 | não regenera antes de 1s (desde o 1º tique, que só estabelece a janela), regenera ao completar | passa | falha |
| 86 | o total ao longo de 4s é o MESMO de chamar Cacadas.regenerar/Stamina.recuperar direto | passa | falha |
| 106 | regen ao longo de 3s (depois da janela) não perde nem dobra o resto fracionário | passa | falha |

## server-save.test.mjs

3 falha(s) — C 3

**C** — Ambiente: lê o ciclo do server-save do banco local de desenvolvimento (que tem um ciclo de verdade); falha igual no modo clássico.  
**Ação:** Isolar o teste do banco local.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 173 | A4. reiniciar o servidor não dispara save nem recupera ciclo perdido; o próximo horário é calculado do agora | falha | falha |

**C** — Consolidação offline na hunt do Draevor com personagem legado.  
**Ação:** Adaptar a fixture: personagem do PoE (sistema "poe", nível ≤ 100, kit do PoE) numa área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 307 | F6. a caçada offline segue correndo depois do save: a consolidação avança uma vez, e repetir o mesmo instante não processa de novo | passa | falha |
| 322 | F7. o retorno do jogador DURANTE o save não conflita: a consolidação concorrente grava, o save não, e o XP não duplica | passa | falha |

## setores.test.mjs

3 falha(s) — C 3

**C** — Setores existem na instância da área do PoE (verificado); o teste usa hunt do Draevor sem instância.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 101 | E5. a instância real nasce com o total por setor (soma = o total de objetivos) e cada bicho tem o seu setor | passa | falha |
| 126 | E6. a party enxerga o mesmo progresso (um convidado lê da sala do dono) e o setor de cada membro | passa | falha |
| 165 | U1. servidor: o cartão do membro offline guarda "volta em" e o setor; limpar o setor avisa a party | passa | falha |

## site.test.mjs

3 falha(s) — C 3

**C** — O personagem de teste é legado arquivado e não gera amostras.  
**Ação:** Adaptar a fixture: o personagem de teste precisa da marca do PoE (sistema "poe"); sem ela é um legado arquivado e não entra.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 47 | exp de hoje e da última hora contam a partir da primeira amostra | passa | falha |

**C** — Ambiente: "database is locked" (SQLite concorrente com outros arquivos da suíte); passa sozinho.  
**Ação:** Isolar o banco do teste.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 79 | /api/drops: só o raro entra, no formato do original | passa | falha |
| 24 | /home/deploy/DraevorIdle/.claude/worktrees/isolated-worktree-implementation-279037/game/testes/site.test.mjs | falha | não se repetiu |

## amigos.test.mjs

2 falha(s) — C 2

**C** — vocationName "Marauder" (classe do PoE) em vez de "Knight"; o segundo falha em cascata (o primeiro deixou a amizade).  
**Ação:** Atualizar a expectativa para a classe do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 39 | pedir, aceitar, tirar — e os erros | passa | falha |
| 48 | pedir a quem já te pediu vira amizade; recusar apaga o pedido | passa | falha |

## avancar-em-grupo.test.mjs

2 falha(s) — C 2

**C** — "Avançar sozinho" em grupo vale nas áreas do PoE; o teste lê a campanha do Draevor.  
**Ação:** Adaptar para áreas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 43 | os dois com "Avançar sozinho": vão JUNTOS para a próxima fase | passa | falha |
| 43 | o outro em "Ficar na fase": o líder avança e ele NÃO vai junto | passa | falha |

## combate-limites.test.mjs

2 falha(s) — B 2

**B** — Tetos/excedentes do Draevor (crítico excedente, ataque duplo na gema).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 113 | a ficha corta resistência, crítico, ataque duplo e penetração em 100%; o que passou fica em `excedentes` | passa | falha |
| 203 | ataque duplo na gema: o ataque repete UMA vez, sem gastar mana a mais, e o roubo de vida conta só do primeiro | passa | falha |

## conjuntos.test.mjs

2 falha(s) — B 2

**B** — Editor de conjuntos (sets) de itens do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 229 | CJ11. busca de itens do seletor: só o slot pedido, filtros por classe/tier/level/nome, sem peça de craft, com sprite e atributos principais | passa | falha |
| 298 | CJ15. rotas: consulta, itens, prévia, totais e modelos só LEEM; salvar é "grava" (bloqueado em produção); ação inválida = 400; conflito = 409 | passa | falha |

## ficha-de-dano.test.mjs

2 falha(s) — C 2

**C** — "Toda criatura das fases tem ataque" vale para as áreas do PoE; o teste percorre a campanha do Draevor (vazia).  
**Ação:** Percorrer as áreas do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 83 | TODA criatura que aparece nas hunts da campanha tem dados de ataque | passa | falha |
| 94 | fichaDoBicho: ataques + XP na mesma resposta, e a escala de dano da fase (a prévia do seletor usa fase e dificuldade) | passa | falha |

## ficha-origens.test.mjs

2 falha(s) — B 2

**B** — Origem do crítico bruto + excedente e progresso de perícia (treino) do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 39 | as origens do crítico somam o valor BRUTO (efetivo + excedente) e dizem de onde vem, por categoria | passa | falha |
| 89 | as skills mandam o progresso exato (tentativas de agora e as que faltam), sem mudar o percentual | passa | falha |

## hot-reload-conteudo.test.mjs

2 falha(s) — B 1 · C 1

**C** — Hot reload do Ato vale para poe-ato-*; o teste usa um ato do Draevor.  
**Ação:** Adaptar para um ato do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 222 | HI8. ACT: um ato novo entra no jogo sem reiniciar, editar o arquivo o SUBSTITUI, um ato inválido mantém o anterior, rascunho/apagar o tiram | passa | falha |

**B** — Níveis das 48 fases/bosses da campanha do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 257 | HI9. CAMPANHA: níveis das fases e dos bosses recarregam a quente; estrutura diferente (fase a mais) exige reinício e não toca em nada | passa | falha |

## implicitos.test.mjs

2 falha(s) — B 2

**B** — Regra do Draevor "peça sem implícito"; o PoE tem implícitos.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 40 | uma peça equipada de cada slot não dá perícia, crítico, leech, resistência nem regeneração | passa | falha |
| 59 | os atributos EXPLÍCITOS da peça continuam entrando na ficha (crítico, leech, resistência, regeneração) | passa | falha |

## item-power-editor.test.mjs

2 falha(s) — B 2

**B** — Editor de Item Power do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 323 | IPE17. regressão do módulo de comparação: IP, ficha e lista continuam iguais ao cálculo direto; atributosBase/fichaDePoder ≡ atributosDoMeta/fichaDoMeta; a lista marca modificados | passa | falha |
| 515 | IPE30. lista do editor de itens: nível, atributos, IP e marca de modificado com os originais; histórico por item e comparação de versões filtrada por item; salvar pelo editor de itens registra | passa | falha |

## item-power.test.mjs

2 falha(s) — B 2

**B** — Item Power do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 266 | IPW16. lista de itens: filtros por categoria, level, raridade, classe e situação; ordem e paginação; detalhamento por atributo | passa | falha |
| 383 | IPW22. rotas: consulta, lista, detalhe, curva, marcos, alertas, prévia, simulação, comparação e regra só LEEM; salvar é "grava"; ação inválida = 400; conflito = 409 | passa | falha |

## itens-compat.test.mjs

2 falha(s) — B 2

**B** — Conversão de itens antigos do Draevor (varredura, peças com atributos na projeção).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 80 | o personagem inteiro: equipamento, mochila, bolsa e depósito — uma vez só | passa | falha |
| 109 | caçada offline projetada: as peças saem COM atributos (antes saíam cruas depois dos 30 min) | passa | falha |

## melee.test.mjs

2 falha(s) — B 1 · C 1

**C** — Falha do ARQUIVO mapa-fundo.test.mjs inteiro (9 testes escondidos): o topo lê o ato da primeira fase do Draevor.  
**Ação:** Adaptar o topo para a primeira área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 16 | testes/mapa-fundo.test.mjs | passa | falha |

**B** — Treino de perícia melee (fist/club/sword/axe) do Draevor; o PoE não tem perícias.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE. Vira D quando o modo clássico for aposentado.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 21 | fist, club, sword e axe treinam e leem o mesmo melee | passa | falha |

## morte.test.mjs

2 falha(s) — B 2

**B** — Blessings e penalidade de morte do Draevor (view do original).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 30 | Zotod (level 89, sem promoção): a view de blessings igual à do original | passa | falha |
| 36 | conta2 (level 343, promovido): 30% de desconto e teto de 80% de um level | passa | falha |

## overrides-itens.test.mjs

2 falha(s) — B 2

**B** — Editor de overrides de itens do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 88 | OI4. desligar uma entrada ou a camada não apaga nada; restaurar volta uma versão; listar exige busca (ou slot) e mostra os com override | passa | falha |
| 119 | OI6. rotas e acesso: leitura, pré-visualização (não grava) e ações (gravam); em produção o salvar é recusado | passa | falha |

## poder-da-arma.test.mjs

2 falha(s) — B 2

**B** — Escala da magia pela arma e Magic Attack (Draevor).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 188 | arma FÍSICA: a magia escala pelo dano normal da ficha (proporcional ao dano médio ÷ a referência do level); wand/rod seguem o Magic Attack; a cura não muda | passa | falha |
| 220 | wand e rod: o Magic Attack vai para o campo "Dano" da ficha (ataque da arma + Magic Level + level), e não o 8–18 do catálogo; o golpe da wand usa esse dano | passa | falha |

## recarga.test.mjs

2 falha(s) — B 2

**B** — Recarga de magias/runas do Draevor (Fierce Berserk, runa).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 15 | recarga de ataque: Fierce Berserk sai a cada 3 s; a próxima magia de ataque espera o cooldown global | passa | falha |
| 15 | runa de ataque divide a recarga do grupo com as magias (não sai junto) | passa | falha |

## tarefas.test.mjs

2 falha(s) — B 2

**B** — Promoção e Coleção do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 140 | promoção no derived: o nome novo, promoted e a regeneração do original | passa | falha |
| 185 | Coleção: Blade Dancer + Gorgon Hydra = 2 peças, +0,6% de crítico (o Zoros no original) | passa | falha |

## validacao.test.mjs

2 falha(s) — E 2

**E** — Regressão da arquitetura: o processo da validação (admin/validacao-runner.mjs) carrega o jogo sem iniciar o PoE, e as fases de poe-ato-1 viram "hunt que não existe". Em produção a Validação bloquearia toda aprovação.  
**Ação:** CORRIGIR: o runner usa o mesmo bootstrap do servidor e dos workers.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 71 | V5. verificações de verdade (processo à parte, jogo carregado do disco): overrides limpos = aprovado; cada tipo de defeito vira erro BLOQUEANTE no módulo certo, com a mensagem do validador do editor | passa | **corrigido** |
| 117 | V6. "pode aprovar": só com validações sem bloqueante E testes aprovados, ambos para o estado de AGORA; mudou o conteúdo depois = precisa rodar de novo | passa | **corrigido** |

## andar-por-clique.test.mjs

1 falha(s) — B 1

**B** — Decisão do dono (07/10): andar pelo clique desliga o Automático.  
**Ação:** Atualizar a expectativa para a regra nova.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 296 | Caça Automática: o clique não anda (quem anda é a rota — regra de sempre) | passa | falha |

## arena.test.mjs

1 falha(s) — B 1

**B** — Força pelo level da arena com teto 500 (Draevor); no PoE o teto é 100.  
**Ação:** Atualizar a expectativa para o teto do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 64 | o duelo: lado a lado, sem bichos, até um cair — e o depois | passa | falha |

## atos-modelo.test.mjs

1 falha(s) — B 1

**B** — Atos legados do Draevor (4 de 12 fases).  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 75 | G6. atos legados: 4 atos de 12 fases (a travada fora do grafo), válidos, e a regra do grafo dá o MESMO que o runtime linear atual | passa | falha |

## atos-recompensas.test.mjs

1 falha(s) — C 1

**C** — A conferência de economia da recompensa vale no PoE; o teste usa uma fase legada do Draevor como base.  
**Ação:** Adaptar a base para uma área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 45 | D4. economia: recompensa grande demais perto do valor de limpar a fase vira aviso/erro (o mesmo teto dos encontros); fase sem spawns avisa que não há base | passa | falha |

## atos-versoes.test.mjs

1 falha(s) — C 1

**C** — Checklist de publicação vale; só a última linha usa o ato "legado-1" do Draevor.  
**Ação:** Trocar "legado-1" por um ato do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 73 | V5. checklist de publicação: aponta o que falta, diz se o ato já está no jogo e como publicar (arquivo + reinício) | passa | falha |

## atributos-do-mob.test.mjs

1 falha(s) — C 1

**C** — Bloqueio do monstro vale no PoE; o golpe do teste é magia do Draevor.  
**Ação:** Reescrever com gema do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 128 | o golpe do jogador em quem bloqueia não causa dano (gema); sem bloqueio causa | passa | falha |

## balanceamento-1-100.test.mjs

1 falha(s) — B 1

**B** — Curva de balanceamento 1–100 do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 27 | a exp do bicho leva o estágio por cima de todo o resto | passa | falha |

## base-por-raridade.test.mjs

1 falha(s) — B 1

**B** — Base por raridade dos itens do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 148 | ficha: Armour, Evasion e Energy Shield somam das peças (base + adds + %); peça de ES não tem Armour | passa | falha |

## bolsa-mover.test.mjs

1 falha(s) — B 1

**B** — Mover para a bolsa pela capacidade de peso do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (filtro-poe: mochila de 20 vagas).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 37 | simples + estrelada, sem pilha: sai a simples e o total não muda | passa | falha |

## chegadas.test.mjs

1 falha(s) — B 1

**B** — Capacidade por peso do Draevor; no PoE a capacidade é a mochila de 20 vagas.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 54 | o Baú do Boss leva para a mochila o que cabe no peso e o resto para a bolsa de loot | passa | falha |

## equipamento.test.mjs

1 falha(s) — C 1

**C** — Arco de duas mãos + aljava vale no PoE; o teste usa peças do Draevor.  
**Ação:** Reescrever com arco e aljava do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 49 | arco de duas mãos e aljava convivem | passa | falha |

## escalonamento.test.mjs

1 falha(s) — C 1

**C** — Verificado: D7 PASSA em poe-a1-the-coast; falha só na troll-cave (hunt do Draevor sem instância).  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 162 | D7. na instância real: dois ativos deixam os bichos mais fortes; sair o segundo devolve ao base | passa | falha |

## familiar-combate.test.mjs

1 falha(s) — C 1

**C** — Verificado: C11 PASSA com level 30; com level 300 (acima do teto 100 do PoE) a XP não sobe.  
**Ação:** Adaptar o level para ≤ 100.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 260 | C11. dano, XP e abate contados UMA vez no dono (o familiar mata, o dono recebe); nada duplica | passa | falha |

## itens-novos-sprites.test.mjs

1 falha(s) — C 1

**C** — O editor lista os itens do PoE no oficial; a expectativa é a lista do Draevor.  
**Ação:** Atualizar a expectativa.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 60 | NV3. editar e salvar um item novo mantém a base; a lista filtra "novos" e marca; propor valida como item existente; apagar remove | passa | falha |

## itens-poe-combate.test.mjs

1 falha(s) — B 1

**B** — Premissa da época da chave ("sem peça do PoE nada muda"); no oficial a ficha sempre tem a resistência a Caos, como no PoE.  
**Ação:** Atualizar: a ficha base do PoE tem Caos.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 69 | sem peça do PoE nada muda: a ficha não ganha Caos nem dano somado, e a magia usa a chance de crítico de sempre | passa | falha |

## itens-poe.test.mjs

1 falha(s) — D 1

**D** — O comportamento "sem a chave ITENS_POE o PoE fica desligado" deixou de existir: a chave não é mais lida (decisão: PoE oficial).  
**Ação:** REMOVER e trocar por: sem os dados o servidor não sobe; DRAEVOR_CLASSICO=1 desliga.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 143 | desligado sem a chave: o jogo atual nunca carrega o catálogo do PoE | passa | falha |

## loot-moeda.test.mjs

1 falha(s) — C 1

**C** — Verificado: o ouro offline vai para o carregado na área do PoE (500 → 7.064, banco 0); na werelions-1 o personagem não mata nada no oficial.  
**Ação:** Adaptar a fixture: personagem do PoE (sistema "poe", nível ≤ 100, kit do PoE) numa área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 48 | caçada offline projetada (além dos 30 min simulados): o ouro projetado também vai para o carregado | passa | falha |

## mobs-mecanicas.test.mjs

1 falha(s) — C 1

**C** — Procriador na instância é da engine; o teste usa hunt do Draevor sem instância.  
**Ação:** Adaptar: a mesma fixture numa área do PoE (ex.: poe-a1-the-coast), que tem instância, objetivos e setores.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 52 | Procriador: os filhos nascem NA MESMA instância e entram na conta da limpeza | passa | falha |

## modo-beta.test.mjs

1 falha(s) — B 1

**B** — Usa o boss de ato do Draevor; no oficial a campanha do Draevor está vazia, então o boss vira boss "solto" — ver o problema A "conteúdo do Draevor alcançável por startHunt".  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 49 | M4. ligado NÃO abre o boss de ato sem portal: a regra do portal e da limpeza continua valendo | passa | falha |

## party-follow-independente.test.mjs

1 falha(s) — C 1

**C** — Bichos do Draevor numa grade de teste com personagem do Draevor: sobram 4 de 8 no tempo do teste.  
**Ação:** Adaptar a fixture: personagem do PoE (sistema "poe", nível ≤ 100, kit do PoE) numa área do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 251 | quatro independentes em regiões diferentes limpam os bichos de cada região; a sala é uma só (cada bicho morre uma vez) e a exp é dividida | passa | falha |

## prey-combate.test.mjs

1 falha(s) — B 1

**B** — Prey do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 70 | LOOT: prey de loot 10★ faz cair o que tem chance entre 25% e 35% (x1,4 passa do sorteio 0,35) | falha | falha |

## tooltip-dos-buffs.test.mjs

1 falha(s) — B 1

**B** — Balão dos buffs do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 53 | o catálogo manda `reforco` só nas gemas de reforço, e com a gema equipada o valor é o dela | passa | falha |

## tooltip-gemas.test.mjs

1 falha(s) — B 1

**B** — Balão das gemas do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE (itens-poe-gemas: ficha da gema).

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 29 | bonusDoTreino segue a habilidade de escala | passa | falha |

## velocidade-de-ataque.test.mjs

1 falha(s) — B 1

**B** — Velocidade de ataque do Draevor.  
**Ação:** Marcar como clássico (roda com DRAEVOR_CLASSICO=1) e substituir pela cobertura do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 23 | a ficha traz o intervalo real entre golpes: 2 s sem bônus, e a velocidade de ataque (add + DEX) o encurta | passa | falha |

## world-dados.test.mjs

1 falha(s) — C 1

**C** — Metadados dos atos para o mundo valem para os atos do PoE; o teste lê a campanha do Draevor.  
**Ação:** Adaptar para os atos do PoE.

| Linha | Teste | Clássico | Agora |
|---:|---|---|---|
| 105 | servidor: a campanha entrega os metadados dos Atos e a posição/tipo de cada fase vindos do conteúdo | passa | falha |


---

# Etapa de 08/10 — a suíte oficial verde (as marcas e os irmãos clássicos)

Depois de A1 (só conteúdo do PoE), A3/"só itens do PoE em todo o jogo", A4 e A5 surgiram falhas novas: testes que entravam em hunt/boss do Draevor ou davam item do Draevor ao personagem, agora recusados. **129 delas não estavam na matriz de 07/10**; foram classificadas abaixo pela mesma régua.

**Marcas aplicadas:** 563 testes — B 379 (`doClassico`) · C 184 (`aAdaptar`), cada uma com o motivo no próprio `skip`. Todo arquivo marcado ganhou o irmão `<x>.classico.test.mjs`, que roda o MESMO arquivo com `DRAEVOR_CLASSICO=1` dentro da suíte de sempre: B e C continuam verificados no clássico.

**Suíte depois das marcas** (`node --test "game/testes/*.test.mjs"`, oficial + irmãos clássicos): 3472 testes · 2867 passam · **0 falham** · 603 pulados (as marcas, com o motivo) · 2 TODO (as falhas anteriores à migração, `jaFalhava`).

Corrigido sem marca nesta etapa: a D de `itens-poe.test.mjs` (trocada por "sem chave o oficial liga; só `DRAEVOR_CLASSICO=1` desliga"), a B de `itens-poe-combate.test.mjs` (a ficha base do PoE tem a resistência a Caos), `efeitos-visuais`, `itens-poe-gemas` e `mapa-fundo` (faltava o bootstrap do PoE no arquivo), `editor-conteudo` (a troca em massa de `troll-cave` tinha quebrado o nome do arquivo de mapa — desfeita), a party (só o Normal existe no PoE: os testes usam `facil` no oficial) e a mensagem do Cruel no PoE ("boss do Ato 0" → "a campanha do PoE é uma passada só").

**E (regressão desta migração, corrigida):** a troca em massa de `troll-cave` pôs `import … from './apoio.mjs'` estático no `item-power` e na `progressao`. O apoio carrega o jogo inteiro, e o import estático roda antes do `process.env.DRAEVOR_OVERRIDES = tmp`: os overrides de teste (IPW13, PG13) foram gravados em `gamedata/overrides/` do worktree (que o servidor local lê). Os dois arquivos foram retirados, o apoio passou a vir por `await import` depois do desvio, e o teste-guarda `isolamento-dos-testes.test.mjs` recusa o padrão (provado com a mutação).

**Depois da primeira suíte com as marcas** (10 falhas), resolvido assim:

- **E (minhas, corrigidas):** `campanha-editor` CE6 — a troca em massa pôs `HUNT_DE_TESTE` dentro do código mandado a outro processo (lá a variável não existe); o arquivo inteiro é do editor da campanha do Draevor e voltou a usar a `troll-cave`. `classes` CL11 — o teste lê o texto da ligação do banco de classes em `backend/index.mjs`, que mudou de propósito na A5 (pular os arquivados): a expectativa segue a ligação nova.
- **Concorrência dos irmãos (corrigida):** `server-save` R1 e P1 ("database is locked") — o irmão clássico roda ao mesmo tempo que o original, no mesmo SQLite. O clássico de teste passou a usar outro arquivo (`DRAEVOR_SQLITE`, posto por `apoio-classico.mjs`; produção é Postgres e nem lê o caminho). Com o banco limpo, até a A4 (que dependia do ciclo gravado no banco de desenvolvimento) passa no clássico.
- **Corrida entre arquivos (corrigida):** `consolidacao-offline` "a rodada ignora quem já acabou" falhava 3 de 3 com o `server-save` rodando junto: o P1 põe 1.500 ausentes no banco e a rodada pega só os 40 mais antigos (`POR_RODADA`). O `server-save` (teste de carga) ganhou um SQLite só dele (`apoio-banco-proprio.mjs`) — e a A4, que era C por ler o ciclo do banco de desenvolvimento, passou a passar no oficial: a marca saiu.
- **B por sorteio:** `atributos-do-mob` "o detalhamento" e `simulador-do-mob` (3 testes) pedem modificadores do Draevor (blindado, escudado, vigoroso, brutal); no oficial o monstro comum troca esses pelos do PoE **sorteados** (`itens-poe/modificadores-monstro.mjs`, `aplicador`) — passavam ou falhavam conforme a sorte (6 rodadas: 4 testes instáveis). Marcados B.
- **Só no oficial (`soNoOficial`):** `biblioteca` L9 (as moedas do PoE na Biblioteca) — teste do PoE num arquivo que também roda no clássico.
- **Falhas anteriores à migração (`jaFalhava`, vão como TODO):** `editor-conteudo` "48 fases" (espera a fenda indisponível, mas ela já existe em `encontros/ondas.mjs`) e `prey-combate` LOOT (a lista que cai do Troll não bate com a esperada). Pendências do dono — X1 em `migracao-poe-oficial.md`.

## Falhas novas, por arquivo

### agua.test.mjs

**C** — A água não ser andável (nascer/pisar) é da engine e vale nas áreas do PoE; o teste percorre as hunts do Draevor, que o jogo oficial recusa.

| Linha | Teste |
|---:|---|
| 31 | nenhuma casa de chão líquido fica andável em nenhum mapa real |
| 44 | ninguém nasce na água: jogador e bichos começam em chão seco |
| 52 | caçando 3 minutos nas hunts com lago, ninguém pisa na água |

### andares.test.mjs

**C** — Andares da instância são da engine; o teste usa a Winter Dream Court (hunt do Draevor).

| Linha | Teste |
|---:|---|
| 108 | Winter Dream Court: os bichos da instância ficam nos andares por onde a rota passa, e as criaturas são as do mapa |

### areas.test.mjs

**B** — As 297 skills de ataque do Draevor com forma desenhada.

| Linha | Teste |
|---:|---|
| 158 | todas as 297 skills de ataque com forma: o dano cai exatamente nas casas desenhadas, nos quatro lados |

**B** — Mob Explosivo do Draevor (raridade de monstro do Draevor) num mapa do Draevor.

| Linha | Teste |
|---:|---|
| 222 | mob Explosivo: o quadrado desenhado é o raio que fere — dentro fere, fora não |

### atributos-do-mob.test.mjs

**B** — Nomes de raridade do Draevor (Mágico/Raro/Chefe/Chefe único); no PoE: Normal, Mágico, Raro e Único.

| Linha | Teste |
|---:|---|
| 194 | os nomes da raridade: Mágico (o modificado), Raro, Chefe e Chefe único; os ids não mudam (os mapas e o save seguem iguais) |

### atributos-efeito.test.mjs

**C** — O bônus de loot age nos drops do PoE (combate.mjs: fatorDeChance); a sonda mata um troll do Draevor e conta sobretudo moedas de ouro.

| Linha | Teste |
|---:|---|
| 284 | loot_bonus: com o atributo, o efeito muda (mais) |

### balanceamento-das-gemas.test.mjs

**B** — Custo e cura das gemas do Draevor (Knight x Druid).

| Linha | Teste |
|---:|---|
| 16 | fatorDeCusto muda o custo de mana mostrado no catálogo; fatorDeCura muda a cura mostrada |
| 36 | o Knight não cura mais barato por mana que o Druid (identidade: o curandeiro é o Druid) |

### biblioteca.test.mjs

**B** — A Biblioteca no oficial mostra só as bases do PoE; o teste busca itens do Draevor.

| Linha | Teste |
|---:|---|
| 19 | L2. busca por nome (sem acento/caixa) e por id, filtro de nível, ordem e categoria inválida |

### bosses-dos-atos.test.mjs

**B** — Bakragore e os bosses de ato do Draevor; no oficial os chefes são os dos atos do PoE.

| Linha | Teste |
|---:|---|
| 102 | alcance: a área em volta do boss não pega quem está longe; o feixe não pega na diagonal |
| 114 | morto no meio do tique: as magias seguintes não batem (sem dano depois da morte) |
| 131 | Bakragore se cura (a defesa do arquivo) quando está abaixo da vida máxima |

### bosses.test.mjs

**B** — Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor.

| Linha | Teste |
|---:|---|
| 17 | boss de task: fechado até a task, abre com as kills, paga Task Token e sai uma vez só |
| 34 | boss diário: a espera começa ao ENTRAR, mesmo sem ele cair |
| 43 | sala de boss: 25 minutos e volta para a cidade |
| 59 | brain-head e ghulosh: o boss está na sala (a entrada fica no meio dela) |
| 69 | Auto Boss: pula o que não dá, entra um depois do outro, conta a leva e para no fim |

### campanha-editor.test.mjs

**B** — Editor da campanha do Draevor (48 fases de campanha.json); a campanha do PoE vem de campanha-poe.json.

| Linha | Teste |
|---:|---|
| 51 | CE3. validação: não cria nem remove fase, level inteiro 1–5000, Normal ≤ Cruel ≤ Merciless, hunt/boss existem; escada que desce e fora da faixa são avisos |
| 68 | CE4. travar/destravar fase é mudança de PROGRESSÃO e avisa com todas as letras |
| 77 | CE5. salvar: grava SÓ os campos pedidos (o resto do arquivo idêntico), guarda a versão anterior e recusa erro sem gravar nada |
| 118 | CE7. restaurar: grava a versão antiga como atual e guarda a atual; versão inexistente é recusada |
| 129 | CE8. rotas: leitura, pré-visualizar (não grava) e salvar (grava); a tela só edita o PROPOSTO (diferenças) e o acesso classifica certo |

### chao-e-troca.test.mjs

**C** — Largar e pegar do chão sem perder nada é da engine; o teste usa peças do Draevor, que não entram no jogo oficial.

| Linha | Teste |
|---:|---|
| 36 | chão: largar e pegar com OUTRO personagem preserva a peça inteira — em toda raridade (a Assassin Star Mítica continua Mítica) |
| 51 | chão: armadura com atributos aleatórios, tier, imbuement e sockets volta idêntica (nada é sorteado de novo) |

### charms.test.mjs

**B** — Charms e bestiário do Draevor (Dodge no Troll).

| Linha | Teste |
|---:|---|
| 120 | na caçada: as mortes enchem o bestiary e o Dodge (no Troll) apara o golpe |

### chegadas.test.mjs

**C** — As Chegadas são da engine; o teste compra um produto da Store que entrega item do Draevor (fora da loja no oficial).

| Linha | Teste |
|---:|---|
| 32 | a compra da Store vai para as Chegadas; nas Chegadas nada se guarda à mão |

### consolidacao-offline.test.mjs

**C** — A consolidação da morte é da engine; o personagem de teste (knight) não vence na área do PoE e a morte cai em outro pedaço.

| Linha | Teste |
|---:|---|
| 106 | morreu num pedaço: não avança mais, e o login aplica a morte |

### encontros-etapa6.test.mjs

**C** — O valor de limpar uma área do PoE dá 0 (o loot do PoE não tem preço de NPC): o editor recusaria toda recompensa numa área do PoE.

| Linha | Teste |
|---:|---|
| 52 | o valor de limpar uma fase é calculado (772 na Troll Cave Fácil) e a razão dos encontros é o que o validador cobra |

### filtro-da-conta.test.mjs

**C** — O filtro "Não vender/Não coletar" é da engine; o teste usa um hand axe do Draevor.

| Linha | Teste |
|---:|---|
| 33 | caçando: "Não vender" nunca é vendido, "Não coletar" fica no chão, o resto é vendido |

### forja.test.mjs

**B** — Forja, craft e desmanche do Draevor; o jogo oficial só aceita itens do PoE.

| Linha | Teste |
|---:|---|
| 133 | craft: com tudo em mãos, a peça sai HERDANDO tier, imbuements e afixos, no lugar da base |
| 150 | craft: base vestida e peça nova de level alto demais → a nova vai para a mochila, não para o corpo |
| 161 | craft: falta material → recusa sem tirar nada |
| 196 | desmanche: mostra só o que tem, separa as peças presas e desmancha várias de uma vez |

### gemas-raridade.test.mjs

**B** — Gemas do Draevor com raridade (chão, troca, mercado); o jogo oficial só aceita gemas do PoE.

| Linha | Teste |
|---:|---|
| 94 | organizar, trocar, largar e pegar: a gema segue inteira |
| 157 | Mercado: anunciar e comprar a gema entrega a MESMA gema (antes chegava limpa, sem raridade) |

### gemas-skill.test.mjs

**B** — Gemas de skill do Draevor (barra, loja da Zuma, dano do balão, gemas iniciais da vocação).

| Linha | Teste |
|---:|---|
| 108 | sem a gema a skill não existe (Action Bar); encaixada, existe; tirada, some de novo |
| 346 | loja da Zuma: vende todas as gemas, só comuns (preço pelo level da magia) e supports (preço fixo) |
| 359 | loja da Zuma: compra paga do bolso e depois do banco; gema nível 1 na mochila |
| 562 | o dano do balão da skill é o do disparo: sobe com o nível da gema, a support e o level (uma conta só) |
| 585 | categorias das gemas (como no Path of Exile): Ataque, Cura, Reforço, Suporte — no item e na loja, em ordem |
| 600 | personagem novo: gemas iniciais da classe (ataque + cura), encaixadas, uma vez só |

### hunt-gravada.test.mjs

**C** — Gravar a caçada compacta é da engine; a área do PoE comprime menos (128895 → 81660 bytes) que a meta do teste.

| Linha | Teste |
|---:|---|
| 24 | a caçada volta idêntica do banco, e muito menor |

### hunts-painel.test.mjs

**B** — Painel de hunts com o bestiário de drops do Draevor.

| Linha | Teste |
|---:|---|
| 39 | H3. drops esperados: queda por limpeza = mortes × chance do bestiário; ordenado por valor; avisa que é estimativa |

### implicitos.test.mjs

**B** — Regra do Draevor: nenhum item com implícito; as bases do PoE têm implícitos.

| Linha | Teste |
|---:|---|
| 15 | nenhum item do catálogo traz implícito (nem os Crafted, nem os originais) |

### infra-editores.test.mjs

**B** — Revisão/conflito no editor da campanha do Draevor (campanha.json).

| Linha | Teste |
|---:|---|
| 47 | IN2. campanha: salvar com a revisão LIDA grava; com revisão velha (arquivo mudou no meio) é recusado SEM gravar; restaurar também confere |
| 95 | IN5. HTTP: conflito responde 409 (e o corpo explica); sucesso e erro de validação continuam 200 |

### item-power.test.mjs

**B** — Item Power do Draevor (fórmula, overrides, distribuição por hunt).

| Linha | Teste |
|---:|---|
| 31 | IPW1. fórmula de fábrica: pesos 1 / 1,5 / 0,8 / 0,8 / 0,8, normalização neutra e a versão da fórmula — sem atributos que não existem |
| 40 | IPW2. dano médio = (mín + máx) / 2; a soma é ponderada e cada atributo tem o seu detalhamento em pontos |
| 52 | IPW3. normalização: o fator converte a unidade do atributo antes do peso; o Block do escudo vale cheio, o da arma metade, os outros slots nada |
| 206 | IPW13. override: só o diferente é gravado; a fábrica nunca muda; salvar → versão anterior no histórico → conflito → restaurar → reverter |
| 306 | IPW18. distribuição: análise de hunt, onde um item cai, alertas (muito acima/abaixo, level acima da hunt, muitas hunts, lacunas) — sem tocar em chance de drop |
| 327 | IPW19. regras de distribuição: candidatos que cabem na faixa (level, IP, raridade, slot) e drops dos monstros listados que FOGEM da regra; a dificuldade entra na chance |

### mobs-mecanicas.test.mjs

**B** — Modificadores de monstro do Draevor (Explosivo, Enfurecido, Vingativo, Endurecido, Espelhado, Venenoso, Abrasador).

| Linha | Teste |
|---:|---|
| 35 | Explosivo: ao morrer, fere o jogador perto (pelo caminho de dano do jogador); longe não |
| 70 | Enfurecido: na vida baixa, UMA vez, mais dano (forcaDoBicho) e golpe mais rápido |
| 86 | Vingativo: um aliado morre perto e ele ganha dano por um tempo |
| 97 | Endurecido: cada dano recebido empilha resistência física, até o teto |
| 104 | Espelhado: parte do dano físico volta no jogador; magia de fogo não |
| 113 | Venenoso: o golpe deixa um dano ao longo do tempo, um pulso por segundo |
| 132 | Abrasador: a aura fere quem está perto, no intervalo dela |

### mobs-raridade.test.mjs

**B** — Raridade de monstro do Draevor (Vigoroso, Brutal, Blindado, levelExtra, spawn do editor).

| Linha | Teste |
|---:|---|
| 39 | raro com "Vigoroso" e "Brutal": vida, dano, exp e loot nos MESMOS campos do combate |
| 52 | resistência e velocidade entram nos cálculos que já existem (Blindado = resistência física) |
| 62 | o level do mob sobe só o `levelExtra` da raridade (a exp a mais não conta), e vale no acerto do jogador |
| 87 | spawn: a raridade vem do `raridade` ou do `tipo` de antes; modificador num normal vira "modificado"; teto por raridade |
| 97 | spawn: o editor de mapas recusa raridade/modificador desconhecido e passa do teto |
| 109 | instância: o mob do spawn configurado nasce raro, com os modificadores, e continua um objetivo da limpeza |
| 128 | a tela recebe o level, a raridade e os NOMES dos modificadores; as cores vão no config |
| 153 | fase 3: o cliente recebe o texto pelo NOME do modificador e o resumo da raridade; o editor recebe ids, tetos e o tipo antigo |

**C** — Os 204 modificadores de monstro do PoE mostram o texto do PoE; em 36 deles o jogo aplica uma aproximação com outros números (falta mostrar o que vale no jogo).

| Linha | Teste |
|---:|---|
| 137 | fase 3: todo modificador tem uma descrição gerada dos dados (os números do JSON aparecem no texto) |

### modo-beta.test.mjs

**B** — Modo beta das hunts VIP/Instance/Divine e dos bosses do Draevor.

| Linha | Teste |
|---:|---|
| 20 | M2. ligado: entra em VIP, Instance e Divine sem premium, pergaminho nem level, e não é expulso por falta de acesso |
| 31 | M3. ligado: boss sem level, sem task e sem recarga, quantas vezes quiser (e nenhuma espera é gravada) |

### motor-de-dano.test.mjs

**B** — Contagem de ativas e supports do Draevor.

| Linha | Teste |
|---:|---|
| 10 | contagem: ativas + supports = total; toda ativa tem uma função |

### party-limite.test.mjs

**C** — O sorteio de itens da party é da engine; o teste sorteia itens do Draevor, que não entram no jogo oficial.

| Linha | Teste |
|---:|---|
| 199 | party: os ITENS são SORTEADOS entre os quatro — todos recebem, nenhum se perde, e o chat de quem recebeu mostra |
| 217 | party: quem não pode levar (filtro do loot) fica fora do sorteio — o item não se perde |

**C** — Colisão da party é da engine; a caçada de um dos cinco (nível 3) acaba no meio dos 5 minutos na área do PoE.

| Linha | Teste |
|---:|---|
| 336 | colisão: cinco na mesma caçada nunca dividem casa (nem com bicho), e ninguém fica travado |

### party-recompensas.test.mjs

**C** — A auditoria do sorteio é da engine; o teste sorteia um item do Draevor, que não entra no jogo oficial.

| Linha | Teste |
|---:|---|
| 214 | P5. cada item sorteado vira um registro de auditoria com id, concorrentes e o único dono |

### percurso.test.mjs

**B** — Hunt VIP do Draevor.

| Linha | Teste |
|---:|---|
| 109 | hunt Vip (sala sem mapa capturado): também tem laço, pelos pontos de nascimento |

**C** — Percurso sem vai-e-volta é da engine; o teste usa a Winter Dream Court (hunt do Draevor).

| Linha | Teste |
|---:|---|
| 120 | sem vai-e-volta: lurando ou não, ele nunca fica desfazendo o próprio passo (Winter Dream Court) |

### poder-da-arma.test.mjs

**B** — Dano das gemas do Draevor pela arma (danoBase, armaDoDano).

| Linha | Teste |
|---:|---|
| 78 | uma arma mais forte dá mais dano; a de nível mais baixo, menos (mesmo personagem, só a arma muda) |
| 140 | catálogo: a gema de ataque diz a origem do dano (família da arma, afinidade, piso) e o dano mostrado segue a arma |

### poderes.test.mjs

**B** — Salas e poderes dos bosses do Draevor (capturados do original).

| Linha | Teste |
|---:|---|
| 36 | as 72 salas capturadas: o jogador e o boss nascem onde o original põe |
| 44 | a barra do boss: vida e elementos iguais ao original (resistência no teto de 20%) |
| 55 | Gaffir: os golpes com os nomes do original e dentro da faixa do monster.lua |
| 66 | melee de boss é o do arquivo, não metade da vida (Essence of Malice: 0..603) |
| 72 | Brain Head não tem melee: só magia |
| 77 | Magma Bubble: sala de lava, o boss nasce nela |
| 83 | bichos da hunt (Winter Dream Court): as magias com o nome, a cor e o efeito do original |
| 131 | bicho novo não solta todas as magias no primeiro tique: o relógio de cada uma começa sorteado |

### podio-combate.test.mjs

**C** — O bônus de pódio é da engine; o personagem de teste não mata nada na área do PoE em 15 minutos.

| Linha | Teste |
|---:|---|
| 47 | sem hunt.podio: mata sem bônus (o padrão de hoje, igual antes da mudança) |
| 53 | com hunt.podio (setado como sessao.mjs faz, 1x por tique): +8% de exp aplicado no kill |

### prey-combate.test.mjs

**B** — Prey do Draevor (por criatura: Troll, Amazon).

| Linha | Teste |
|---:|---|
| 44 | DANO: prey de dano 10★ bate 25% mais forte no Troll |
| 50 | DEFESA: prey de defesa 10★ tira 30% do golpe do Troll (do que passou da armadura) |
| 59 | EXPERIÊNCIA: prey de exp 10★ dá +40% de exp por Troll |
| 75 | o bônus NÃO vale contra outra criatura (prey de Amazon caçando Troll) |
| 84 | o bônus NÃO vale com o tempo zerado |

### prey.test.mjs

**B** — Prey do Draevor (por criatura: Troll).

| Linha | Teste |
|---:|---|
| 256 | caçando de verdade: prey de exp dá +40% na exp do Troll e o relógio desce |

### progressao.test.mjs

**B** — Progressão e dificuldade do Draevor (Atos 1–10 do catálogo do Draevor, neutro de fábrica).

| Linha | Teste |
|---:|---|
| 52 | PG2. progressão e dificuldade são DIMENSÕES SEPARADAS: o loot é por dificuldade e neutro de fábrica; a progressão não tem campo de dificuldade |
| 106 | PG5. neutro de fábrica: o gerador devolve EXATAMENTE os mesmos itens de antes (mesma semente), com ou sem a configuração explícita |
| 111 | PG6. a DIFICULDADE influencia o gerador real: pesos de raridade, +1 modificador, pesos e teto de tier, e a chance de drop só de EQUIPAMENTO |
| 164 | PG9. Atos 1, 5 e 10 nas três dificuldades: mesma faixa e mesmos tiers; distribuição teórica soma 1; Normal < Cruel < Merciless em itens raros; nível 1000 tratado |
| 177 | PG10. o SIMULADOR: determinístico por semente, a amostra bate com a teoria, usa o gerador real, cobre monstro e hunt, avisa quando o Ato não tem bases, e a proposta é simulada sem ser aplicada |
| 206 | PG11. bases por Ato: só equipamento cujo level mínimo cai na faixa (independe da dificuldade); craft fora; slot/tier/contagens; level incompatível nunca entra |
| 235 | PG13. overrides: o arquivo de fábrica nunca é editado; salvar grava só a DIFERENÇA, valida antes, tem prévia de impacto, versões, restaurar, desligar, conflito (409) |

### progresso-da-hunt.test.mjs

**B** — Mapas reais do Draevor (ahau, burster-spectres).

| Linha | Teste |
|---:|---|
| 474 | mapas reais que dançavam (ahau, burster-spectres): o kite não repassa em ciclo |

### raridade-dos-mapas.test.mjs

**B** — Raridade de monstro por mapa do Draevor (temas, editor de mapas).

| Linha | Teste |
|---:|---|
| 48 | distribuir: modificadores do tema, dentro do teto, com no máximo N mecânicas; boss fica de fora |
| 76 | editor: mapa real (troll-cave) é só spawns; o resto é do editor |
| 82 | mapa do editor fora da campanha: o mob nasce com a raridade do spawn, e renasce com ela |

### recarga.test.mjs

**B** — Recarga das magias do catálogo do Draevor.

| Linha | Teste |
|---:|---|
| 46 | o catálogo mandado ao cliente mostra a recarga que o servidor aplica |

### reforcos.test.mjs

**B** — Reforços do Draevor (tipos de efeito do catálogo).

| Linha | Teste |
|---:|---|
| 41 | toda gema de reforço tem entrada nos dados; os efeitos são de tipos conhecidos |

### relatorio-da-ausencia.test.mjs

**C** — O relatório da ausência é da engine; o personagem de teste morre de outro jeito na área do PoE.

| Linha | Teste |
|---:|---|
| 86 | loot e DEPOIS a morte: o loot de antes da morte está no relatório, e o relatório diz até quando vai |

### setores.test.mjs

**C** — O reagrupamento por setor é da engine; o teste usa a dificuldade/fase do Draevor.

| Linha | Teste |
|---:|---|
| 134 | R1. reagrupamento: opcional por padrão; obrigatório só na fase/tipo configurados, e diz quem falta |

### simulador-do-mob.test.mjs

**B** — Simulador do monstro com a raridade do Draevor.

| Linha | Teste |
|---:|---|
| 96 | o editor recebe o detalhamento do monstro: atributos com origens, ataques, erros e avisos das regras |

### simulador-tique.test.mjs

**C** — O worker do tique é da engine (sem defeito: sem o worker também dá 0 abates); o personagem de teste não mata nada na área do PoE.

| Linha | Teste |
|---:|---|
| 76 | os eventos do tique no worker são os mesmos que `Cacadas.tique` devolveria (ex.: kill) |
| 94 | o bônus de pódio (não-enumerável em hunt.podio) atravessa o worker — a mesma correção de podio-combate.test.mjs |

### supports-etapa4.test.mjs

**B** — As 41 supports do Draevor.

| Linha | Teste |
|---:|---|
| 59 | as 41 supports: cada uma com gema, nome e efeito de chave conhecida |

### tarefas.test.mjs

**B** — Tasks do Draevor (tokens, Auto Task, montaria).

| Linha | Teste |
|---:|---|
| 73 | pegar paga os tokens e PARA a task; aceitar volta a contar; parada não conta |
| 92 | com o Auto Task a etapa que fecha paga sozinha e a task não para |
| 103 | task de montaria: fechando, a montaria é dele e paga os tokens |

### tooltip-dos-buffs.test.mjs

**C** — O balão da gema de reforço do PoE é a ficha do PoE (corpoDaGemaPoe); o bloco antigo (Reforcos.descrever) fica sem linhas nas 75 gemas do PoE.

| Linha | Teste |
|---:|---|
| 13 | todo reforço tem tooltip com o que faz, a duração e quem é afetado — e nenhum texto genérico |

### tooltip-gemas.test.mjs

**B** — As 92 gemas de ataque do Draevor e o danoBase delas.

| Linha | Teste |
|---:|---|
| 18 | as 92 gemas de ataque: 23 melee + 14 distance + 55 magic (a regra das tags + as 8 exceções de : paladin sagrado → Distance, monk → Melee) |
| 34 | catálogo: toda skill de gema com dano traz danoBase e escalaCom; o dano base não passa do dano com a gema |

### tooltip-suportes.test.mjs

**B** — Os 41 suportes do Draevor (nome em português, loja, compatibilidade).

| Linha | Teste |
|---:|---|
| 22 | os 41 suportes têm nome em português, e o id, o nome em inglês e o nome do item seguem como chave |
| 41 | a loja mostra o suporte em português |
| 68 | a compatibilidade sai em português, sem tag técnica em inglês |
| 79 | a regra de compatibilidade não mudou: quantas habilidades de ataque aceitam cada suporte |

### world.test.mjs

**C** — O WORLD (descrição, requisito, payload) é da engine; o teste usa a campanha do Draevor.

| Linha | Teste |
|---:|---|
| 40 | o WORLD recebe descrição, ambiente, conexões, boss principal e a condição de conclusão — e NENHUM segredo |
| 71 | requisito de entrada = PROGRESSO (exige completar fases), e o level é só RECOMENDADO: nível baixo entra, falta de fase não |
| 94 | sem conteúdo cadastrado (produção hoje), o payload da campanha é o de sempre, com `mundo` vazio |

