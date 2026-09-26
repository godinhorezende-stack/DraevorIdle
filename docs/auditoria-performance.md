# Auditoria de performance e arquitetura — Ravox Idle (restaurado)

Data: 2026-09-26. Só diagnóstico e plano: **nenhum arquivo do jogo foi alterado**.
Os scripts de medição usados estão em `tools/perf/` (mais `tools/carga.mjs` e
`tools/perfil-servidor.mjs`, que já existiam) — rodar de novo depois de cada fase
é o "medir de novo" do plano.

Ambiente da medição: container Linux, Node 22, Chromium headless (sem GPU: o
desenho do canvas cai na CPU, então os números do cliente **exageram** o custo de
raster; a tendência vale, o valor absoluto não). Servidor com `--inspect`, bots
de `tools/carga.mjs` (knight level 600, vida infinita, 8 hunts diferentes).

---

## 0. Resumo em 12 linhas

1. **O maior problema não é rede nem render: é o servidor parar para todo mundo.**
   Uma volta de 2h offline congela o processo por **1,5–2,3 s** para os outros
   jogadores (a simulação offline roda síncrona no login).
2. O tique do servidor é **um laço único e síncrono** sobre todas as sessões. Com
   200 jogadores caçando ele leva ~167 ms de cada 250 ms: **ping p50 185 ms,
   p99 451 ms**. Teto prático hoje: **~150–200 jogadores caçando por processo**.
3. Tráfego de WebSocket **já é baixo** (0,3 KB/s por jogador no fio, 4 msgs/s,
   com delta e recorte da tela). Não é onde gastar esforço agora.
4. Há três laços **O(N²)** por tique: praça (`Chat.jogadoresNaPraca`) e party
   (`Party.naMesmaSala`, chamado 2–3x por jogador por tique).
5. O estado gravado de cada personagem tem **150–720 KB**, ~97% dele os bichos da
   hunt, cada um com uma **cópia da tabela de loot**. Isso pesa no autosave, no
   login, na lista de amigos e em todo ranking.
6. A ficha de combate (`Ficha.combate`) é recalculada do zero várias vezes por
   tique: **14% do tempo do tique**.
7. Entrar numa hunt pela primeira vez trava o servidor até **395 ms**
   (leitura + parse + rota do mapa, síncronos).
8. Login custa **6 MB descomprimidos / 723 KB no fio** a cada conexão (catálogo,
   itens e mapa da cidade pelo WebSocket, sem cache entre conexões).
9. No celular, a camada de nomes (`#map-overlay`) é um canvas do tamanho da tela
   em **DPR cheio**: DPR 3 → 23 FPS e 40 travadas; DPR 2 → 36 FPS e 1 travada.
10. Não há limite de tamanho de mensagem (padrão do `ws`: 100 MB) nem limite de
    ritmo por conexão: **um cliente malicioso consegue travar o servidor**.
11. Banco: SQLite síncrono chamado de 9 módulos direto, sem camada de repositório,
    sem transações; o mercado mexe em linhas do banco na hora e no estado do
    personagem só no autosave (risco de duplicação se o processo cair).
12. **Redis não é necessário enquanto houver um processo só.** PostgreSQL entra
    na fase 6, depois de tirar o banco do caminho quente — a ordem importa.

O que **já está bom** e não deve ser refeito: relógio único (não há
`setInterval` por jogador), progresso offline por timestamp, `charDelta`/
`huntDelta`/`cityDelta`, recorte dos bichos para a tela, efeitos cortados com a
aba escondida, `permessage-deflate`, JSON gigante serializado uma vez só,
cliente que pula quadro idêntico, canvas principal em resolução fixa baixa
(736×416 ampliado por CSS), cache de placas de nome, `so-quando-muda.mjs`,
ETag/Brotli/WebP nos estáticos, BFS em `Int16Array`. Muito do trabalho óbvio
já foi feito — os gargalos que sobraram são **estruturais**.

---

## 1. Linha de base medida (o "antes")

| Cenário | Medida | Valor |
|---|---|---|
| 50 jogadores caçando, 45 s | CPU do processo | 20% |
| | intervalo entre `state` (alvo 250) | p50 250 · p99 276 ms |
| | ping | p50 8 · **p99 153** ms |
| 200 jogadores caçando, 40 s | CPU do processo | **77%** |
| | intervalo entre `state` | p50 251 · **p99 527** · máx 617 ms |
| | ping | **p50 185 · p99 451** · máx 507 ms |
| | tráfego no fio | 0,30 KB/s por jogador |
| | RSS / heap depois do GC | 550–630 MB / 100 MB |
| 200 jogadores parados na cidade | CPU | 35% (40% do tique é a praça) |
| | ping | p50 91 · p99 137 ms |
| Login com 2h de caçada offline | pior ping de **outro** jogador | **1.506–2.279 ms** |
| 1ª entrada numa hunt (`spike-8`) | servidor parado | **395 ms** |
| Todos os 127 mapas de hunt carregados | heap | +224 MB |
| Estado gravado por personagem caçando | tamanho | **148–719 KB** (hunt: 97%) |
| Um login (sem cache) | recebido | 6 MB descomprimido · 723 KB no fio |
| Cliente desktop 1366×768, caçando | CPU da aba / FPS | 40% · 60 FPS · 394 `drawImage`/quadro |
| Cliente celular 412×915, CPU 4x lenta | DPR 3 / DPR 2 / DPR 1 | **23** / 36 / 51 FPS |
| | long tasks em 20 s (DPR 3) | **40**, máx 187 ms |
| Memória: 3 rodadas de 40 jogadores | heap depois do GC | 97 → 97 → 98 MB (estável: **cache, não vazamento**) |

Custo por jogador caçando: **~0,84 ms de CPU por tique** (3,3 ms por segundo).

---

## 2. FASE 1 — Mapa da arquitetura real

### 2.1 Como o jogo é de verdade

```
 NAVEGADOR (cliente ORIGINAL baixado, ~74 mil linhas, sem build)
 ├─ main.mjs (10 mil linhas) ── conexão WS, applyState, renderAll, janelas
 ├─ panels.mjs (25 mil) ─────── todos os painéis/modais
 ├─ map.mjs ─────────────────── canvas do mapa (rAF) + overlay de nomes
 ├─ hud, actionbar, inventory, chat, social, guildas, arvore, gemas...
 └─ so-quando-muda.mjs ──────── remendo global nos protótipos do DOM
             │  1 WebSocket (/ws), JSON + deflate
             ▼
 UM PROCESSO NODE (server/index.mjs)
 ├─ HTTP: estáticos (assets_raw) + /api/* do site + /api/mapas do editor
 ├─ WS: new Sessao(ws) por conexão
 ├─ nucleo/sessao.mjs (1.539 linhas, importa 49 módulos) ← "objeto-deus"
 │    ├─ despachar(m): switch com ~120 comandos
 │    ├─ tique(): hunt | cidade | treino, a 4 Hz
 │    ├─ mandarEstado(): monta character/city/hunt e faz o delta
 │    └─ gravarAgora(): autosave a cada 30 s
 ├─ relógio ÚNICO (setTimeout encadeado, 250 ms) → tique() de TODAS as sessões
 ├─ sistemas/* (49 módulos): quase todos FUNÇÕES PURAS sobre `estado` ✔
 └─ node:sqlite SÍNCRONO (server/dados/jogo.db), estado do personagem = 1 JSON
```

Não existe Redis, fila, worker, nem PostgreSQL. Não existe áudio de jogo
(só o áudio do chat, guardado em memória por 5 min). Não existe "Pokedex" —
o equivalente é o bestiário (`charms.mjs`).

### 2.2 Quem depende de quem (servidor, medido pelos `import`)

| Módulo | Depende de | Dependem dele |
|---|---:|---:|
| `nucleo/sessao` | **49** | 1 |
| `cacadas` (motor da hunt) | **31** | 6 |
| `hunt/combate` | 27 | 3 |
| `ficha` | 13 | 6 |
| `inventario` | 9 | **16** |
| `nucleo/dados` | — | **38** |
| `nucleo/banco` | — | **9** (acesso direto ao SQL) |

Ciclos de import:
- `afixos ↔ boosts ↔ gemas ↔ imbuements ↔ inventario` (5 módulos)
- `arena ↔ cacadas ↔ hunt/combate` (o motor de combate conhece a arena)

### 2.3 Acoplamentos DESNECESSÁRIOS encontrados

| Acoplamento | Por quê existe | Custo | Alternativa |
|---|---|---|---|
| `chat`, `amigos`, `guildas` importam **o motor inteiro da hunt** (31 deps) | só para `nomeDaHunt()` e `salaDe()` | tudo que é social recarrega/depende do combate; ciclo difícil de quebrar | um "onde está" (read-model de presença) com `{nome, lugar, sala}` |
| `arena` dentro de `hunt/combate` (`Arena.antesDoTique`, `bonusDoPodio`) | a arena reaproveita a hunt | todo tique de todo jogador passa pela arena | gancho/estratégia: a hunt recebe `modificadores` sem saber quem são |
| 9 módulos fazem `db.prepare(...)` direto | não há camada de dados | migrar para PostgreSQL mexe em 9 arquivos e em chamadas síncronas espalhadas | `repositorios/*` com API assíncrona (fase 6) |
| `party`, `chat`, `amigos`, `arena`, `guildas`, `site`, `ranking` recebem `vivas` (o Map de TODAS as sessões) e chamam `s.enviar()` | "ligar(vivas)" | domínio falando com a rede; laços sobre todos os online | índices próprios (sala → membros, célula → jogadores) + um canal de saída |
| `Party.camposDoPersonagem` → `B.lerMelhoriasDaConta` | slots de party | **consulta SQL + JSON.parse por jogador por segundo** no caminho quente | valor na sessão, invalidado na compra |
| `sessao.mjs` conhece os 49 sistemas | o `switch` de comandos | todo sistema novo mexe no mesmo arquivo | cada sistema registra os próprios comandos numa tabela |
| cliente: `hud.mjs` importa `map.mjs`; `guildas ↔ social` | reaproveitar desenho | pouco custo em runtime | não mexer agora |

**Acoplamentos que são bons e devem ficar:** os sistemas recebem `estado` e
devolvem `{ok, erro}` sem falar com a rede (`aplicar()` em `sessao.mjs` é o
único tradutor). Isso é exatamente o que permite mover a simulação para
workers depois — não jogar fora.

---

## 3. FASE 2 — Frontend (cliente)

Medido (desktop, caçando, 20 s): CPU da aba 40% (a maior parte é raster em
software do headless), script 169 ms/s, estilo 12 ms/s, layout 1 ms/s, 63
recálculos de estilo/s, 38 mutações de DOM/s, 3.101 nós, 846 listeners, heap
22 MB estável, **zero long tasks**. O cliente desktop está saudável.

"Isso precisa rodar a cada quadro?"

| Operação | Onde | Frequência hoje | Precisa? | Proposta |
|---|---|---|---|---|
| Desenho do mapa (pilhas de tiles, ~400 `drawImage`) | `map.mjs::render/drawMapa` | cada quadro do monitor, pulado se idêntico | sim, enquanto algo se mexe | manter; cache por pedaço já foi tentado e quebrou a ordem de desenho (comentário em `drawMapa`) — **não refazer sem necessidade medida** |
| Limpar e redesenhar o overlay de nomes (tela inteira × DPR) | `limparOverlay`, `drawTexts` | cada quadro desenhado | sim, mas não em DPR 3 | **teto de DPR 2 no overlay** (ver §14) |
| `renderAll()` (HUD, barra, analisador, buffs, boss CD, controles...) | `main.mjs` | **a cada `state` (4/s)** | não | "sujo por painel": cada painel re-renderiza só quando a chave dele muda no delta |
| `void ouro.offsetWidth` (reflow forçado) | `renderAll` | a cada ganho de ouro (auto-venda) | não | reiniciar a animação com `animation` + `animationend`, ou Web Animations API |
| Spread do personagem inteiro (`{...state.character, ...delta}`) | `applyState` | 4/s | barato (raso) | manter |
| Analisador | `setInterval(…, 1000)` + `renderAll` | 1/s + 4/s | só se visível | já retorna se escondido ✔ |
| Timers do chat (presença, áudio expirado, falas velhas) | `chat.mjs` | 1–10 s | ok | manter |
| Listas crescendo (chat) | `LIMITE_POR_ABA = 200` | — | — | já limitado ✔ |

Problema de arquitetura do cliente: a UI é "redesenha tudo a cada mensagem" e
o `so-quando-muda.mjs` remenda isso **globalmente** trocando os setters de
`textContent`/atributos do DOM. Funciona (medido: tirou ~140 ms/s de estilo),
mas é tratar o sintoma. Vale mudar? **Só por painel, onde medir custo** — o
cliente é o original e reescrever `panels.mjs` (25 mil linhas) não se paga.

---

## 4. FASE 3 — Game loop

### Servidor: o laço central faz coisas demais, e de uma vez só

`rodarRelogio()` chama `tique()` de **todas** as sessões em sequência, no mesmo
`setTimeout`. Com 200 jogadores caçando isso leva ~167 ms: mensagens de todo
mundo (ping, cliques, chat) esperam na fila atrás do laço — é o ping p50 de
185 ms. O próprio laço também mistura simulação, rede e persistência:

```
tique() de cada sessão, 4 Hz:
  autosave? (JSON.stringify de até 720 KB + UPDATE síncrono)      ← persistência
  Party.guia / Party.partilha (varre TODOS os online)              ← social
  Arena.antesDoTique                                               ← modo de jogo
  Cacadas.tique: stamina, boosts, prey, imbuements, regen,         ← simulação
                 lure, respawn, passo (BFS), bichos (BFS), golpes,
                 familiar, mortes, loot, auto-venda
  mandarEstado: characterParaCliente a cada 1 s (~60-100 KB),      ← rede
                JSON.stringify por chave para o delta, praça O(N)
```

Frequências propostas (a partir do que o jogo precisa, não de números prontos):

| Sistema | Hoje | Proposto | Por quê |
|---|---|---|---|
| Simulação da hunt | 4 Hz | **4 Hz (manter)** | todo ritmo do jogo é múltiplo de 250 ms (passo, golpe 2 s, poção 1 s) e bate com o original |
| Envio de `state` | junto do tique, pulado se vazio | manter, mas **espalhado em fatias** (ver abaixo) | o cliente interpola o passo (`moveMs`) |
| Personagem completo (`characterParaCliente`) | a cada 1 s + a cada ação | **só quando algo marcou "sujo"** | 95% das chaves não mudam por minutos |
| Barras hp/mana | todo quadro | todo quadro (manter) | são 2 números |
| Regeneração/stamina na cidade | 4 Hz | 1 Hz (é por timestamp: dá o mesmo resultado) | 4x menos trabalho na cidade |
| Outros jogadores na praça | 4 Hz, O(N²) | 4 Hz, **grade espacial**, recalcula só quando alguém anda | movimento é de 250 ms |
| Autosave | 30 s, sempre, síncrono | **60 s só se sujo** + imediato em economia (transação) | ver §11 |
| Ranking/site | cache 15 s, consulta varre JSON | 60 s, colunas indexadas | ver §11 |
| Simulação offline | síncrona no login | **worker** | ver gargalo nº 1 |

**Tique espalhado ("fatias"):** em vez de 1 laço de 250 ms com todos, 5 fatias
de 50 ms com 1/5 das sessões cada (sessão fica numa fatia fixa). O custo total
é o mesmo, mas o pior atraso de uma mensagem cai ~5x e o ritmo de cada jogador
continua 250 ms. Risco baixo; dificuldade baixa.

### Cliente: laços separados já existem na prática

Render = rAF com pulo de quadro idêntico; rede = eventos do socket; UI = a cada
`state`; analisador 1 s; medidor de ping próprio. O que falta é só a UI deixar
de ser "tudo a cada `state`" (§3).

---

## 5. FASE 4 — Sistemas independentes

Adaptado ao que existe (não à lista genérica):

| Grupo | Módulos hoje | Pode rodar isolado? | Observação |
|---|---|---|---|
| **Simulação por jogador** | `cacadas`, `hunt/*`, `treino`, `exercicio`, `stamina`, `boosts`, `buffpower`, `prey`, `imbuements`, `summon`, `arvore` (tique) | **Sim** — só lê/escreve o `estado` do jogador | Hunt é **instância por jogador** (ou por sala de party). É o que torna o jogo fácil de paralelizar |
| **Ficha/derivados** | `ficha`, `afixos`, `gemas`, `proficiencia`, `promocao`, `tiers` | Sim (puros) | precisam de cache com "sujo" |
| **Inventário/economia local** | `inventario`, `bolsa`, `deposito`, `bau`, `loja`, `craft`, `forja`, `desmanche` | Sim (puros sobre `estado`) | |
| **Economia entre jogadores** | `mercado`, `banqueiro` (transferência), `bau` da conta | **Não** — mexem em dois jogadores | precisam de transação no banco |
| **Social/mundo compartilhado** | `chat`, `amigos`, `guildas`, `party`, `arena`, `ranking`, `site`, praça | Não — precisam ver todos | ficam no processo principal (ou Redis, se houver vários) |
| **Rede/protocolo** | `sessao` (despachar, mandarEstado), `quadro`, `json` | — | separar Gateway de Sessão |
| **Persistência** | `banco` + SQL em 9 módulos | — | repositórios |

Onde um evento/mensagem **tem benefício real** (e só aí):

| Evento | Quem emite | Quem escuta hoje (chamada direta) | Ganho |
|---|---|---|---|
| `presenca.mudou` (entrou/saiu/mudou de hunt) | sessão | amigos, guildas, site, chat | tira o motor da hunt de dentro do social |
| `personagem.subiuDeLevel` | combate | ficha, promoção, recompensas (presentes), site | ficha sabe quando invalidar cache |
| `personagem.equipouOuMudouFicha` | inventário/forja/árvore/gemas | ficha (cache) | é o "sujo" do `Ficha.combate` |
| `mercado.vendeu` | mercado | crédito do vendedor, histórico, chat Mercado | uma transação, vários ouvintes |
| `hunt.morreu` | combate | party, bosses, morte, arena | já está espalhado em `morrerNaHunt` |

**Não** usar eventos dentro do tique da hunt (golpe → dano → loot): é código
quente e sequencial, um barramento ali só adiciona custo. Um `EventEmitter` do
Node, síncrono, basta — sem framework.

---

## 6. FASE 5 — WebSocket

| Item pedido | Situação real | Veredito |
|---|---|---|
| Mensagens excessivas | 4 `state`/s por jogador, 0 msgs/s do cliente parado | ok |
| Dados duplicados / sem mudança | delta por chave (`deltaRaso`), `state` vazio pulado | ok ✔ |
| Broadcasts | chat global/mercado: `JSON.stringify` **por destinatário** | serializar 1x e mandar o mesmo texto |
| Mensagens grandes | `hello` 2 MB + `welcome` 4 MB **por conexão**; `pedirMapa` = 3,7 MB sem limite de ritmo | mover dados fixos para HTTP com cache (§8 gargalo 8) |
| Informação para quem não precisa | bichos recortados para a tela ✔; efeitos cortados fora da tela/aba escondida ✔ | ok |
| Batching | 1 mensagem por tique com tudo junto ✔ | ok |
| Throttling / proteção | **nenhum `maxPayload` (100 MB), nenhum limite de mensagens por conexão** (só o chat, 1/s) | **crítico** |
| Interest management | hunt: tela ✔; **praça: O(N) por jogador**; party: O(N) por jogador | grade espacial + índice de salas |
| Serialização | `JSON.stringify` de cada chave do personagem para comparar, 1x/s | trocar comparação por versões/"sujo" |

Conclusão: o desenho de rede está bom. **Não** vale trocar JSON por binário
agora — 0,3 KB/s por jogador já é pouco, e o custo real está no *cálculo* do
que mandar, não no tamanho.

Arquitetura de interesse proposta (só onde há mundo compartilhado):

```
Praça (cidade, 187×108): grade de células 16×16 → Set de sessões por célula.
  andar()  → move a sessão de célula só quando troca de célula.
  jogadoresNaPraca(eu) → olha as 9 células em volta (≈ constante), não todos.
Party/sala: Map<sala, Set<sessão>>, atualizado em entrar/sair da hunt.
  naMesmaSala(s) → sala.membros (O(tamanho da party)), não todos os online.
Hunt solo: já é instância própria — nada a fazer.
```

---

## 7. FASE 6 — Entidades

| Entidade | Onde vive | Processada quando | Problema |
|---|---|---|---|
| Bichos da hunt | `estado.hunt.monstros` (até **547** numa hunt) | todo tique, todos | laço inteiro em `moverMonstros`, `alvoAtual`, `golpesDosMonstros`; cada bicho carrega `loot`, `name`, `look`, `colors` copiados do bestiário |
| Jogadores na praça | `vivas` | todo tique, O(N²) | §6 |
| NPCs/objetos da praça | `CITY_META` (fixo) | stringify por tique no delta da praça | chave fixa: tirar do delta |
| Projéteis/efeitos/dano | eventos do tique (vão e somem) | só no tique que acontecem | ok |
| Loot no chão | `Inventario.chaoParaCliente()` | todo tique na cidade | versão/"sujo" |
| Desconectado | sessão removida de `vivas` e do relógio ✔ | nunca | ok; a hunt segue offline por timestamp ✔ |

Estratégia ACTIVE / NEAR / FAR / INACTIVE para os **bichos de uma hunt**:

| Estado | Critério | Atualização |
|---|---|---|
| ATIVO | perseguindo ou a ≤ `ALCANCE_DE_PERCEPCAO` do jogador | completa, 4 Hz (como hoje) |
| PERTO | na tela (23×13 + margem) mas parado | só animação/direção; sem BFS |
| LONGE | fora da tela, vivo | **nada** por tique; só entra na conta de respawn/lure |
| INATIVO | morto aguardando respawn | só o timestamp de renascer (já é assim) |

Hoje o código já pula quem não persegue (`if (!m.perseguindo) continue`), mas
**ainda varre os 547** em vários laços por tique e a checagem "casa livre?" é
`hunt.monstros.some(...)` **por vizinho** (O(M²) no pior caso). Uma grade de
ocupação (`Uint16Array` do tamanho do mapa) torna isso O(1).

---

## 8. FASE 15 — Os 10 maiores gargalos (medidos)

### 1. Simulação offline síncrona no login — **CRÍTICO**
- **Arquivo/função:** `server/sistemas/cacadas.mjs::simularAusencia` (chamada ao entrar no personagem, `nucleo/sessao.mjs`)
- **Impacto:** servidor **inteiro** parado 1,5–2,3 s por login de quem ficou 2h+ fora (até 7.200 tiques de hunt de uma vez: 30 min simulados; o resto é projetado).
- **Frequência:** todo login com hunt offline — no horário de pico, vários por minuto.
- **Causa:** laço `for (t = desde; t <= fim; t += 250) tique(...)` na thread do jogo.
- **Solução:** rodar em `worker_threads` (a função já é pura sobre `estado`: manda o estado, recebe o estado). Paliativo imediato: simular 5 min em vez de 30 e projetar o resto (a projeção já existe: `projetar`).
- **Risco:** baixo (worker) / médio (paliativo muda levemente o rendimento offline). **Dificuldade:** média.

### 2. Tique monolítico e síncrono — **CRÍTICO para escalar**
- **Arquivo/função:** `nucleo/sessao.mjs::rodarRelogio` → `tique()`
- **Impacto:** 167 ms de cada 250 ms com 200 caçando; ping p50 185 ms. Teto de ~150–200 jogadores caçando por processo.
- **Frequência:** 4 Hz × todas as sessões.
- **Causa:** um laço só, uma thread só; rede, simulação e autosave misturados.
- **Solução:** (a) fatias de tique (fase 3, barato); (b) simulação em N workers por jogador/sala (fase 5).
- **Risco:** (a) baixo, (b) médio. **Dificuldade:** (a) baixa, (b) alta.

### 3. Ficha de combate recalculada do zero várias vezes por tique — **ALTO**
- **Arquivo/função:** `sistemas/ficha.mjs::combate`, chamada de `regenerar`, `golpesDosMonstros` (por golpe), `contraAtaque`, `round`, `characterParaCliente` (2x)
- **Impacto:** **14% do tempo do tique** (1,86 s de 13,4 s no perfil de 200 jogadores). Cada chamada soma equipamento, afixos, árvore, gemas, proficiência, imbuements.
- **Causa:** função pura sem memorização.
- **Solução:** memorizar por tique (chave = `estado` + instante do tique) — seguro e simples; depois, "sujo" por evento (§5).
- **Risco:** baixo (por tique). **Dificuldade:** baixa.

### 4. Busca de caminho e ocupação alocando e varrendo demais — **ALTO**
- **Arquivo/função:** `hunt/caminho.mjs::bfsDistancias` (`new Int16Array(W*H)` + `new Int32Array(W*H)` **a cada chamada**; `proximoPassoAte` faz até 4 BFS), `hunt/monstros.mjs::moverMonstros` (`livre()` = `monstros.some` por vizinho), `Set` de `"x,y"` refeito por passo em `cacadas.mjs::tique`
- **Impacto:** `bfsDistancias` é o maior tempo próprio do perfil (1,5 s de 20 s com 200); coletor de lixo 0,5 s.
- **Solução:** reusar os buffers por mapa (zerar só o que foi visitado); grade de ocupação dos bichos; chave numérica `y*W+x` no lugar de string.
- **Risco:** baixo (há `testes/caminho.test.mjs` comparando com a versão antiga). **Dificuldade:** baixa/média.

### 5. Laços O(N²) na praça e na party — **ALTO**
- **Arquivo/função:** `sistemas/chat.mjs::jogadoresNaPraca` (+ `guildaDe` 2x por vizinho); `sistemas/party.mjs::naMesmaSala` (chamado por `partilha`, `guia` e `extrasDoRetrato`, 2–3x por jogador por tique, **mesmo sem party**)
- **Impacto:** cidade com 200: `snapshotDaPraca` = 40% do tique. Hunt com 200: `extrasDoRetrato` 0,5 s/20 s. Crescem ao quadrado: 1.000 na cidade ≈ 25x.
- **Solução:** grade espacial na praça; `Map<sala, Set>` na party; sair cedo quando não há party.
- **Risco:** baixo. **Dificuldade:** baixa/média.

### 6. Estado do personagem inchado (bichos com loot copiado) — **ALTO**
- **Arquivo/função:** criação dos bichos em `hunt/monstros.mjs` / `cacadas.mjs::entrar`; gravação em `sessao.mjs::gravarAgora` → `banco.mjs::gravarEstadoPersonagem`
- **Impacto:** 148–719 KB por personagem; `JSON.stringify` + `UPDATE` síncronos ~6 ms cada (0,8 s/20 s com 200); login faz `JSON.parse` disso; `cartaoDaConta` faz parse de **todos** os personagens da conta; lista de amigos faz parse de cada amigo offline (N+1); rankings fazem `json_extract` em blobs desse tamanho.
- **Causa:** o bicho leva `loot` (742 B), `name`, `look`, `colors` do bestiário; os 547 bichos são gravados a cada 30 s.
- **Solução:** bicho = `{uid, key, x, y, hp, dir, ...dinâmico}`, o resto vem de `BESTIARY[key]`; **não gravar `monstros`/`respawns`** (a hunt renasce ao voltar, a simulação offline já recria o andamento). Autosave só com "sujo".
- **Risco:** médio (vários lugares leem `m.name`/`m.loot`; testes cobrem boa parte). **Dificuldade:** média.

### 7. `characterParaCliente` a cada segundo + SQL no caminho quente — **MÉDIO/ALTO**
- **Arquivo/função:** `nucleo/sessao.mjs::characterParaCliente` / `mandarEstado`; `party.mjs::camposDoPersonagem` → `banco.mjs::lerMelhoriasDaConta`
- **Impacto:** monta ~60–100 KB de objeto e faz `JSON.stringify` de cada chave para comparar, 1x/s por jogador; **uma consulta SQL + parse por jogador por segundo**; `Ficha.combate` e `Ficha.totais` chamados 2x cada dentro dele.
- **Solução:** cache das melhorias da conta na sessão; seções com versão/"sujo" (inventário mudou → só `inventory`/`weight`); chamar a ficha uma vez.
- **Risco:** médio (delta errado = tela desatualizada). **Dificuldade:** média.

### 8. Dados fixos pelo WebSocket a cada login — **MÉDIO**
- **Arquivo/função:** `sessao.mjs::ola` (catálogo 2 MB no `hello`, antes do cliente poder dizer que já tem), `welcome` (itens 1,25 MB + mapa da cidade 3,7 MB); mapas de hunt no primeiro quadro de cada hunt
- **Impacto:** 723 KB no fio + deflate na thread de I/O por conexão; celular que reconecta paga de novo; `pedirMapa` sem limite (3,7 MB por pedido).
- **Solução:** servir catálogo/itens/mapas como arquivos versionados por hash (`/gamedata/v/<hash>/catalog.json`, `immutable`), pré-comprimidos (nginx `brotli_static`/`gzip_static`); o WS manda só os hashes. O cliente precisa trocar a origem desses dados (mudança pequena em `main.mjs`/`auth.mjs`).
- **Risco:** médio (toca o cliente original). **Dificuldade:** média.

### 9. Mapas de hunt carregados na hora, síncronos, e pesados em memória — **MÉDIO**
- **Arquivo/função:** `hunt/terreno.mjs::mapaRealCapturado` / `gradeDaHunt` (`readFileSync` + `JSON.parse` + `percursoDoMapa`)
- **Impacto:** até **395 ms** de servidor parado na primeira entrada numa hunt; 127 mapas em cache = **224 MB** de heap (a grade andável é `Set` de strings `"x,y"` por andar).
- **Solução:** pré-processar num passo de build (`tools/`) para um formato compacto (bitmap `Uint8Array` + rota pronta) e carregar no boot; ou carregar no worker.
- **Risco:** baixo. **Dificuldade:** média.

### 10. Sem limite de tamanho nem de ritmo de mensagem — **CRÍTICO (robustez)**
- **Arquivo/função:** `server/index.mjs` (`new WebSocketServer` sem `maxPayload`; `ws.on('message')` sem limite); `sessao.mjs::despachar`
- **Impacto:** uma mensagem de 100 MB = `JSON.parse` de 100 MB na thread do jogo (segundos parado); `pedirMapa` em laço = MBs de deflate por pedido. **Um cliente derruba a experiência de todos** (o item 11 do pedido).
- **Solução:** `maxPayload` de ~1 MB (o áudio do chat vai até `MAX_AUDIO_BYTES` = 800 KB; o ideal depois é mandar áudio por HTTP e baixar o limite do WS para ~64 KB); balde de fichas por sessão (ex.: 30 msgs/s, rajada 60); `pedirMapa` no máximo 1 a cada 3 s; fechar conexão que estoura.
- **Risco:** baixo. **Dificuldade:** baixa.

Outros achados (menores ou que dependem de escala):
- Mercado: `SELECT * FROM mercado_ofertas` inteiro a cada abertura/filtro, filtro e paginação em JS, sem índice em `kind/moeda/item/price`.
- Ranking/site: `json_extract` sobre a tabela inteira de personagens (blobs de até 720 KB), com cache de 15 s. Com 100 mil personagens isso é uma varredura de GBs.
- `lower(nome) = lower(?)` e `COLLATE NOCASE` não usam o índice `UNIQUE(nome)` (que é BINARY): varredura completa em amigos, guildas, site, arena.
- Tabela `sessoes` nunca expira (cresce para sempre; token eterno).
- Brotli nível 9 **síncrono** na primeira requisição de cada arquivo (~50–110 ms por arquivo de 0,5–1 MB, ~300 ms no total na partida a frio).
- `Object.defineProperty` de `guia`/`partilha` em todo tique de hunt.
- Chat global: `JSON.stringify` + deflate por destinatário.
- Áudio do chat, parties, desafios de arena, `guildaDe` (cache `lembradas`) vivem na memória do processo: não sobrevivem a reinício e não funcionam com mais de um processo sem Redis.

---

## 9. FASE 7/8 — Renderização e object pooling

| Item | Situação | Proposta |
|---|---|---|
| Sprites / atlas | já em atlas (cidade 9,1 MB PNG, hunts até 5,3 MB, itens em 10 páginas) com WebP ao lado ✔ | ok; atlas de hunt só é baixado ao entrar na hunt |
| Draw calls | ~400 `drawImage`/quadro na hunt, de 1 atlas; pulo de quadro idêntico ✔ | aceitável para Canvas 2D; WebGL/batching só se medir FPS baixo em aparelho real **com GPU** |
| Culling | só casas visíveis ✔; bichos fora da tela nem chegam ✔ | ok |
| Partículas/efeitos | efeitos e projéteis por evento, com liga/desliga (`graficos.mjs`) e "modo leve" automático ✔ | ok |
| Nomes | placa de nome em cache com teto de 150 ✔ | ok |
| Overlay de nomes | canvas da tela inteira × DPR, limpo por quadro | **teto de DPR** (§14) |
| Object pooling (cliente) | GC do cliente 90–100 ms em 20 s | **não vale** agora |
| Object pooling (servidor) | GC 0,5 s em 20 s com 200 jogadores; lixo vem de: buffers do BFS, `snapshotDaHunt` (objeto novo por bicho por tique), `Set`s de strings, `JSON.stringify` do delta | reusar buffers do BFS (gargalo 4); o resto cai sozinho com "sujo"/grade. Pool genérico de objetos **não** — complexidade sem ganho medido |

---

## 10. FASE 9 — Memória

- **Servidor:** 3 rodadas iguais de 40 jogadores: heap 97 → 97 → 98 MB. **Sem
  vazamento detectado.** O que sobe de 35 MB (partida) para ~100 MB são caches
  por design: grades de hunt, textos JSON dos objetos grandes, índices.
  Risco real é o **cache sem teto** das grades (224 MB com tudo carregado).
- Listas: amostras de exp limitadas à última hora ✔; áudios expiram em 5 min ✔;
  `guildaDe` (`lembradas`) sem teto (1 entrada por nome consultado) — pequeno.
- Sessões: saem do relógio e de `vivas` no `close`/`error` ✔.
- **Cliente:** heap 22 MB estável em 20 s; chat limitado a 200 por aba ✔; um
  socket novo por reconexão (o antigo é descartado) ✔.
- **Não medido ainda** (ficam para a fase 9 do plano): troca de personagem
  repetida, abrir/fechar painéis 100x, 2h de sessão contínua no cliente.

---

## 11. FASE 10/11/12 — Backend, banco e cache

### Banco hoje

- `node:sqlite` **síncrono**, WAL, um arquivo. Toda chamada para a thread do jogo.
- `personagens.estado` = o personagem inteiro em JSON. Rápido de desenvolver,
  ruim de consultar: ranking, site, amigos, guildas e arena fazem
  `json_extract`/`JSON.parse` do blob.
- 9 módulos com SQL próprio; nenhuma transação.
- **Consistência:** o mercado apaga/atualiza a oferta e credita o outro lado
  **na hora**, mas o ouro/itens de quem comprou só vão para o banco no autosave
  (até 30 s depois). Se o processo cair nesse intervalo, o comprador volta
  sem ter pago e a oferta já foi consumida — **dinheiro criado do nada**. Mesmo
  risco na transferência do banqueiro.

### Honestidade sobre o PostgreSQL

Para **um servidor só**, o volume atual de escrita (200 jogadores × 1 gravação
a cada 30 s ≈ 7 gravações/s) cabe folgado no SQLite. O que o PostgreSQL traz
de verdade: vários processos escrevendo ao mesmo tempo (necessário a partir da
fase 5 com workers/processos), transações de economia robustas, backups e
réplica com ferramentas maduras, e consultas concorrentes do site sem disputar
com o jogo. Como é o objetivo (VPS + Docker), ele entra — **mas depois** de
tirar o banco do caminho quente, porque o driver do PostgreSQL é assíncrono e
hoje há consulta síncrona dentro do tique.

### Onde cada dado deve morar

| Dado | Onde | Por quê |
|---|---|---|
| Contas, personagens (colunas quentes: nome, vocação, level, xp, skills, outfit, promovido, pontos de arena, visto_em), estado frio (JSONB), guildas, amizades, mercado, histórico, **livro-caixa** de ouro/coins | **PostgreSQL** | fonte da verdade, transações |
| Estado vivo do personagem online, hunt, bichos, cooldowns, party, desafios | **memória do processo** que simula aquele jogador | muda 4x/s; não é para banco nem Redis |
| Catálogo, itens, mapas, bestiário, grades compactas | memória (carregado no boot) + **HTTP com cache** para o cliente | fixo |
| Melhorias da conta, guilda de cada nome, perfil público | cache em memória com invalidação | lido toda hora |
| Sessões de login, presença online, pub/sub de chat/amigos/party entre processos, limite de ritmo, ranking ao vivo (ZSET), áudio do chat (TTL 5 min) | **Redis — só quando houver mais de um processo de jogo** | antes disso é memória do processo |
| Catálogo/itens/mapas já baixados | **cliente**: cache HTTP (`immutable`) | login em KB |

### Esquema PostgreSQL proposto (resumo)

```sql
contas(id uuid pk, email citext unique, senha text, criada_em timestamptz)
sessoes(token_hash bytea pk, conta uuid fk, criada_em, expira_em)          -- com expiração
personagens(id uuid pk, conta uuid fk, nome citext unique, vocacao, sexo,
            level int, xp bigint, promovido bool, arena_pontos int,
            outfit jsonb, visto_em timestamptz, versao int)                 -- colunas quentes
personagem_estado(personagem uuid pk fk, estado jsonb, versao int)          -- o resto, frio
personagem_skills(personagem uuid, skill text, valor int, pk(personagem, skill))  -- ranking
mercado_ofertas(... , index (kind, moeda, item, price), index (personagem))
livro_caixa(id bigserial, de uuid, para uuid, moeda, valor bigint, motivo, em)  -- anti-duplicação/auditoria
guildas / guilda_* / amizades / arena_*: como hoje, com índices em nome (citext)
```
Ranking: índices em `personagens(level desc, xp desc)` e
`personagem_skills(skill, valor desc)` — consulta de milissegundos, sem cache.

### Persistência proposta

- **Write-behind:** o tique nunca espera o banco. Estado sujo entra numa fila;
  um laço assíncrono grava em lote (`UPDATE ... FROM (VALUES ...)`) a cada
  ~60 s ou quando a fila enche. `versao` evita gravar por cima de algo mais novo.
- **Economia é síncrona com o banco:** comprar no mercado, transferir no banco,
  compra na loja = **uma transação** que grava as duas pontas (colunas de
  ouro/coins + livro-caixa + oferta) antes de responder. O estado em memória
  só muda depois do `COMMIT`.
- Saída do processo (`SIGTERM` do Docker): esperar a fila esvaziar antes de
  sair (hoje o `soltarPersonagem` é síncrono; com PostgreSQL precisa de `await`).

---

## 12. FASE 13 — Sistema idle

Aqui o projeto **já está no desenho certo**:
- Nenhum timer por jogador: um relógio só para todos ✔ (`sessao.mjs`, comentário "Um relógio para todos").
- Regeneração, stamina, boosts, prey, imbuements, buff power, treino offline: **por tempo decorrido** (`agora - ultimaRegen`) ✔.
- Respawn, cooldowns, golpes: **timestamps** (`proximoGolpeEm`, `proximoPasso`, `R.jaPode`) ✔.
- Progresso offline: `offlineDesde` + simulação + projeção ✔ — o problema é só **onde** ela roda (gargalo 1).

Ajustes:
- Na cidade, a regeneração/stamina pode ir a 1 Hz (mesma conta por timestamp).
- Simulação offline: worker + menos minutos simulados, mais projeção.
- Hunt de quem está com a aba em segundo plano: já corta efeitos; pode ir
  além (não montar `snapshotDaHunt` enquanto `oculta`, só barras e run).

---

## 13. FASE 14 — Mobile

Medido (412×915, CPU 4x mais lenta, Chromium sem GPU):

| DPR | FPS | long tasks em 15–20 s | maior | overlay |
|---|---|---|---|---|
| 3 | **23** | **40** | 187 ms | 1236×2745 (3,4 Mpx) |
| 2 | 36 | 1 | 51 ms | 824×1830 |
| 1 | 51 | 0 | — | 412×915 |

- O canvas **principal** já é pequeno e fixo (736×416, ampliado por CSS) — não
  é ele. O custo que escala com o DPR é o **overlay de nomes/textos**, que é da
  tela inteira em pixels físicos e é limpo e redesenhado a cada quadro.
- Proposta: `ratio = Math.min(devicePixelRatio, 2)` **no overlay**
  (`map.mjs::resizeOverlay`, `nitido`, e as chaves das placas). Texto em DPR 2
  numa tela DPR 3 continua nítido a olho; é o valor que os números acima
  sustentam. Não mexer no canvas principal (já é pixel art ampliada).
- Rede no celular: cada reconexão paga 723 KB (gargalo 8).
- **Precisa confirmar em aparelho real** (fraco/intermediário/moderno), com GPU
  de verdade: o headless exagera o custo de raster. O `medidor.mjs` e o modo
  leve automático (`graficos.mjs`) já dão a base para isso.

---

## 14. FASE 16 — Matriz de prioridade

| # | Problema | Impacto | Frequência | Complexidade | Prioridade |
|---|---|---|---|---|---|
| 1 | Simulação offline trava o servidor no login | Muito alto (todos param 1,5–2,3 s) | Todo login pós-ausência | Média | **CRÍTICO** |
| 10 | Sem `maxPayload`/limite de ritmo | Muito alto (1 cliente trava todos) | Sob abuso | Baixa | **CRÍTICO** |
| — | Mercado/banqueiro sem transação (duplicação em queda) | Alto (economia) | Em quedas | Média | **CRÍTICO** |
| 2 | Tique monolítico síncrono | Alto (ping 185 ms a 200) | 4 Hz | Baixa (fatias) / Alta (workers) | **ALTO** |
| 3 | `Ficha.combate` sem memorização | Alto (14% do tique) | Várias por tique | Baixa | **ALTO** |
| 5 | O(N²) praça/party | Alto e cresce ao quadrado | 4 Hz | Baixa/Média | **ALTO** |
| 6 | Estado de 150–720 KB (bichos) | Alto (save, login, ranking, amigos) | 30 s + logins | Média | **ALTO** |
| 4 | BFS/ocupação alocando e varrendo | Médio/alto (maior tempo próprio) | Por passo | Baixa/Média | **ALTO** |
| 7 | Personagem inteiro 1x/s + SQL no tique | Médio | 1 Hz por jogador | Média | **MÉDIO** |
| 9 | Mapa de hunt síncrono na 1ª entrada, 224 MB | Médio (395 ms) | 1ª entrada por mapa | Média | **MÉDIO** |
| 8 | Dados fixos pelo WS (723 KB/login) | Médio (rede/celular) | Todo login | Média | **MÉDIO** |
| 13 | Overlay em DPR cheio no celular | Médio/alto no celular | Por quadro | Baixa | **MÉDIO** |
| — | Ranking/site/amigos com `json_extract`/parse de blob, `lower(nome)` sem índice | Baixo hoje, alto com 10 mil+ personagens | Por consulta | Média | **MÉDIO** |
| — | `renderAll` a cada `state` + reflow forçado | Baixo no desktop | 4 Hz | Média | **BAIXO** |
| — | Brotli síncrono na partida a frio | Baixo (~300 ms uma vez) | Por deploy | Baixa | **BAIXO** |
| — | Chat global stringify por destinatário | Baixo | Por fala | Baixa | **BAIXO** |
| — | `sessoes` sem expiração | Baixo (cresce devagar; segurança) | — | Baixa | **BAIXO** |

---

## 15. FASE 17 — Arquitetura proposta (adaptada ao que existe)

Não é para virar microserviços. O jogo tem uma propriedade que decide tudo:
**a hunt é uma instância por jogador (ou por sala de party)**. A simulação é o
que pesa, e ela é paralelizável por natureza. O mundo compartilhado (praça,
chat, amigos, guildas, mercado) é leve.

```
                       ┌────────────── VPS (Docker Compose) ──────────────┐
 navegador ──HTTPS──►  │ nginx: TLS, estáticos pré-comprimidos (immutable),│
            ──WSS───►  │        /ws com upgrade, limite de conexões por IP │
                       │                     │                             │
                       │  ┌──────────────── game (Node) ────────────────┐  │
                       │  │ THREAD PRINCIPAL                              │  │
                       │  │  Gateway: WS, maxPayload, limite de ritmo,    │  │
                       │  │           serialização                        │  │
                       │  │  Sessões + Dispatcher (tabela de comandos     │  │
                       │  │           registrada por sistema)             │  │
                       │  │  Mundo compartilhado: Praça (grade espacial), │  │
                       │  │     Chat, Amigos, Guildas, Party (índice de   │  │
                       │  │     salas), Arena (casamento), Ranking        │  │
                       │  │  Economia: Mercado/Banco/Loja → transação     │  │
                       │  │  Persistência: repositórios + fila write-behind│ │
                       │  │  Eventos: EventEmitter síncrono, poucos tipos │  │
                       │  ├───────────────────────────────────────────────┤  │
                       │  │ WORKERS DE SIMULAÇÃO (worker_threads, N=cores-1)│ │
                       │  │  cada um dono de um conjunto de jogadores/salas│ │
                       │  │  tique 4 Hz: hunt, combate, bichos, caminho,  │  │
                       │  │  regen, stamina, boosts, familiar, treino     │  │
                       │  │  entrada: comandos; saída: delta pronto (texto)│ │
                       │  │  + simulação offline do login                 │  │
                       │  └───────────────────────────────────────────────┘  │
                       │  postgres:16 (volume + pg_dump diário)             │
                       │  redis (SÓ quando houver 2+ processos de jogo)     │
                       └────────────────────────────────────────────────────┘
```

CLIENTE: manter o original. Mudanças pontuais: teto de DPR no overlay, UI
"suja por painel" onde medir custo, dados fixos por HTTP com cache.

Por que não seguir a lista genérica (NetworkGateway, AISystem, QuestSystem,
Queues...): não existe IA separada da hunt (os bichos são 150 linhas dentro
dela), não há quests com estado compartilhado, e fila externa só faz sentido
com vários processos. Criar esses nomes agora seria arquitetura sem ganho
medido.

Decisões ruins atuais, uma a uma:

| Decisão | Por que é problema | Impacto | Alternativa | Mudar agora? | Risco |
|---|---|---|---|---|---|
| Tudo numa thread, laço único | um jogador pesado atrasa todos | teto ~150–200 caçando | fatias + workers | fatias sim; workers na fase 5 | médio |
| Trabalho pesado síncrono no login/entrada | congela o servidor | 0,4–2,3 s | worker/pré-processamento | **sim** | baixo |
| `sessao.mjs` objeto-deus | todo sistema novo mexe nele; 49 imports | manutenção, conflito | dispatcher com tabela | fase 7 | médio |
| Estado = um JSON grande | consulta cara, gravação cara | save/ranking/amigos | colunas quentes + JSONB frio; bicho normalizado | parcial (fase 1 e 6) | médio |
| SQL espalhado e síncrono | impede PostgreSQL; consulta no tique | teto e migração | repositórios assíncronos | fase 6 | médio |
| Economia fora de transação | duplicação em queda | econômico | transação + livro-caixa | **sim, junto da fase 1/6** | médio |
| Social importando o motor da hunt | acoplamento, ciclo | manutenção | read-model de presença | fase 7 | baixo |
| Dados fixos pelo WS | login pesado | rede/celular | HTTP com cache | fase 4 | médio (cliente) |

---

## 16. FASE 18 — Plano de refatoração incremental

Regra em todas as fases: um PR por item, `npm test` verde (hoje 179 testes),
e rodar de novo as medições da §1 antes e depois. Nenhuma fase depende de
reescrever outra.

### Fase 1 — Correções críticas
1. `maxPayload` + limite de ritmo por sessão + limite no `pedirMapa`.
2. Simulação offline num `worker_thread` (paliativo se precisar antes: 5 min simulados + projeção).
3. Parar de gravar `monstros`/`respawns` e tirar os campos do bestiário de cada bicho.
4. Cache das melhorias da conta na sessão (tira SQL do tique).
5. Mercado e transferência do banco em transação única, gravando as duas pontas na hora.
- **Saída:** login com 12h offline não passa de 50 ms de ping para os outros; estado gravado < 30 KB; mensagem acima do `maxPayload` é recusada sem travar.

### Fase 2 — Frontend
1. Teto de DPR 2 no overlay (`map.mjs`).
2. Tirar o reflow forçado do ouro.
3. `renderAll` → renderização por painel onde o perfil mostrar custo (começar por HUD e barra de ações).
- **Saída:** celular emulado DPR 3 ≥ 35 FPS e < 5 long tasks em 20 s; desktop sem regressão (`tools/perf/perfil-cliente.mjs`).

### Fase 3 — Game loop
1. Tique em fatias (5 × 50 ms).
2. `Ficha.combate` memorizada por tique.
3. BFS com buffers reusados; grade de ocupação dos bichos; chaves numéricas.
4. Cidade: regeneração a 1 Hz; `guia/partilha` sem `defineProperty` por tique.
- **Saída:** 200 caçando com CPU < 45%, ping p99 < 60 ms, intervalo p99 < 280 ms (`tools/carga.mjs 200 40`).

### Fase 4 — WebSocket / interesse
1. Grade espacial da praça; índice sala → membros da party.
2. Personagem por seções "sujas" em vez de montar tudo a cada 1 s.
3. Chat global serializado uma vez.
4. Catálogo, itens e mapas por HTTP versionado; WS manda só os hashes.
- **Saída:** 200 na cidade com CPU < 15%; login com cache < 50 KB no fio.

### Fase 5 — Backend
1. Workers de simulação (`worker_threads`), jogador/sala fixo num worker.
2. Grades de hunt compactas, pré-processadas no build e carregadas no boot.
3. Estáticos pré-comprimidos no build (sem Brotli síncrono em runtime).
- **Saída:** 1.000 bots caçando num VPS de 4 vCPU com intervalo p99 < 300 ms e ping p99 < 100 ms.

### Fase 6 — Banco / cache (PostgreSQL)
1. Camada de repositórios (tirar SQL dos 9 módulos), primeiro sobre o SQLite atual, com API assíncrona.
2. Colunas quentes + índices (ranking, busca por nome com `citext`), `sessoes` com expiração.
3. Implementação PostgreSQL dos mesmos repositórios, escolhida por variável de ambiente; script de migração SQLite → PostgreSQL.
4. Autosave write-behind com "sujo" e `versao`.
- **Saída:** testes passam nos dois bancos; ranking < 10 ms com 100 mil personagens sintéticos; nenhuma chamada ao banco dentro do tique.

### Fase 7 — Desacoplamento
1. `EventEmitter` com os 5 eventos da §5.
2. Social sem importar `cacadas` (read-model de presença).
3. Arena fora do motor de combate (ganchos).
4. `sessao.mjs` dividido em Gateway / Sessão / Dispatcher (comandos registrados por sistema).
- **Saída:** `cacadas` sai do fan-in de chat/amigos/guildas; ciclos de import zerados; `sessao` < 30 imports.

### Fase 8 — Mobile
1. Medir em 3 aparelhos reais (fraco/intermediário/moderno) com o `medidor.mjs`.
2. Ajustar o teto de DPR e o limiar do modo leve pelos números reais.
3. Reconexão barata (depende da fase 4.4).

### Fase 9 — Stress testing
1. Ampliar `tools/carga.mjs`: cenário misto (caçando / cidade / chat / mercado), tempestade de logins, voltas de offline, 500 / 1.000 / 2.000 bots.
2. Teste de 2 h para memória (servidor e cliente), troca de personagem e reconexão em laço.
3. Rodar dentro do Docker com limite de VPS real (ex.: 2 vCPU / 4 GB).

### Trilha de infraestrutura (paralela, a partir do fim da fase 1)

- `Dockerfile` do jogo: `node:22-slim`, usuário sem root, `HEALTHCHECK` em `/saude`, `stop_grace_period: 30s` para o autosave de saída.
- `docker-compose.yml`: `nginx`, `game`, `postgres:16` (volume), e `redis` só quando existir o segundo processo.
- nginx: TLS (Let's Encrypt), `brotli_static`/`gzip_static`, `Cache-Control: immutable` para URLs com versão, `proxy_pass` do `/ws` com `Upgrade`/`Connection`, `limit_conn`/`limit_req` por IP.
- Backup: `pg_dump` diário com rotação, testado com restauração.
- Métricas mínimas em `/saude`: duração do tique (p50/p99), atraso do event loop, online, heap, tamanho da fila de gravação.
- Quando precisar de mais de um processo/máquina: nginx com afinidade (a sessão fica no mesmo processo), Redis para presença, pub/sub (chat, amigos, convites de party) e limite de ritmo; o ranking pode virar ZSET.

---

## Apêndice — Como repetir as medições

```bash
cd server && npm install
node --inspect=127.0.0.1:9229 index.mjs               # servidor com o profiler
node tools/carga.mjs 200 40                            # carga (outro terminal)
node tools/perfil-servidor.mjs 20                      # CPU por função durante a carga
node tools/perf/memoria.mjs antes                      # heap depois do GC
TOKEN=$(node tools/perf/preparar-personagem.mjs | jq -r .token)
node tools/perf/login-offline.mjs $TOKEN               # travamento do login offline
node tools/perf/perfil-cliente.mjs $TOKEN Perfteste desktop 20 desk
DPR=3 node tools/perf/perfil-cliente.mjs $TOKEN Perfteste mobile 20 mob
```
(`preparar-personagem.mjs` cria a conta `perf@teste.local`; apague-a do banco
depois se for um banco de verdade.)
