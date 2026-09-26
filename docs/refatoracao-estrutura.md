# Refatoração de estrutura — `/game/*`

Mapa de dependências, riscos e plano de migração para reorganizar o
repositório em `game/backend`, `game/frontend`, `game/engine`,
`game/database`, `game/websocket`, `game/systems`, `game/admin`, `game/docker`
— **sem mudar nenhuma regra de gameplay, economia ou comportamento**.

Nada foi movido ainda. Este documento é o mapa + a proposta pedidos antes de
qualquer `git mv`.

---

## 1. Inventário atual

```
server/
  index.mjs                 — gateway HTTP + upgrade de WebSocket (1 arquivo)
  nucleo/            (11 arquivos, ~?? linhas) — infra + regras centrais
  sistemas/           (47 arquivos)             — os sistemas do jogo
  sistemas/hunt/      (11 arquivos)             — o motor de combate/caçada
  scripts/            (1 arquivo)                — migração SQLite → Postgres
  testes/             (42 arquivos)              — node:test, 231 casos
assets_raw/
  client/             (202 MB) — o cliente extraído (HTML/CSS/JS que roda no navegador)
  gamedata/           (710 MB) — JSON de conteúdo (catálogo, mapas, hunts, árvore) + sprites
  packages/shared/    (232 KB) — código ISOMÓRFICO: client E server importam os mesmos arquivos
  *.html              — as páginas servidas (`/jogar`, `/online`, `/editor`, etc.)
api-mapeada/          (38 MB)  — capturas de referência do jogo original (docs, não código rodando)
docker/, docker-compose*.yml, .env.example, scripts/  — infra de deploy (Fase 6, já pronta)
tools/                — geradores de dados e scripts de carga/perf, todos fora do runtime do jogo
```

16.531 linhas em `sistemas/` + `sistemas/hunt/` + `nucleo/` (sem contar testes).

---

## 2. Mapa de dependências

### 2.1 Camadas, de fora para dentro

```
index.mjs (HTTP + WS upgrade)
  └── nucleo/sessao.mjs (uma conexão = uma Sessao; despacha comando → sistema)
        ├── nucleo/banco.mjs / nucleo/db.mjs  (Postgres/SQLite — Fase 6)
        ├── nucleo/dados.mjs                  (catálogos carregados 1x, na subida)
        ├── nucleo/regras.mjs                 (fórmulas + constantes REAIS do jogo)
        ├── nucleo/quadro.mjs, json.mjs        (protocolo/serialização)
        └── sistemas/*.mjs  (46 módulos — importados quase todos por sessao.mjs)
              └── sistemas/hunt/*.mjs (o motor de caçada/combate, chamado por cacadas.mjs e arena.mjs)
```

`nucleo/sessao.mjs` importa **41 dos 47 módulos de `sistemas/`** diretamente —
é o maior hub do projeto (nenhuma surpresa: é o dispatcher). Os outros hubs
grandes são `sistemas/cacadas.mjs` (motor de caçada, importa 25 módulos,
incluindo todo `hunt/`) e `sistemas/hunt/combate.mjs` (importa 20 módulos de
`sistemas/`, incluindo `arena.mjs`).

### 2.2 Quem depende de quem (fora de `nucleo`/`sistemas`)

| Consumidor | Depende de | Isomórfico? |
|---|---|---|
| `nucleo/regras.mjs` | `assets_raw/packages/shared/src/formulas.mjs` |✅ client usa os mesmos arquivos |
| `nucleo/quadro.mjs` | `assets_raw/packages/shared/src/tela.mjs` | ✅ |
| `sistemas/guildas.mjs` | `assets_raw/packages/shared/src/{brasao-de-guilda,nome-de-guilda,ordem-das-guildas}.mjs` | ✅ |
| `sistemas/premium.mjs` | `assets_raw/packages/shared/src/portas-de-acesso.mjs` | ✅ |
| `nucleo/dados.mjs`, `sistemas/{charms,novidades,proficiencia,amigos,recompensas,entregas,poderes,arvore,gemas,arena,mapas,tarefas,bosses}.mjs`, `sistemas/hunt/terreno.mjs` | `assets_raw/gamedata/**/*.json` (+ sprites, só leitura) | ❌ (só servidor lê; sprites são servidos ao browser pelo `index.mjs`, mas como arquivo estático, não como import) |
| `sistemas/bosses.mjs` | `api-mapeada/servidor/bossToken.json` | ❌ — **único ponto do runtime que lê `api-mapeada`**; é dívida técnica (uma captura de referência virou fonte de dados ao vivo), fora do escopo desta refatoração, só documentando o risco |

**Achado importante**: `assets_raw/packages/shared/` não é "frontend" nem
"backend" — é código isomórfico de verdade, importado pelos dois lados. É o
candidato natural para `game/engine` (ver §4).

### 2.3 Ciclos de import (ESM tolera, mas travam uma separação limpa)

Dois ciclos reais, ambos dentro de `sistemas/`:

1. **`arena.mjs ↔ sistemas/hunt/combate.mjs`** — `arena.mjs` importa
   `armaDoPersonagem`/`alcanceDaArma`/etc. de `combate.mjs`; `combate.mjs`
   importa `arena.mjs` (pra dar bônus de pódio ao fechar uma luta).
2. **`arena.mjs ↔ cacadas.mjs`** — `cacadas.mjs` importa `arena.mjs`
   (pra abrir uma arena); `arena.mjs` importa `cacadas.mjs` (pra ler o estado
   da caçada de quem está lutando).

Isso já funciona hoje porque ESM permite ciclos quando o uso é dentro de
função (não no topo do módulo, onde o binding ainda não existiria) — não é um
bug, e mover arquivos **preservando os caminhos relativos entre eles** não
muda nada disso.

**Mas** é a prova de que `combate.mjs` (candidato óbvio a "motor genérico de
combate") hoje SABE sobre `arena.mjs` (uma feature 100% específica deste
jogo — patentes semanais, pódio). Uma engine de verdade não pode importar de
uma feature específica. Resolver isso de verdade é o que
`docs/auditoria-performance.md` já planeja pra **Fase 7** (EventEmitter com
os eventos do combate; arena vira um "ganchos", não um import direto) — e
**mexe em fluxo de controle**, não só em pasta. Por isso a Fase 7 fica FORA do
escopo desta refatoração (que promete zero mudança de comportamento): nesta
primeira passada, `combate.mjs` e `arena.mjs` continuam vizinhos dentro de
`game/systems/`, não viram `engine` vs `systems`.

### 2.4 Pontos de risco — código que assume a profundidade exata do caminho

Todo o projeto usa import relativo puro (nenhum path alias, nenhum bundler) —
então **qualquer mudança na profundidade de aninhamento entre dois arquivos
quebra o import entre eles**. Isto é o risco central da migração inteira.
Levantamento completo dos arquivos que calculam caminho a partir de
`import.meta.url` (== quebram se só ELE mudar de pasta, mesmo que o alvo não
se mexa):

| Arquivo | Padrão | Novo cálculo precisa de |
|---|---|---|
| `index.mjs` | `join(dirname(...), '..', 'assets_raw')` | apontar pra `game/frontend` + `game/gamedata` (ver §4.2) |
| `nucleo/banco.mjs` | `join(dirname(...), '..')` → `dados/jogo.db` | mesma profundidade relativa dentro de `game/database` |
| `nucleo/dados.mjs` | `'..','..','assets_raw','gamedata'` | apontar pro novo lugar do gamedata |
| `nucleo/quadro.mjs` | import estático de `assets_raw/packages/shared` | apontar pro novo `game/engine` |
| `nucleo/regras.mjs` | idem | idem |
| `nucleo/sessao.mjs` | lê `assets_raw/gamedata/task-token-real.json` | idem |
| `nucleo/simulacao-offline.mjs` | `new URL('./simulacao-offline-worker.mjs', ...)` | **só quebra se os dois arquivos pararem de ser vizinhos** — mantê-los juntos elimina o risco |
| `sistemas/{charms,novidades,proficiencia,amigos,recompensas,entregas,poderes,arvore,gemas,arena,mapas,tarefas,bosses}.mjs` | leem JSON de `assets_raw/gamedata/...` | apontar pro novo gamedata |
| `sistemas/guildas.mjs`, `sistemas/premium.mjs` | import estático de `assets_raw/packages/shared` | apontar pro novo `game/engine` |
| `sistemas/hunt/terreno.mjs` | `'..','..','..','assets_raw','gamedata','hunts'` | idem (3 níveis — mais frágil ainda, é o mais fundo) |
| `sistemas/bosses.mjs` | lê `api-mapeada/servidor/bossToken.json` | decisão em aberto (ver §5) |

Fora de `import.meta.url`, mais dois grupos de risco:

- **`server/testes/*.mjs`** (42 arquivos): todos importam via `../nucleo/...`
  e `../sistemas/...` — ou seja, dependem de continuar sendo **irmã** de
  `nucleo/` e `sistemas/` na mesma profundidade. `testes/apoio.mjs` e
  `testes/site.test.mjs`/`guildas.test.mjs` também leem
  `../../assets_raw/packages/shared/...` direto.
- **`server/scripts/migrar-sqlite-para-postgres.mjs`**: `await import('../nucleo/banco.mjs')`
  e 4 outros `../sistemas/*.mjs` — mesma regra.
- **Infra que hoje assume literalmente `server/`, `assets_raw/`, `api-mapeada/`**:
  `docker/Dockerfile`, `docker-compose.yml`, `docker-compose.override.yml`,
  `.dockerignore`, `server/package.json` (`"test": "node --test \"testes/*.test.mjs\""`),
  `.claude/launch.json` (`"server/index.mjs"`). Nenhum é bloqueador pro código
  rodar — mas todos quebram silenciosamente (`docker compose up` falhando,
  debug do VS Code não abrindo) se não forem atualizados junto.
- **`tools/*.mjs`** (15 scripts): geradores de dados e carga/perf, todos fora
  do processo do jogo em produção — importam `server/sistemas/...` a partir
  da raiz do repo. Baixo risco (não rodam no boot), mas quebram se ninguém
  atualizar.

---

## 3. O que NÃO é um risco

- Os dois ciclos (§2.3) não impedem a migração de pasta — só impedem uma
  separação *lógica* limpa entre engine e systems (ver §2.3 e §4).
- `assets_raw/gamedata` (o conteúdo/dados, 710 MB) não referencia nada de
  código — é só JSON/imagem lido, nunca importa nada.
- Nenhum workflow de CI (`.github/`) referencia caminhos — não existe.
- Testes não têm mocks de caminho de arquivo (nenhum `jest.mock`/stub de fs)
  que dependa de string de path — são só imports relativos normais.

---

## 4. Estrutura alvo proposta

```
game/
  backend/                    — index.mjs (gateway), package.json, node_modules
  engine/                     — o que é ISOMÓRFICO de verdade (client + server)
    formulas.mjs, tela.mjs, brasao-de-guilda.mjs, nome-de-guilda.mjs,
    ordem-das-guildas.mjs, portas-de-acesso.mjs, andar-visivel.mjs,
    boss-pouch.mjs, desenhar-brasao.mjs, outfit-color.mjs, prazos.mjs,
    qrcode.mjs, remendo.mjs        (= assets_raw/packages/shared/src/*, 1:1)
  database/                   — banco.mjs, db.mjs, migrar-sqlite-para-postgres.mjs
  websocket/                   — sessao.mjs, quadro.mjs, json.mjs, limites.mjs
                                  (a "borda" entre rede crua e os sistemas)
  systems/                     — os 47 arquivos de sistemas/ + hunt/ (11) + regras.mjs +
                                  dados.mjs + simulacao-offline(-worker).mjs, INTACTOS
                                  (o ciclo arena↔combate continua aqui dentro — ver §2.3)
  admin/                       — mapas.mjs (a única coisa "admin" que já existe: o
                                  editor de mapas) + o HTML/JS do /editor
  frontend/                    — assets_raw/client + as páginas HTML da raiz de assets_raw
  gamedata/                    — assets_raw/gamedata (conteúdo — não é "frontend": é lido
                                  pelo server, e as imagens são só SERVIDAS ao browser)
  docker/                      — o /docker atual + docker-compose*.yml + .env.example
  testes/                      — os 42 arquivos de testes/, intactos (ver §5, pergunta 3)
```

`server/nucleo/estaticos.mjs` fica em `game/backend/` (é o servidor de
arquivo estático genérico que o gateway usa — parte do próprio gateway, não
um "sistema" nem parte isomórfica).

`api-mapeada/` **não entra em `game/`** — continua na raiz do repo como
referência/documentação (não é código rodando). O único uso em runtime
(`sistemas/bosses.mjs`) fica marcado como dívida técnica pré-existente (ver
§5, pergunta 4) — não é para esta refatoração resolver, só para não repetir
sem querer o mesmo padrão em código novo.

### 4.1 Por que isto e não outra coisa

- **`engine`** = só o que os DOIS lados (client extraído e server) importam
  hoje de verdade (`assets_raw/packages/shared`). `nucleo/regras.mjs` NÃO
  entra aqui, mesmo reexportando `formulas.mjs` — o arquivo também define
  constantes 100% deste jogo (vocações, level inicial 8, validação de nome)
  que só o server usa; forçá-lo pra dentro de "engine" faria a engine carregar
  conhecimento de jogo específico, o oposto do pedido.
- **`systems`** fica com `regras.mjs`, `dados.mjs` e `sessao/simulacao-offline`
  junto dos outros 47 — são todos conhecimento específico deste jogo (mesmo
  os "genéricos" como `combate.mjs`, por causa do ciclo com `arena.mjs`
  documentado em §2.3).
- **`database`** e **`websocket`** são exatamente os pedidos pelo usuário —
  já existem como agrupamento natural em `nucleo/` hoje (Fase 6 já separou
  banco de sessão).
- **`admin`**: não existe hoje nenhum sistema de administração (sem papéis,
  sem autenticação separada) — o único candidato real é o editor de mapas
  (`/editor`, `sistemas/mapas.mjs`). Ver pergunta 2 em §5: posso ou não
  reclassificar isso como "admin" agora.

### 4.2 Tabela de movimento (arquivo → destino)

| De | Para |
|---|---|
| `server/index.mjs` | `game/backend/index.mjs` |
| `server/nucleo/estaticos.mjs` | `game/backend/estaticos.mjs` |
| `server/package.json`, `package-lock.json`, `node_modules/` | `game/backend/` |
| `server/nucleo/banco.mjs`, `db.mjs` | `game/database/` |
| `server/scripts/migrar-sqlite-para-postgres.mjs` | `game/database/migrar-sqlite-para-postgres.mjs` |
| `server/nucleo/sessao.mjs`, `quadro.mjs`, `json.mjs`, `limites.mjs` | `game/websocket/` |
| `server/nucleo/regras.mjs`, `dados.mjs` | `game/systems/` |
| `server/nucleo/simulacao-offline.mjs`, `simulacao-offline-worker.mjs` | `game/systems/` (continuam vizinhos um do outro) |
| `server/sistemas/*.mjs` (47) | `game/systems/*.mjs` (1:1, mesmo nome) |
| `server/sistemas/hunt/*.mjs` (11) | `game/systems/hunt/*.mjs` (1:1) |
| `server/sistemas/mapas.mjs` | `game/admin/mapas.mjs` |
| `server/testes/*` (42) | `game/testes/*` (1:1) |
| `assets_raw/client/` + `assets_raw/*.html` | `game/frontend/` |
| `assets_raw/gamedata/` | `game/gamedata/` |
| `assets_raw/packages/shared/src/*` | `game/engine/*` (achatado — sem a pasta `packages/shared/src` no meio) |
| `docker/`, `docker-compose*.yml`, `.env.example` | `game/docker/` (compose fica na raiz de `game/docker/` referenciando `../backend`, `../frontend` etc.) |
| `api-mapeada/` | fica onde está (raiz do repo) |
| `tools/` | fica onde está (fora de `game/`) — atualiza só os imports que apontam pra dentro |

---

## 5. Decisões (confirmadas antes de mexer em qualquer arquivo)

1. **Separação real engine/systems (Fase 7): NÃO incluída nesta rodada.**
   O ciclo `arena ↔ combate` fica como está, os dois dentro de
   `game/systems/`. A Fase 7 (EventEmitter, arena por gancho) fica registrada
   como próximo passo separado, fora do escopo desta refatoração.
2. **`sistemas/mapas.mjs` (editor de mapas) MOVE para `game/admin/`** —
   primeiro (e único, por ora) morador da pasta, junto da página `/editor`.
3. **`assets_raw/gamedata` vira `game/gamedata/`** — 9ª pasta, separada de
   código (nem `systems`, nem `frontend`).
4. **`sistemas/bosses.mjs` lendo `api-mapeada/servidor/bossToken.json`**:
   fica como está — fora do escopo, só documentado como dívida técnica
   pré-existente (§2.2).

---

## 6. Ordem de migração proposta (cada etapa termina com `npm test` verde)

A ideia central: mover **por camada**, sempre de dentro para fora (quem tem
menos gente importando primeiro), e sempre movendo o destino final junto de
um único commit de "atualiza os imports que apontam pra cá" — nunca um commit
que só move sem atualizar quem aponta pra lá (deixaria o repo quebrado entre
commits).

1. **Criar o esqueleto `game/*` vazio** (só as pastas) — sem mover nada,
   commit trivial.
2. **`engine`**: mover `assets_raw/packages/shared/src/*` → `game/engine/`.
   Atualiza os 5 arquivos que importam (regras.mjs, quadro.mjs, guildas.mjs,
   premium.mjs + o client, se for tocado agora — client fica pra etapa 8).
   Rodar `npm test`.
3. **`database`**: mover `nucleo/{banco,db}.mjs` + `scripts/migrar-...mjs` →
   `game/database/`. Atualiza `sessao.mjs`, os 5 `sistemas/*.mjs` que importam
   `banco.mjs` direto, `party.mjs`, e os testes que importam `../nucleo/banco.mjs`/`db.mjs`.
   Rodar `npm test` (com e sem `DATABASE_URL_TESTE`).
4. **`websocket`**: mover `nucleo/{sessao,quadro,json,limites}.mjs` →
   `game/websocket/`. Atualiza `index.mjs` e os poucos `sistemas/*` que
   importam `quadro.mjs`. Rodar `npm test`.
5. **`systems`**: mover `sistemas/` (47) + `sistemas/hunt/` (11) +
   `nucleo/{regras,dados,simulacao-offline,simulacao-offline-worker}.mjs` →
   `game/systems/`. É o maior volume de arquivos, mas o MENOR risco de
   import quebrado: como tudo dentro de `sistemas/` já se importa por `./` e
   `../` relativo entre si, a profundidade interna não muda — só os imports
   que APONTAM PRA FORA de sistemas (`../nucleo/...` → `../database/...`
   etc., já feitos nas etapas 2-4) e os que sistemas recebe de fora
   (`sessao.mjs`, os testes). Rodar `npm test`.
6. **`admin`**: extrair `mapas.mjs`
   de `game/systems/` para `game/admin/`, atualizar o único importador
   (`index.mjs`/`sessao.mjs`, o que despachar `/api/mapas`). Rodar `npm test`.
7. **`backend`**: mover `index.mjs` + `nucleo/estaticos.mjs` + `package.json`/
   `package-lock.json`/`node_modules` → `game/backend/`. Atualiza `RAIZ` (o
   caminho pro frontend/gamedata) e o script `"test"` do `package.json`
   (glob de `testes/*.test.mjs` → `../testes/*.test.mjs` ou similar, a
   depender de onde `testes/` ficar). Rodar `npm test` de dentro de
   `game/backend/`.
8. **`testes`**: mover `server/testes/` → `game/testes/`, atualizar todo
   import relativo (`../nucleo/X` → `../database/X` / `../websocket/X` /
   `../systems/X`, `../sistemas/X` → `../systems/X`). Ajustar
   `package.json`'s glob. Rodar `npm test` — este é o commit que precisa
   passar 100% antes de seguir (é a suíte inteira validando a estrutura
   nova de uma vez).
9. **`frontend` + `gamedata`**: mover `assets_raw/client` + os HTML da raiz
   → `game/frontend/`; `assets_raw/gamedata` → `game/gamedata/` (ou onde a
   pergunta 3 decidir). Atualiza os ~14 arquivos que leem
   `assets_raw/gamedata/...` e o `RAIZ` do `index.mjs`/backend. Rodar
   `npm test` + subir o servidor local e testar `/jogar`, `/api/status`,
   um login manual — esta etapa move os 900 MB de conteúdo, é onde mais
   vale conferir na mão além dos testes automatizados.
10. **`docker`**: mover `docker/` + `docker-compose*.yml` + `.env.example`
    → `game/docker/`; atualizar todos os caminhos internos (contexto de
    build, volumes `./assets_raw` → `../frontend` + `../gamedata`, etc.).
    Reconstruir a imagem e repetir a validação de ponta a ponta feita na
    Fase 6 (build, subida dos 3 serviços, `/saude`, WebSocket através do
    nginx) antes de considerar esta etapa concluída.
11. **Limpeza**: atualizar `tools/*.mjs` (15 scripts), `.claude/launch.json`,
    `README.md`, `docs/*.md` com os caminhos novos; rodar
    `graphify update .` (grafo do projeto, CLAUDE.md pede isso depois de
    mudar código) e apagar as pastas `server/`/`assets_raw/` antigas (vazias
    a essa altura) do git.

Cada etapa é um commit separado; se algo quebrar no meio, `git revert` do
commit da etapa não afeta as anteriores.

---

## 7. Fora do escopo desta refatoração (fica documentado, não é feito agora)

- Fase 7 do audit (EventEmitter, arena desacoplada do motor de combate por
  ganchos, `sessao.mjs` dividido em Gateway/Sessão/Dispatcher) — é o que
  tornaria `engine`/`systems` uma separação de VERDADE (sem ciclo), não só
  de pasta. Ver pergunta 1.
- Resolver a leitura de `api-mapeada` em `bosses.mjs`. Ver pergunta 4.
- Dividir `testes/` para espelhar `engine`/`database`/`websocket`/`systems`
  (hoje fica um `game/testes/` único, testando tudo por import relativo
  cruzado) — possível depois, não pedido agora.
