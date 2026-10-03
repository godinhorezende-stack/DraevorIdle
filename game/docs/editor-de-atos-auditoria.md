# Editor de Acts, Biblioteca e Modo Beta — Etapa 1: auditoria e proposta

Tudo abaixo foi conferido no repositório (nada inventado). Nenhum código foi alterado nesta etapa.

## 1. O que existe hoje

| Tema | Fonte real | Observação |
|---|---|---|
| Campanha | `gamedata/campanha.json` (10 KB): `dificuldades`, `escala`, `fases[]` (`huntId, nome, ato, levelOriginal, nivel{facil,medio,dificil}`, `pular?`), `bosses{"1".."4"}` (`bossId, nome, nivel`) | Lido no boot por `systems/campanha.mjs` (`CAMPANHA`, `FASES`) |
| Conteúdo/mapa das fases | `gamedata/campanha-conteudo.json`: por fase `descricao, ambiente, mundo{bossPrincipal, obrigatorios, todos}`, `mapa{x,y}`, `tipo`, `conexoes[]`, `requisitos.exige[]`; `atos{n:{nome,parte,tema,descricao,bossMapa}}` | Lido por `systems/campanha-conteudo.mjs`; validado por `systems/campanha-mapa.mjs` (`validarMapa`, `validarAtos`, `TIPOS_DE_FASE`) |
| Encontros | `gamedata/encontros/<huntId>.json` (49 arquivos) + `systems/encontros/*` (baú, boss, onda, captura, altar) | Lidos **no boot**; salvar exige reiniciar |
| Bosses | `gamedata/catalog-real.json` → `bosses` (87), `bosses-unicos.json`, `systems/bosses.mjs`, `systems/bosses-unicos/` | `cooldownHours`, `task`, `lootCount`; bosses de ato zerados em `campanha.mjs` |
| Hunts | `catalog-real.json`: `hunts` (48 normais), `vips` (36), `especiais` (1, "Instance Kollos"), `divinas` (11); mapas em `gamedata/hunts/*-map.json` (130) | Hunt VIP = `vip:true`; especial = `especial:true`; divina = `divina:true` |
| Monstros / drops | `catalog-real.json` → `bestiary` (1840; cada um com `loot[]`, `hp`, `exp`, `elements`); itens em `item-catalog.json` | Drop é **por monstro** (`systems/hunt/combate.mjs`: `soltarDrops`, `matarMonstro` idempotente via `recompensado`) |
| Recompensa de encontro | `systems/encontros/recompensas.mjs`, `lootDoEncontro`, `pagarPremio` (1ª vez) | Usa as mesmas regras do loot de bicho |
| Acesso VIP/Instance/Divine | `systems/premium.mjs` (`trancaDaHunt`, `podeEntrar`, `podeFicar`) e `engine/portas-de-acesso.mjs`; chamado em `Cacadas.entrar`/`entrarNaSala` | Exige premium + pergaminho + level |
| Editor existente | `/editor` (mapas, `frontend/editor.mjs` 716 linhas) e `/editor/conteudo` (`editor-conteudo.mjs` 692 linhas; backend `admin/conteudo.mjs` + `admin/conteudo-http.mjs`) | Já edita fases, encontros, bosses, mapa do mundo, atos (nome/tema/descrição) |
| Permissão de admin | **Só rede**: rotas `/api/mapas/_conteudo/*` ficam sob prefixo que o nginx tranca (acesso por túnel SSH). Tabela `contas` = `id, email, senha, criada_em` | **Não existe** GM, beta tester ou papel por conta no jogo |
| Progresso | `estado.campanha[dif] = {limpezas{huntId}, completas[huntId], bosses[]}` (por **huntId**) | Serializado no JSON do personagem (`personagens`) |
| Testes | `campanha`, `conteudo-dos-atos`, `bosses-dos-atos`, `boss-do-ato`, `editor-conteudo`, `conteudo-privado` etc. (169 arquivos) | Boa base de regressão |

## 2. Limitações estruturais encontradas (o que impede "atos configuráveis" hoje)

1. **A campanha é uma lista linear fixa.** `fases[]` em ordem; liberar a fase N exige a N-1 (`faseLiberada`), com `FASES_POR_ATO = 12` fixo em `campanha.mjs:29` e usado em `:100`, `:113`, `:145` (índice % 12 decide início de ato). `ATOS = ceil(fases/12)`.
2. **O cliente também assume 4 atos × 12 fases**: `panels.mjs` (`for ato <= 4`, `(ato-1)*12`, `ato < 4`, "Fase ato*12").
3. **Um boss por ato, em mapa `bosses{n}`**, atrelado ao número do ato; a dificuldade seguinte abre após o ato 4.
4. **`conexoes` e `requisitos.exige` existem só como dados de DESENHO/aviso** do mapa (`campanha-mapa.mjs` valida), mas o servidor libera pela ordem linear. Bifurcação/convergência hoje não têm efeito no runtime.
5. **Escala por dificuldade** (`nivel[dif]`, `escala`) é por fase, em 3 dificuldades; um ato novo precisa dessas faixas.
6. **Encontros lidos no boot**: publicar um ato exige reinício ou recarga a quente (não existe).
7. **Drops são do monstro** (`bestiary[].loot`) e dos encontros; não há tabela de loot por fase/hunt/ato. O modelo de chance é por item, em fração.
8. **Sem versionamento**: os JSON são editados em disco; só o Git guarda histórico. Em produção `gamedata/hunts` é sobreposto por `data/mapas`.
9. **Sem papel por conta**: a "permissão" é estar na rede/túnel; o jogo não sabe quem é testador.

## 3. Viabilidade por parte

| Parte | Reaproveita | Precisa adaptar | Não existe |
|---|---|---|---|
| 1 Modo beta | `premium.podeEntrar/podeFicar`, `Bosses.marcarEntrada`, `Cacadas.entrar` (pontos únicos de recusa) | adicionar flag server-side que ignora premium/pergaminho/level/recarga | papel `beta` na conta, perfil isolado, recompensa de teste sem economia |
| 2 Biblioteca | `catalog-real.json`, `admin/conteudo.mjs` (`opcoes`, `listarBosses`, `buscarItens`), `bestiary` | endpoint agregador somente-leitura + UI | tela de biblioteca; categorias de drops/tabelas |
| 3 Editor de atos | `/editor/conteudo`, mapa do mundo (nós/conexões), `validarMapa/Atos` | modelo de ato com N fases e grafo; UI de conexões | grafo no runtime (item 4 acima), detecção de ciclos/isoladas, duplicar/versionar |
| 4 Bosses nos atos | boss de ato + portal + Auto (já feitos), tipos de encontro boss | boss final por ato configurável (hoje `bosses{n}`) | boss opcional/aleatório por fase via editor (existe tipo de encontro `boss`) |
| 5 Drops | `lootDoEncontro`, `valorEsperado`, `impactoEconomico` (`encontros/economia.mjs`) | tabela de drops por origem (fase/ato/boss) sobre o mesmo sorteio | simulador de rolagens; anti-duplicação por origem |
| 6 Validação/publicação | `validarMapa`, `validarFase`, `auditar` | validador do grafo e referências; estados rascunho/publicado | versionamento, diff, restaurar |
| 7 Runtime | todo o fluxo atual de fases/portal/Auto/party | **generalizar** `faseLiberada`/`proximaParaSeguir`/portal para ler um grafo | recarga a quente de atos publicados |

Viável sem mudança estrutural: modo beta, biblioteca (leitura), validação das referências, edição de metadados do ato.
Exige mudança estrutural: grafo de fases com bifurcação/convergência no servidor, quantidade variável de fases/atos, drops por fase/ato, publicação com versões.

## 4. Riscos para os atos atuais

- Trocar o formato de `campanha.json` quebra progresso salvo? **Não**, o progresso é por `huntId`; o risco está em `FASES_POR_ATO`, `atoDoBoss` e nos índices usados no cliente.
- Qualquer mudança em `faseLiberada`/`bossLiberado` afeta o portal, a Caça Automática e a party (acabamos de ajustá-los; a regressão é coberta por `boss-do-ato.test.mjs`).
- Drops: mexer em `soltarDrops` mexe na economia. Proposta: **não** alterar; adicionar apenas uma tabela extra sorteada pelo mesmo código.
- Publicar ato sem recarga a quente exigiria reinício do servidor (com Server Save/manutenção já existentes).

## 5. Proposta de arquitetura (compatível e com rollback)

1. **Camada de dados nova, ao lado da atual**: `gamedata/atos/<id>.json` (ato = fases com referências `huntId`/`bossId`, arestas `{de, para, requisito}`, boss final, drops por origem, estado `rascunho|beta|publicado|desativado`, `versao`). Referencia o cadastro original; só guarda sobrescritas.
2. **Os 4 atos atuais são importados como atos "legado" somente-leitura** gerados de `campanha.json` + `campanha-conteudo.json` (nenhum arquivo atual é alterado; rollback = desligar a camada nova).
3. **Servidor**: um módulo `systems/atos.mjs` que expõe a mesma interface que o runtime já usa (`faseLiberada`, `proximaParaSeguir`, `bossLiberado`, `ultimaFaseDoAto`), resolvendo pelo grafo; atos legados continuam usando o caminho linear atual até a migração ser validada por testes de equivalência.
4. **Beta**: papel `beta` guardado em tabela/arquivo separado (não em `contas` de produção), concedido só pelo admin pela rede trancada; flag `beta` no estado de sessão ignora premium/pergaminho/level/recarga; progresso e recompensas de teste ficam num perfil separado (sem tocar nos personagens oficiais) e atos em `beta` só aparecem para quem tem o papel.
5. **Versionamento**: cada publicação grava `gamedata/atos/_versoes/<id>/<n>.json` (somente acréscimo); diff e restauração leem esses arquivos.
6. **UI**: nova aba dentro de `/editor/conteudo` (reaproveita auth por rede, estilos e o canvas do mapa do mundo): Biblioteca → Atos → Fases/Conexões → Bosses → Drops → Validação → Publicação.

## 6. Ordem de implementação sugerida (menor risco primeiro)

1. **Biblioteca (somente leitura)** — sem risco para o jogo; entrega valor imediato.
2. **Modo beta** — papel + flag server-side, testado em VIP/especial/divina/bosses; perfil isolado.
3. **Modelo de ato + validador de grafo + importação dos atos legados** (sem runtime ainda), com testes de equivalência.
4. **Editor visual** sobre o modelo (criar/editar/duplicar/conectar/validar).
5. **Runtime por grafo** só para atos novos em `beta`, mantendo o legado linear.
6. **Drops por origem** (tabela adicional + simulador + alertas).
7. **Publicação + versionamento + recarga a quente**, por último.

## 7. Decisões do dono (03/10)

1. **Testador:** todos, por enquanto. 2. **Isolamento:** nenhum perfil separado — vale no servidor oficial, que hoje está em beta. 3. **Fases:** qualquer número por ato (generalizar o `12` fixo; atos atuais seguem com 12). 4. **Dificuldades:** as 3 (Normal/Cruel/Merciless). 5. **Publicação:** reinício controlado (Server Save + manutenção).
- **Beta:** hoje o "beta" é só o aviso `avisoDeDesenvolvimento` do catálogo — **não existe flag de servidor**. Proposta: criar `modoBeta` numa config do servidor (ligado agora, como decidido), com interruptor admin pela rede trancada, para poder desligar sem deploy. O acesso livre fica atrás desse interruptor, nunca gravado nos personagens.
