# Auditoria da árvore de passivas do PoE no Draevor

Página auditada: `http://localhost:8099/editor/conteudo#poe-arvore-poedb` (Engine › Árvore × PoEDB) e a árvore em uso no jogo com `ITENS_POE=1`.
Ciclos 1 e 2 — 09/10/2026. Inventário verificável (gerado, rastreável por id):
- [`arvore-passivas-poe-inventario.md`](arvore-passivas-poe-inventario.md);
- [`arvore-passivas-poe-inventario.json`](arvore-passivas-poe-inventario.json).

---

## 1. Resumo executivo

| | Antes (commit `de2be187`) | Ciclo 1 | **Ciclo 2** |
|---|---:|---:|---:|
| Nós analisados (principal + maestrias + ascendências) | 2.810 | 2.810 | 2.810 |
| Auditáveis (sem os 28 inícios) | 2.782 | 2.782 | 2.782 |
| **Funcionais** (todas as linhas com efeito real, verificado) | 1.622 (58,3%) | 1.693 (60,9%) | **1.712 (61,5%)** |
| Funcionais com aproximação | 158 (5,7%) | 141 (5,1%) | 141 (5,1%) |
| **Parciais** (parte das linhas com efeito) | 430 (15,5%) | 407 (14,6%) | **400 (14,4%)** |
| **Sem efeito real** | 462 (16,6%) | 431 (15,5%) | **419 (15,1%)** |
| Não classificáveis (sem linhas: 57 encaixes de joia, 53 outros) | 110 | 110 | 110 |
| Falhas no motor (alocar → somar → tirar), em todos os nós | 5 | 0 | **0** |
| Efeitos traduzidos que nada no código lê | 84 em 5 causas | 0 | **0** |
| **Cobertura funcional** (funcionais + aproximados) | 64,0% | 65,9% | **66,6%** |

Linhas, no ciclo 1: 4.075 com efeito real, 1.515 pendentes, 455 que o jogo marca como inexistentes (com o porquê) e 756 lembretes do PoE.

### A escada de cobertura (ciclo 2)

Cada nó fica no último degrau que alcança sem pular nenhum. Lista por id no inventário.

| Degrau | O que prova | Nós |
|---|---|---:|
| Apenas exibido | está nos dados e no editor, mas o motor não o aloca | 0 |
| Alocável | o servidor aloca e tira (caminho, pontos, regras), mas nenhuma linha tem efeito | 529 |
| Interpretado | a linha vira modificador tipado com leitor no código, mas o efeito não foi visto | 19 (condições que o cenário automático não monta: "drenando", "cadáver consumido"…) |
| Aplicado (sem teste numérico ainda) | a ficha efetiva muda ao alocar ou o combate lê o valor no acerto/tique | 1.065 |
| **Validado por teste** | cada efeito do nó tem teste numérico de integração (`testes/cobertura-arvore.mjs` e os arquivos citados lá) | **1.169** |

"Aplicado" se mede na ficha que o servidor refaz depois de mudar a árvore (`depoisDeMudar`): vida, armadura, golpe, regeneração… Quando a
chave pede uma condição comum (escudo, tipo de arma, duas armas, vida baixa), o cenário é montado. Aparecer só na ficha do personagem
(tela) não conta.

### Metodologia (como os números saem)

Os números saem de `game/admin/auditoria-arvore-passivas.mjs`, rodado por `game/tools/auditar-arvore-passivas.mjs`. Nenhum número vem do
texto do nó. Para cada nó há quatro verificações:

1. **Dados.** Cada linha do nó é traduzida pela mesma função do montador (`traduzirLinha`). Uma linha "funciona" se a regra dá um
   efeito tipado (`equivalente`, `aproximado`, `novo`).
2. **Efeito conectado.** Cada efeito precisa de quem o leia no código do servidor (`systems/`, `websocket/`). Lê-se a chave literal
   ou montada (`imune_${afeccao}`). A escala, a condição e o evento precisam ser conhecidos, e a condição/tag precisa ser *produzida*
   por alguém (uma tag que nenhuma gema tem não vale). O formato `tag` (afinidade do Draevor) conta como desconectado no modo PoE.
3. **Alocação.** Um personagem de teste chega ao nó pelo motor de verdade: `Passivas.caminhoAte` + `Passivas.alocar`, as mesmas
   regras que o servidor aplica ao pedido do WebSocket. Isso vale também para cada opção de maestria e para as ascendências, com 8 pontos.
4. **Cálculo e remoção.** A diferença na soma que a ficha usa (`Afixos.soma` / `Especializacoes.efeitos`), antes × depois de alocar,
   precisa ser exatamente o valor do nó. Depois o nó sai pelo respec (`Passivas.respec`) e a soma precisa voltar ao que era.

A situação sai daí:
- **funcional:** toda linha funciona, todo efeito está conectado e o motor passou;
- **parcial:** algumas linhas, ou falha no motor;
- **sem efeito:** nenhuma linha efetiva;
- **não classificável:** o nó não tem linhas, como os encaixes de joia.

Linha pendente nunca conta como implementada. O "antes" foi medido com o mesmo auditor, aplicado ao código do commit anterior.

**O que a auditoria não prova.** O "efeito conectado" garante que alguém lê o atributo, mas não que a conta esteja certa para cada
atributo. Por isso há testes numéricos por tipo de modificador (seção 2, coluna "Efeito validado") e o combate de verdade com semente
fixa (`testes/passivas-poe.test.mjs`).

---

## 2. Matriz de cobertura (por tipo de modificador)

Os tipos vêm dos dados reais (4.602 efeitos em 2.810 nós). "Alocação" e "Cálculo" foram verificados no motor em todos os 2.230 nós com
efeito. "Efeito validado" diz se há teste com número conferido para o tipo; quando não há, a validação é só a estática (alguém lê).

| Tipo de modificador | Existe nos dados (efeitos / nós) | Alocação funciona | Cálculo funciona | Efeito validado | Situação |
|---|---|---|---|---|---|
| Dano % (aumentado, "mais"; por tag de golpe: corpo a corpo, projétil, magia…) | 915 / 565 | sim | sim | **sim**: golpe corpo × projétil, combate real com semente, "mais" contra vida baixa | funciona |
| Atributos For/Des/Int (fixo) | 296 / 273 | sim | sim | **sim**: +10 de Força exato, sem duplicar, sai no respec | funciona |
| Velocidades (ataque, conjuração, movimento) | 328 / 290 | sim | sim | **sim**: intervalo do golpe na razão exata | funciona |
| Crítico (chance, multiplicador) | 306 / 220 | sim | sim | sim (o mesmo atributo das peças: `itens-poe-combate`) | funciona |
| Armadura e evasão (% e por peça) | 248 / 188 | sim | sim | **sim**: armadura da peça × (1 + %); a defesa de UMA peça (lote 5) | funciona |
| Resistências | 231 / 115 | sim | sim | **sim**: +5% em fogo/gelo/raio, o caos não muda | funciona |
| Vida % (`stat: life`) e vida fixa/regeneração/dreno | 99 + 205 / 269 | sim | sim | **sim**: aditivo (5% + 6% no mesmo %), respec devolve | funciona |
| Mana % e custo | 71 + 140 / 193 | sim | sim | estático | funciona |
| Escudo de energia | 137 / 114 | sim | sim | sim (lote 5: ES do elmo/escudo; escala no escudo) | funciona |
| Bloqueio (ataque, magia) | 131 / 99 | sim | sim | **sim**: condicional com escudo; "por X% de bloqueio" | funciona |
| Afecções e chance no acerto | 338 / 258 | sim | sim | parcial (testes dos itens: degenerativo, controle) | funciona |
| Efeitos por evento (ao matar, bloquear, usar frasco…) | 158 / 95 | sim | sim | **sim**: bloquear magia × ataque; usar frasco; carga no crítico | **corrigido** (16 nós de frasco estavam mortos) |
| Atordoamento | 88 / 70 | sim | sim | estático | funciona |
| Precisão (% e fixa) | 33 + 75 / 87 | sim | sim | estático | funciona |
| Lacaios e totens | 74 / 65 | sim | sim | estático | funciona (o que existe); ver lacunas |
| Cargas e fúria | 72 / 63 | sim | sim | sim (lotes 3/4: fúria máxima) | funciona |
| Supressão de magia | 40 / 40 | sim | sim | sim (lote 6: por Adaga) | funciona |
| Penetração | 19 / 19 | sim | sim | estático | funciona |
| Conversão / dano extra | 6 / 6 | sim | sim | estático | funciona |
| Escala da ficha ("por X de armadura/bloqueio/ES no escudo") | 27 / 17 | sim | sim | **sim**: escudo 300 de armadura+evasão → +30% só no ataque | funciona |
| Condição de estado + tag de golpe | 484 / 237 | sim | sim | **sim**: bloqueio com escudo; tags das gemas (Runa…) | **corrigido** (10 tags que nenhuma gema produzia) |
| Afinidade por tag (formato do Draevor, `tag`) | 53 → **0** | sim | sim | **sim**: corrigido para `dmg_inc@corpo/@projetil` | **corrigido** (morto no modo PoE) |
| Keystones com mecânica (`regra: poe`, conversão) | 12 / 12 | sim | sim | sim (testes das keystones nos itens/árvore) | funciona |
| Keystones só de texto | 36 / 36 | sim | n/a | — | **ausente** (33 sem efeito) |
| Encaixes de joia | 57 nós | sim (nó comum, custo 1) | n/a | — | **ausente** (não há joias de árvore) |
| Nós de escolha (Ascendente, Caçadora de Relíquias, Assassina) | 43 nós | **corrigido** | sim | **sim**: um por pai, custo 0, 8 pontos bastam | **corrigido** |
| Pontos concedidos por nó (`pontos_passiva`) | 26 nós | sim | sim | **sim**: total +1; respec que deixaria pontos negativos recusado | **corrigido** (respec podia negativar) |

---

## 3. Lacunas

Cada lacuna traz a evidência e a causa. Quando muitos nós dividem a causa, ela aparece agrupada, com os nós afetados no inventário.

### 3.1 Corrigidas neste ciclo

**L1. Nós de dano "Corpo a Corpo", "de Projétil", "Físico Corpo a Corpo" e "de Área" sem efeito no modo PoE.** Prioridade: **crítica**.
- **Nós afetados:** 53, entre eles 465 "Dano e Velocidade de Ataque do Projétil", 2092, 6797 e 10843 "Dano de Projétil" (lista no inventário de antes).
- **Esperado:** "+12% de Dano Corpo a Corpo" aumenta o golpe corpo a corpo.
- **Observado:** a linha aparecia com ✓, mas o golpe não mudava.
- **Causa:** as regras próprias da árvore (`gamedata/itens-poe/traducao-arvore.json`) davam `{ tag: 'melee' }`, a afinidade das
  especializações do Draevor. No modo PoE essa afinidade é zerada de propósito (`systems/acoes.mjs:263`, `systems/hunt/combate.mjs:1313`),
  para tirar as especializações, e a árvore caía junto.
- **Correção:** as regras passaram ao modificador tipado do PoE (`dmg_inc@corpo`, `dmg_inc@projetil`, `phys_dmg@corpo`,
  `dmg_inc@area`), que o `fichaDoGolpe` resolve em cada acerto. Também mudaram duas regras que eram aproximadas sem necessidade:
  - "+X% de Bloquear enquanto portar um Escudo" virou `block@comEscudo`;
  - "do Dano de Ataques é Drenado como Vida" ficou equivalente, porque no modo PoE as magias não roubam.
- **Teste:** golpe corpo +12 e projétil +0; combate real com semente, razão (100+p+12)/(100+p) dentro de 1%; nenhum nó com `tag`.

**L2. Nós de escolha das ascendências tratados como nós comuns.** Prioridade: **crítica** (alocação).
- **Nós afetados:** 43 — Ascendente 18, Caçadora de Relíquias 23, Assassina 2.
- **Esperado:** como no PoE, o nó-pai deixa escolher UMA opção, sem gastar ponto.
- **Observado:**
  - cada opção custava 1 ponto e era possível pegar várias;
  - 5 notáveis da Caçadora de Relíquias ficavam a 9 pontos do início, acima do teto de 8, e eram inalcançáveis (as 5 falhas do motor).
- **Causa:** o conversor não lia `isMultipleChoiceOption` do poedb.
- **Correção:** `tools/montar-arvore-poe.mjs` lê as escolhas e `converterAscendencias` grava `opcaoDe` com custo 0. No servidor,
  `Passivas.podeAlocar` exige o pai (`SEM_PAI`) e recusa uma segunda opção (`OPCAO_REPETIDA`); `validar` confere que o pai existe e está ligado.
- **Teste:** Assassina escolhe Na Jugular **ou** Apunhalada, sem gastar ponto; União da Carne (9 nós) cabe nos 8 pontos.

**L3. A morte derrubava level no modo PoE e deixava a árvore com pontos negativos.** Prioridade: **crítica** (pontos).
- **Esperado (PoE 1):** a morte tira experiência, nunca um level.
- **Observado:** `Morte.morrer` seguia a curva do Tibia (até 0,8 level). Caindo de level, `pontos().livres` ia a 0 e os nós a mais
  continuavam valendo, com o déficit escondido.
- **Correção:**
  - `systems/morte.mjs`: no modo PoE a perda é aparada no começo do level (`semPerderLevel`);
  - `systems/passivas/arvore.mjs`: `pontos()` passa a informar `deficit` e, com déficit, nada se aloca;
  - `frontend/client/src/passivas.mjs`: a tela mostra "−N pontos: tire nós no respec".
- **Teste:** morrer no modo PoE tira só os 1.000 de XP acima do level e não o level; o teste do Tibia continua no clássico
  (`morte.classico.test.mjs`); déficit visível, nada se aloca, tirar nós resolve.

**L4. O respec de um nó que concede pontos podia negativar os pontos.** Prioridade: alta.
- **Nós afetados:** os 26 "Ponto de Passiva" / "Caminho do …" da Ascendente e da Caçadora de Relíquias.
- **Correção:** `planoDeRespec` simula os pontos sem os nós tirados (`pontosSe`) e recusa com `PONTOS_NEGATIVOS`. O respec completo sempre pode.
- **Teste:** com os pontos todos gastos, tirar o "Ponto de Passiva" é recusado.

**L5. Tags de golpe que nenhuma gema produzia.** Prioridade: alta (mecanismo compartilhado).
- **Nós afetados:** 7 com runas (15973 "Dano e Duração de Runas", 29033, 29861, 40776…), mais toda regra futura com marcas,
  feitiços, vínculos, golpes, impactos e canalização.
- **Esperado:** "Chance de Crítico de Runas" vale nas runas, que nas gemas em português são as Brands ("Runa Tempestuosa").
- **Causa:** `TAG_DO_POE` (`systems/itens-poe/condicoes-poe.mjs`) não tinha Golpear, Impacto, Nova, Canalização, Feitiço, Vínculo,
  Marca, Runa, Ativação nem Retaliação. As tags existiam em `TAGS_DE_GOLPE`, mas nunca valiam.
- **Correção:** o mapa foi completado.
- **Teste:** cada tag do poedb vira a tag de golpe; `crit_chance_inc@runa` vale só nas Runas.

**L6. Eventos "ao usar um Frasco" nunca disparados.** Prioridade: alta.
- **Nós afetados:** as 8 Maestrias de Frascos, mais os mods de itens com as mesmas linhas.
- **Causa:** `usarFrasco` e `usarFrascoMana` estavam em `EVENTOS`, mas ninguém chamava `ModsPoe.evento` ao usar o frasco.
- **Correção:** `ModsPoe.eventosDoFrasco` é chamado pela sessão (`websocket/sessao.mjs`, `{t:'frasco', action:'usar'}`) depois de um uso bem-sucedido.
- **Teste:** "Recupera 4% de Vida ao usar um Frasco" (50 → 54) e "Remove uma Afecção… Frasco de Mana" só no de mana.

**L7. "25% de chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" lido por ninguém.** Prioridade: média.
- **Nós afetados:** as 8 Maestrias de Frascos.
- **Causa:** a regra dava `frasco_carga_no_critico`, que nenhum código lia.
- **Correção:** a regra passou a `ev:critico:frascoChance`, com a nova ação `frascoChance`: a chance de cada frasco do cinto ganhar
  1 carga. O atributo sem leitor saiu de `atributos-novos.json`.
- **Teste:** com chance 100, o crítico dá +1 carga.

**L8. Testes da engine da árvore inexistentes no jogo oficial.** Prioridade: alta (manutenção).
- **Observado:** em `testes/passivas.test.mjs` as regras da engine estão marcadas "a adaptar" (C) e só rodam no clássico. No
  oficial nada testava alocação, recusas, respec ou stats com a árvore do PoE.
- **Correção:** `testes/passivas-poe.test.mjs`, com 24 testes, e o invariante do auditor (todo nó com efeito aloca, soma exato e sai).

### 3.1b Corrigidas no ciclo 2

**C1. "Pode Alocar Passivas do ponto inicial do X" (o "Caminho do X" da Ascendente) sem efeito.** Prioridade: **crítica** (alocação).
- **Nós afetados:** 6 (7618, 24755, 53992, 54877, 56722, 63357).
- **Causa:** o motor só partia do início da classe e do da ascendência.
- **Correção:**
  - a linha vira `inicio_extra:<classe>` (`traducao-arvore.json`);
  - o servidor (`passivas/arvore.mjs`) passa a partir também desses inícios: `iniciosExtras`, `podeAlocar`, `caminhoAte`, `ilhadosSemEles` e a troca de versão em `garantir`;
  - a vista manda `iniciosExtras` e a tela acende os vizinhos (`frontend/client/src/passivas.mjs`).
- **Teste:** sem o Caminho, o vizinho do início do Marauder é recusado (`SEM_CAMINHO`). Com ele, aloca. Tirar o Caminho ilha o vizinho (`ILHARIA`), e com `junto` sai tudo.

**C2. A escada de cobertura e a tabela de testes.**
- A auditoria passou a verificar todos os 2.782 nós no motor, inclusive os sem efeito, e a medir o "aplicado" na ficha efetiva.
- `testes/cobertura-arvore.mjs` + `testes/passivas-poe-cobertura.test.mjs`: para cada atributo, um nó real da árvore é alocado e o número
  da ficha muda exatamente o que diz. São 33 atributos, entre eles:
  - os 3 `stat` do formato legado (vida %, mana %, precisão %);
  - armadura, evasão e escudo sobre a peça;
  - bloqueio com escudo, resistências, dano por elemento e por tag de golpe;
  - velocidades, crítico, precisão, regeneração, roubo e recarga.
- **Falsos negativos do auditor corrigidos:**
  - escudo/vida mexidos pelo `depoisDeMudar`: o retrato passou a ser tirado numa cópia;
  - listas que somam a mesma chave: compara-se o valor, não o tamanho;
  - keystone com mecânica: conta pela lista que o combate consulta.

**C3. O legado `traducao-arvore.json` confirmado de ponta a ponta.**
- As 22 regras próprias foram conferidas uma a uma. "Dano de Área" não atinge nenhum nó; as outras atingem de 1 a 98 linhas.
- Os `stat` legados (`life`, `mana`, `accuracy`) chegam à vida/mana máximas e à precisão da ficha com a conta aditiva certa (teste de cobertura).
- **Bloqueio "enquanto portar um Escudo"** (13 linhas): sem escudo o nó não dá nada; com escudo soma o valor (teste com nó real).
- **Dreno "de Ataques"** (15 linhas): o nó soma o roubo da ficha; o ataque cria a instância de roubo (até 10% da vida); a magia não rouba.

**C4. Keystones com mecânica completa** (todas as linhas, a vantagem e a desvantagem; `testes/passivas-poe-keystones.test.mjs`, 10 testes). O Juramento do Zelote vindo de peça passou a usar o mesmo caminho da árvore; o caso especial de `cacadas.regenerar` saiu.

| Keystone | O que cada linha faz agora | Onde age |
|---|---|---|
| Solipsismo | a Int não dá ES inerente; −2% de duração das afecções elementais em você por 15 de Int | `personagem/atributos.efeitos`; `controleNoJogador`/`dotNoJogador` |
| Terror dos Magos | a Des não dá evasão inerente (a supressão por 15 de Des já existia) | `personagem/atributos.efeitos` |
| Empunhadura de Ferro | o bônus de dano da Força vale nos ataques de projétil | `Ficha.forcaNoGolpe` (`acoes`, `hunt/combate`, ficha da tela) |
| Juramento do Zelote | a regeneração de vida vai para o escudo | `ficha.regenDoPoe` (`esDaVida`) + `condicoes-poe.tique` |
| Devastador Fantasma | o roubo de vida vira roubo de escudo; teto de roubo do escudo ×2; o escudo não recarrega | `ficha.aplicarLeech`, `recuperarRoubo`; `defesa.recarregar` |
| Bateria Anciã | o escudo paga os custos (já existia); o escudo não segura o dano da vida; 50% menos recarga | `escudoParaOCusto`; `defesa.absorver`, `defesa.recarregar` |
| Proteção Perversa | a recarga que começou há menos de 4 s não é interrompida; 40% menos recarga | `defesa.absorver`, `defesa.recarregar` |
| Juventude Eterna | a recarga do escudo enche a vida; 50% menos regeneração de vida; 50% menos teto de roubo de vida | `defesa.recarregar`, `ficha.regenDoPoe`, `recuperarRoubo` |
| Equilíbrio Elemental | o acerto elemental tira a Exposição daqueles elementos e põe −25% nos outros (o PoE atual; a de peça é a regra antiga) | `mods-poe.aoAcertar` (o sistema de Exposição) |

As outras 28 keystones de texto, uma a uma: o que falta e se dá para fechar com o que o jogo tem.

| Keystone | Situação | O que falta (dependência) |
|---|---|---|
| Inoculação do Caos | sem efeito | vida 1 é simples (`sincronizarMaximos`), mas a imunidade a caos tem de cobrir golpes, magias e dano contínuo. Pela metade, com vida 1, mataria o personagem — não implementada |
| Pacto Vaal | sem efeito | dreno instantâneo no corpo a corpo é simples; "só recupera vida pelo dreno" exige um ponto único de recuperação de vida (hoje: regeneração, frascos, por acerto/abate, eventos, recarga) |
| Dançarino do Vento | sem efeito | o dano recebido precisa saber se o golpe do monstro é ataque; "mais evasão" condicional |
| Dança da Flecha | sem efeito | o golpe do monstro precisa saber se é projétil ou corpo a corpo |
| Guarda Desequilibrada | sem efeito | a mitigação da armadura do jogador com "defender com X%" e o teto de redução por tipo |
| Acrobacia | sem efeito | esquiva de acertos mágicos (um sorteio a mais em `poderes.mjs`) e o teto de 75% |
| Combatente Versátil | sem efeito | os tetos de bloqueio −10 e o bloqueio mágico pelo excedente (os tetos existem em `bloqueioFinal`) |
| O Agnóstico | sem efeito | tirar o escudo existe (`sem_escudo`); falta o "sacrifica 20% da mana por segundo para recuperar vida" no tique |
| Sombra Fluvial | sem efeito | o dano contínuo em você precisa saber quando começou; 100% mais duração das afecções em você (existe o atributo) |
| Mestre dos Feitiços | sem efeito | duração infinita das maldições e o "menos efeito" delas |
| Agonia Perfeita | sem efeito | afecções só no crítico e o multiplicador de dano contínuo igual ao do crítico |
| Dança Carmesim | sem efeito | o acúmulo do sangramento por personagem (o `maxPilhas` é por tipo, em `dot.json`) |
| Geada Cortante, Tempestade Turbulenta, Chama Voraz | sem efeito | "Não pode causar dano que não seja X" existe (`so_dano:`); falta a outra metade de cada uma (frio pelo resfriamento, dano elétrico máx/mín, incêndio extra de 1 s). Pela metade ficariam só a desvantagem |
| Queima-Roupa | sem efeito | o dano do projétil pela distância percorrida |
| O Empalador | sem efeito | empalar em área e os empalamentos extras |
| Mobilização | sem efeito | os clamores que não dão buff a você e a duração "mais" |
| Ego Supremo | sem efeito (linhas inertes) | a reserva existe (`reserva.mjs`); falta o "mais efeito por mana reservada" |
| Dança Fantasma, Escudo Divino | sem efeito | mortalhas fantasmas; recuperação do escudo limitada pela evasão/armadura |
| Instabilidade do Lacaio, Égide Necromântica | sem efeito | os lacaios do jogo não explodem nem herdam o escudo |
| Lâmina Ensanguentada, Arsenal da Vingança | inexistente | Tinturas e habilidades de Retaliação não existem no jogo |
| Vínculo Ancestral | parcial (+1 totem) | "você não pode causar dano por si só" (bloquear o dano próprio em todos os caminhos) |
| Mesclador de Runas | parcial (−1 totem) | marca vinculada adicional (o vínculo de marca não existe) |

**C4b. Defeito corrigido nos lacaios** (achado pelo mapa de dependências).
- **O defeito:** "+1 ao número Máximo de Zumbis/Esqueletos/Golens/Totens" (`max_lacaio:*`, 12 efeitos da árvore, mais as peças) entrava na invocação, mas a checagem "já estão todos em campo" de `acoes.dispararSemMarcar` calculava o máximo sem a soma do dono. A gema era recusada antes de invocar o lacaio a mais.
- **Correção:** a checagem usa a mesma soma da invocação.
- **Teste:** `passivas-poe-lacaios.test.mjs`. Sem a correção: 4 de 5 zumbis. Com a correção: 5 de 5. A vida e o dano do zumbi invocado são os da soma do dono.

**C5. Os 30 nós "inalcançáveis" e as ascendências do poedb.**

Conferi contra o poedb 3.29 (`/home/deploy/scrapling/saida/arvore/arvore-poedb-3.29-pt.json`).
- **Os 30 são todos intencionais:** têm `isBlighted` + `recipe` e nenhuma ligação, nem no poedb nem na coleção. São os notáveis que no
  PoE só se ganham ungindo um amuleto com óleos. Dependem do sistema de Óleos/Unção, que está no roteiro (Óleos só dos pináculos).
  Nenhum é erro de ligação.
- **Na principal, nada faltou:** todo nó com posição do poedb está no jogo. Os outros 402 nós "principais" do poedb não têm posição, porque não estão na árvore atual.
- **Ascendências:**
  - os 147 nós do poedb fora do jogo são 15 Linhagens (Bloodlines: Aul, Farrul, Olroth…), a última etapa do roteiro;
  - a **Guardiã (Warden)** é a exceção. O jogo tem a versão da coleção (3.24/3.25, com Tinturas) e o poedb 3.29 traz a Guardiã refeita
    ("Juramento dos Maji", "Espíritos Vívidos"). Trocar remove alocações de quem já escolheu a Guardiã — **decisão do dono** (R14).

**C6. Os 57 encaixes de joia — investigados, não implementados.**
- "Joia" no Draevor é o slot de anel/amuleto (`SLOTS_DE_JOIA` em `itens/gerar.mjs`), outra coisa.
- As joias do PoE (`Jewels`, 8 bases; `Abyss_Jewels`, 5) existem no catálogo, mas ficam em `naoEquipaveis` (`itens-poe/jogo.mjs`). Não
  viram item do jogo: não caem e não têm id.
- Para os encaixes funcionarem faltam:
  1. a joia virar item (id, sorteio dos mods pelas pools do poedb, drop);
  2. o comando de encaixar/tirar no nó alocado (servidor, validado);
  3. a soma do `af` da joia encaixada em `Afixos.soma`, como as peças;
  4. o respec do nó devolver a joia;
  5. a tela.
- Os itens 2 a 5 dependem do 1, que é o item "Joias" do roteiro. Implementar só o encaixe deixaria código sem uso. Fica como R12, com este desenho.

### 3.2 Restantes (por causa técnica)

As linhas pendentes, agrupadas por tema, com o que cada tema precisa, estão no inventário ("Linhas sem tradução com efeito"). Os maiores grupos:

| # | Lacuna (causa) | Nós/linhas | Prioridade | Dependência | Correção proposta | Teste necessário |
|---|---|---|---|---|---|---|
| R1 | **Keystones só de texto**: das 36, **8 fechadas no ciclo 2** (C4); restam 28 (ver C4, uma a uma) | 28 nós | alta | mecânicas próprias (ES protege a mana, recuperação limitada pela evasão…) | uma regra por keystone em `traducao-arvore.json` → `keystones` (o formato `poe` existe) e o gancho no combate. **Não** ligar só a vantagem: a Bateria Anciã já tem o "custo pago pelo escudo" (`escudoParaOCusto`), mas sem as duas desvantagens daria uma keystone só positiva | por keystone: o número com e sem, as duas metades |
| R2 | **Notáveis de ascendência quase todos sem efeito** (109 de 161; Guardião, Gladiador, Luminária com 0 funcionais) | 141 nós | alta | mecânicas de cada ascendência (cerca de 113 linhas "outros") | por ascendência, começando pelas sem nenhum efeito | por notável: o efeito no golpe/defesa |
| R3 | ~~"Pode Alocar Passivas do ponto inicial do X"~~ — **corrigido no ciclo 2 (C1)** | 6 nós | feito | o motor aceitar um 2º início alcançável (hoje: `alcancaveis` parte do início da classe e da ascendência) | o nó guarda `inicioExtra`; `podeAlocar`, `caminhoAte` e `ilhadosSemEles` passam a partir dos inícios extras alocados | alocar pelo início do Marauder com o Caminho do Marauder; tirar o Caminho ilha os nós de lá |
| R4 | **Maestrias parciais** (216 de 315: alguma opção sem efeito) | 1.106 linhas de opção sem efeito (pendentes ou inexistentes) | média | as mesmas mecânicas dos temas | por tema (afecções em você, precisão "mais", reflexo…) | por opção |
| R5 | **Afecções e controle em você** (limite, "enquanto tiver uma", empalar em você, resfriamento mínimo) | 209 linhas / 121 nós | média | contadores de afecção no jogador | novas condições de estado em `condicoesDe` e o limite em `dotNoJogador` | afecção recusada com outra ativa |
| R6 | **Lacaios** (área, recarga, penetração, buffs ao matar, resistências máximas) | 83 / 35 | média | o lacaio do jogo só tem dano, vida e velocidade | atributos de lacaio lidos em `lacaios-poe.mjs` | o número no lacaio |
| R7 | **Armadilhas e minas de verdade** | 80 / 30 | média | no jogo as gemas viram golpes comuns | sistema de armar/detonar (decisão de design) | — |
| R8 | **Marcas/Runas presas ao inimigo** (vínculo, convocação, alcance) | 70 / 30 | média | as Runas (Brands) são golpes comuns; a tag agora existe (L5) | o que for número (dano, crítico, duração) com `@runa`/`@marca`; o vínculo pede sistema | por linha |
| R9 | **Reflexo de dano dos monstros** ("Evita X% do dano refletido") | 36 / 26 | baixa | o jogo não reflete dano no personagem | só depois de existir reflexo | — |
| R10 | **Dreno com ritmo e teto** | 38 / 34 | baixa | o roubo do PoE tem instância e teto (existe); o que depende de "instantâneo" não | linhas de teto e taxa → `roubo_*_inc` (existe) | o teto por segundo |
| R11 | **Debuffs do PoE ausentes** (Crueldade, Esmagado, Sangue Corrompido) | 29 / 29 | baixa | os debuffs não existem | criar os estados no alvo/jogador | — |
| R12 | **Encaixes de joia** | 57 nós | média (depende do roteiro) | não há joias de árvore (Joias está no roteiro do dono) | o nó guarda a joia encaixada; a soma entra por `Afixos.soma` como as peças | joia encaixada soma; sair do nó tira a joia |
| R14 | **Guardiã desatualizada** (a da coleção 3.24/3.25 × a do poedb 3.29) | 22 × 15 nós | **decisão do dono** | trocar remove alocações | importar a Guardiã do poedb (posições `group`/`orbit`) e dar respec grátis a quem tinha | — |
| R15 | **30 notáveis de unção** (só por óleo no amuleto) | 30 nós | baixa | Óleos e Unção (roteiro) | o amuleto ungido concede o notável como se alocado | o notável vale com o amuleto vestido |
| R13 | **Arena x1 nivelada mantém a árvore inteira** (déficit temporário durante o duelo) | — | **decisão do dono** | design da arena | (a) aceitar; (b) a arena usar só os pontos do level dela | — |

---

## 4. Limitações e diferenças em relação ao PoE

**Funcionalidades ausentes**
- Mecânicas das 36 keystones só de texto (R1).
- A maior parte dos notáveis de ascendência (R2).
- O "Caminho do X" da Ascendente (R3).
- Joias de árvore (R12).
- Armadilhas e minas de verdade (R7).
- Marcas presas ao inimigo (R8).
- Reflexo de dano (R9).
- Debuffs do PoE (R11).

**Funcionalidades existentes com defeito (corrigidas neste ciclo):** L1–L7. Nenhum defeito conhecido ficou aberto no motor da árvore. O auditor
aloca 2.230 nós, soma e tira sem nenhuma falha.

**Diferenças intencionais de design do Draevor**
- Vida %, mana % e precisão % da árvore usam o formato das especializações (`stat: life/mana/accuracy`). Somam no mesmo % aditivo
  dos itens (`life_inc`, `mana_inc`, `accuracy_inc`), então o número é o do PoE. Mantido para não mexer na origem que a ficha mostra.
- Respec de graça e também na caçada no jogo oficial (dono, 09/10).
- Os pontos de ascendência vêm de 2 por boss de fim de ato, até 8 (dono, 05/10).
- Ficam fora da árvore (os inícios não alcançam): os 30 notáveis de joia de aglomerado/unção, como "Estaca de Vinhas Cordiais" e
  "Adore o Coração da Infestação", e as Linhagens (Bloodlines), que são a última etapa do roteiro.

**Dependem de sistemas inexistentes:** R6, R7, R8 (vínculo), R9, R11 e R12; ver a coluna "Dependência" da tabela 3.2.

**Dados que não puderam ser verificados**
- Os 110 nós não classificáveis: os 57 encaixes de joia e 53 nós sem linhas, como os pais de escolha da Caçadora de Relíquias e
  ascendências sem texto no poedb.
- As 455 linhas que o jogo declara inexistentes (`inerte`) foram aceitas pelo que dizem; cada uma traz o porquê no balão.
- A coleção de origem é a do Drive (posições e ligações), com os textos do poedb 3.29. Ligações que o poedb tenha e a coleção não
  só aparecem quando quebram o alcance, como aconteceu com as escolhas (L2).

---

## 5. Arquitetura (o fluxo do atributo, como está)

Não há um segundo sistema: a árvore entra na mesma soma dos itens.

1. **Base do personagem:** `R.statsBase` / a base do PoE (50/40 de vida/mana, +12/+6 por nível) e os atributos da classe.
2. **Nível e progressão:**
   - `Passivas.pontosDoLevel`: 1 ponto por level depois do 1º, mais os `pontos_passiva` concedidos;
   - `pontosDeAscendencia`: 2 por boss de ato, até 8.
3. **Equipamento e gemas:** `Afixos.somaDeItens`, com o `poe.af` de cada peça e as condições de anel, mais as gemas (`GemasPoe.adds`).
4. **Árvore:**
   - `Passivas.efeitos(estado)` com cache pela assinatura dos nós;
   - os `add` entram em `Afixos.soma` como as peças;
   - `stat`/`tag` entram em `Especializacoes.efeitos`;
   - keystones em `Keystones.aplicarNaFicha`.
5. **Buffs, cargas, frascos e altares:** `Afixos.soma`, nas linhas seguintes à árvore (cargas, frascos, buffs do PoE).
6. **Atributos finais** em `Ficha.combate`:
   - `comOsModsDoPoe` → `ModsPoe.resolver` dobra as condições de estado (`stat@cond`) e as escalas do personagem (`stat%escala`);
   - `porTag` guarda o que depende do golpe (`stat@ataque+corpo`), resolvido por acerto em `fichaDoGolpe`;
   - `eventosDa` guarda os eventos (`ev:matar:vidaPct`);
   - a segunda passada (`escalasDaFicha`) faz os "por X de armadura/bloqueio/ES no escudo".

**Conceitos tipados** (sem procurar palavras na descrição; cada linha do PoE vira, por regra, um destes):

| Conceito | Formato |
|---|---|
| Valor base | da peça (`base.armor`) ou da classe |
| Fixo | `add: str` |
| Aumento aditivo | `armour_pct`, `dmg_inc`, `life_inc` (somam no mesmo %) |
| Multiplicador independente | `mais_dano`, `life_more`; em `fichaDoGolpe` vira `fatorDasCargas` |
| Conversão | `phys_as_extra_*`, `recebe_*_como_*`, keystone `conversao` |
| Condição | `@cond` (estado do personagem, `CONDICOES_DE_ESTADO`) e `@tag` (golpe/alvo, `TAGS_DE_GOLPE`) |
| Escala | `%escala` ("por X") |
| Evento | `ev:<evento>:<ação>:<param>` |
| Regras que mudam o jogo | keystones `regra: poe` e `temHabilidade` |

O que não se interpreta com segurança fica **registrado** (pendente), com o texto e a chave automática, e nada é descartado
(`traduzirLinha` → `registrados`).

**O servidor é a autoridade.** O cliente só pede (`{t:'passivas', action, id/ids/opcao}`). `ComandosDasPassivas.comando` valida nó a nó
(existência, posse, ligação, level, pontos, maestria, escolha, ascendência) e, ao tirar, ilhamento e pontos negativos. A ficha é refeita
no servidor (`depoisDeMudar`). O cliente só soma os efeitos dos nós para exibir "o que a árvore dá" e não aplica nada ao jogo.

**Persistência.** `estado.passivas` (alocados, maestrias, ascendência, por árvore) vai inteiro no JSON do personagem: autosave a cada 30 s
(`gravarAgora`) e ao sair (`soltarPersonagem`). `garantir` limpa nós que sumiram e reconecta na troca de versão.

---

## 6. Correções implementadas (ciclo 1) e arquivos

| Correção | Arquivos |
|---|---|
| Auditor por nó (dados, conexão, alocação, cálculo, remoção) e inventário | `game/admin/auditoria-arvore-passivas.mjs` (novo), `game/tools/auditar-arvore-passivas.mjs` (novo), `docs/auditorias/arvore-passivas-poe-inventario.md` (gerado) |
| L1 regras da árvore → modificador tipado | `game/gamedata/itens-poe/traducao-arvore.json`, `game/gamedata/itens-poe/arvore-poe.json` (remontada) |
| L2 nós de escolha | `game/tools/montar-arvore-poe.mjs`, `game/systems/itens-poe/arvore.mjs` (`converterAscendencias`), `game/systems/passivas/arvore.mjs` (`validar`, `podeAlocar`, `arvoreParaCliente`) |
| L3 morte sem perder level (PoE) e déficit | `game/systems/morte.mjs`, `game/systems/passivas/arvore.mjs` (`pontos`), `game/frontend/client/src/passivas.mjs` |
| L4 respec sem pontos negativos | `game/systems/passivas/arvore.mjs` (`pontosSe`, `planoDeRespec`) |
| L5 tags das gemas | `game/systems/itens-poe/condicoes-poe.mjs` (`TAG_DO_POE`) |
| L6/L7 eventos de frasco e carga no crítico | `game/systems/itens-poe/mods-poe.mjs` (`eventosDoFrasco`, ação `frascoChance`), `game/systems/itens-poe/condicoes-poe.mjs` (`ACOES`), `game/websocket/sessao.mjs`, `game/gamedata/itens-poe/traducao.json`, `game/gamedata/itens-poe/atributos-novos.json` |
| L8 testes | `game/testes/passivas-poe.test.mjs` (novo, 24 testes); `game/testes/morte.test.mjs` (o teste do Tibia passa a ser do clássico — B — e entra o do PoE); `game/testes/itens-poe-arvore.test.mjs` (a asserção do formato `tag` passa ao tipado — C, a regra mudou por causa do defeito L1) |

**Prioridades.** Segui a ordem pedida, com uma troca. L1 (modificadores exibidos sem efeito, prioridade 2) entrou antes da metade de
L3 que é de pontos. O motivo é o tamanho: 53 nós no caminho de qualquer personagem de ataque. As correções de alocação e pontos (L2, L3,
L4) vieram em seguida, no mesmo ciclo.

---

### Arquivos do ciclo 2

| Correção | Arquivos |
|---|---|
| C1 inícios extras ("Caminho do X") | `game/systems/passivas/arvore.mjs` (`iniciosExtras`, `podeAlocar`, `caminhoAte`, `ilhadosSemEles`, `garantir`, `vista`); `game/frontend/client/src/passivas.mjs` (caminho, ilhados e disponível com os inícios extras; a opção de escolha bloqueada quando a irmã foi escolhida); `game/gamedata/itens-poe/traducao-arvore.json` |
| C2 escada e cobertura | `game/admin/auditoria-arvore-passivas.mjs` (`retrato`, `CENARIOS`, `cobertoPorTeste`, `NIVEIS`); `game/tools/auditar-arvore-passivas.mjs` (+ o `.json`); `game/testes/cobertura-arvore.mjs` (novo); `game/testes/passivas-poe-cobertura.test.mjs` (novo) |
| C3 legado, bloqueio e dreno | `game/testes/passivas-poe.test.mjs` (dreno de ataques, bloqueio com escudo) |
| C4 keystones | `game/systems/personagem/atributos.mjs` (`efeitos(p, af)`); `game/systems/ficha.mjs` (`forcaNoGolpe`, `regenDoPoe`, `aplicarLeech`, `recuperarRoubo`); `game/systems/personagem/defesa.mjs` (`absorver`, `recarregar`); `game/systems/itens-poe/condicoes-poe.mjs` (o `tique` com `esDaVida`); `game/systems/acoes.mjs`, `game/systems/hunt/combate.mjs`, `game/systems/personagem/ficha-poe.mjs` (a Força pela `forcaNoGolpe`); `game/gamedata/itens-poe/traducao.json` (15 regras); `game/gamedata/itens-poe/atributos-novos.json` (13 atributos); `game/testes/passivas-poe-keystones.test.mjs` (novo) |

## 7. Testes executados (resultados reais)

- `testes/passivas-poe.test.mjs`: **24 de 24 passam**, incluindo o invariante do auditor (2.230 nós alocados, 0 falhas, ~14 s).
- Os testes ligados às mudanças: passivas, respec, arvore, itens-poe-arvore(-poedb), frascos, mods(-abas), itens-poe, gemas, morte
  (oficial e clássico) e itens-poe-combate. Resultado: 214 testes, 172 passam, 41 pulados (marcados B/C para o clássico) e 1 falha.
  A falha era a asserção do formato antigo em `itens-poe-arvore.test.mjs`, classe C, adaptada (ver seção 6) e passando.
- Suíte SYSTEM (`node tools/testes/testar.mjs system --desde=origin/main`): resultado no fim deste ciclo, na seção 9. A FULL está bloqueada nesta
  máquina, porque ela hospeda o servidor do jogo.

---

## 8. Próxima prioridade recomendada

1. **R3, o "Caminho do X" da Ascendente.** É regra de alocação, prioridade 1, e mexe no motor (inícios extras).
2. **R1, keystones**, uma por vez e sempre com as duas metades:
   - Bateria Anciã: a metade do custo já existe (`escudoParaOCusto`); faltam "o escudo protege a mana em vez da vida" e "50% menos recarga".
   - Juramento do Zelote: a regeneração de ES existe (`condicoes-poe.tique`), mas falta redirecionar a regeneração de vida.
   - Acrobacia: a supressão existe, mas não a esquiva de magia.
3. **R2, notáveis de ascendência**, começando pelas sem nenhum efeito: Guardião, Gladiador e Luminária.
4. **R4/R5**: as opções de maestria pendentes por tema.

## 9. Suíte geral (SYSTEM — `node tools/testes/testar.mjs system --desde=origin/main`; a FULL está bloqueada nesta máquina)

| Ciclo | Arquivos | Testes | Passaram | Falharam | Pulados (B/C do clássico) |
|---|---:|---:|---:|---:|---:|
| fim do ciclo 1 | 308 | 3.164 | 2.584 | **0** | 578 |
| fim do ciclo 2 | 310 | 3.208 | 2.628 | **0** | 578 |
| fim do ciclo de dependências | 313 | 3.242 | 2.662 | **0** | 578 |

Sem falhas preexistentes no escopo do SYSTEM. Dois testes antigos foram adaptados, e só porque a regra mudou de propósito (ver a seção 6):
- `morte.test.mjs`, classe B: a regra do Tibia continua testada no clássico;
- `itens-poe-arvore.test.mjs`, classe C: o formato `tag` era o defeito L1.
