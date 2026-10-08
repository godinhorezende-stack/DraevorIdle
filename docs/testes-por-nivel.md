# Testes por nível — QUICK, SYSTEM e FULL

A suíte completa continua existindo e continua rodando **todos** os arquivos. O que muda é **quando** ela roda. Uma mudança pequena roda
o que ela atinge (QUICK ou SYSTEM). A FULL fica para o núcleo, para o que toca muitos sistemas, antes de merge e antes de deploy. Nenhum
teste foi apagado, pulado, desativado, transformado em `todo`, ganhou timeout ou foi alterado por causa disto. O motor só **escolhe**
quais arquivos de teste o `node --test` executa.

- Matriz de todos os testes (sistema, tempo, boot, dependências, se roda isolado) e o **TOP 20** dos lentos com o motivo:
  [testes-matriz.md](testes-matriz.md), gerada por `npm run test:auditoria`.
- Saída local (fora do git): `game/testes/.saida/` — o log de cada rodada, `tempos.json`, `aprovadas.json` (os fingerprints),
  `ultima-full.txt`, `isolado.json`.

## 1. Arquitetura

```
                          game/tools/testes/testar.mjs   ← o MOTOR (o único com lógica)
                         /            |             \
   npm test / test:* (package.json)   |      .githooks/pre-commit (git)     ← cada um só chama o motor
                          .claude/settings.json → hook-antes-do-commit.mjs (Claude Code)

   testar.mjs usa:  sistemas.mjs (o MAPA CURADO, a autoridade)   grafo.mjs (imports diretos, o sinal auxiliar)
                    ambiente.mjs (onde pode rodar, segurança, workers)   coletor.mjs (reporter: tempos, boot, contagens)
                    auditoria.mjs (a matriz e o TOP 20)
```

| Arquivo | O que é |
|---|---|
| `game/tools/testes/testar.mjs` | o motor: classifica as mudanças, roda o nível, valida, relata, grava o fingerprint aprovado, instala o pre-commit |
| `game/tools/testes/sistemas.mjs` | os 14 sistemas (fontes e testes de cada um), o núcleo da FULL obrigatória, os limiares da FULL recomendada, o que não tem teste |
| `game/tools/testes/ambiente.mjs` | o ambiente (LOCAL / CI / STAGING / PRODUCTION_HOST / PRODUCTION) pelos sinais reais da máquina, a segurança (nada de URL ou credencial de produção nos testes) e o paralelismo adaptativo |
| `game/tools/testes/grafo.mjs` | o grafo de dependências (imports estáticos, dinâmicos literais, `new URL(…, import.meta.url)`) — para os imports DIRETOS |
| `game/tools/testes/coletor.mjs` | reporter do `node --test`: uma linha por arquivo, e o JSON da rodada (tempo de parede, tempo dos testes, contagens, falhas) |
| `game/tools/testes/auditoria.mjs` | `docs/testes-matriz.md`: a matriz, o TOP 20 com o motivo, a rodada isolada (`--isolado`) |
| `game/tools/testes/hook-antes-do-commit.mjs` | a cola do hook do Claude Code: reconhece o `git commit` e chama o motor |
| `.githooks/pre-commit` | a cola do git: chama o motor (`npm run test:instalar-hook` instala, uma vez por clone) |

## 2. A suíte (auditoria de 08/10/2026)

- **368 arquivos de teste**: 250 do jogo oficial e 118 irmãos `.classico.test.mjs`, que rodam o mesmo arquivo no modo clássico.
- **3.559 testes**: 2.942 passam, 0 falham, 615 pulados (as marcas da migração, com o motivo), 2 TODO (`jaFalhava`: `editor-conteudo:53`,
  `prey-combate:66`).
- **FULL: 10,5 min de parede** na medição inicial desta auditoria (4 núcleos, 3 processos; feita na VPS ANTES da regra do §7 — hoje
  ela seria recusada aqui). Somando os arquivos, são 28,3 min. Numa
  máquina mais lenta, ou com menos núcleos livres, passa de 20 min.
- **BOOT × TESTS**: quase todo arquivo carrega o jogo inteiro (`apoio.mjs` → `iniciarJogoDoPoe()`). Os números estão na
  §10 e na matriz. A carga do jogo é o piso de todo arquivo, e é por isso que o QUICK escolhe poucos ARQUIVOS.
- **Distribuição**: 206 arquivos levam menos de 3 s; 108, de 3 a 6 s; 39, de 6 a 15 s; 11, de 15 a 60 s; **4 levam mais de 60 s** (20% do
  tempo somado: `validacao`, `itens-poe-jogo`, `server-save` e o irmão dele).
- **Rodada isolada** (auditoria): cada um dos 368 arquivos sozinho, no seu processo, 3 por vez — 10 min. 367 passaram. O `loot-moeda`
  falhou uma vez e passou nas 30 repetições seguintes (12 sozinho e 18 com 3 cópias ao mesmo tempo). Classificação: **intermitente, não
  reproduzido; sem evidência de A nem de E**. A mensagem se perdeu porque a auditoria descartava o stdout; já corrigido (agora guarda o
  `spec`). O teste não foi mexido; na próxima ocorrência, a mensagem fica registrada em `isolado.json`.

### Dependências e conflitos

| Recurso | Quem usa | Conflito em paralelo? |
|---|---|---|
| SQLite de desenvolvimento (`game/database/dados`) | contas, personagens, sessão, party, server save… | **é o recurso compartilhado.** Já mitigado: o `server-save` usa um SQLite próprio (`apoio-banco-proprio.mjs`); o irmão clássico, outro arquivo; a party, uma tabela por processo (`PARTY_TABELA`); cada teste apaga o que criou (`@teste.local`). |
| Porta HTTP | `acesso`, `estaticos*`, `infra-editores`, `hot-reload-conteudo` | não: todos usam `listen(0)`. |
| PostgreSQL | só `db.test` | não: só com `DATABASE_URL_TESTE` (sem ela, pula). **Nunca o de produção.** |
| Redis | só `redis.test` | não: sem `REDIS_URL`, no-op. |
| Arquivos do jogo (overrides, versões) | editores, hot reload | não: pasta temporária (`DRAEVOR_OVERRIDES`); `isolamento-dos-testes.test.mjs` recusa o contrário. |
| Git | `git-envio`, `git-integracao`, `publicacao` | não: repositórios temporários. |
| Workers e processos filhos | offline, simulador, validação | não entre arquivos; pesam na CPU. |
| Estado global (`Math.random`, `process.env`) | vários | não: um processo por arquivo. |

## 3. Os níveis

| Nível | O que roda | Quando | Tempo típico (VPS) |
|---|---|---|---|
| **QUICK** | as **validações rápidas** dos alterados (`node --check`, `JSON.parse`, marca de conflito de merge, `import` de verdade dos módulos do servidor, o validador das skills se mexeu nelas) **+** os testes que dependem DIRETAMENTE deles (até 20: os alterados, os de nome parecido, os mais rápidos) | cliente (frontend), um teste, módulo sem testes | segundos |
| **SYSTEM** | as validações **+ todos** os testes dos sistemas tocados (mapa curado) + os que importam diretamente os alterados | mudança dentro de um ou mais sistemas | 15 s a ~2 min |
| **FULL** | os 368 arquivos | núcleo (obrigatória); muitos sistemas ou módulo muito compartilhado (recomendada); antes de merge importante e de deploy; pedido explícito | ~10,5 min (VPS), 20+ em máquina mais lenta |

*Lint:* não há linter configurado no projeto (nem ESLint nem Prettier no `package.json`). O QUICK usa o que pega erro de verdade sem
dependência nova: sintaxe, JSON, marca de conflito esquecida e o import real.

### FULL obrigatória × recomendada

- **OBRIGATÓRIA** (o hook RODA a FULL antes de deixar o commit passar — onde ela pode rodar; no host do jogo ele barra, §7): o **núcleo** — `testes/apoio*.mjs` (bootstrap dos testes),
  `tools/testes/**` (o runner), `package.json`/`package-lock.json`, `backend/index.mjs` (boot), `database/banco.mjs` e `db.mjs`
  (persistência central), `websocket/sessao.mjs` (WebSocket central), `systems/dados.mjs` e `regras.mjs` (o que todo sistema lê),
  `systems/cacadas.mjs` (o laço da caçada — o "game loop"), `systems/itens-poe/iniciar.mjs` e `catalogo.mjs` (bootstrap e modo do jogo).
- **RECOMENDADA** (não bloqueia; o commit passa com `⚠️ FULL SUITE RECOMENDADA` e o motivo): 4+ sistemas tocados; um arquivo do qual
  ≥ 10% dos testes dependem diretamente (`ficha`, `hunt/combate`, `hunt/monstros`, `acoes`, `afixos`, `skills/gemas`, `treino`,
  `campanha`…); um arquivo fora do mapa curado.

### Como o nível é decidido (`classificar`)

1. As mudanças: `git diff --name-only HEAD` (preparadas ou não) + os arquivos novos. É a ÁRVORE DE TRABALHO, que é o que os testes executam.
2. Por arquivo, nesta ordem:
   - **sem teste** (documentação, skills, `.gitignore`, `_versoes/`, `.br/.gz`) → nada;
   - **núcleo** → FULL obrigatória;
   - **arquivo de teste** → ele e o irmão `.classico`;
   - **cliente** (`frontend/`) → QUICK (as validações e os testes que o importam). Não sobe sozinho para SYSTEM;
   - **o resto** → os sistemas que o **mapa curado** liga ao caminho (`fontes`). Fora do mapa: o sinal auxiliar dos imports (os sistemas
     dos testes que o importam e de quem o importa, até 3 passos), e a FULL fica recomendada.
3. Sinal auxiliar: o teste que importa o arquivo **diretamente** (ou o lê pelo `new URL`) entra sempre, esteja ou não na lista do sistema.
4. **O fecho transitivo NÃO é usado para escolher.** Pelo `apoio.mjs`, quase todo arquivo "alcança" ~335 dos 368 testes, e tudo viraria FULL.

## 4. Os 14 sistemas (o mapa curado)

| Sistema | Apelidos | Fontes (resumo) | Arquivos de teste |
|---|---|---|---:|
| `gemas` | gems, skills | `systems/skills/`, `acoes`, `gemas-poe`, `suportes-poe`, `reserva`, compilador de gemas, `sockets-de-gema`, barra e soquetes do cliente | 53 |
| `itens` | items, inventario | `systems/itens/`, `itens-poe/{gerar,jogo,mods-poe,traduzir,frascos,moedas}`, mochila, bolsa, depósito, troca, forja, gamedata de itens | 77 |
| `combate` | combat, damage | `systems/combate/`, `hunt/combate`, `ficha`, `personagem/`, `mobs/`, `condicoes-poe`, afecções, cargas, `armas/` | 66 |
| `campanha` | campaign, atos, bosses | `campanha*`, atos, `itens-poe/{campanha,monstros,pinaculos}`, encontros, bosses únicos, editor de atos, mapa da campanha | 52 |
| `cacada` | hunt, engine | `systems/hunt/`, `mapa/`, morte, limpeza do chão, treino, mapas das hunts (o `cacadas.mjs` é núcleo) | 44 |
| `offline` | ausencia | consolidação e simulação offline, simulador de tique, server save, limpeza de temporários | 13 |
| `party` | grupo | `party`, `party-recompensas`, `hunt/{aliados,sala,escalonamento}` | 20 |
| `sessao` | websocket, ws | `websocket/` (o `sessao.mjs` é núcleo), estáticos e privados do backend | 33 |
| `banco` | database, db | `database/` (o `banco.mjs` e o `db.mjs` são núcleo) | 16 |
| `cliente` | frontend, ui | `frontend/`, estáticos, pré-compressão | 30 |
| `editor` | admin, overrides | `admin/`, overrides, hot reload, editores do cliente | 55 |
| `loot` | drop, filtro | bolsa, afixos, filtro, baú, drops, moedas, rentabilidade | 24 |
| `social` | site, guildas, chat, arena, loja | site, guildas, chat, arena, loja, mercado, presentes, tarefas | 22 |
| `progressao` | personagem, arvore, xp | árvore, passivas, progressão, prey, charms, classes do PoE | 33 |

Um teste pode estar em mais de um sistema. Todo arquivo de teste está em pelo menos um (a auditoria confere; teste novo sem sistema
aparece lá). Os padrões exatos: `game/tools/testes/sistemas.mjs`.

## 5. Comandos

| Comando | O que faz |
|---|---|
| `npm test` | **FULL** — a suíte oficial (como sempre foi); recusada no host do jogo e em produção (§7) |
| `npm run test:quick` | QUICK das mudanças do git (ou dos arquivos: `npm run test:quick -- game/systems/x.mjs`) |
| `npm run test:system -- gemas` | SYSTEM dos sistemas dados (apelidos valem: `gems combat items campaign websocket database engine frontend`); sem nome, os das mudanças |
| `npm run test:auto` | classifica e roda o nível que as mudanças pedem (o mesmo dos hooks, sem barrar) |
| `npm run test:dry-run` | **não roda nada**: arquivos modificados, sistemas detectados, classificação, testes selecionados, a FULL (obrigatória/recomendada/não necessária), o motivo e se o estado já está aprovado (fingerprint). Com arquivos: `node game/tools/testes/testar.mjs --dry-run game/systems/x.mjs` |
| `npm run test:explain` | o porquê: para cada arquivo, o padrão do mapa que casou e os testes que o importam (e quantos % dos testes); para cada teste escolhido, os motivos |
| `npm run test:auditoria` | gera `docs/testes-matriz.md`; `-- --isolado` roda antes cada arquivo sozinho (só para auditoria: não é o mecanismo normal) |
| `npm run test:ambiente` | a verificação de segurança, sem rodar nada: ambiente, sinais do servidor do jogo, processos, URLs mascaradas, isolamento, se a FULL pode rodar |
| `npm run test:instalar-hook` | instala o pre-commit do git (uma vez por clone) |

Toda rodada termina no mesmo relatório:

```
FULL SUITE
==========
Arquivos: 368 de 368
Total / Passed / Failed / Skipped / Todo / Duration
BOOT:  … (a carga do jogo em cada processo, somada)
TESTS: … (os testes em si, somados)
TOTAL: … (somado por arquivo)
Arquivos mais lentos (boot + testes) …   Testes mais lentos …   Falhas (com A–E) …   Log completo: game/testes/.saida/full-<data>.log
✔ Aprovado — fingerprint <hash> (FULL sobre este conteúdo)
```

Falhou algum teste: o relatório lista cada falha (arquivo:linha, nome, mensagem) e lembra a regra — classificar em **A** (bug real),
**B** (obsoleto), **C** (adaptar), **D** (removido) ou **E** (regressão), nunca ajustar o teste para passar. Uma FULL com muitas falhas
**não** é corrigida em massa: o relatório é o diagnóstico (skill `draevor-testing`).

## 6. Os hooks de commit

Não havia hook de testes no projeto: na prática, a suíte inteira era rodada à mão antes de todo commit. Agora existem dois, e os dois
são só cola para o motor (`testar.mjs auto --hook`):

- **Git** — `.githooks/pre-commit` (versionado). `npm run test:instalar-hook` grava em `.git/hooks/pre-commit` um stub que chama o
  `.githooks/pre-commit` da árvore em que o commit acontece (cada worktree, o seu; branch sem ele → passa). **Não** mexe em
  `core.hooksPath`: os outros hooks da pasta, como o post-commit do graphify, continuam valendo. Pega o commit feito pelo Claude, pelo
  terminal ou por qualquer outra ferramenta.
- **Claude Code** — `.claude/settings.json` → `PreToolUse` no Bash → `hook-antes-do-commit.mjs`. Comando que não é `git commit` passa em
  ~0,1 s; o `git commit` chama o motor e, se ele barrar, devolve o porquê ao Claude (saída 2). Timeout de 1 h (a FULL obrigatória roda
  dentro dele, onde ela pode rodar).

O que acontece no `git commit`:

| Mudança | Resultado |
|---|---|
| só documentação | passa |
| cliente / teste | **QUICK** → passa se passar |
| sistema(s) | **SYSTEM** → passa se passar |
| núcleo, em máquina de desenvolvimento/CI/staging | **FULL obrigatória** → **roda a FULL** → passa se passar |
| núcleo, no host do jogo ou em produção | barra em ~1 s: "FULL obrigatória detectada, mas o ambiente atual não é adequado para execução automática." |
| FULL recomendada | roda o QUICK/SYSTEM → `⚠️ FULL SUITE RECOMENDADA` + motivo → **não bloqueia** |
| mesmo conteúdo já aprovado (fingerprint) por uma rodada que cobre o que o commit pede | passa **sem rodar de novo** (e o segundo hook — git depois do Claude — também) |
| validação ou teste falhou | **barra**, com o relatório |

`git commit --no-verify` pula o pre-commit do git (é do git; use por sua conta).

## 7. Onde a FULL pode rodar — o ambiente e a segurança

O motor descobre o ambiente pelos **sinais reais da máquina** (`ambiente.mjs`), não por variável de ambiente:

| Ambiente | Como é detectado | QUICK / SYSTEM | FULL |
|---|---|---|---|
| **PRODUCTION** | dentro da instalação de produção: o checkout em `/srv/draevor`, `NODE_ENV=production`, contêiner com `DATABASE_URL`, `DRAEVOR_AMBIENTE=producao` | **não rodam** | **não roda** |
| **PRODUCTION_HOST** | a máquina **hospeda o jogo** — qualquer sinal forte: contêineres `draevor*` (Docker), diretório de deploy (`/srv/draevor/app`), configuração de produção (`/srv/draevor/config/.env` — só a existência, o conteúdo não é lido), nginx com o domínio de produção (`mmoidledraevor.io`), portas 80/443 em escuta junto com os outros; processos `node backend/index.mjs` contam como sinal fraco (a máquina de desenvolvimento também sobe o servidor) | rodam **leves** (metade dos núcleos, `nice 10`) — o pre-commit fica rápido | **RECUSADA**, manual e automática: `FULL SUITE BLOQUEADA: esta máquina hospeda o servidor do jogo. Execute a FULL em ambiente dedicado/local/CI/staging.` |
| **CI / STAGING** | variáveis de CI (`CI`, `GITHUB_ACTIONS`…) ou `DRAEVOR_AMBIENTE=ci/staging` — numa máquina **sem** sinal de jogo | rodam | roda (todos os núcleos) |
| **LOCAL** | o resto (máquina de desenvolvimento, ambiente dedicado de testes) | rodam | roda (núcleos − 1) |

- **Nenhuma variável libera a FULL onde há sinal do jogo**: `NODE_ENV=LOCAL`, `DRAEVOR_AMBIENTE=local` não mudam nada; os sinais mandam.
  As variáveis só servem para pedir um ambiente MAIS restrito, ou para dizer CI/staging numa máquina sem jogo.
- **`nice` não autoriza nada**: reduz a prioridade, mas não tira o consumo de CPU, memória, I/O e cache, nem a disputa por banco.
- **No pre-commit**, FULL obrigatória num ambiente que não pode rodá-la responde em ~1 s:
  `FULL obrigatória detectada, mas o ambiente atual não é adequado para execução automática.` + o motivo + a verificação de segurança,
  e barra o commit (saída 2). Nunca começa uma FULL pesada.
- **Verificação de segurança** (`npm run test:ambiente`, e no começo de toda FULL permitida): o ambiente detectado e cada sinal, os
  processos relevantes (game-server, nginx, Postgres, Redis, Docker), `DATABASE_URL`/`REDIS_URL` **mascaradas**, as variáveis removidas,
  se sobrou URL de produção, o isolamento — e só então a FULL roda.
- **O ambiente dos testes não herda produção**: `DATABASE_URL`, `REDIS_URL`, `PG*` e qualquer variável de senha/token/chave saem do
  ambiente dos processos de teste (inclusive do `import` de verdade das validações). Postgres/Redis de teste só por `DATABASE_URL_TESTE` /
  `REDIS_URL_TESTE` (o `db.test` e o `redis.test` leem sozinhos). Se sobrar uma URL com credencial ou do domínio de produção, ou se o banco
  de teste for igual ao do jogo → **nenhum teste roda**.
- **Isolamento verificado** (não presumido): os servidores dos testes usam `listen(0)`; nenhum teste abre WebSocket de rede (a sessão usa
  um socket falso); o SQLite de desenvolvimento é local (WAL + `busy_timeout` de 5 s), compartilhado só entre os processos da MESMA
  rodada (cada teste com nomes únicos e limpeza; o `server-save` com banco próprio; a party com tabela por processo). O `db.test` usa uma
  tabela fixa (`teste_db`) e o Redis de teste chaves fixas: **duas rodadas contra o mesmo Postgres/Redis de teste se atropelam**. Por
  isso há a trava `.saida/rodando.lock` (uma rodada por árvore) e a regra de não rodar FULL onde esses recursos são os do jogo.

## 8. O fingerprint (o que já foi testado)

Não é um horário. É o **sha256 do conteúdo** de todos os arquivos relevantes da árvore de trabalho e da **configuração** que muda o
resultado:

- **estado**: os arquivos do HEAD, com o conteúdo de agora no lugar dos mexidos, mais os novos; cada um pelo hash de blob do git. Ficam de
  fora só os de `SEM_TESTE` (documentação, skills…). Não depende do índice nem do HEAD: depois do commit, a mesma árvore tem o mesmo estado;
- **configuração**: versão do node, sistema/arquitetura, as variáveis do jogo (`DRAEVOR_CLASSICO`, `DRAEVOR_SQLITE`, `DRAEVOR_OVERRIDES`,
  `ITENS_POE`, `NODE_ENV`, `TZ`) e se há Postgres/Redis de teste (só se existem; o valor tem senha);
- **nível e testes**: o registro aprovado guarda o nível e a lista de arquivos que rodaram (`todos` na FULL), e o fingerprint de UMA rodada
  é o hash de estado + configuração + nível + testes (`aprovadas.json`; um registro adulterado é ignorado).

Um commit só pula os testes se uma rodada **aprovada** tem **o mesmo estado e a mesma configuração** e cobre os testes que o nível pede (a
FULL cobre tudo). Um byte a mais num arquivo relevante → outro estado → roda de novo. O estado é fotografado **antes** da rodada: o que
mudar durante ela não sai aprovado.

## 9. Paralelismo (medido depois da auditoria)

O número de processos é **adaptativo** (`planejarParalelismo`), não "núcleos − 1" fixo: o mínimo entre o teto do ambiente (CI/STAGING:
todos os núcleos; LOCAL: núcleos − 1; PRODUCTION_HOST: metade, só para QUICK/SYSTEM), os núcleos ociosos AGORA (núcleos − carga média de
1 min), a memória disponível (`MemAvailable`, ~400 MB por processo, 1,5 GB de reserva) e o número de arquivos. Todo relatório mostra:

```
Parallelism: 2 worker(s) — teto 2 (host do jogo: só QUICK/SYSTEM, metade dos núcleos, prioridade baixa) · 3 núcleo(s) ocioso(s) agora · 23 pela memória · 10 arquivo(s) · prioridade baixa (nice 10)
CPU:         4 núcleo(s), carga média 0.96 (1 min)
Memory:      10.6 GB disponíveis de 15.6 GB
Environment: PRODUCTION_HOST (esta máquina hospeda o servidor do jogo)
```

A medição que embasou isso (os 53 arquivos do sistema `gemas`, nesta VPS, antes da regra do §7):

| Processos ao mesmo tempo | Parede | Memória usada (pico, máquina toda) |
|---:|---:|---:|
| 2 | 75,5 s | 6,0 GB |
| **3 (o padrão)** | **57,1 s** | 6,4 GB |
| 4 | 56,0 s | 6,8 GB |
| 6 | 52,5 s | 7,2 GB |

De 2 para 3 processos o ganho é real (−24%); acima de 3, no máximo 8%, com mais memória e mais espera pela trava do SQLite — mais
processos não é mais rápido. Numa máquina de desenvolvimento maior ou no CI, o teto sobe sozinho.

Os 368 processos isolados servem só para a AUDITORIA. Os níveis agrupam os arquivos numa única chamada do `node --test`. Rodar vários
arquivos num processo só (`--experimental-test-isolation=none`) pouparia a carga do jogo, mas quebra o que depende de processo próprio: o
modo clássico lido ao carregar, o desvio de gravação (`DRAEVOR_OVERRIDES`) antes do import, `PARTY_TABELA`, `Math.random` e
`process.env` trocados. Não foi adotado.

**Não rode duas rodadas ao mesmo tempo na mesma árvore** (dois `npm test`, ou um SYSTEM durante a FULL): as cópias dos mesmos arquivos
disputam as mesmas linhas do SQLite (o server save reivindica o ciclo pelo horário — a segunda cópia é recusada e o teste falha).

## 10. Números e verificações (08/10/2026)

**FULL final: adiada porque o host atual executa o servidor do jogo.** Esta VPS é PRODUCTION_HOST (contêineres `draevoridle-game-1`,
`draevoridle-nginx-1` e `draevoridle-postgres-1`, `/srv/draevor/app`, `/srv/draevor/config/.env`, nginx com `mmoidledraevor.io`, portas
80/443). A FULL de referência é a medição inicial da auditoria (motor antigo, mesmo `testes/*.test.mjs`): **368 arquivos, 3.559 testes,
2.942 passam, 0 falham, 615 pulados, 2 TODO, 10,5 min de parede** (28,3 min somados). A FULL pelo motor novo fica para uma máquina de
desenvolvimento, o CI ou staging — e ela é obrigatória antes do merge desta mudança (ela mexe no núcleo: o próprio runner).

| Verificação | Resultado |
|---|---|
| dry-run de UI (`frontend/client/src/tooltip.mjs`) | QUICK — 10 arquivos; FULL não necessária |
| dry-run de gemas (`systems/itens-poe/suportes-poe.mjs`) | SYSTEM `gemas` — 53 arquivos |
| dry-run de combate (`systems/combate/formulas.mjs`) | SYSTEM `combate` — 68 arquivos |
| dry-run de engine (`systems/cacadas.mjs`, o laço da caçada) | FULL obrigatória |
| dry-run de banco (`database/banco.mjs` / `database/redis.mjs`) | FULL obrigatória / SYSTEM `banco` — 16 arquivos |
| QUICK de UI, rodado (host do jogo, 2 workers, nice 10) | 10 arquivos, 117 testes, 0 falhas — **14 s** (BOOT 17,1 s + TESTS 7,2 s somados) |
| SYSTEM `gemas`, rodado (idem) | 53 arquivos, 593 testes, 0 falhas — **74 s** (BOOT 1 min 23 s + TESTS 56 s somados) |
| pre-commit do git (núcleo alterado, neste host) | barra em ~1,7 s: "FULL obrigatória detectada, mas o ambiente atual não é adequado…" + "FULL SUITE BLOQUEADA…" |
| hook do Claude Code (o mesmo `git commit`) | barra em ~0,9 s, com a mesma mensagem; comando que não é commit passa em ~0,08 s |
| `npm test` / `DRAEVOR_AMBIENTE=local npm test` / `NODE_ENV=LOCAL npm test` neste host | os três recusados em ~1–2 s com "FULL SUITE BLOQUEADA…" |
| erro de sintaxe num arquivo de sistema, pelo hook | barra em 1,2 s, nenhum teste roda |
| fingerprint | aprovado → muda 1 byte num arquivo relevante → "ainda não aprovado" → desfaz → aprovado de novo; mudar só documentação não invalida |
| alteração depois de uma aprovação | o hook roda o QUICK (10 s), aprova o estado novo; o mesmo conteúdo de novo → "Já aprovado"; desfeito → vale a aprovação anterior (a da FULL usa exatamente o mesmo mecanismo, com "todos") |
| segurança | `DATABASE_URL`/`REDIS_URL` ausentes (seriam removidas e mostradas mascaradas); a única credencial no ambiente (um token do Claude Code) sai dos testes; nenhuma URL de produção nos testes |
| rodada isolada (auditoria) | 367 de 368 passaram; `loot-moeda` falhou 1× e passou nas 30 repetições seguintes (intermitente, não reproduzido) |

## 11. Riscos e limitações

- **O mapa curado pode ficar velho.** Um módulo novo ou movido sem entrada em `sistemas.mjs` cai em "fora do mapa": os imports dão os
  sistemas e a FULL fica recomendada. A auditoria lista teste sem sistema. A FULL antes de merge/deploy fecha o resto.
- **Dependência que o grafo não vê:** caminho montado em tempo de execução (`import(\`${G}/…\`)`, `join(…)`) e dado lido por
  `readFileSync` sem `new URL`. O mapa cobre os casos conhecidos (o gamedata por pasta).
- **Commit parcial:** os testes e o fingerprint olham a árvore de trabalho inteira, não só o que vai no commit. Um commit que separa
  arquivos que só funcionam juntos passa (a árvore testada estava completa). A regra continua: commit em pedaços que fazem sentido.
- **O QUICK é amostra:** até 20 arquivos. Mudança de sistema roda o SYSTEM inteiro.
- **Mudança no núcleo feita NA VPS não passa pelo hook**: a FULL é obrigatória e aqui ela é recusada. O caminho é rodar a FULL fora
  (desenvolvimento/CI/staging) — o fingerprint aprovado lá NÃO viaja (`.saida/` é local), então o commit do núcleo sai de lá também; ou
  `git commit --no-verify` com a FULL feita antes do merge (decisão de quem commita).
- **FULL obrigatória dentro do hook** (numa máquina que pode rodá-la) leva ~10 min; rodar `npm test` antes dá o mesmo resultado.
- **QUICK/SYSTEM na VPS ainda usam CPU do host do jogo** (metade dos núcleos, `nice 10`): um SYSTEM grande (`offline`, `editor`) leva
  alguns minutos. É o custo de permitir commit aqui; a FULL, não.
- **A detecção depende dos sinais conhecidos** (Docker com `draevor` no nome, `/srv/draevor`, o domínio). Uma instalação de produção em
  outro lugar precisa entrar em `CAMINHOS_DE_PRODUCAO`/`DOMINIOS_DE_PRODUCAO` (ou `DRAEVOR_SERVIDOR_DO_JOGO=1` no ambiente dela).
- **Postgres/Redis de teste compartilhados entre máquinas** (dois CIs no mesmo `DATABASE_URL_TESTE`) se atropelam: a trava só vale para
  a árvore local.
- **`--no-verify`** pula o pre-commit do git. O hook do Claude Code não tem atalho.
- **Instalação do pre-commit é por clone** (`npm run test:instalar-hook`): um clone novo sem isso só tem o hook do Claude Code.

## 12. Garantias

- Nenhum teste foi removido, pulado, desativado, tornado `todo`, ganhou timeout ou foi alterado. A FULL roda `testes/*.test.mjs`
  inteiro — a mesma lista do `npm test` antigo (a FULL pelo motor novo está adiada: §10).
- Produção (VPS, Postgres, Redis, Docker, dados dos jogadores) não foi tocada: tudo roda na worktree, com o SQLite de desenvolvimento.
  Nem os testes, nem os hooks, nem a auditoria acessam produção ou fazem deploy. A detecção só LÊ sinais (lista de contêineres, processos,
  portas, existência de arquivos, a configuração do nginx); o `.env` de produção não é lido.
