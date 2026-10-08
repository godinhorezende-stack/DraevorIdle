---
name: draevor-testing
description: Testes do Draevor Idle com rigor — unitário, integração, gameplay (tique), sessão/WebSocket, banco e persistência, regressão, desempenho e ponta a ponta; como rodar a suíte (`node --test`), os modos oficial (PoE) e clássico, as fixtures (personagem do PoE, hunt de teste, sessão falsa), sorte determinística, e a CLASSIFICAÇÃO OBRIGATÓRIA de toda falha em A (bug real), B (teste obsoleto), C (adaptar), D (comportamento removido) ou E (regressão). Use sempre que escrever, rodar, consertar, marcar ou apagar um teste, ou quando um teste falhar.
---

# Draevor — testes

## Regra fundamental

**Nunca altere um teste só para ele passar.** Teste que falha é informação. Para CADA falha, antes de mudar código ou teste:

| | Categoria | O que fazer |
|---|---|---|
| **A** | bug real do jogo | corrigir o CÓDIGO; o teste fica |
| **B** | teste obsoleto (espera regra antiga do Draevor) | marcar/substituir; **não** mudar o PoE para agradá-lo |
| **C** | a regra vale, o teste precisa do modelo do PoE (hunt, gema, item, personagem) | adaptar a fixture, mantendo a asserção |
| **D** | o comportamento deixou de existir de vez | remover, com o motivo escrito |
| **E** | regressão causada por mudança de arquitetura | corrigir o código (ou a infraestrutura) |

Escreva, por falha: **causa**, **comportamento esperado**, **o que muda (código ou teste) e por quê**. Na dúvida entre A e C,
**reproduza a regra no PoE** (mesma asserção, fixture do PoE): se passar, é C; se falhar, é A. Registro vivo da migração:
`docs/migracao-poe-matriz.md` (teste a teste) e `docs/migracao-poe-oficial.md` §8.

Sem alteração em massa às cegas: script de troca mecânica só depois de classificar o que ele toca, revisando os usos que não são o
caso comum (ex.: um `'troll-cave'` que é de propósito a hunt do Draevor). Correção nova: prove que o teste **falha sem ela** e passa com ela.

## Rodar

```bash
node --test game/testes/*.test.mjs                 # a suíte (npm test); ~4–5 min em 4 núcleos
node --test game/testes/itens-poe*.test.mjs        # os testes do PoE
node --test --test-name-pattern="C11" game/testes/familiar-combate.test.mjs
DRAEVOR_CLASSICO=1 node --test game/testes/*.test.mjs   # o Draevor clássico (transição)
```

Cada arquivo roda no seu processo. Compare execuções pelo resumo `ℹ tests/pass/fail/skipped` e pela lista "failing tests" (cada falha
vem com `test at arquivo:linha` — a linha da declaração).

## Infraestrutura (`game/testes/`)

- **`apoio.mjs`**: carrega o jogo inteiro pelo mesmo bootstrap do servidor (`iniciarJogoDoPoe()`, top-level await — importar o apoio
  basta); `personagemDeTeste({ vocacao, level })` (já com a marca do PoE `sistema: 'poe'`; teste de legado tira de propósito),
  `PERSONAGEM`, `HUNT_DE_TESTE` (no oficial a área do PoE com o terreno da Troll Cave; no clássico a própria), `huntDoPoe('<hunt do
  Draevor>')`, `campanhaCompleta()`. Arquivo de teste que não importa o apoio e precisa do jogo do PoE chama `iniciarJogoDoPoe()`.
- **Modo clássico num arquivo**: `import './apoio-classico.mjs';` como PRIMEIRO import (as constantes de carga leem o modo ao carregar).
- **Marcas da migração** (`apoio-migracao.mjs`): `{ skip: doClassico('motivo') }` (B) e `{ skip: aAdaptar('motivo') }` (C
  pendente) — pulam no oficial com o motivo e rodam no clássico. Todo arquivo marcado tem o irmão `<x>.classico.test.mjs`
  (`import './apoio-classico.mjs'; await import('./<x>.test.mjs');`), que a MESMA suíte roda: B e C seguem verificados no clássico.
  Adaptou um C? Tire a marca e confira os dois (o arquivo e o irmão). Arquivo novo marcado → crie o irmão. Teste só do PoE num
  arquivo com irmão: `{ skip: soNoOficial('motivo') }`. Falha que já existia antes da migração: `{ todo: jaFalhava('motivo') }` (aparece
  como TODO). O irmão usa outro SQLite (`DRAEVOR_SQLITE`, posto pelo `apoio-classico.mjs`): os dois rodam juntos e não disputam linhas.
- **Desvio de gravação** (`process.env.DRAEVOR_OVERRIDES = tmp`, histórico, versões): ANTES de carregar o jogo. Um `import` estático roda
  antes de qualquer linha do arquivo — o apoio e os módulos do jogo vêm por `await import(...)` depois do desvio
  (`isolamento-dos-testes.test.mjs` recusa o contrário).
- **Sessão sem rede**: `new Sessao({ readyState: 1, bufferedAmount: 0, send })`, `s.conta = …`, `await s.tique()` à mão (o relógio
  global não roda em teste). Mensagem do cliente: `s.receber({ t: 'play', name })`.
- **Caçada pura**: `Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' })`, `Cacadas.tique(e, PERSONAGEM, agora += R.PASSO_MS)`,
  `matarMonstro`, `criarMonstro`; offline: `Cacadas.simularAusencia` / `consolidarAusencia` / `SimulacaoOffline.simular` (+ `encerrar` no `after`).
- **Banco**: o SQLite local de desenvolvimento (`game/database/dados`) é compartilhado. Conta de teste: e-mail `@teste.local`, e
  **apague o que criou** (`t.after`/`after`). Postgres só com `DATABASE_URL_TESTE` (`db.test.mjs`). Nunca aponte teste para produção.
- **Sorte**: injete `rng`/semente (`mulberry32`, padrão `comSemente` em `consolidacao-offline.test.mjs`); se sobrescrever
  `Math.random`, restaure no `finally`. Teste de distribuição: rng fixo e muitas amostras (ex.: 20 000).

## Por domínio (o mínimo)

- **PoE / personagem:** nível ≤ 100 (tabela de XP do PoE); o kit do Draevor não protege no PoE — em teste de motor que não mede
  sobrevivência, vida alta (`hp = maxHp = 1e9`). Criação: `sistema: 'poe'`, nível 1, 2 frascos; limite de personagens sem os arquivados.
- **Login/legado:** `play` de arquivado é recusado e o `estado` no banco não muda (`personagens-legado.test.mjs`).
- **Combate:** asserção sobre a conta (`combate/formulas.mjs`) E sobre o golpe de verdade no tique; dano por tipo; crítico com rng fixo.
- **Itens:** peça do PoE tem `poe` (raridade, mods, iLvl); só item do PoE entra (`so-itens-do-poe.test.mjs`).
- **Gemas:** gema numa peça vestida, ligada ao suporte; XP pela morte; status do catálogo.
- **Loot:** quantidade e pesos com rng fixo; nada do Draevor; projeção offline gera peça do PoE.
- **Campanha/bosses:** áreas `poe-a*`; conclusão por objetivo; chefe de ato e pináculo entram; hunt/boss do Draevor recusados.
- **Offline:** 30 min tique a tique + projeção; morte no meio; stamina; consolidação não mexe em arquivado nem em quem está online.
- **Sessão/WebSocket:** a mensagem do cliente passa só os campos permitidos; idempotência (pedido repetido, morte repetida).
- **Persistência:** ida e volta pelo JSON do banco (`huntParaGravar` → `JSON` → `huntAoCarregar`), sem perder campos da peça.
- **Desempenho:** `tools/carga.mjs`, `tools/perf/`, base em `docs/auditoria-performance.md` — medir antes/depois, nunca no olho.
- **Ponta a ponta:** não há harness no repositório; servidor local em outra porta (`PORTA=8098 ENDERECO=127.0.0.1 node
  game/backend/index.mjs`) + navegador automatizado. Proponha antes de adicionar dependência. Não use as portas do dono (8099) sem pedir.

## Falhas conhecidas de ambiente

Os arquivos rodam em paralelo no MESMO SQLite de desenvolvimento. Teste de carga (muitas linhas de uma vez) ganha banco próprio com
`import './apoio-banco-proprio.mjs'` como primeiro import (o `server-save` P1, com 1.500 ausentes, fazia a rodada da consolidação —
que pega 40 — não alcançar o personagem do `consolidacao-offline`). `site.test.mjs` às vezes dá "database is locked": rode o arquivo
sozinho para confirmar; a ação é isolar o banco do teste, não mudar o jogo.
