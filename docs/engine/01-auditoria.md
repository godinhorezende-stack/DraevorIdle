# Engine do Draevor — Fase A: diagnóstico do repositório (04/10/2026)

Auditoria somente leitura, sobre a `main` em `0f9a09c`. Base do pedido "Evolução da Engine — PoE Reference Integration".
Complementa as auditorias anteriores: [editores e cadastros](../../game/docs/editor-de-atos-auditoria.md),
[modificadores de item](../modificadores/relatorio.md), [gemas](../auditoria-gemas.md), [atributos e combate](../sistema-de-atributos-e-combate.md).

## 1. Arquitetura geral

| Camada | Onde | Observação |
|---|---|---|
| Servidor | `game/backend/index.mjs` (HTTP + estáticos), `game/websocket/sessao.mjs` (o protocolo do jogo) | Node ESM, sem framework. Tique de caçada de 250 ms (`TICKS_POR_SEGUNDO = 4`). |
| Regras | `game/systems/**` (~140 módulos) | Funções puras sobre o `estado` do personagem; quem fala com o cliente é a sessão. |
| Motor compartilhado | `game/engine/**` | Servido ao cliente em `/packages/shared/src/` (ex.: `areas.mjs`, `sockets-de-gema.mjs`): a mesma conta nos dois lados. |
| Dados | `game/gamedata/**` (248 arquivos JSON) | Lidos no boot. Em produção a pasta é **somente leitura** (só `gamedata/hunts` é gravável). |
| Persistência | Personagem = um JSON (sqlite local, Postgres em produção); `emTransacao` grava várias sessões juntas. Redis só no ranking (`redis.test.mjs`). | |
| Cliente | `game/frontend/client/src/**` (JS puro, sem bundler) | Desenho real dos sprites em `sprites.mjs`; balão de item em `tooltip.mjs`. |
| Engine (editor) | `/editor` (mapas) e `/editor/conteudo` (Etapas 1–5 do redesign) | Rotas de escrita sob `/api/mapas`, trancadas pelo nginx (só túnel SSH). |
| Deploy | `/srv/draevor/bin/deploy.sh` | ff-only da `main`, pré-compressão, `pg_dump`, build, nginx, `/saude`. |

## 2. Estado de cada sistema

| Sistema | Arquivos principais | Configuração | Estado |
|---|---|---|---|
| **Motor de modificadores** | `systems/combate/modificadores.mjs` | — | **Existe e é o modelo do PoE**: flat/increased/more, local→global, condições, tags, validade, limites, partes. Usado por `ficha.mjs` e `mobs/atributos.mjs`. |
| **Fórmulas de combate** | `systems/combate/formulas.mjs`, `limites.mjs` | `gamedata/combate/formulas.json`, `limites.json` | Coeficientes em JSON, cada fórmula atrás de um `modo` (`tibia`/`draevor`/`poe`). Armadura, acerto e bloqueio já em `poe` desde 02/10. |
| Ficha do personagem | `systems/ficha.mjs` (618), `personagem/atributos.mjs`, `defesa.mjs` | `gamedata/atributos-principais.json`, `classes.json` | Agrega itens, árvore, passivas, gemas, buffs; cache invalidado por `Ficha.invalidar`. **Crítico.** |
| Itens e modificadores | `systems/itens/*.mjs`, `systems/afixos.mjs` | `gamedata/itens/*.json` (atributos, pools, tiers, raridades, efeitos) | Dados em JSON validados no boot, testes de geração e de efeito real. **Sem editor**. Sem prefixo/sufixo nem famílias (diferença de modelo do PoE). |
| Gemas e habilidades | `systems/skills/*.mjs`, `acoes.mjs` (1209), `combo.mjs` | `gamedata/gemas/*.json`, `action-catalog.json` | Gemas ativas/suporte, sockets, links, regras de uso, global cooldown. Sem editor. |
| Monstros | `systems/mobs/*.mjs`, `hunt/monstros.mjs`, `poderes.mjs` | `gamedata/mobs/*.json`, `monstro-poderes.json`, `boss-poderes.json`, `catalog-real.json` | Raridade, modificadores, mecânicas, poderes do Canary. Bestiário só leitura (tela Mobs). |
| Combate da caçada | `systems/cacadas.mjs` (2114), `hunt/combate.mjs` (1122) | `gamedata/instancias.json`, `combate/*.json` | O laço quente do servidor. **Crítico**: desempenho e determinismo. |
| Mundo | `campanha.mjs`, `atos-*.mjs`, `encontros/**`, `bosses-unicos/**` | `campanha.json`, `campanha-conteudo.json`, `encontros/`, `bosses-unicos.json`, `atos/` | Editores existem (fases/encontros, bosses únicos, atos, mapa do mundo, mapas). |
| Loot e economia | `itens/gerar.mjs`, `encontros/recompensas.mjs`, `mercado.mjs`, `troca.mjs`, `loja.mjs` | `itens/raridades.json`, `precos-de-venda.json`, `store-real.json` | Loot por chance individual; economia com tetos relativos nos encontros. |
| Simuladores | `combate/simulador.mjs`, `simulador-mob.mjs`, `simulador-rotacao.mjs`, `simulador-tique.mjs` | — | **Usam as mesmas funções do combate** (`danoMostrado`, `Ficha.combate`, `Acoes.disparar`). Sem tela na engine. |
| Testes | `game/testes/*.test.mjs` | — | 1.640 testes (`npm test`), mais Playwright ad hoc. Dois testes instáveis conhecidos (P2 do boss do ato; disputa do sqlite local). |

## 3. As sete perguntas

1. **Regras fixas no código.** 177 constantes numéricas em `systems/` (fora `regras.mjs`). A maioria é técnica (intervalos, tamanhos de lote), mas há regra de jogo: `GLOBAL_SPELL_COOLDOWN` (2 s), `INTERVALO_BASE_DO_GOLPE_MS` (2 s), `NIVEL_INICIAL`, `stamina.TETO`, `forja.TIER_MAX`, `afixos.FRACAO_DA_MITICA` (1,3), `acoes.MAX_ALVOS_DO_SLOT`, `ALCANCE_PADRAO`, `MAXIMO_DE_CONDICOES`. `afixos.MAX_AFIXOS = 3` é um valor antigo que engana quem lê.
2. **Já editável.** Pela engine: mapas e spawns, encontros, bosses únicos, dados da tela WORLD, atos e suas recompensas. Só no JSON, à mão: fórmulas e limites do combate, itens e mods, gemas, monstros (mods, raridades, distribuição), passivas, preços.
3. **Dados duplicados.** Dois cadastros de "boss" com ids diferentes (`CATALOGO.bosses` × `bosses-unicos.json`); 211 referências a itens inexistentes no loot (auditoria da Biblioteca). A sobreposição entre `item-catalog.json` e `catalog-real.json` não foi verificada nesta fase.
4. **Incompleto.** Prefixo/sufixo e famílias de mod (não existem); tipos de fase do Editor de Acts sem runtime; `dmg_vs_elite` à espera de monstros Elite; histórico/versões (só o contador do ato); hot reload (só bosses únicos e mapas valem na hora).
5. **Precisa refatorar antes de editar por tela.** `itens/config.mjs` lê e valida os arquivos **na importação** — para validar um rascunho a validação precisa receber os dados como parâmetro. O mesmo padrão (ler no import) existe em `gemas.mjs`, `formulas.mjs`, `mobs/*.mjs`.
6. **Prontos para receber mecânicas novas.** O motor de modificadores (tipos, escopos, condições, tags) e as fórmulas com `modo` — a troca de fórmula já é feita por configuração, sem mexer no combate.
7. **Críticos.** `cacadas.mjs`/`hunt/combate.mjs` (laço quente), `ficha.mjs` (cache e agregação), `itens/gerar.mjs` (a única fonte de sorte de item), persistência (`emTransacao`), `sessao.mjs` (contrato com o cliente), mercado/troca (economia entre jogadores).

## 4. Riscos de alteração

- **Itens já existentes guardam os valores sorteados** (`af: [{ id, nivel, value }]`): mudar faixas só afeta peças novas; mudar ids exige conversão (o padrão `renomearAdds` já existe).
- **Catálogo vai ao cliente no `welcome`**: mudar mods em tempo de execução exige reenviar o catálogo ou pedir relogin.
- **Produção é somente leitura em `gamedata`**: a engine grava no ambiente local; a publicação continua sendo git → PR → deploy (o que é desejável).
- **Testes que leem o `gamedata` real**: uma configuração aprovada muda resultados esperados — cada piloto precisa rodar a suíte inteira.

## 5. Oportunidades de reutilização

Motor de modificadores, fórmulas com `modo`, simuladores (mesma lógica do jogo), validadores existentes (`itens/config.validar`, `bosses-unicos/catalogo.validar`, `atos-modelo.validarAto`, `encontros/modelo.validar`), a Biblioteca/fichas da engine (busca, sprites, tooltip real) e a auditoria de modificadores (`tools/auditar-modificadores.mjs`).
