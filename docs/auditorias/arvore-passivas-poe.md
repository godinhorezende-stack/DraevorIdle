# Auditoria da árvore de passivas do PoE no Draevor

Página auditada: `http://localhost:8099/editor/conteudo#poe-arvore-poedb` (Engine › Árvore × PoEDB) e a árvore em uso no jogo com `ITENS_POE=1`.
Ciclos 1, 2, 3 (maldições e dreno instantâneo) 4 (totens, dano excedente, monstros à prova e amaldiçoados, maldições em você) 5 (afecções em você) e 6 (afecções do personagem nos monstros) — 09/10/2026; **ciclo 7 (tudo o que não funcionava — 11/10/2026, seção 3.1g)**; **os "não se aplica" que passaram a valer — fáceis e médias (11/10/2026, seção 3.1h)**. Inventário verificável (gerado, rastreável por id):
- [`arvore-passivas-poe-inventario.md`](arvore-passivas-poe-inventario.md);
- [`arvore-passivas-poe-inventario.json`](arvore-passivas-poe-inventario.json).

---

## 1. Resumo executivo

| | Antes (commit `de2be187`) | Ciclo 1 | Ciclo 2 | Ciclo 3 | Ciclo 4 | Ciclo 5 | Ciclo 6 | Ciclo 7 | **Não se aplica (11/10)** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Nós analisados (principal + maestrias + ascendências) | 2.810 | 2.810 | 2.810 | 2.810 | 2.810 | 2.810 | 2.810 | 2.810 | 2.810 |
| Auditáveis (sem os 28 inícios) | 2.782 | 2.782 | 2.782 | 2.782 | 2.782 | 2.782 | 2.782 | 2.782 | 2.782 |
| **Funcionais** (todas as linhas com efeito real, verificado) | 1.622 (58,3%) | 1.693 (60,9%) | 1.712 (61,5%) | 1.728 (62,1%) | 1.730 (62,2%) | 1.734 (62,3%) | 1.753 (63,0%) | **2.124 (76,3%)** | **2.187 (78,6%)** |
| Funcionais com aproximação | 158 (5,7%) | 141 (5,1%) | 141 (5,1%) | 147 (5,3%) | 147 (5,3%) | 147 (5,3%) | 148 (5,3%) | 165 (5,9%) | 207 (7,4%) |
| **Parciais** (parte das linhas com efeito) | 430 (15,5%) | 407 (14,6%) | 400 (14,4%) | 395 (14,2%) | 401 (14,4%) | 403 (14,5%) | 406 (14,6%) | **265 (9,5%)** | **181 (6,5%)** |
| **Sem efeito real** | 462 (16,6%) | 431 (15,5%) | 419 (15,1%) | 402 (14,5%) | 394 (14,2%) | 388 (13,9%) | 365 (13,1%) | **118 (4,2%)** | **97 (3,5%)** |
| Não classificáveis (sem linhas: 57 encaixes de joia, 53 outros) | 110 | 110 | 110 | 110 | 110 | 110 | 110 | 110 | 110 |
| Falhas no motor (alocar → somar → tirar), em todos os nós | 5 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | **0** |
| Efeitos traduzidos que nada no código lê | 84 em 5 causas | 0 | 0 | 0 | 0 | 0 | 0 | **0** | **0** |
| **Cobertura funcional** (funcionais + aproximados) | 64,0% | 65,9% | 66,6% | 67,4% | 67,5% | 67,6% | 68,3% | **82,3%** | **86,1%** |

Linhas, no ciclo 1: 4.075 com efeito real, 1.515 pendentes, 455 que o jogo marca como inexistentes (com o porquê) e 756 lembretes do PoE.

**Linhas no ciclo 7** (a árvore inteira, cada opção de maestria conta; `arvore-poe.json`):

| | Antes do ciclo 7 | Depois do ciclo 7 | **Depois dos "não se aplica" (11/10)** |
|---|---:|---:|---:|
| Com efeito no jogo (igual, aproximado ou atributo novo) | 4.381 | **5.386** (+1.005) | **5.540** (+154) |
| Sem regra (registradas, sem efeito) | 1.220 | **115** | 115 |
| Inertes: falta mecânica, gema ou item no jogo | 444 | **245** | 244 |
| Inertes: dependem de ligar mecânicas de MONSTRO (reflexo, Cegueira, Sangue Corrompido, Mutilar e Empalar em você) — **decisão do dono** | — | **75** | 75 |
| Inertes: **não se aplicam ao jogo** (luz, mercenários, baús, alcance em décimos de metro, posicionamento…) — não há o que fazer funcionar | — | **215** | **62** |
| **Não funcionam (soma)** | **1.664** | **650** (dos quais 215 não se aplicam) | **496** (dos quais 62 não se aplicam) |
| Lembretes / textos explicativos | 756 | 765 | 765 |

Cada linha que não funciona agora diz o PORQUÊ (a nota da regra) no balão da árvore do jogo e no painel da Engine (seção 3.1g).

### A escada de cobertura (ciclo 6; entre parênteses, o ciclo 2)

Cada nó fica no último degrau que alcança sem pular nenhum. Lista por id no inventário.

| Degrau | O que prova | Nós |
|---|---|---:|
| Apenas exibido | está nos dados e no editor, mas o motor não o aloca | 0 |
| Alocável | o servidor aloca e tira (caminho, pontos, regras), mas nenhuma linha tem efeito | 475 (529) |
| Interpretado | a linha vira modificador tipado com leitor no código, mas o efeito não foi visto | 10 (19) (condições que o cenário automático não monta: "drenando", "cadáver consumido"…) |
| Aplicado (sem teste numérico ainda) | a ficha efetiva muda ao alocar ou o combate lê o valor no acerto/tique | 1.081 (1.065) |
| **Validado por teste** | cada efeito do nó tem teste numérico de integração (`testes/cobertura-arvore.mjs` e os arquivos citados lá) | **1.216** (1.169) |

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
| **Pacto Vaal** (ciclo 3) | o dreno de vida do golpe corpo a corpo entra na hora, fora do teto por segundo; a vida só se recupera pelo dreno (regeneração, vida por acerto/abate, "Recupera X% de Vida", frasco de vida, cura de magia e recarga na vida não enchem) | `ficha.aplicarLeech` (tags do golpe); `condicoes-poe.vidaSoPeloDreno` em `regenDoPoe`, `curar`, `mods-poe`, `frascos`, `defesa`, `condicoes-poe.tique`, `acoes` (cura) |
| **Mestre dos Feitiços** (ciclo 3) | as maldições Feitiço (Hex) ficam no monstro sem expirar; 20% menos efeito das maldições | `acoes.efeitosDaMaldicao` → `Reforcos.marcar` |

As outras 26 keystones de texto, uma a uma: o que falta e se dá para fechar com o que o jogo tem.

| Keystone | Situação | O que falta (dependência) |
|---|---|---|
| Inoculação do Caos | sem efeito | vida 1 é simples (`sincronizarMaximos`), mas a imunidade a caos tem de cobrir golpes, magias e dano contínuo. Pela metade, com vida 1, mataria o personagem — não implementada |
| Dançarino do Vento | sem efeito | o dano recebido precisa saber se o golpe do monstro é ataque; "mais evasão" condicional |
| Dança da Flecha | sem efeito | o golpe do monstro precisa saber se é projétil ou corpo a corpo |
| Guarda Desequilibrada | sem efeito | a mitigação da armadura do jogador com "defender com X%" e o teto de redução por tipo |
| Acrobacia | sem efeito | esquiva de acertos mágicos (um sorteio a mais em `poderes.mjs`) e o teto de 75% |
| Combatente Versátil | sem efeito | os tetos de bloqueio −10 e o bloqueio mágico pelo excedente (os tetos existem em `bloqueioFinal`) |
| O Agnóstico | sem efeito | tirar o escudo existe (`sem_escudo`); falta o "sacrifica 20% da mana por segundo para recuperar vida" no tique |
| Sombra Fluvial | sem efeito | o dano contínuo em você precisa saber quando começou; 100% mais duração das afecções em você (existe o atributo) |
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

### 3.1c Corrigidas no ciclo 3 (maldições e dreno instantâneo)

**M1. A maldição do PoE amaldiçoa o monstro com as regras do PoE** (`skills/reforcos.mjs` — `marcar`, `maldicoesAtivas`, `vulnerabilidade`, `forcaDoBicho`):
- a gema de maldição grava a maldição no monstro (`bicho.maldicoes[<gema>]`: os efeitos, a duração, quando começou, quando foi lançada);
- **limite de 1 maldição** (+ "Você pode aplicar uma Maldição adicional"): vale a lançada por último; a Marca tem o limite próprio, à parte;
- a maldição ativa **não renova a cada acerto** (corre a duração; vencida, o próximo acerto amaldiçoa de novo) — senão a "Duração" e o "expirou X%" não valeriam num jogo idle;
- "Efeito aumentado se Y% da Duração expirou", "Desacelerados" (o passo do monstro, `hunt/monstros.moverMonstros`), "Recupera X% de Vida/Mana quando você Amaldiçoar um Inimigo sem Maldições" (evento novo `amaldicoarSemMaldicao`, disparado pelo golpe básico e pelas gemas), "Dano Extra dos Críticos de Inimigos Amaldiçoados reduzido" (`criticoDoBicho`), "Remove Afecções Elementais ao Conjurar uma Maldição", "+2 ao Nível das Gemas de Maldição" (a árvore no nível da gema — `skills/gemas.extrasDaGemaPoe`);
- **defeito corrigido:** as regras "@alvoAmaldicoado" (10 linhas: "Recupera X% de Vida ao Matar um Inimigo Amaldiçoado", dreno contra amaldiçoados…) nunca viam a maldição posta pela gema — só o dano contínuo "maldição" dos monstros. Agora `tagsDoAlvo` lê `bicho.maldicoes`.

**M2. O dreno do PoE completo** (`ficha.aplicarLeech`, `recuperarRoubo`, `tetoDoRouboPct`):
- **a parte instantânea** ("X% do Dreno é Instantâneo", "por Garra Equipada", "empunhando uma Garra", Pacto Vaal no corpo a corpo): entra na hora, fora do teto por segundo; o resto vira a instância de sempre;
- **o teto por recurso** (vida, mana, escudo) e o geral; a tela de personagem mostra o mesmo número (`tetoDoRouboPct`);
- **o recurso cheio encerra o dreno** (como no PoE), medido na parte **livre** (a vida/mana não reservada); "não são removidos quando… Cheia" (vida e escudo) e o Recoup "se o Dreno foi removido Preenchendo a Vida Não Reservada" (condição nova `drenoRemovidoCheio`);
- o dreno de escudo nos ataques (`es_leech`), o dreno de vida das magias com Fúria Arcana (`vida_leech_magia`), e "enquanto no máximo de Fúria" (condição nova `furiaCheia`);
- **defeitos corrigidos:** (a) "X% do Dreno é Instantâneo" (9 linhas) era inerte com a nota "o dreno do jogo já é instantâneo" — falso desde 07/10; (b) 18 linhas de teto ("Vida, Mana ou Escudo de Energia") eram inertes com "o dreno do jogo não tem teto" — falso; (c) a regra genérica de "Reserva" engolia como inertes as linhas de dreno com "Vida Não Reservada" (11 linhas); (d) o teto "do Dreno de Vida" e o "de Mana" subiam o teto de TODOS os recursos — agora cada um sobe o seu.

**M3. Pacto Vaal e Mestre dos Feitiços** com as duas metades (C4).

Teste: `testes/passivas-poe-maldicoes-dreno.test.mjs` (13 testes, todos com o nó real; um deles numa caçada de verdade). Cada mecânica foi conferida por mutação: desligada, o teste dela falha.

### 3.1d Corrigidas no ciclo 4 (totens, dano excedente, monstros à prova e amaldiçoados, maldições em você)

- **O dreno dos totens para você** (6 opções da Maestria de Totens): o golpe FÍSICO de um totem de ATAQUE drena para o dono com as regras do dreno do PoE (`cacadas.golpeDoTotem` → `Ficha.drenarPoe`); o totem de magia, não.
- **O dano excedente** (o Apetite Insaciável do Carrasco): o acerto que mata drena o que passou da vida que restava (`mods-poe.aoAcertar`, o ponto único do golpe básico e das gemas).
- **Monstros à prova de maldições:** os mods do PoE "Infeitiçável" e "Feiticeiro" (Hexproof) — eram só registrados — passam a valer: o Feitiço não pega, a Marca pega; a Ocultista ("Seus Feitiços podem afetar Inimigos a Prova de Maldições") passa. "Reflete Feitiços" devolve o Feitiço para você.
- **O escudo de energia do monstro de verdade:** os mods "Ganhe 40% de Vida Máxima como Escudo de Energia" eram +40% de vida; agora o escudo fica por cima da vida, sai primeiro e recarrega 20%/s depois de 2 s sem dano (÷ "Início da Recarga mais rápido"), como no PoE (`skills/estados.tique`). Com isso, "Inimigos Amaldiçoados por você não podem Recuperar Escudo de Energia" e "têm Regeneração de Vida reduzida" (Últimos Ritos) têm onde agir.
- **Decisão do dono (09/10): o escudo do monstro é o do PoE puro.** Consequência medida: quem depende do golpe básico e não vence a recarga (o mod "Início da Recarga 150% mais rápido" recarrega 0,8 s depois do dano — cerca de 10% da barra do monstro por golpe de 2 s) fica preso nesse monstro e o mapa não limpa. Skills de gema mais rápidas, lacaios e dano contínuo interrompem a recarga. **Lacuna antiga achada aqui:** no modo PoE, o golpe básico ataca a cada 2 s para todo mundo — a velocidade de ataque da arma do PoE não entra no intervalo (`ficha.intervaloDoGolpeMs` só lê o APS das armas do Draevor).
- **Defeito corrigido no caminho:** a sobra fracionária da recarga do escudo se acumulava com o escudo quase cheio (339 pontos num escudo de 135, medido), e a recarga seguinte saía inteira de uma vez.
- **"Inimigos Amaldiçoados Mortos por você são destruídos":** sem cadáver (o Erguer Espectro não os ergue).
- **Maldições dos monstros em você:** o mod do PoE "Amaldiçoa" (era só registrado) amaldiçoa quem o monstro acerta (Fraqueza Elemental, Vulnerabilidade ou Enfraquecer, por 6 s), com "Imune a Maldições" e "Efeito das Maldições em você". "Suas Resistências Elementais não podem ser reduzidas por Maldições" deixou de ser inerte: segura a Fraqueza Elemental e a Inflamabilidade refletida.
- **Defeito corrigido — resistência negativa:** no modo PoE, toda resistência negativa vinda de atributos (os "−X% de Resistência a Fogo" das peças, as maldições) era cortada em 0 pelo limite do Draevor antes da conta do PoE. Agora fica negativa, como no PoE (até −200%), e o dano daquele elemento aumenta.

Teste: `testes/passivas-poe-maldicoes-dreno.test.mjs` (22 testes no arquivo, 8 deste ciclo). Cada mecânica foi conferida por mutação.

### 3.1e Corrigidas no ciclo 5 (afecções em você)

- **"Afecções Danificadoras/Não Danificadoras Não Podem ser infligidas em você enquanto você já tiver uma"** (a Maestria de Proteção): o Incêndio, o Sangramento e o Veneno de um lado; a Eletrização, o Resfriamento e o Congelamento (o do controle conta) do outro (`mods-poe.dotNoJogador`, `condicoes-poe.controleNoJogador`).
- **"Efeito do Resfriamento e Eletrização em você reduzido"**, **"X% mais Duração de Afecções em você"** e **"Sofre 50% menos Dano Degenerativo se você começou a sofrer Dano Degenerativo no último segundo"** — a Sombra Fluvial passa a ter as duas linhas.
- **"Inimigos Sangrando não infligem Sangramento em você"**, **"Inimigos Incendiados não podem te Incendiar"** (Cauterização): o monstro que bate com a afecção não a passa.
- **"Dano Mágico Suprimido não pode infligir Afecções Elementais em você"**: a supressão passou a ser sorteada antes das afecções da magia (`poderes.dispararMagia`), e a magia suprimida não incendeia, não eletriza e não congela/resfria (`Controle.tentar`).
- **O Campeão** ("Primeiro a Bater, Último a Cair"): Adrenalina ao atingir Vida Baixa, 25% de vida ao ganhar Adrenalina (evento novo `ganharAdrenalina`) e as afecções removidas ao ganhar Adrenalina.
- **"Você é Inafetado por Sangramento enquanto Drenando"** (o Carrasco): o sangramento corre em você, mas não fere.
- **Inertes, com o porquê:** "Não pode ser Empalado" e "Evitar ser Empalado" (os monstros do jogo não empalam); "Golpes Críticos contra você não infligem Afecções Elementais de forma Inerente" (o crítico dos monstros não põe afecção por si no jogo).
- **Ainda pendentes no tema, por depender de mecânica que não existe:** o sangramento que dói mais em movimento (nem em você, nem nos monstros), as afecções do personagem nos monstros (empalamento, eletrização máxima/espalhada, sangramento agravado, "permanentemente Dano aumentado por segundo Congelado").

Teste: `testes/passivas-poe-afeccoes-em-voce.test.mjs` (7 testes, nós reais; conferido por mutação).

### 3.1f Corrigidas no ciclo 6 (as afecções do personagem nos monstros)

Afecções e controle: de 413 para 541 linhas com efeito (88%); pendentes de 169 para 31.

- **Eletrização** (`itens-poe/afeccoes.aoAcertar`, `mods-poe.aoPorAfeccoes`): o máximo a mais e o fixo ("Efeito Máximo … é igual a X%"), o mínimo, a parte da Mana máxima aumentada, "até N Eletrizações em cada Inimigo" (somam — o Warden), o espalhar para os vizinhos, "sempre Eletrizam" e "Todo Dano pode Eletrizar".
- **Resfriamento e Congelamento** (`afeccoes`, `skills/estados`): o mínimo e o máximo do Resfriamento, "reduz o Dano causado pela metade do Efeito" (`doBicho`), "continuam Congelados por ao menos N segundos", "Resfriados ao Descongelarem", "Todo o Dano com Maças e Cetros infligem Resfriamento" e o **dano permanente** por segundo Congelado/Resfriado (`fatorRecebidoPeloBicho`).
- **Empalamento** (`mods-poe.aoAcertar`): o efeito em não Empalados, a duração, os acertos a mais, "durarem por um Acerto adicional", "remover todos os Empalamentos" e **O Empalador** (espalha, +5, a espera). **Mudança de regra:** o empalamento solto passa pela Redução de Dano Físico do monstro (a resistência física e a redução de dano), como no PoE — antes passava inteiro —, e "ignoram a Redução de Dano Físico" a tira.
- **Veneno**: em não-Envenenados, em Sangrando, os do crítico, "Envenenados por você não podem causar Golpes Críticos" e "X% mais Dano contra Inimigos Afetados por ao menos N Venenos" (condição nova `alvoVenenos:N`).
- **Sangramento**: por Empalamento, por Carga de Tolerância, a **Dança Carmesim** (até 8, 50% menos) e "Inimigos com Sangramento Explodem".
- **O crítico nas afecções**: o efeito das não-Danificadoras, os multiplicadores, e a **Agonia Perfeita** completa (o multiplicador degenerativo é o de crítico; o crítico não dá dano extra — a linha não tinha regra —; sem crítico não há afecção). A Agonia vinda de peça deixou de ser "+30% de multiplicador".
- **Resistências a menos** (Incendiados/Resfriados: elementais; Envenenados: caos — `hunt/resistencia.resistenciaDe`), "Eletrizados ou Congelados por você sofrem Dano Elemental aumentado", o **Coberto de Gelo** (estado novo) e de Cinzas ao Congelar/Incendiar, "Recupera X% de Vida ao Incendiar um Inimigo não Incendiado" (evento novo `incendiarNovo`).
- **Inertes, com o porquê:** os dois "sem Dano extra em movimento" (o sangramento do jogo não dói mais em movimento) e "Feixes de Vínculo" (não existem).
- **Ainda pendentes (31):** o sangramento agravado e em movimento (pede a mecânica do movimento, uma decisão de balanceamento), "Dano de Raio … Azarado" em você, os projéteis (atravessados, ricochetes, distância), o tempo na Presença, o Liberto (Elementalista), a Geada, o físico convertido em fogo dos incendiados e as auras de Congelar/Resfriar em volta.

Teste: `testes/passivas-poe-afeccoes-nos-monstros.test.mjs` (11 testes, nós reais; 31 mecânicas conferidas por mutação).

### 3.1g Corrigidas no ciclo 7 (tudo o que não funcionava — 11/10/2026)

Pedido do dono: "faça a inspeção de tudo na árvore de habilidades que não está funcionando … tente resolver tudo … ficando próximo de 0 não
funcionando". Levantamento por modelo de linha (números → #), agrupado por família, e oito lotes. Linhas que não funcionavam: **1.664 → 650**
(e 215 das 650 não se aplicam ao jogo). Regras novas: 458 (no topo de `traducao.json`, marcadas `_ciclo7`); atributos novos: 137 (548 → 685 em `atributos-novos.json`).

- **Lote A — Retaliação** (as 7 gemas são golpes comuns no jogo): dano, velocidade, recarga, área, afecções, Debilitar, armadura por gema
  diferente usada (`distintas:retaliacao:N`), atordoamento, Fúria, bloqueio "se usou uma Retaliação Recentemente" (`usouTag:<tag>`). Ganho de
  quebra: `atk_speed@<tag>` (ex.: `@movimento`) nunca entrava no tempo da gema; agora entra (`acoes.temposDaGemaPoe`). O Debilitar contava
  19% (Debilitado + Exaurido); agora 10%, como no PoE.
- **Lote B — Lacaios e totens** (`lacaios-poe.mjs`, o tique dos lacaios em `cacadas`): crítico, área, recarga, bloqueio mágico, redução física,
  escudo da vida, máximo das resistências, recuperação, vida na morte de outro lacaio e ao bloquear, dano dobrado, ignorar redução física,
  penetração nos amaldiçoados, dreno para o dono, Poder Profano e Agressividade ao matar, a explosão em vida baixa, golens imunes a elemental,
  Arqueiros Ilusórios e Balistas, totens (provocar ao invocar, dois por uso, por totem invocado), "dano/velocidade de lacaio também te afetam".
- **Lote C — Marcas e Precisão**: o efeito da Marca, transferir ao matar, sem regeneração/sem crítico/precisão e dano no Marcado, Cegar os
  vizinhos, Frenesi ao acertar o Marcado, "X% mais Precisão" contra o Marcado/Único/de perto (`personagem/defesa.precisaoMaisContra`),
  Runas e Vínculo (velocidade, duração, efeito do buff). Os vínculos presos ao inimigo/aliado ficam inertes, com o porquê.
- **Lote D — Fortificação, Atordoamento, Cegueira, Esmagar, Provocar**: a **Fortificação** (estado novo: 1% menos dano de acertos por
  Fortificação, até 20 + o máximo, 6 s; o Acerto Fortificante dá 1 por 1% da vida do alvo tirada) e as 20 linhas dela; **ser atordoado**
  (`combate/controle.tentar` → `mods-poe.aoSerAtordoado`: regeneração, Adrenalina pela duração, vida do golpe, atordoar os vizinhos, só-físico,
  escudo no Ponto de Atordoamento); o golpe ganha as tags do que **fez** (`critico`, `golpeAtordoou`: Golpe de Misericórdia, duração do
  atordoamento); Esmagado (−15% de redução física), duração da Cegueira e da Provocação, provocados não evadem, mão principal/secundária.
- **Lote E — o que liga em mecânica que já existia**: teto do bloqueio, bloqueio Sortudo, cadáveres (`hunt.cadaveres`: consumir a cada N s),
  Exposição mínima/extra, resistência invertida, Físico como elemento aleatório com chance, Caos que passa pelo escudo, Raio Azarado, cargas
  de frasco do morto com afecção, eficiência de custo por tag, encaixes da arma, regeneração dos inimigos próximos, magias usadas
  recentemente (`usos:<tag>`), Totem que leva parte do golpe, Minas (no jogo detonam no alvo: o "Dano sofrido/causado" acumula no alvo).
- **Lote F — dano, velocidade, Fúria, recursos, frascos, projéteis**: bônus por tempo dos eventos (`ev:<evento>:stat:<atributo>:<s>`), teto
  das escalas (`~<máximo>`), projéteis pela distância ao alvo, auras nos inimigos próximos (resistência, dano elemental, velocidade de ação),
  resistências que seguem a de Fogo, Supressão (Sortuda, impedir mais, por acerto suprimido), Poder do Clamor, crítico Sortudo, evasão "mais",
  dano Azarado dos inimigos, Fúria (efeito, perda), Fúria Arcana, Vento Favorável, aljava, regeneração da defesa, remover afecções.
- **Lote G — quatro mecânicas que as gemas já tinham pela metade**: o **Solo Sagrado** (6% da vida por segundo — o poedb: 360 por minuto;
  criar ao acertar/ficar parado, efeito, precisão, perdurar, inimigos sobre ele sofrem mais), a **Postura** (Sangue por padrão, Areia com a gema
  Sangue e Areia; mudar de postura), o **Valor** dos Estandartes (o lembrete do PoE: +1 por abate ou acerto corpo a corpo em Raro/Único, a
  cada 0,5 s, até 50; no jogo reforça a aura do Estandarte em 1% por Valor — aproximado) e o **Impelir** dos Clamores (a gema diz quantos).
  Bug corrigido: a condição "enquanto Elusivo" nunca valia, mesmo com o buff.
- **Lote H — keystones e o resto**: Inoculação do Caos (vida 1, imune a Caos e Veneno), O Agnóstico (sem Escudo de Energia + mana pela vida),
  Mente sobre Matéria ("X% do dano removido da Mana antes da Vida"), Mortalhas Fantasmas, penetração de Caos. Correção: a penetração
  **elemental** valia também no Caos (o Caos não é elemental no PoE).
- **Keystones inteiras** (a regra da R1: nunca só a vantagem ou só a desvantagem): completadas a Geada Cortante (os Resfriados sofrem mais
  Gelo pelo efeito do Resfriamento), o Combatente Versátil (o excedente do bloqueio de ataques vira bloqueio mágico), a Guarda Desequilibrada
  (o teto de 50% na redução física) e o Escudo Divino (o Físico negado vira Escudo por segundo). Ficam **inertes inteiras**, com o porquê, a
  Tempestade Turbulenta, a Chama Voraz e a Dança da Flecha (falta a parte boa delas). **Antigas, para decidir:** o Vínculo Ancestral tem só
  a vantagem (+1 Totem; "não pode causar Dano com Habilidades por si só" ainda não age) e o Mesclador de Runas só a desvantagem (−1 Totem; a
  Marca adicional Vinculada não existe no jogo).
- **O porquê de cada linha**: `arvore-poe.json` guarda `notas` (a nota da regra) por linha; o balão da árvore do jogo mostra a nota embaixo da
  linha, com a marca "–" para o que **não se aplica ao jogo**; a Engine mostra o estado `inerte` (antes não aparecia nem colorria o nó) e o
  `naoSeAplica`, com a nota, e a cobertura conta à parte o que não se aplica.

Testes novos (nós reais da árvore, o número medido onde a linha age): `passivas-poe-retaliacao-lacaios-marcas` (7),
`passivas-poe-fortificacao-atordoamento` (9), `passivas-poe-bloqueio-cadaveres-minas` (7), `passivas-poe-tempo-distancia-auras` (7),
`passivas-poe-solo-postura-estandarte` (4), `passivas-poe-inoculacao-mortalha` (3) — 37 testes.

**O que ficou (650 linhas), pelo porquê:**

| Porquê | Linhas | O que precisa |
|---|---:|---|
| Não se aplica ao jogo (luz e campo de visão, mercenários, baús, alcance em décimos de metro, aura sem área/duração, Estandarte plantado, sangramento em movimento/agravado, projétil sem trajetória, janela da Retaliação, posicionamento) | 215 | nada — a mecânica do PoE não tem o que mudar no jogo |
| **Mecânicas de monstro desligadas** (reflexo de dano, Cegueira, Sangue Corrompido, Mutilar e Empalar em você, Exposição em você) | 75 | **decisão do dono**: ligar os modificadores de monstro/mapa que já estão no catálogo (mexe na dificuldade) |
| Sem regra ainda (1 ou 2 linhas cada, quase todas de ascendências novas: Desafio, Força dos Ventos, Casca, Chama Santificada, Fanatismo, Convergência, frascos consumidos) | 115 | uma mecânica pequena por ascendência |
| Tinturas (a classe de item não existe) | 58 | criar a Tintura (item novo) — **decisão do dono** |
| Runas e Vínculos presos ao alvo | 51 | sistema de prender/ligar (design) |
| Armadilha e Mina plantadas (limite, duração, detonar ao mover) | 34 | no jogo elas disparam na hora — mudar só com sistema de armar (R7) |
| Convocar o Aço (Call of Steel) | 20 | a habilidade concedida pelas gemas de Aço |
| Suportes que ainda não agem (Crueldade, Impiedade, Lâmina Noturna, Selos do Libertar, a reserva do Feiticeiro) | 38 | o efeito no motor de suportes |
| Outros (Intensidade, Portador da Praga, Égides, gemas que não estão no jogo) | 40 | gemas/mecânicas próprias |

### 3.1h Os "não se aplica" que passaram a valer — fáceis e médias (11/10/2026)

O dono pediu (11/10: "como eu faço para esses 215 aplicarem no game?" → "faça os fáceis, depois os médios"): o jogo ganhou a mecânica que
faltava e a linha passou a valer. **215 → 62** linhas que não se aplicam; 153 delas funcionam agora (e a "Cada quarta Habilidade de
Retaliação…", que esperava a contagem, também). Linhas que não funcionam: **650 → 496**. Nós validados por teste: 1.172 → **1.238**.
Três pontos foram **decisão do dono** (11/10, as recomendações aceitas): a janela da Retaliação, o Sangramento em você triplicar enquanto
anda e o Estandarte plantado.

**Fáceis (30 linhas):**
- **"Vida Não Pode ser Drenada"** (o modificador de monstro `MonsterModCannotLeech`): entra no sorteio dos raros (antes ficava fora, sem
  efeito), tira o dreno de vida do dano nele (`ficha.aplicarLeech`, `semDrenoDeVida`) e liga "X% mais Dano contra Inimigos que não podem ter
  Vida Drenada" (a tag `alvoSemDreno`). O Vampírico (o monstro que drena) segue fora do sorteio. Corrigido o "empre" do poedb no texto.
- **Recuperação de Bloqueio** (aproximado): bloquear o golpe de um Elite/Chefe trava a próxima ação 0,35 s ÷ (1 + Recuperação de Bloqueio e de
  Atordoamento) — `combate/controle.travarNoBloqueio`; o de um comum, não.
- **"Clamores não podem Impelir Habilidades de Deslocamento"**: o golpe de Movimento não leva nem gasta o Impelir.
- **Totens**: o golpe de um Elite/Chefe deixa o lacaio lento (o golpe dele demora mais — `lacaios-poe.controleNoLacaio`); "A Velocidade de
  Ação dos Totens não pode ser modificada para abaixo do valor base" o impede.
- **Distância do Empurrão** (aproximado): cada 100% é uma casa a mais; o resto, a chance de mais uma.

**Médias (123 linhas):**
- **Sangramento em movimento e Agravado** (27 → 1): o lembrete do PoE ("O Dano é 200% maior enquanto em movimento"): o monstro que andou no
  último segundo (o passo dele, o empurrão — `andouEm`) sofre o triplo por pulso; o Agravado, sempre (o total a pagar não muda —
  `combate/dot.fatorDoMovimento`). Valem: as chances de Agravar (ao Acertar com Ataques, no Crítico, ao Atordoar, no ataque Impelido), "Agravam
  qualquer Sangramento mais antigos que N segundos", "Sangramentos que você infligir são Agravados" (Gladiador) e a Dança Carmesim inteira
  (o Sangramento dela não tem o extra e não se Agrava). **O Sangramento em você** (dono: "como no PoE") também triplica enquanto você anda
  (andou no último segundo — `mobs/mecanicas.tique`), e "Mover enquanto Sangrando faz com que você não sofra Dano extra" o tira. Fica 1 (a
  dos lacaios): os lacaios do jogo não sangram.
- **Alcance corpo a corpo** (26, aproximado): "+X metros" soma em metros; cada 2 m é uma casa a mais (`ficha.alcanceCorpoExtra`). "com
  Espadas" e "enquanto com ao menos N Inimigos Próximos" (a condição nova `inimigosPertoMin:N`, a até 2 casas).
- **Aura** (25): o raio da aura em casas (o da gema, em metros ÷ 2) × √(1 + Área de Efeito, a geral e "Efeito em Área de Habilidades de Aura") —
  é até onde ela vale nos **companheiros de grupo** na mesma sala (`gemas-poe.adds`: a aura deles vale em você, uma vez cada); a duração das
  auras Vaal (que agora duram o que a gema diz) e dos Estandartes ("Habilidades de Aura Não Maldições têm Duração aumentada").
- **Retaliação** (12 + a "quarta crítica"): a janela do PoE — "Não pode ser usado por padrão / Se Torna Utilizável uma vez por 2 segundos quando
  você Bloquear um Acerto" (o Clamor Vingativo: "quando você sofrer um Acerto Selvagem", um acerto de 15% da Vida). Cada gema de Retaliação usa
  uma vez por janela (`condicoes-poe.abrirRetaliacao/usarRetaliacao`; a barra recusa com o motivo `RETALIACAO` e mostra "Só depois de bloquear
  um acerto"). Valem: "por um tempo X% maior", "por N segundos adicionais", "X% de chance de não consumir", "X% de chance de outra se tornar
  Utilizável", "Cada quarta … sempre será um Golpe Crítico" e o Arsenal da Vingança (a cada sexto acerto sofrido, as que causam dano).
  **Muda o jogo:** até aqui as gemas de Retaliação saíam como golpes comuns.
- **Furtividade** (4, aproximado): o raio em que os monstros notam você (8 casas) ÷ (1 + Furtividade); quem já persegue segue perseguindo.
- **Baús** (8, aproximado): "X% de chance de abrir Baús próximos quando você Conjurar uma Magia" — os baús da sala a até 4 casas abrem como se
  você os abrisse (a chave, a armadilha e os guardiões valem igual — `acoes.abrirBausAoConjurar`).

- **Estandarte plantado** (22, dono: "Plantar como no PoE"): o PoE atual — o Valor se ganha com uma gema de Estandarte na barra e nenhum
  plantado; usar a gema consome TODO o Valor e planta o estandarte onde você está: dura o da gema (10 s), raio 2,4 m, e "X% mais Área de Efeito
  / Efeito de Aura por Valor consumido" (no nível 20, 10% cada: com 50 de Valor, 6× o efeito). Sair da área o encerra. No automático a barra
  espera o Valor máximo; o clique planta com o que tiver (`mods-poe.plantarEstandarte`, `acoes`). Valem: a duração e a área dos Estandartes, a
  vida por Valor consumido, remover uma afecção, as cargas no Valor máximo, ganhar Valor com ele plantado, os bônus que ficam N s depois de
  sair, recuperar parte do Valor ao sair e a regeneração por Valor consumido. O teste do Valor do ciclo 7 ("só com o Estandarte ligado, 1% por
  Valor") foi reescrito para a regra do PoE, com a aprovação do dono.

**O que segue sem se aplicar (62):** mercenários (18), projétil sem trajetória (14), raio de luz e campo de visão (18), posicionamento (3),
cadáveres sem vida (2), joias na árvore (2), Runas presas ao alvo (2), penalidade de movimento das armaduras (1), "Não Pode ser Empurrado"
(os monstros não empurram, 1) e os lacaios que não sangram (1).

Testes novos: `passivas-poe-nao-se-aplica-faceis` (5) e `passivas-poe-nao-se-aplica-medios` (12; dois pela barra de verdade: a Eviscerar
recusada sem bloquear, liberada depois do bloqueio, e a quarta crítica; o Estandarte da Guerra sem Valor, esperando o máximo, plantado no
clique e encerrado ao sair da área). `cobertura-arvore.mjs`: as mecânicas novas citadas
(+ a medida por tag de `area_inc@aura` e `duracao_habilidades@aura`); `mobs-raridade`: `semDreno` na lista de atributos (dono, 11/10).

### 3.2 Restantes (por causa técnica)

As linhas pendentes, agrupadas por tema, com o que cada tema precisa, estão no inventário ("Linhas sem tradução com efeito"). Os maiores grupos:

| # | Lacuna (causa) | Nós/linhas | Prioridade | Dependência | Correção proposta | Teste necessário |
|---|---|---|---|---|---|---|
| R1 | **Keystones só de texto**: das 36, **8 fechadas no ciclo 2 e 2 no ciclo 3** (C4); restam 26 (ver C4, uma a uma) | 26 nós | alta | mecânicas próprias (ES protege a mana, recuperação limitada pela evasão…) | uma regra por keystone em `traducao-arvore.json` → `keystones` (o formato `poe` existe) e o gancho no combate. **Não** ligar só a vantagem: a Bateria Anciã já tem o "custo pago pelo escudo" (`escudoParaOCusto`), mas sem as duas desvantagens daria uma keystone só positiva | por keystone: o número com e sem, as duas metades |
| R2 | **Notáveis de ascendência quase todos sem efeito** (109 de 161; Guardião, Gladiador, Luminária com 0 funcionais) | 141 nós | alta | mecânicas de cada ascendência (cerca de 113 linhas "outros") | por ascendência, começando pelas sem nenhum efeito | por notável: o efeito no golpe/defesa |
| R3 | ~~"Pode Alocar Passivas do ponto inicial do X"~~ — **corrigido no ciclo 2 (C1)** | 6 nós | feito | o motor aceitar um 2º início alcançável (hoje: `alcancaveis` parte do início da classe e da ascendência) | o nó guarda `inicioExtra`; `podeAlocar`, `caminhoAte` e `ilhadosSemEles` passam a partir dos inícios extras alocados | alocar pelo início do Marauder com o Caminho do Marauder; tirar o Caminho ilha os nós de lá |
| R4 | **Maestrias parciais** (216 de 315: alguma opção sem efeito) | 1.106 linhas de opção sem efeito (pendentes ou inexistentes) | média | as mesmas mecânicas dos temas | por tema (afecções em você, precisão "mais", reflexo…) | por opção |
| R5 | **Afecções e controle em você** (limite, "enquanto tiver uma", empalar em você, resfriamento mínimo) | 209 linhas / 121 nós | média | contadores de afecção no jogador | novas condições de estado em `condicoesDe` e o limite em `dotNoJogador` | afecção recusada com outra ativa |
| R6 | **Lacaios** (área, recarga, penetração, buffs ao matar, resistências máximas) | 83 / 35 | média | o lacaio do jogo só tem dano, vida e velocidade | atributos de lacaio lidos em `lacaios-poe.mjs` | o número no lacaio |
| R7 | **Armadilhas e minas de verdade** | 80 / 30 | média | no jogo as gemas viram golpes comuns | sistema de armar/detonar (decisão de design) | — |
| R8 | **Marcas/Runas presas ao inimigo** (vínculo, convocação, alcance) | 70 / 30 | média | as Runas (Brands) são golpes comuns; a tag agora existe (L5) | o que for número (dano, crítico, duração) com `@runa`/`@marca`; o vínculo pede sistema | por linha |
| R9 | **Reflexo de dano dos monstros** ("Evita X% do dano refletido") | 36 / 26 | baixa | o jogo não reflete dano no personagem | só depois de existir reflexo | — |
| R10 | ~~**Dreno com ritmo e teto**~~ — **fechado nos ciclos 3 e 4**: o teto por recurso, a parte instantânea, o fim do dreno com a vida livre cheia, o dreno dos totens e o do dano excedente | 0 linhas pendentes | — | — | — | — |
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

### Arquivos do ciclo 3 (maldições e dreno instantâneo)

| Correção | Arquivos |
|---|---|
| M1 maldições | `game/systems/skills/reforcos.mjs` (`marcar`, `maldicoesAtivas`, `amaldicoado`, `fatorDeDesaceleracao`, `vulnerabilidade`, `forcaDoBicho`); `game/systems/acoes.mjs` (`efeitosDaMaldicao`: `maldicaoRegras`, o "menos efeito", a duração infinita; a hora do lançamento no buff; o evento nas gemas; o leitor da árvore para o nível das gemas); `game/systems/hunt/combate.mjs` (o evento no golpe básico); `game/systems/hunt/monstros.mjs` (o passo do amaldiçoado); `game/systems/itens-poe/condicoes-poe.mjs` (`amaldicoadoPorVoce` em `tagsDoAlvo` e `criticoDoBicho`; o evento `amaldicoarSemMaldicao`; `efeito_maldicao_expirou:<Y>`); `game/systems/itens-poe/mods-poe.mjs` (`removerAfeccao:elementais`); `game/systems/skills/gemas.mjs` (o nível das gemas pela árvore) |
| M2 dreno | `game/systems/ficha.mjs` (`aplicarLeech`: a parte instantânea, `es_leech` nos ataques, `vida_leech_magia`; `tetoDoRouboPct`; `recuperarRoubo`: o cheio pela parte livre; `regenDoPoe` e `curar` com o Pacto Vaal); `game/systems/personagem/ficha-poe.mjs` (o teto da tela); `game/systems/itens-poe/condicoes-poe.mjs` (`vidaSoPeloDreno`, `furiaCheia`, `drenoRemovidoCheio`, o buff `pactoVaal` das peças como no PoE); `game/systems/itens-poe/frascos.mjs`, `game/systems/personagem/defesa.mjs` (o Pacto Vaal) |
| Regras e atributos | `game/gamedata/itens-poe/traducao.json` (31 regras novas — uma no lugar da antiga do teto de vida/mana, que subia o de todos — e 4 corrigidas); `game/gamedata/itens-poe/atributos-novos.json` (15 atributos); `game/gamedata/itens-poe/arvore-poe.json` (refeito); `game/systems/itens-poe/precisa-arvore.mjs` (o que falta) |
| Testes | `game/testes/passivas-poe-maldicoes-dreno.test.mjs` (novo, 14 testes); `game/testes/passivas-poe-afeccoes.test.mjs` (a duração lida em `bicho.maldicoes` — classe C, o modelo mudou); `game/testes/itens-poe-arvore-poedb.test.mjs` (o dreno instantâneo agora existe — classe C); `game/testes/cobertura-arvore.mjs` |

### Arquivos do ciclo 4

| Correção | Arquivos |
|---|---|
| Dreno dos totens e do excedente | `game/systems/ficha.mjs` (`drenarPoe`, o dreno compartilhado); `game/systems/cacadas.mjs` (`golpeDoTotem`); `game/systems/itens-poe/mods-poe.mjs` (`aoAcertar`: o excedente; `definirDreno`) |
| Monstros à prova, refletindo, com escudo e amaldiçoados | `game/systems/mobs/raridade.mjs` (`esPoe`, `aProvaDeMaldicoes`, `refleteFeiticos`); `game/systems/skills/estados.mjs` (`escudoDoMonstro`, a recarga, a regeneração reduzida); `game/systems/skills/reforcos.mjs` (`regrasDasMaldicoes`, `afDaMaldicaoNoJogador`, à prova e o reflexo em `marcar`); `game/systems/acoes.mjs` (as regras da maldição); `game/systems/hunt/combate.mjs` (sem cadáver) |
| Maldições em você | `game/systems/itens-poe/condicoes-poe.mjs` (`MALDICOES_DOS_MONSTROS`, `amaldicoarJogador`, `addsDasMaldicoesNoJogador`); `game/systems/afixos.mjs` (a soma); `game/systems/mobs/mecanicas.mjs` (o efeito `maldicao`); `game/systems/ficha.mjs` (a resistência negativa) |
| Dados | `game/tools/montar-modificadores-monstro-poe.mjs` e `game/gamedata/itens-poe/modificadores-monstro.json` (9 mods: escudo, Hexproof, Reflete Feitiços, Amaldiçoa — só esses; as correções manuais das linhas ficaram); `traducao.json` (6 regras novas, 1 corrigida); `atributos-novos.json` (7) |
| Testes | `passivas-poe-maldicoes-dreno.test.mjs` (+8); `mobs-raridade.test.mjs` (a lista de stats conhecidos dos modificadores ganhou os 4 novos — classe C: o mob passou a aplicá-los); `encontros-etapa6.test.mjs` (classe C, decisão do dono "PoE puro": no modo PoE o cavaleiro da caçada offline caça com um Machado Vaal — desarmado, 15 de dano a cada 2 s, ficava preso num monstro com escudo de recarga rápida) |

### Arquivos do ciclo 5

| Correção | Arquivos |
|---|---|
| Afecções em você | `game/systems/itens-poe/mods-poe.mjs` (`dotNoJogador`, `jaTemAfeccao`, o evento `ganharAdrenalina`); `game/systems/itens-poe/condicoes-poe.mjs` (`controleNoJogador`, `ganharBuff`); `game/systems/poderes.mjs` (a supressão antes das afecções); `game/systems/combate/controle.mjs` (`tentar`: sem afecção elemental); `game/systems/combate/dot.mjs` (o tipo no pulso); `game/systems/mobs/mecanicas.mjs` (inafetado, o primeiro segundo do dano contínuo) |
| Dados e testes | `traducao.json` (15 regras); `atributos-novos.json` (9); `testes/passivas-poe-afeccoes-em-voce.test.mjs` (novo, 7 testes); `testes/cobertura-arvore.mjs` |

### Arquivos do ciclo 7

| Correção | Arquivos |
|---|---|
| Motor | `game/systems/itens-poe/condicoes-poe.mjs` (Fortificação, Solo Sagrado, Postura, Estandarte/Valor, escalas novas e o teto `~`, condições e tags novas, `controleNoJogador`, `fichaDoGolpe`, `doBicho`, `fatorRecebidoPeloBicho`, o tique); `game/systems/itens-poe/mods-poe.mjs` (`aoAcertar`, `aoSerAcertado`, `aoSerAtordoado`, ações novas, periódicos, auras nos inimigos, `parteNoTotem`, `poderDoClamor`); `game/systems/itens-poe/lacaios-poe.mjs`; `game/systems/cacadas.mjs` (o tique dos lacaios); `game/systems/acoes.mjs` (custo e recarga por tag, Impelir, Marca); `game/systems/hunt/combate.mjs` e `game/systems/poderes.mjs` (o golpe e a magia dos monstros no personagem); `game/systems/combate/controle.mjs`; `game/systems/personagem/defesa.mjs`; `game/systems/ficha.mjs`; `game/systems/afixos.mjs` (a aljava, a Inoculação do Caos); `game/systems/itens-poe/frascos.mjs`; `game/systems/itens-poe/gemas-poe.mjs`; `game/systems/hunt/resistencia.mjs`; `game/systems/skills/estados.mjs` e `reforcos.mjs`; `game/systems/combate/limites.mjs` (penetração de Caos); `game/systems/passivas/arvore.mjs` (maestrias contadas, `notas`); `game/systems/itens-poe/arvore.mjs` (`notas`, o "ㅤ" das ascendências novas) |
| Tela | `game/frontend/client/src/passivas.mjs` (o porquê de cada linha, a marca "–"); `game/frontend/client/src/editor-poe-telas.mjs` e `game/admin/itens-poe-telas.mjs` (os estados `inerte`/`naoSeAplica` e as notas na Engine); CSS |
| Dados | `traducao.json` (458 regras `_ciclo7`), `atributos-novos.json` (+137), `arvore-poe.json` (remontada, com `notas`) |
| Auditoria | `game/admin/auditoria-arvore-passivas.mjs` (as condições novas; `alvoVenenos:N` não é mais "desconhecida") |

### Arquivos dos "não se aplica" (11/10)

| Correção | Arquivos |
|---|---|
| Motor | `game/systems/combate/dot.mjs` (o Sangramento em movimento e o Agravar); `game/systems/mobs/mecanicas.mjs` (o Sangramento em você andando); `game/systems/hunt/monstros.mjs` (`andouEm`, a percepção); `game/systems/itens-poe/condicoes-poe.mjs` (a janela da Retaliação, a Furtividade, `inimigosPertoMin`, `alvoSemDreno`, o Impelir); `game/systems/itens-poe/mods-poe.mjs` (o Agravar, o Acerto Selvagem, o Arsenal, o Empurrão); `game/systems/itens-poe/afeccoes.mjs`; `game/systems/itens-poe/gemas-poe.mjs` (`gatilhoDeRetaliacao`, a duração das auras Vaal, a aura dos companheiros); `game/systems/acoes.mjs` (a janela na barra, a quarta crítica, o raio da aura, os baús ao conjurar); `game/systems/cacadas.mjs` (a percepção, o totem lento); `game/systems/hunt/combate.mjs` e `game/systems/poderes.mjs` (o bloqueio abre a janela e trava); `game/systems/combate/controle.mjs` (`travarNoBloqueio`); `game/systems/itens-poe/lacaios-poe.mjs`; `game/systems/ficha.mjs` (o dreno no monstro sem dreno); `game/systems/mobs/raridade.mjs` (`semDreno`) |
| Dados | `traducao.json` (+ as regras dos dois lotes), `atributos-novos.json`, `arvore-poe.json` (remontada), `modificadores-monstro.json` (o `MonsterModCannotLeech` com efeito; `tools/montar-modificadores-monstro-poe.mjs`) |
| Auditoria e testes | `game/admin/auditoria-arvore-passivas.mjs` (a condição `inimigosPertoMin:N`); `game/testes/cobertura-arvore.mjs`; `game/testes/mobs-raridade.test.mjs` (`semDreno`); `game/testes/passivas-poe-solo-postura-estandarte.test.mjs` (o Valor: a regra do PoE — dono, 11/10); os dois testes novos |

### Arquivos do ciclo 6

| Correção | Arquivos |
|---|---|
| Afecções nos monstros | `game/systems/itens-poe/afeccoes.mjs` (`daSoma`, `aoAcertar`, `fatorDeEletrizacao`); `game/systems/itens-poe/mods-poe.mjs` (o empalamento, `aoPorAfeccoes`, o Coberto de Gelo, `definirReducaoFisica`); `game/systems/itens-poe/condicoes-poe.mjs` (`finalizar`, `tagsDoAlvo`, `doBicho`, `criticoDoBicho`, `fatorRecebidoPeloBicho`, `resMenosDasAfeccoes`, a Agonia Perfeita das peças); `game/systems/skills/estados.mjs` (o congelamento mínimo, o resfriar ao sair, o tempo Congelado/Resfriado); `game/systems/hunt/resistencia.mjs` (as resistências a menos); `game/systems/cacadas.mjs` (registra a redução física do empalamento); `game/systems/ficha.mjs` (`critMultiplierBruto`); `game/systems/itens-poe/traduzir.mjs` e `game/admin/auditoria-arvore-passivas.mjs` (a condição `alvoVenenos:N`) |
| Dados e testes | `traducao.json` (60 regras); `atributos-novos.json` (39); `testes/passivas-poe-afeccoes-nos-monstros.test.mjs` (novo); `testes/cobertura-arvore.mjs` |

## 7. Testes executados (resultados reais)

- `testes/passivas-poe.test.mjs`: **24 de 24 passam**, incluindo o invariante do auditor (2.230 nós alocados, 0 falhas, ~14 s).
- Os testes ligados às mudanças: passivas, respec, arvore, itens-poe-arvore(-poedb), frascos, mods(-abas), itens-poe, gemas, morte
  (oficial e clássico) e itens-poe-combate. Resultado: 214 testes, 172 passam, 41 pulados (marcados B/C para o clássico) e 1 falha.
  A falha era a asserção do formato antigo em `itens-poe-arvore.test.mjs`, classe C, adaptada (ver seção 6) e passando.
- Suíte SYSTEM (`node tools/testes/testar.mjs system --desde=origin/main`): resultado no fim deste ciclo, na seção 9. A FULL está bloqueada nesta
  máquina, porque ela hospeda o servidor do jogo.

---

**Ciclo 7 (11/10/2026):**
- 6 arquivos novos de teste da árvore (37 testes, nós reais), três rodadas seguidas sem falha intermitente.
- `passivas*` + `itens-poe*` (51 arquivos, 477 testes): 0 falhas. Três testes antigos com o **seletor de nó ajustado** (decisão do dono,
  11/10): `passivas-poe-cobertura` ("accuracy", "duracao_congelamento") e `passivas-poe-frascos` procuravam um nó com UMA linha só, e esses
  nós ganharam linhas que agora funcionam. O seletor aceita as outras linhas declaradas em `junto`; a asserção continua exata, e na
  Precisão o esperado soma a linha "Precisão igual a duas vezes sua Força" (a mutação que zera essa linha é pega: 782 × 718).
- **FULL por exceção** (dono, 11/10 — o pre-commit exige a FULL por `cacadas.mjs`, `acoes.mjs` e `afixos.mjs`): 4.046 testes, 3.416 passam,
  **0 falhas**, 628 pulados (clássico) e os 2 TODO de sempre. Commit com `--no-verify`.

**Os "não se aplica" (11/10/2026):**
- 2 arquivos novos (17 testes, nós reais) passam.
- Regressão de 86 arquivos (passivas, cobertura, mobs, dano ao longo do tempo, movimento dos monstros, combo, barra, reserva, encontros,
  itens-poe, gemas, afecções, controle, lacaios, party, auras, árvore): **883 testes, 812 passam, 0 falhas**, 71 pulados (clássico).
- FULL: **pendente** — o pre-commit exige (núcleo: `cacadas.mjs`, `acoes.mjs`); só com a exceção do dono.

## 8. Próxima prioridade recomendada

(Ciclo 3: as maldições e o dreno instantâneo foram fechados, com o Pacto Vaal e o Mestre dos Feitiços. O que segue continua valendo, sem R10.)

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
| fim do ciclo 3 (maldições e dreno instantâneo) | 314 | 3.260 | 2.680 | **0** | 578 |
| fim do ciclo 4 (totens, excedente, monstros, maldições em você) | 315 | 3.271 | 2.690 | **1** (intermitente e antiga — abaixo) | 578 |
| fim do ciclo 5 (afecções em você) | 316 | 3.278 | 2.698 | **0** | 578 |
| fim do ciclo 6 (afecções do personagem nos monstros) | 317 | 3.289 | 2.709 | **0** | 578 |
| depois do merge da main (#181, #182) e dos 3 testes abaixo | 318 | 3.295 | 2.715 | **0** | 578 |

Sem falhas preexistentes no escopo do SYSTEM. Dois testes antigos foram adaptados, e só porque a regra mudou de propósito (ver a seção 6):
- `morte.test.mjs`, classe B: a regra do Tibia continua testada no clássico;
- `itens-poe-arvore.test.mjs`, classe C: o formato `tag` era o defeito L1.

**A falha do ciclo 4 é antiga:** `loot-moeda.test.mjs` (o personagem de teste, desarmado, às vezes fica preso no monstro "Ameaça Agarradora" e não mata em 15 minutos). Reproduzida com o sorteio do spawn por semente: no `origin/main` (sem as mudanças deste trabalho) as MESMAS sementes travam (4 de 40); sozinho, o teste passou em 5 de 6 rodadas. Fica como tarefa à parte.

**Depois do merge da main (#181, #182)**, três testes com a premissa corrigida, com a asserção igual e conferidos por mutação:
- `passivas-poe-lacaios.test.mjs`: falhava na main pura (3/4) desde o "uma ação por vez" (#182). Os zumbis vencem por tempo, e o teste contava os vivos no último tique; agora conta o pico de invocados.
- `xp-da-hunt.test.mjs` (caçada offline): falhava sempre na main pura desde o #181. Os Mágicos/Raros mais rápidos matavam o cavaleiro desarmado em 51 s, com 0 abates. A projeção nem rodava antes (82 s, 1 abate). Decisão do dono (09/10): vida que não acaba e um Machado Vaal, como no `encontros-etapa6`. Resultado: 592 abates e razão 0,500; a mutação da projeção é pega (0,313).
- `so-itens-do-poe.test.mjs`: 2 de 40 sementes falhavam com o escudo dos monstros do PoE puro. O cavaleiro desarmado ficava preso no Elite/Raro com "Início da Recarga 150% mais rápido". Decisão do dono (09/10): um Machado Vaal só nesse teste. Resultado: 0 de 40, mínimo de 3.876 abates.

No ciclo 3, mais dois, também classe C (a regra mudou a pedido do dono):
- `passivas-poe-afeccoes.test.mjs`: a duração da maldição agora é lida em `bicho.maldicoes` (o modelo da maldição no monstro mudou);
- `itens-poe-arvore-poedb.test.mjs`: a asserção dizia que "X% do Dreno é Instantâneo" não existia no jogo; agora existe (`roubo_instantaneo_pct`).
