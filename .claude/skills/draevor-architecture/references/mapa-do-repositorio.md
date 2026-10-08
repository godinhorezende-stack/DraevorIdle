# Mapa do repositório (o que existe DE VERDADE)

Levantado em 08/10/2026 na branch `claude/isolated-worktree-implementation-279037` (inclui o trabalho da migração para o PoE oficial,
ainda não na `main`). Atualize quando mover algo. Diagnóstico completo da migração: `docs/migracao-poe-oficial.md`.

## Arquitetura atual

| Responsabilidade | Onde está | Observação |
|---|---|---|
| Ponto de entrada do servidor (HTTP + WebSocket + boot) | `game/backend/index.mjs` | sobe o jogo pelo bootstrap `game/systems/itens-poe/iniciar.mjs` |
| Relógio do jogo (tique de 250 ms em 5 fatias de 50 ms) | `game/websocket/sessao.mjs` (`FATIAS`, `ligarRelogio`, `Sessao.tique`) | os testes tocam `tique()` à mão |
| Tique da caçada (movimento, alvo, combate, mortes) | `game/systems/cacadas.mjs` (`tique`, `round` vem de `hunt/combate.mjs`) | funções puras sobre `estado` |
| Instância, terreno, caminho, andares, setores, monstros | `game/systems/hunt/*.mjs` | é o "motor" de runtime de fato |
| Caçada offline (simulação e consolidação) | `game/systems/simulacao-offline.mjs` + `simulacao-offline-worker.mjs`, `cacadas.mjs` (`simularAusencia`, `consolidarAusencia`, `projetar`), `consolidacao-offline.mjs` | roda em threads |
| Tique em threads (desligado em produção) | `game/systems/simulador-tique.mjs` + `simulador-tique-worker.mjs` | `SIMULADORES_TIQUE` |
| Protocolo e quadro (delta) para o cliente | `game/websocket/{sessao,quadro,limites,json}.mjs` | `quadro.mjs` manda só o que mudou |
| Persistência | `game/database/{banco,db,caca-offline,redis}.mjs` | SQLite padrão, PostgreSQL com `DATABASE_URL`, Redis com `REDIS_URL` |
| Código isomórfico (cliente e servidor) | `game/engine/*.mjs` | contém regra: `formulas.mjs`, `sockets-de-gema.mjs`, `areas.mjs` |
| Regras de jogo (Draevor + motor) | `game/systems/*.mjs` e subpastas (`skills/`, `combate/`, `personagem/`, `itens/`, `mobs/`, `encontros/`, `bosses-unicos/`, `passivas/`) | |
| Regras do PoE (o gameplay oficial) | `game/systems/itens-poe/*.mjs` (27 módulos) + `systems/personagem/ficha-poe.mjs` | liga-se no motor por ganchos |
| Dados | `game/gamedata/**` (versionado; `itens-poe/` com o conteúdo do PoE; `atos/poe-ato-N.json`; `hunts/` com o terreno; `overrides/` dos editores) | produção monta somente leitura |
| Editores ("a Engine") | `game/admin/*.mjs` + `game/frontend/client/src/editor-*.mjs` | só local; o nginx de produção tranca `/api/mapas/_conteudo` |
| Cliente | `game/frontend/client/src/*.mjs` (`main`, `actionbar`, `inventory`, `tooltip`, `sheet`, `panels`, `auth`, `minimapa`, `soquetes`, `itens-poe-balao`) | só mostra e pede |
| Testes | `game/testes/*.test.mjs` (`node --test`), apoio em `game/testes/apoio*.mjs` | um processo por arquivo |
| Infra | `game/docker/*` (Dockerfile só com código; `gamedata`/`frontend` montados), `scripts/deploy.sh`, `docs/deploy.md` | produção: `/srv/draevor/bin/deploy.sh` |
| Ferramentas | `tools/*.mjs` (raiz) e `game/tools/*.mjs` | importadores do PoE, auditorias, carga |

"Engine" tem três sentidos aqui: os **editores** (admin), a pasta **`game/engine/`** (isomórfico) e o **motor de runtime** (tique/instância
em `systems/hunt` + `cacadas.mjs` + relógio da sessão). Diga sempre qual.

## Sistemas do PoE (oficiais)

Itens/mods/sockets/qualidade (`jogo`, `gerar`, `traduzir`, `sockets`, `condicoes-poe`, `mods-poe`), gemas (`gemas-poe`,
`compilador-de-gemas/`, `estilos-das-gemas`), suportes (`suportes-poe`, `compat-suportes`), lacaios (`lacaios-poe`), frascos (`frascos`),
cargas/afecções (`cargas`, `afeccoes`), árvore/classes (`arvore`, `classes`), campanha (`campanha`, `monstros`, `habilidades`,
`missoes-de-gemas`, `drops-por-monstro`, `previa-da-area`), modificadores de monstro (`modificadores-monstro`), pináculos (`pinaculos`),
moedas (`moedas`), regra de entrada de item (`so-itens-do-poe`), bootstrap (`iniciar`), porta do modo (`catalogo.ligado()`).

## Principais problemas

1. **166 portas `catalogo.ligado()`** espalhadas (ficha 26, condicoes-poe 24, acoes 10, sessao 9...) + constantes calculadas na carga
   (barra, slots, crítico base, campanha). É a transição; o plano é colapsar quando o clássico sair.
2. **Duplicação Draevor × PoE** (ver abaixo).
3. **Direção de dependência violada:** `systems/chat.mjs` → `websocket/quadro.mjs`; `systems/consolidacao-offline.mjs` →
   `websocket/sessao.mjs`; `database/caca-offline.mjs` → `systems/stamina.mjs`.
4. `game/engine/` não é só técnico: tem fórmulas de combate e regra de sockets de gema.
5. A suíte de testes nasceu sobre conteúdo do Draevor (Troll Cave, magias, itens); a migração está em andamento
   (`docs/migracao-poe-matriz.md`).
6. Arquivos enormes: `websocket/sessao.mjs` (~2,7 mil linhas), `systems/cacadas.mjs` (~2,3 mil), `hunt/combate.mjs` (~1,3 mil).

## Dependências importantes

- As áreas do PoE são hunts virtuais sobre o **terreno das hunts do Draevor** (`gamedata/itens-poe/campanha-poe.json` → `mapa`;
  `hunt/terreno.mjs` resolve o apelido) e os monstros do PoE usam o **bestiário/sprites do Draevor**. Não apague mapas nem bestiário.
- As gemas do PoE usam os **moldes de magia do Draevor** (`ACTION_CATALOG`, `skills/gemas.mjs`) e o motor de projétil/área
  (`skills/golpes-secundarios.mjs`, `engine/areas.mjs`).
- `Ficha.combate(estado)` (`systems/ficha.mjs`) é o cache de atributos que combate, tela e simuladores leem.

## Ciclos conhecidos (imports estáticos)

- Um componente de **29 arquivos** (inclui `acoes`, `ficha`, `campanha`, `poderes`, `hunt/instancia`, `hunt/monstros`, `inventario`, e 6
  do PoE: `itens-poe/{afeccoes,frascos,lacaios-poe,mods-poe,monstros,traduzir}`).
- `systems/arena.mjs` ↔ `systems/cacadas.mjs`.
- Já quebraram por TDZ (ler no topo um valor do ciclo): `gemas → traduzir → afixos → item` e `campanha → monstros → … → lacaios-poe`.
- Para listar: um detector de componentes fortemente conexos sobre `game/{systems,websocket,backend,admin,database}` (o da migração está
  descrito em `docs/migracao-poe-oficial.md` §4).

## Duplicações (Draevor × PoE)

| Assunto | Draevor (clássico) | PoE (oficial) |
|---|---|---|
| Gerador de item | `systems/itens/gerar.mjs` | `systems/itens-poe/gerar.mjs` + `jogo.mjs` |
| Ficha | `systems/ficha.mjs` (com portas) | `systems/personagem/ficha-poe.mjs` (tela) + ramos em `ficha.mjs` |
| Árvore de passivas | `systems/passivas/arvore.mjs` (árvore do Draevor) | `systems/itens-poe/arvore.mjs` → `gamedata/itens-poe/arvore-poe.json` (mesmo motor) |
| Sockets de gema | `game/engine/sockets-de-gema.mjs` | `systems/itens-poe/sockets.mjs` |
| Gemas/suportes | `systems/skills/gemas.mjs` (gemas e suportes 911xxx do Draevor) | `itens-poe/gemas-poe.mjs`, `suportes-poe.mjs` |
| Campanha | `systems/campanha.mjs` (48 fases; também o motor de atos) | `systems/itens-poe/campanha.mjs` (10 atos + Epílogo) |
| Modificadores de monstro | `systems/mobs/raridade.mjs` | `systems/itens-poe/modificadores-monstro.mjs` |
| Filtro de loot | `systems/bolsa.mjs` (regras por item) | filtro do PoE em `systems/afixos.mjs` |
| Poções × frascos | barra (`systems/acoes.mjs`) | `systems/itens-poe/frascos.mjs` |
| Dano contínuo | `systems/combate/dot.mjs` | `systems/itens-poe/afeccoes.mjs` (usa o `dot`) |
| Fórmulas | `game/engine/formulas.mjs`, `systems/regras.mjs` | `systems/combate/formulas.mjs` (PoE: armadura, acerto) |
