# Auditoria completa e otimização de performance — síntese e lacunas

Data: 2026-09-27. **Só diagnóstico — nenhum arquivo de jogo foi alterado.**

## Atualização (mesma sessão, mais tarde): causa real dos "ícones não oficiais" no mobile — corrigida

Pedido explícito antes do resto desta síntese: achar e corrigir os "ícones
não oficiais" no mobile. **Não era CSS, nem ativo errado, nem nada
específico de mobile** — era o rate limit do nginx (`limit_req` da
`location /`) rejeitando requests aleatórios com 503 em todo carregamento
frio da tela de jogo, porque o cliente (sem bundler, ES modules soltos)
dispara ~74-106 requests em paralelo e o `burst=40` configurado só cobria
40. Reproduzido ao vivo (navegador embutido, `read_network_requests`):
sempre os MESMOS arquivos falhavam (`gamedata/missile-sprites.json`,
`client/src/traduz.mjs`, `packages/shared/src/formulas.mjs` — a ordem de
import de `main.mjs` é determinística), o que se manifestava como "ícone
quebrado" no mobile mas valia igual no desktop (só menos notado, telas
maiores escondem mais). Corrigido subindo `burst` para 200 em
`game/docker/nginx/conf.d/game.conf.inc`, `nginx -s reload` aplicado,
confirmado com dois carregamentos frios completos (desktop e mobile
375×812 emulado) sem nenhum 503. Detalhe técnico em `docs/deploy.md` §9c.
Isto também explica parte da sensação geral de "lag"/"travando" relatada
mais abaixo — é o item **#21** na tabela de gargalos.

## Por que este documento não repete medições do zero

O pedido veio um dia depois de uma auditoria de performance e uma de
mobile terem sido feitas **nesta mesma máquina, com ferramentas reais**
(`tools/perf/*`, `tools/carga.mjs`), com commits aplicados e remedidos:

- [`docs/auditoria-performance.md`](auditoria-performance.md) — 833 linhas.
  Linha de base medida, 10 gargalos com arquivo/função/impacto/solução/risco,
  matriz de prioridade, arquitetura proposta, e **Fases 1, 3, 4 e 6 já
  implementadas e remedidas** (commits citados, número antes/depois de cada
  uma — inclusive os casos em que a meta **não** foi batida, com o motivo).
- [`docs/auditoria-mobile.md`](auditoria-mobile.md) — responsividade medida
  em 10 resoluções reais, alvos de toque corrigidos com tabela antes/depois.
- [`docs/refatoracao-estrutura.md`](refatoracao-estrutura.md) — mapa de
  dependências completo, ciclos de import, e a divisão `game/backend` /
  `engine` / `systems` / `database` / `websocket` / `admin` / `frontend` /
  `gamedata` **já executada** (11 etapas, uma por commit).
- [`docs/deploy.md`](deploy.md) — Docker Compose (nginx + game + postgres +
  redis opcional) já montado, testado neste repositório, com backup e script
  de deploy.

Refazer essas medições agora, no meio desta sessão, sem os mesmos bots de
carga rodando em paralelo, daria números **piores** que os já registrados —
não mais confiáveis. Este documento **não duplica** o que já foi medido:
confirma que os arquivos citados ainda existem no código atual (a
reestruturação para `game/*` aconteceu DEPOIS da auditoria de performance;
já conferi os caminhos novos — `game/websocket/limites.mjs`,
`game/docker/nginx/conf.d/*`, `game/docker/docker-compose*.yml` — e o que
está descrito bate com o código de hoje), soma o que os documentos citados
não cobrem do seu pedido, e organiza tudo no formato que você pediu.

---

## 1. RESUMO

**O maior gargalo já identificado e parcialmente resolvido é o mesmo: o
processo do jogo é uma coisa só — um laço de tique síncrono, uma thread.**
Depois das Fases 1/3/4, o teto medido é de **~200 jogadores caçando por
processo antes do ping degradar** (CPU 70-72% em vez dos 45% que a Fase 3
mirava; o que sobrou é `bfsDistancias`, `write`/`writev` do WebSocket e o
custo fixo de 200 sessões × 4 tiques/s — não há mais um vilão único e óbvio
como havia antes da Fase 3). **Isto só se resolve de verdade com workers de
simulação por jogador/sala (Fase 5, planejada, não feita)** ou com mais de
um processo (aí sim entra o Redis, que hoje existe no `docker-compose.yml`
mas não é chamado por nenhuma linha de código do jogo).

O que o SEU pedido cobre e os documentos existentes **não** cobrem:
reorganização de ícones em menu/gaveta no mobile (a auditoria de mobile só
corrigiu alvo de toque e safe-area, não mexeu em arquitetura de informação),
teste de carga acima de 200 (a Fase 9, "500/1.000/2.000 bots", está
planejada mas não executada), cabeçalhos de segurança HTTP (não há CSP/
X-Frame-Options no nginx), e um plano concreto para quando o Redis for
realmente ligado.

---

## 2. TOP 20 GARGALOS

| # | Problema | Local | Impacto | Evidência | Status | Risco |
|---|---|---|---|---|---|---|
| 1 | Tique monolítico síncrono — teto ~200 caçando/processo | `game/websocket/sessao.mjs::rodarRelogio` | CPU 70-72% com 200; ping p99 62-362ms (variação alta) | `docs/auditoria-performance.md` §4, Fase 3 remedida | **Parcial** — fatias de 50ms feitas (`1090805`); workers (Fase 5) não | Alto (workers) |
| 2 | Sem workers de simulação por jogador/sala | idem | é o que tiraria o jogo do teto de 1 processo | Fase 5 do audit | **Tentado e desligado** — infra criada (`game/systems/simulador-tique*.mjs`), hunts solo, correção provada por teste; carga real (`tools/carga.mjs 30 20`) piorou o ping (p99 174ms→1037ms com 2 workers, pior ainda com 4) em vez de melhorar — causa não investigada a fundo (suspeita: custo de clone estruturado do estado inteiro a cada tique). `SIMULADORES_TIQUE=0` por padrão, não recomendado ligar. Detalhe em `auditoria-performance.md`, Fase 5 | Alto |
| 3 | `bfsDistancias` aloca 2 arrays a cada chamada | `game/systems/hunt/caminho.mjs` | maior tempo próprio isolado do perfil | audit §8 item 4 | **Pendente** (buffers reusados) | Baixo |
| 4 | `write`/`writev` do WebSocket, ~13-14% CPU com 200 | `ws.send` nativo | piso do modelo atual (1 msg/tique/sessão) | audit Fase 4, resultado | **Estrutural** — só cai com menos mensagens ou mensagens compartilhadas | Alto (mudança de arquitetura) |
| 5 | Login manda catálogo/itens/mapa pelo WS (6MB/723KB) | `sessao.mjs::ola`/`welcome` | rede e celular pagam isso a cada conexão | audit §8 item 8, Fase 4.4 **adiada de propósito** (risco de reordenar handshake sem navegador ao vivo) | **Pendente, desenhado** | Médio |
| 6 | Mapas de hunt síncronos na 1ª entrada (até 395ms) + 224MB de heap com todos carregados | `hunt/terreno.mjs::mapaRealCapturado` | trava o servidor na 1ª entrada de cada mapa | audit §8 item 9 | **Pendente** | Médio |
| 7 | `sessao.mjs` é objeto-deus (49→41 imports diretos) | `game/websocket/sessao.mjs` | todo sistema novo mexe nele | audit §2.3, Fase 7 | **Pendente** (fora do escopo da refatoração de pastas, de propósito) | Médio |
| 8 | Ciclo `arena ↔ combate` / `arena ↔ cacadas` | `game/systems/{arena,cacadas,hunt/combate}.mjs` | engine "genérica" conhece feature específica | audit §2.3, refatoracao §2.3 | **Pendente** (Fase 7) | Baixo (ESM tolera; é dívida, não bug) |
| 9 | Ciclo `afixos ↔ gemas ↔ imbuements ↔ inventario ↔ boosts` | `game/systems/*.mjs` | mesmo padrão do #8 | confirmado via `graphify` nesta sessão (uso só dentro de função, seguro) | **Estrutural, benigno** | Baixo |
| 10 | `sistemas/bosses.mjs` lê `api-mapeada/` em runtime | `game/systems/bosses.mjs` | única leitura de dado de referência em produção | refatoracao §2.2, §5 pergunta 4 | **Dívida documentada, não corrigida** | Baixo |
| 11 | Autosave grava tudo, todo intervalo (sem "sujo"/versão) | `sessao.mjs::gravarAgora` | I/O de banco maior que o necessário | audit Fase 6, item 4 (⬜) | **Pendente** | Médio |
| 12 | `sessoes` sem expiração no banco | `game/database/banco.mjs` | cresce para sempre; token eterno | audit §8 "outros achados" | **Pendente** | Baixo (segurança) |
| 13 | Ranking/site/amigos com `json_extract`/parse de blob | `sistemas/{ranking,site,amigos}.mjs` | baixo hoje, alto com 10 mil+ personagens | audit §8 | **Pendente** | Médio (escala) |
| 14 | `lower(nome) = lower(?)` não usa índice `UNIQUE` (BINARY) | vários módulos de busca por nome | varredura completa em amigos/guildas/site/arena | audit §8 | **Parcial** — `citext` já entrou no Postgres (Fase 6.2); confirmar se SQLite ainda tem o problema | Baixo |
| 15 | Sem métricas reais em `/saude` (só `{ok,online}`) | `game/backend/index.mjs:103-106` | não dá pra ver tique p50/p99, atraso do event loop, heap, fila em produção | confirmado agora no código; `docs/deploy.md` §9 | **Pendente** | Baixo |
| 16 | Sem cabeçalhos de segurança HTTP (CSP, X-Frame-Options, HSTS, Referrer-Policy) | `game/docker/nginx/conf.d/*.conf*` | confirmado agora — nenhum `add_header` de segurança no nginx | não coberto por nenhum documento anterior | **Gap novo** | Baixo/Médio |
| 17 | Sem limite de CPU por container (só memória, 1g) | `game/docker/docker-compose.prod.yml` | um container pode saturar o host em CPU mesmo com `deploy.resources.limits.memory` | confirmado agora no arquivo | **Gap novo** | Baixo |
| 18 | Redis existe no compose mas zero código fala com ele | `game/docker/docker-compose.yml` (`profiles: ["scale"]`) | nenhum risco hoje; mas também nenhum plano de código pronto para quando precisar | confirmado (`grep -r redis game/` só acha o compose) | **Documentado, sem plano de código** | — |
| 19 | Ícones do HUD não têm reorganização mobile (agrupar em menu/gaveta) | `game/frontend/client/src/{hud,actionbar,mobile}.mjs`, `style.css` | a auditoria de mobile corrigiu alvo de toque, não arquitetura de informação | **Gap novo** vs. seu pedido (§10-12) | **Não iniciado** | Médio (toca `panels.mjs`, 25 mil linhas) |
| 20 | Teste de carga só validado até 200 jogadores | `tools/carga.mjs` | seu pedido pede 10/50/100/500/1000 | audit Fase 9, planejada não executada | **Pendente** | — |
| 21 | nginx `limit_req burst=40` menor que o carregamento frio real (~74-106 requests) | `game/docker/nginx/conf.d/game.conf.inc`, `location /` | 503 aleatório em assets no carregamento frio — a causa dos "ícones não oficiais" no mobile, também acontecia (menos notado) no desktop | reproduzido ao vivo hoje, ver atualização no topo deste documento | **✅ Corrigido agora** (`burst=200`, verificado sem 503 em 2 cargas frias) | Baixo |

---

## 3. FRONTEND

Medido (desktop, caçando, 20s): CPU da aba 40%, **zero long tasks**, heap
22MB estável — **cliente desktop saudável** (`auditoria-performance.md` §3).
Pendente (Fase 2, planejada não feita): teto de DPR no overlay mobile,
tirar o reflow forçado do contador de ouro, `renderAll()` por painel em vez
de tudo a cada `state` (4/s) — hoje funciona pelo remendo global
`so-quando-muda.mjs`, que já economiza ~140ms/s de estilo tratando o
sintoma; regravar `panels.mjs` (25 mil linhas) painel por painel **não se
paga** sem medir custo real por painel primeiro.

## 4. MOBILE

`auditoria-mobile.md`: 10 resoluções reais medidas, `--e-tablet` adicionado,
5 alvos de toque corrigidos com tabela antes/depois, safe-area estendida.
**Não coberto** (seu pedido, §11-14): a regra "mesmo jogo, mesmos sistemas,
diferença é apresentação" já é respeitada (nada foi removido), mas a
reorganização de ÍCONES em menu/drawer para reduzir DOM simultâneo no
celular (§10, §12 do seu pedido) não foi feita — hoje o mobile usa gaveta
para janelas, mas a barra de ações/ícones do topo ainda mostra os mesmos
elementos do desktop, só maiores. As 16 resoluções exatas do seu pedido
(1920×1080 até 932×430) não foram todas testadas — a auditoria cobriu 10,
com sobreposição parcial. Teclado cobrindo UI (`visualViewport`) e tooltip
de comparação de item cortando em 360px ficaram documentados como
pendentes, não corrigidos.

## 5. ÍCONES

Ver #19 da tabela. Não há auditoria específica de "poluição visual de
ícones" — a auditoria de mobile mediu alvo de toque (tamanho mínimo), não
quantidade simultânea de ícones na tela nem agrupamento. É trabalho novo.

## 6. GAME LOOP

`auditoria-performance.md` §4 e Fase 3: tique em 5 fatias de 50ms já feito
(`1090805`); `Ficha.combate` memorizada por tique já feito (`12dd27e`,
1.86s→0.83s); grade de ocupação dos bichos já feita (`18d0ff6`, ganho a
partir de ~500-1000 bichos); regeneração da cidade a 1Hz já feita
(`115e59c`, 453ms→115ms). **Não** existe mega-loop monolítico — os sistemas
já são funções puras sobre `estado`, chamadas em sequência de um só tique
(é a causa do gargalo #1, não uma falta de separação de sistemas).

## 7. IDLE SYSTEM

`auditoria-performance.md` §12: **já está no desenho certo**. Nenhum timer
por jogador (um relógio só, comentário "Um relógio para todos" em
`sessao.mjs`), regeneração/stamina/boosts/prey/imbuements por tempo
decorrido (timestamp), respawn/cooldowns por timestamp, progresso offline
por `offlineDesde` + simulação em `worker_thread` (Fase 1.4, já feito —
pior ping de outro jogador numa volta de 2h caiu de 1.506-2.279ms para
77-130ms). O único ajuste pendente citado: cidade pode ir a 1Hz também
para regeneração (parte já feita, ver Fase 3.3).

## 8. RENDERIZAÇÃO

`auditoria-performance.md` §9: atlas + WebP já em uso, culling de bichos
fora da tela já existe, pulo de quadro idêntico já existe, object pooling
no cliente **não vale a pena** (GC do cliente é 90-100ms em 20s, baixo).
No servidor, o lixo que sobra vem de buffers do BFS (#3 da tabela) e
`snapshotDaHunt` criando objeto novo por bicho por tique — cai sozinho
quando o BFS for corrigido. **Não trocar DOM por canvas** — sem evidência
de ganho medido, exatamente como você pediu para evitar.

## 9. WEBSOCKET

`auditoria-performance.md` §6 e Fase 4: tráfego já é baixo (0,3KB/s por
jogador), delta por chave já existe, batching já existe (1 msg/tique),
interest management na praça já foi resolvido com grade espacial
(`0292255`, O(N²)→linear). **maxPayload (1MB) e rate limit (token bucket,
40msg/s, rajada 120) já implementados** (`game/websocket/limites.mjs`,
confirmado agora). Pendente: dados fixos (catálogo/itens/mapa) ainda vão
pelo WS a cada login (Fase 4.4, adiada por risco de handshake — ver #5 da
tabela). Broadcast de chat já serializa uma vez (`0292255`, testado em
`chat-broadcast.test.mjs`).

## 10. BACKEND

`refatoracao-estrutura.md`: mapa de dependências completo, `sessao.mjs`
ainda é o maior hub (41 imports diretos) — Fase 7 (dispatcher por sistema,
EventEmitter para os 5 eventos identificados) resolveria isso, não feita.
Dois ciclos de import documentados (`arena↔combate`, `arena↔cacadas`) — ESM
tolera (uso só dentro de função), mas impede separação engine/systems de
verdade. Confirmei nesta sessão, via `graphify`, mais um ciclo
(`afixos↔gemas↔imbuements↔inventario↔boosts`) com o mesmo padrão seguro.

## 11. REDIS

**Atualização de 2026-09-27, depois desta síntese**: implementado o
primeiro uso real — cache de leituras caras entre processos, escolhido
pelo dono do projeto entre as opções listadas (cache / presença / rate
limit / pub-sub). `game/database/redis.mjs` (dual-mode: sem `REDIS_URL`,
tudo vira no-op, igual a hoje — mesmo padrão de `db.mjs`/Fase 6):

- `lerMelhoriasDaConta`/`gravarMelhoriasDaConta` (`game/database/banco.mjs`):
  Redis como camada abaixo do Map local, TTL 5 min, invalidado na hora por
  quem grava.
- `guildaDe` (`game/systems/guildas.mjs`): mesma ideia; `esquecer()` limpa
  o prefixo inteiro no Redis também (`SCAN`, não `KEYS`).

Testado de ponta a ponta pela stack Docker real (nginx→game→Redis): criei
personagem, confirmei as chaves (`melhoriasDaConta:<conta>`,
`guildaDe:<nome>`) no Redis; depois **injetei um valor diferente direto no
Redis, reiniciei o container do jogo** (limpando o Map local) **e o login
seguinte leu o valor injetado**, não o do Postgres — prova de que o
caminho "Redis primeiro, banco só no miss" funciona de verdade. Testes
automatizados em `game/testes/redis.test.mjs` (dual-mode, mesmo padrão de
`db.test.mjs` com `REDIS_URL_TESTE`); suíte completa: 232 testes, 230
passam, 2 pulados (Postgres/Redis reais, sem env de teste).

Continua **não** usado para: presença, pub/sub entre processos, rate
limit compartilhado, ranking ZSET — isso seria uma fase própria (opção
"pub/sub entre processos" que não foi a escolhida agora), só necessária
de verdade a partir de 2+ processos de jogo. Porta 6379 só é exposta ao
host no override de DEV (`docker-compose.override.yml`, para
`redis-cli`/testes) — em produção (`docker-compose.prod.yml`, sem esse
override) continua interna à rede do Docker.

## 12. POSTGRESQL

Fase 6, ✅ feita: camada de repositórios assíncrona (`game/database/db.mjs`,
`banco.mjs`), os 9 módulos que faziam SQL direto convertidos, `citext` para
busca sem `lower()`, dual-mode SQLite/Postgres pela env `DATABASE_URL`,
script de migração testado. 231 testes passam nos dois bancos. **Pendente**
dessa mesma fase: autosave write-behind com "sujo"+versão (hoje grava tudo,
todo intervalo — item 4, ⬜); reconfirmar "ranking <10ms com 100 mil
personagens sintéticos" depois da conversão (não remedido). Economia
(mercado, banqueiro) já em transação única desde a Fase 1.5 — sem risco de
duplicação em queda de processo, testado.

## 13. MEMÓRIA

`auditoria-performance.md` §10: **sem vazamento detectado** — 3 rodadas de
40 jogadores deram heap estável (97→97→98MB); o que sobe é cache por
design (grades de hunt, até 224MB com os 127 mapas carregados — risco real
é esse cache sem teto, não vazamento). Sessões saem de `vivas` e do
relógio no `close`/`error`. **Não medido ainda**: troca de personagem
repetida, abrir/fechar painéis 100x, sessão de 2h contínua no cliente —
ficam para a Fase 9 (stress testing), não feita.

## 14. NETWORK

Coberto pelo item WebSocket (§9) e pelo nginx (§15). `keepalive 32` no
upstream do nginx evita reabrir conexão TCP por request do site. `limit_conn`
20 por IP tanto no HTTP quanto no `/ws`. Sem CDN — não é necessário no
estágio atual (VPS único).

## 15. NGINX

Confirmado agora (`game/docker/nginx/conf.d/*.conf*`): TLS pronto mas
comentado (falta domínio real), `/ws` com `Upgrade`/`Connection` corretos e
timeout de 1h (sessão de jogo fica horas conectada), `limit_req`/`limit_conn`
por IP no HTTP e no WS, `/api/mapas` (editor) bloqueado para tudo que não
seja rede interna Docker ou localhost — com o cuidado extra de cobrir o NAT
hairpin de túnel SSH (bloco `172.16.0.0/12`), exatamente o fix dos 2 últimos
commits do repositório. **nginx não recomprime nem cacheia por conta
própria** de propósito — o jogo já faz isso (`estaticos.mjs`) e duplicar
seria trabalho em dobro com `Cache-Control` conflitante — decisão correta,
não um gap. **Gap real**: nenhum cabeçalho de segurança (`Content-Security-
Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Strict-Transport-Security` depois do TLS) — nenhum documento anterior
cobriu isso.

## 16. DOCKER

`docker-compose.yml`: `game` depende de `postgres` saudável antes de subir;
`stop_grace_period: 30s` dá tempo do `SIGTERM` gravar todo mundo antes do
`SIGKILL`; `HEALTHCHECK` no Dockerfile bate em `/saude`; volumes read-only
para frontend/gamedata/api-mapeada (um `git pull` atualiza sem rebuild);
usuário sem root na imagem. `docker-compose.prod.yml`: limite de memória
1GB no `game` e no `postgres` (não medido por carga real ainda, é teto
contra vazamento), rotação de log (10MB × 5 arquivos) nos três serviços.
**Gaps confirmados agora**: sem limite de **CPU** por container (só
memória); `postgres` não tem `deploy.resources.limits` no override de prod
(só o `game` e o próprio Postgres têm memória — confirmar se isso foi
proposital); nenhuma métrica de container (cAdvisor/Prometheus) — a seção
34 (Observabilidade) do seu pedido não tem nenhuma solução ainda.

## 17. SEGURANÇA

`/api/mapas` (editor/admin) já bloqueado por IP interno no nginx (ver §15) —
**a única superfície administrativa que existe** (`refatoracao-estrutura.md`
§4.1: "não existe hoje nenhum sistema de administração com papéis"). Rate
limit e `maxPayload` no WebSocket já cobrem o abuso de mensagem (§9).
Postgres/Redis não expostos publicamente (confirmado — nenhuma porta deles
mapeada no nginx, só 5432/6379 internos ao compose). **Gaps**: sem
cabeçalhos HTTP de segurança (§15); `sessoes` sem expiração no banco (#12
da tabela); CORS não auditado ainda (o jogo serve tudo pela mesma origem
via nginx, então o risco é baixo hoje, mas não foi verificado
explicitamente); uploads — não há upload de arquivo no jogo hoje (o único
"upload" é áudio de chat em base64 pelo WS, já limitado a 800KB).

## 18. ARQUITETURA

`auditoria-performance.md` §15 (arquitetura proposta) e
`refatoracao-estrutura.md` (execução): a divisão em `game/{backend,engine,
database,websocket,systems,admin,frontend,gamedata}` **já está no ar**,
zero mudança de comportamento (11 commits, um por etapa, testes verdes em
cada um). O que falta para ser uma separação de verdade (não só de pasta)
é a Fase 7 do audit de performance: EventEmitter para os 5 eventos
identificados (presença, subiu de level, mudou ficha, vendeu no mercado,
morreu na hunt), arena desacoplada do motor de combate por gancho, e
`sessao.mjs` dividido em Gateway/Sessão/Dispatcher. Isso é o que
resolveria os ciclos de import (#8, #9 da tabela) e tornaria o `engine`
realmente reutilizável (objetivo da seção 28 do seu pedido). **Decisão
explícita já tomada e documentada**: não fazer isso junto da reorganização
de pastas, porque mexe em fluxo de controle, não só em `git mv`.

---

## PLANO DE IMPLEMENTAÇÃO (mapeado às suas 11 fases)

Reaproveitando a numeração e o conteúdo já planejado nos documentos
existentes — nenhuma fase nova inventada onde já existe uma:

| Sua fase | Conteúdo | Status | Documento |
|---|---|---|---|
| FASE 1 — Gargalos críticos | `maxPayload`, rate limit, simulação offline em worker, bichos sem cópia do bestiário, economia em transação | ✅ **Feito e remedido** | audit §16, Fase 1 |
| FASE 2 — Frontend/renderização | Teto de DPR mobile, tirar reflow forçado, `renderAll` por painel | ⬜ Planejado, não feito | audit §16, Fase 2 |
| FASE 3 — Game loop/idle | Fatias de tique, `Ficha.combate` memorizada, BFS/grade de ocupação, regen 1Hz | ✅ **Feito e remedido** (meta agregada de CPU não batida — ver nota) | audit §16, Fase 3 |
| FASE 4 — WebSocket/rede | Grade espacial da praça, personagem por seções sujas, chat serializado 1x, dados fixos por HTTP | 🟡 **3/4 feitos**; item 4 (dados fixos por HTTP) adiado por risco | audit §16, Fase 4 |
| FASE 5 — Backend (workers) | `worker_threads` por jogador/sala, grades de hunt pré-processadas, estáticos pré-comprimidos no build | ⬜ Planejado, não feito — **é o que resolve o gargalo #1** | audit §16, Fase 5 |
| FASE 6 — PostgreSQL | Repositórios assíncronos, colunas quentes+índices, dual-mode, migração | ✅ **Feito** (autosave write-behind pendente) | audit §16, Fase 6 |
| FASE 7 — Redis/cache | Ainda não é necessário (1 processo). Plano de código para quando precisar: presença, pub/sub, rate limit compartilhado, ranking ZSET | ⬜ **Sem plano de código escrito ainda** — gap novo desta síntese | — |
| FASE 8 — Memória | Sem vazamento detectado; cache de grades sem teto (224MB no pior caso) | 🟡 Medido, teto do cache pendente | audit §16, Fase 8/9 |
| FASE 9 — Mobile/responsividade | 10 resoluções medidas e corrigidas; **reorganização de ícones em menu/gaveta NÃO feita**; 6 resoluções do seu pedido não testadas ainda | 🟡 **Parcial** — gap novo (ícones) | mobile audit + esta síntese |
| FASE 10 — Docker/infraestrutura | Compose completo, healthcheck, limite de memória, backup, deploy script | 🟡 **Feito**; falta limite de CPU, métricas de container, cabeçalhos de segurança nginx | deploy.md + esta síntese |
| FASE 11 — Escalabilidade | Workers (Fase 5) + Redis (quando 2+ processos) + teste de carga 500-1000-2000 | ⬜ **Planejado (Fase 9 do audit = "stress testing"), não executado** | audit §16, Fase 9 |

**Nota sobre a Fase 3 (Game Loop):** a meta de CPU (<45% com 200 caçando)
não foi batida — ficou em 70-72%. Cada item individual foi medido e
confirmado isoladamente (números exatos no documento original); a soma
dos quatro não bastou porque o BFS e o custo fixo de rede (`write`/`writev`)
não fazem parte desta fase — é por isso que a Fase 5 (workers) é o próximo
passo que realmente move a agulha, não uma repetição da Fase 3.

---

## O que eu preciso que você decida antes de eu implementar qualquer coisa

1. **Fase 5 (workers) é a que mais vale a pena tecnicamente, mas é a de
   maior risco/esforço** (o audit já classifica como "Alta" dificuldade).
   Quer que eu comece por ela, ou prefere os itens de risco baixo primeiro
   (Fase 2 frontend, buffers do BFS, cabeçalhos de segurança no nginx,
   limite de CPU no Docker — todos "Baixo" risco/dificuldade)?
2. **Reorganização de ícones mobile (§10-12 do seu pedido)**: isso não
   estava em nenhum documento anterior. Quer que eu faça um estudo à parte
   (tela por tela, o que agrupar em menu) antes de tocar em CSS/JS, do
   mesmo jeito que a auditoria de mobile foi feita?
3. **Teste de carga até 1.000-2.000** (Fase 9 do audit): isso precisa rodar
   fora desta sessão de chat (minutos de carga sustentada) — confirma que
   posso disparar `tools/carga.mjs` com esses números neste ambiente local
   (não é produção, é o mesmo container/processo local de sempre)?
4. A Fase 4.4 (dados fixos por HTTP) e a Fase 7 (desacoplar `sessao.mjs`)
   foram **propositalmente adiadas** pela auditoria original por mexerem em
   fluxo de controle sem cobertura de teste de navegador ao vivo. Quer que
   eu trate isso diferente, ou mantenho o mesmo critério de cautela?
