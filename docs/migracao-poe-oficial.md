# Migração do Draevor para o PoE oficial — diagnóstico

07/10/2026 · branch `claude/isolated-worktree-implementation-279037` (worktree isolado). **Nada foi para produção**: a main e o servidor
(`/srv/draevor/app`, main `9d7fbdb`) continuam no Draevor clássico. Este é o diagnóstico pedido antes de qualquer refatoração estrutural
grande. A matriz teste a teste está em [`migracao-poe-matriz.md`](migracao-poe-matriz.md).

## Resumo

- **O jogo oficial já é o do PoE sem chave nenhuma.** Com os dados do PoE presentes, o servidor sobe no PoE; sem eles, não sobe (mensagem
  clara, saída 1); `DRAEVOR_CLASSICO=1` sobe o Draevor clássico (só para a transição, com aviso no boot). `ITENS_POE` não é mais lida.
- **Testes no modo oficial** (2.122): 538 falhas antes desta etapa, **535 agora**, nenhuma nova. Classificação das 538: **A 0 · B 292 ·
  C 243 · D 1 · E 2**. Prova cruzada: **534 das 538 passam com `DRAEVOR_CLASSICO=1`**: o motor do Draevor está inteiro; essas falhas são
  regra ou fixture do Draevor, não código quebrado. Os testes do PoE: 194 de 196 (as 2 falhas são a D e uma B).
- **Corrigido nesta etapa:** a regressão E (o processo da Validação carregava o jogo sem o PoE e bloquearia toda aprovação em produção) e
  dois caminhos que **escreviam em personagem arquivado** (transferência do banco por nome e "char da conta fora do mundo").
- **Bugs reais achados fora dos testes** (nenhum teste os pegava), detalhados na seção "Problemas encontrados":
  A1 hunts e bosses do Draevor ainda são alcançáveis por `startHunt` direto · A2 thread do tique sem o PoE (latente) · A3 mercado com ofertas
  dos arquivados · A4 ranking misturando arquivados · A5 migração de classe da Engine reescreve arquivados.
- **Precisa da sua decisão** (seção 10): o que fazer com A1, A3 e A4; trazer os ~20 MB de dados do PoE para o repositório; e quando
  aposentar o modo clássico.

---

## 1. Arquitetura atual

**Processos que rodam o jogo** (cada um carrega os módulos do zero):

| Ponto de entrada | Onde roda | Carrega o PoE? |
|---|---|---|
| `game/backend/index.mjs`: HTTP, WebSocket, boot | servidor | sim |
| `systems/simulacao-offline-worker.mjs`: a caçada offline (login e consolidação a cada 10 min) | pool de threads | sim (corrigido na etapa anterior: antes quebrava em área do PoE) |
| `systems/simulador-tique-worker.mjs`: o tique de hunt solo em threads | pool, **desligado** (`SIMULADORES_TIQUE` não está no `.env` de produção) | **agora sim** (A2, corrigido) |
| `admin/validacao-runner.mjs`: as verificações da Validação da Engine | processo à parte, local | **agora sim** (E, corrigido) |
| `game/tools/*.mjs`: importadores e geradores | linha de comando, local | cada um o seu |

**Camadas como o código está hoje:**

| Pasta | Tamanho | Papel |
|---|---|---|
| `game/engine` | — | código isomórfico (cliente e servidor) |
| `game/database` | 5 arquivos | SQLite (padrão) / PostgreSQL (`DATABASE_URL`); Redis (`REDIS_URL`) para cache e presença |
| `game/websocket` | `sessao.mjs` com 2.705 linhas | a borda: login, lista, criação, entrada, comandos |
| `game/systems` | 83 arquivos, 21,9 mil linhas (+ `hunt/` 19, `skills/` 6, `combate/` 9, `mobs/` 5, `personagem/` 6) | o jogo: caçada, instância, combate, ficha, barra, gemas, itens, campanha, party, mercado, banco, offline |
| `game/systems/itens-poe` | 27 arquivos, 6,3 mil linhas | **a camada do PoE**: não é um segundo jogo, liga-se no motor por ganchos (gema/suporte/reforço registrados nas ações; bases como itens virtuais do catálogo; áreas como hunts virtuais sobre mapas do Draevor; monstros do PoE como criaturas do bestiário) |
| `game/gamedata` | 63 MB no git (`itens-poe/` 9,1 MB gerados pelos tools) | dados versionados + overrides e versões dos editores |
| `game/admin` | 41 arquivos | a Engine (editores), só local: o nginx de produção tranca `/api/mapas/_conteudo` |
| `game/frontend/client` | 89 módulos | o cliente |
| `REFERENCIAS_POE` (`/home/deploy/referencias-poe`) | 300 MB, **fora do repositório** | a coleção do PoE: catálogo importado, imagens, motor e dados das gemas, suportes |

**Como o jogo decide "PoE ou Draevor":** uma porta só, `itens-poe/catalogo.ligado()`, chamada em **166 lugares** (ficha 26,
condicoes-poe 24, acoes 10, sessao 9, afixos 7, mods-poe 6, cargas 6, itens-poe-http 6, equipamento 4, moedas 4, frascos 4, combate 4 e
mais 34 arquivos com 1–3). Mais as **constantes calculadas na carga do módulo** a partir dela (acoes: `BARRA_DO_POE`, `SLOTS`,
`PAPEL_DO_SLOT`, `FRASCOS_NA_BARRA`, `TECLAS_PADRAO`; ficha: `CRITICO_BASE`, `MULTIPLICADOR_CRITICO_BASE`; classes; campanha: `CAMPANHA`
com as fases do Draevor vazias; equipamento: `SLOTS_DE_EQUIPAMENTO`; buffpower; loja: `FORA_DA_LOJA`). No cliente, as portas são o que o
servidor manda: `state.classesPoe`, `character.filtroPoe`, `catalog.frascos` (22 usos).

**Produção:** a imagem Docker tem **só código** (`backend`, `engine`, `database`, `websocket`, `systems`, `admin`); `game/gamedata` e
`game/frontend` são montados **somente leitura** do checkout; os mapas vêm de `/srv/draevor/data/mapas`. **Nada do `REFERENCIAS_POE`
chega lá**: hoje o servidor de produção, com este código, recusaria subir.

## 2. Arquitetura proposta

A estrutura que você descreveu (ENGINE → GAME SYSTEMS → POE GAMEPLAY → DATA) já existe nas pastas; o que falta é a **regra de
dependência** e o fim da transição. Proposta, **sem mover arquivo**:

| Camada | Onde fica | O que entra |
|---|---|---|
| ENGINE (infra, sem regra de jogo) | `game/database`, `game/websocket`, `game/engine`, `systems/hunt/instancia.mjs`, relógio/tique/workers | PostgreSQL, Redis, WebSocket, instâncias, threads |
| GAME SYSTEMS (regras que valem para qualquer conteúdo) | `game/systems/*` | combate, ficha, barra (combo, modos, regras do slot), fases/encontros/setores, party/escalonamento, loot (motor), inventário/depósito/mercado/banco, motor de atos (`campanha.mjs`), offline |
| POE GAMEPLAY (as regras do PoE) | `game/systems/itens-poe/*` + `personagem/ficha-poe.mjs` | itens/mods/sockets, gemas/suportes/lacaios, frascos, cargas/afecções/condições, árvore/classes/ascendências, campanha/atos/monstros/pináculos, moedas, filtro |
| DATA (o conteúdo do PoE) | `game/gamedata/itens-poe/*`, `gamedata/atos/poe-ato-*.json`, `gamedata/hunts` (terreno), overrides | versionado; editado na Engine local; chega em produção pelo git |

**Regras propostas:**

1. **Bootstrap único:** `systems/itens-poe/iniciar.mjs` é **permanente**: é a função que todo processo/thread chama para carregar o
   jogo (servidor, thread offline, threads do tique, Validação, testes). Só pontos de entrada o importam; nenhum módulo de `systems/` o
   importa. É isso que permite que ele dependa de tudo sem criar ciclo; os ganchos do motor entram por import dinâmico. Renomear para
   `systems/iniciar-jogo.mjs` só faz sentido quando o modo clássico sair (ver F3).
2. **Sem "plugin" para uma chave que vai sumir:** as 166 portas existem por causa do modo clássico. Enquanto ele existir, ficam. Quando ele
   for aposentado, `ligado()` vira sempre verdadeiro e cada porta **colapsa no lugar**: fica o ramo do PoE e sai o do Draevor, depois de
   verificar quem mais usa aquele código. Não copiar os sistemas do PoE para arquivos novos, nem inventar uma camada de estratégia.
3. **Sem ciclo novo** (seção 4): leitura de outro módulo só dentro de função, nunca no topo; e um teste que trava o tamanho do ciclo atual.
4. **Dados em DATA, código em código:** nada de executar JavaScript de fora do repositório em tempo de execução (seção 7).
5. **Editores:** a Engine (local) grava em `gamedata/` e `gamedata/overrides` (com `_versoes`). O caminho para produção é o de sempre:
   commit (o "enviar para o git" da Engine ou manual) → PR → merge → `deploy.sh`. Em produção `gamedata` é somente leitura, de propósito.

## 3. Dependências

- **O PoE depende do Draevor em:** o **terreno** das hunts (cada área do PoE é uma hunt virtual sobre um mapa do Draevor:
  `campanha-poe.json` + `campanha-mapas.json` opcional; em produção os mapas vêm de `/srv/draevor/data/mapas`); o **bestiário/outfits**
  (os monstros do PoE são desenhados com sprites do Draevor); e o motor (combate, instância, barra, loot, party, offline). Por isso **as
  hunts do Draevor não podem ser apagadas**: o que sai é a entrada direta nelas (A1).
- **O Draevor depende do PoE em:** as 166 portas e as constantes de carga listadas acima (`systems/*` importa `itens-poe/catalogo.mjs` e
  vários `itens-poe/*` diretamente).
- **Dependências externas em tempo de execução** (seção 7): o catálogo de itens, as imagens, os dados e o **código** do motor de gemas
  (`poe-gemas-poedb/engine/src/gemas/{compilador,progressao,regras,arquetipos}.mjs`, importados de fora do repositório) e `gemas.js`
  executado com `runInNewContext`.

## 4. Ciclos

- **Corrigidos:** `gemas → traduzir → afixos → item` (TDZ em `SLOTS_DE_JOIA`; funções movidas para `condicoes-poe`) e
  `campanha → monstros → … → lacaios-poe` (TDZ em `PONTOS`; virou cálculo preguiçoso, commit `c2533b6`).
- **Existentes hoje** (detector de componentes fortemente conexos sobre os 262 módulos do servidor): **2**.
  - **29 arquivos, 6 deles do PoE:** `acoes`, `afixos`, `aparencia`, `boosts`, `campanha`, `charms`, `combate/controle`, `combate/dot`,
    `encontros/recompensas`, `entregas`, `ficha`, `gemas`, `hunt/instancia`, `hunt/monstros`, `hunt/rentabilidade`, `hunt/resistencia`,
    `inventario`, `itens-poe/afeccoes`, `itens-poe/frascos`, `itens-poe/lacaios-poe`, `itens-poe/mods-poe`, `itens-poe/monstros`,
    `itens-poe/traduzir`, `mobs/atributos`, `mobs/mecanicas`, `personagem/defesa`, `poderes`, `skills/estados`, `tarefas`.
  - `arena ↔ cacadas`, que já existia (`docs/refatoracao-estrutura.md` §2.3).
- ESM tolera ciclo; o que quebra é **ler no topo do módulo** um valor de outro módulo do mesmo ciclo (foi o caso das duas correções).
  Desfazer o ciclo grande é refatoração grande e **não é necessário** para a migração. Proposta: (a) a regra da seção 2; (b)
  `testes/ciclos.test.mjs` com o detector, falhando se o ciclo crescer ou se aparecer um novo, para que a regra não dependa de memória.

## 5. Sistemas do PoE (já no jogo oficial)

| Sistema | Módulo(s) | Situação |
|---|---|---|
| Itens: 1.035 bases, mods, raridade, qualidade, requisitos, sockets e cores | `jogo`, `gerar`, `traduzir`, `sockets`, `condicoes-poe`, `mods-poe` | no jogo |
| Gemas ativas: 562 | `gemas-poe`, `estilos-das-gemas` | 86 funcionam, 457 parciais, 19 não (status do próprio catálogo) |
| Suportes: 262 | `suportes-poe`, `compat-suportes` | 61 funcionam, 168 parciais, 33 não |
| Lacaios e totens | `lacaios-poe` | no jogo |
| Frascos (cinto, cargas, a cidade enche) | `frascos` | no jogo |
| Cargas, afecções, mods condicionais | `cargas`, `afeccoes`, `condicoes-poe` | no jogo |
| Árvore, ascendências, maestrias, 7 classes | `arvore`, `classes` | no jogo |
| Campanha: 10 atos + Epílogo, 143 áreas, missões, chefes | `campanha`, `monstros`, `habilidades`, `missoes-de-gemas`, `drops-por-monstro` | no jogo; atos editáveis na Engine (`poe-ato-N.json`) |
| Monstros: raridade e 204 modificadores | `modificadores-monstro`, `mobs/raridade` | no jogo |
| 11 chefes pináculo | `pinaculos` | no jogo |
| 195 moedas (Forja do PoE) | `moedas` | no jogo |
| Filtro de loot, mochila de 20 vagas, ficha do PoE, anúncio de Únicos | `afixos` (filtro), `inventario`, `personagem/ficha-poe` | no jogo |

## 6. Sistemas legados (Draevor)

| Sistema | No jogo oficial | Destino |
|---|---|---|
| Campanha do Draevor (48 fases, 4 atos, dificuldades) e o editor dela | vazia; os dados ficam | sai com o modo clássico |
| **Hunts do Draevor** | o terreno é usado pelas áreas do PoE; **a entrada direta ainda funciona (A1)** | manter os mapas; bloquear a entrada |
| Bosses do Draevor (`bosses.json`) | **alcançáveis por `startHunt` (A1)** | bloquear a entrada |
| Árvore do Draevor, especializações, poções, orbes de socket na loja, baús de marco, 3 das 4 recompensas de nível, bônus online, Prey, blessings, promoção/coleção, treino de perícia, Buff Power, Item Power | desligados pela porta | o código fica até aposentar o modo clássico |
| Ferramentas da Engine só do Draevor (Biblioteca de itens, Item Power, Conjuntos, Overrides de itens, armazém de atos legados) | funcionam sobre itens que não caem mais | decidir: só no clássico ou aposentar |
| Mercado, ranking | **misturam o legado com o PoE (A3, A4)** | decisão sua |
| Personagens antigos | **arquivados** (seção 9) | ficam no banco, intactos |

## 7. Dados externos necessários

Medido a partir do que o código abre de fato (`catalogo.mjs`, `gemas-poe.mjs`, `suportes-poe.mjs`, `admin/*`, `tools/*`) e das imagens
que o catálogo referencia.

| O quê | Tamanho | Tipo | Quem usa |
|---|---|---|---|
| `importado/itens-poe.json` | 4,1 MB | dado **gerado** (`tools/importar-poe-itens.mjs`) | jogo |
| `original/poe-itens/**`: **só as 2.215 imagens referenciadas** | 7,1 MB (de 105 MB) | asset | jogo (`/api/jogo/poe/icone/item/`) |
| `poe-gemas-poedb/engine/dados/gemas.js` | 1,9 MB | dado, mas em **JavaScript executado** (`runInNewContext`) | jogo |
| `poe-gemas-poedb/engine/src/gemas/{compilador,progressao,regras,arquetipos}.mjs` | 30 KB | **código externo** importado em tempo de execução | jogo |
| `poe-gemas-poedb/icones` (562) | 3,6 MB | asset | jogo (`/api/jogo/poe/icone/gema/`) |
| `poe-suportes-poedb/suportes.json` | 1,1 MB | dado | jogo |
| `poe-suportes-poedb/icones` (262) | 2,7 MB | asset | jogo (`/api/jogo/poe/icone/suporte/`) |
| **Total que o jogo precisa** | **≈ 20,5 MB** | | |
| `engine/dados/monstros.js`, `status.js`, `engine/index.html` + `src/` (arena de gemas), `original/poe-atos` (9,3 MB) | — | só Engine (local) | telas da Engine |
| `original/` (resto: ~98 MB de imagens não usadas, `poe-arvore` 8,7 MB, `poe-bestiario` 21 MB, `poe-gems` 4 MB, `poe-monstros`, `poe-apresentacao`), `poedb/` 2,8 MB, `suportes-drive` 45 MB, `poewiki`, `gemas/` 9,6 MB, `gemas.json` 6,7 MB, `catalogo-imagens.json`, `missoes.json` | ~280 MB | fonte dos tools (temporário/regenerável) | só para regenerar `gamedata/itens-poe` |

O que o jogo deriva da coleção **já está no repositório** (`gamedata/itens-poe`, 9,1 MB: árvore, campanha, classes, traduções, moedas,
pináculos, modificadores, missões, ícones de moedas e ascendências). **Proposta:** trazer os ~20,5 MB do jogo para o repositório, no
mesmo padrão:

- `gamedata/itens-poe/catalogo-itens.json` (o catálogo, gerado pelo mesmo tool);
- `gamedata/itens-poe/icones-itens/`, só as 2.215 referenciadas; o tool copia;
- `gamedata/itens-poe/gemas.json`, convertido de `gemas.js` por um tool, para o jogo não executar JS de fora;
- `suportes.json`, `icones-gemas/`, `icones-suportes/`;
- os 4 arquivos do motor de gemas como **código revisado do repositório** (`systems/itens-poe/compilador-de-gemas/`). Confirme que esse
  código é seu e pode ir para o repositório.

Com isso, produção recebe os dados pelo git (checkout → montagem somente leitura), sem montagem nova nem variável. `REFERENCIAS_POE`
passa a ser só a fonte dos tools, local. A alternativa (montar uma pasta em `/srv/draevor/data` + `REFERENCIAS_POE` no `.env`) deixa os
dados fora do git e o deploy com passo manual.

> Atenção: imagens e textos são do Path of Exile (Grinding Gear Games). Servir isso publicamente em produção é decisão sua de licença e
> risco.

## 8. Estratégia para os testes

As 538 falhas por **causa** (matriz completa e rastreável em [`migracao-poe-matriz.md`](migracao-poe-matriz.md)):

| Causa | Falhas | Categorias | Arquivos |
|---|---:|---|---:|
| Personagem de teste sem a marca do PoE: agora é legado arquivado e não entra | 50 | C 50 | 8 |
| Magias e gemas do Draevor na barra do PoE ("Slot inválido", "spell-…") | 150 | B 95 · C 55 | 21 |
| Campanha e atos do Draevor (48 fases, boss de ato por portal, editor da campanha) | 100 | B 61 · C 39 | 20 |
| Hunt do Draevor sem instância (encontros, setores, andares, escalonamento…) | 59 | C 59 | 14 |
| Itens, ficha e progressão do Draevor (árvore, poções, crítico, peso…) | 160 | B 124 · C 36 | 35 |
| Ferramentas da Engine sobre itens do Draevor | 13 | B 12 · C 1 | 5 |
| Arquitetura e ambiente | 6 | C 3 · D 1 · E 2 | 3 |

**Verificado rodando no PoE** (não só pela mensagem de erro): as 7 regras da consolidação offline (pedaços, stamina, tempo caçando)
**passam** numa área do PoE com personagem do PoE; o escalonamento da party (D7) **passa** em `poe-a1-the-coast`; o familiar (C11)
**passa** com level 30 (falhava com 300, acima do teto do PoE); o ouro offline vai para o carregado na área do PoE (500 → 7.064, banco 0);
o Energy Shield absorve e recarrega (o valor muda porque a INT do PoE aumenta o ES, 200 → 213); a área do PoE tem instância, objetivos e
setores. Nenhuma A apareceu entre os testes.

**Estratégia, em ordem:**

1. **Nada é apagado agora.** A única D (`itens-poe`: "desligado sem a chave") é trocada por "sem os dados não sobe; `DRAEVOR_CLASSICO=1`
   desliga".
2. **E (2):** corrigidas nesta etapa (seção "O que mudou").
3. **B (292): marcar como "clássico"**, sem mudar o PoE. Os arquivos 100% B ganham, como **primeiro** import, um apoio que liga
   `DRAEVOR_CLASSICO=1` antes de qualquer módulo carregar (as constantes de carga dependem disso); os arquivos mistos B/C são separados em
   dois. Um script `test:classico` roda esses; a suíte oficial não. Isso já é seguro porque a matriz mostra que 290 das 292 B passam no
   clássico. Quando o modo clássico for aposentado, todas viram D e saem junto com o código do Draevor que testam.
4. **C (243): adaptar**, começando pelas mais baratas:
   - criar em `testes/apoio.mjs` um `personagemDoPoe()` que usa a MESMA criação do jogo (exportar `estadoInicialPersonagem` de
     `sessao.mjs` ou movê-la para `systems/personagem/`): classe do PoE, nível ≤ 100, kit, frascos, `sistema: 'poe'`;
   - área padrão `poe-a1-the-coast`;
   - ajudante de barra do PoE.
   Ordem: legado (50) → instância/encontros (59) → barra (55) → campanha (39) → itens (36). Os encontros precisam de um encontro de teste
   numa área do PoE, porque nenhuma área do PoE tem encontros cadastrados.
5. **Meta antes do deploy:** suíte oficial com **0 falhas** e as B passando no `test:classico`.
6. Os 2 testes de **ambiente** (`site` "database is locked" e `server-save` A4, que lê o ciclo do banco local) falham também no clássico.
   Isolar o banco deles (C).

## 9. Estratégia para os personagens legados

Regra: **não converter, não apagar, não mexer.** Um personagem sem a marca do PoE (`sistema: 'poe'`, ou o cinto de frascos dos criados
no PoE local antes da marca) fica **arquivado** (`systems/personagem/legado.mjs`). Todos os caminhos que leem ou gravam personagens:

| Caminho | Situação | Efeito no arquivado |
|---|---|---|
| Login e lista da conta | aparece com o selo "Draevor clássico · arquivado" e a explicação | nenhum |
| Seleção / `play` | recusado no servidor com a mensagem; o cliente nem tenta | nenhum |
| Reconexão / retomada automática | o cliente pula os arquivados; o servidor recusa do mesmo jeito | nenhum |
| Criação e limite de personagens | arquivados **não contam** no limite; o novo nasce no PoE (nível 1, frascos, marca) | nenhum |
| "Trazer para o mundo" (party/hunt de outro char da conta) | passa pela mesma entrada: recusado | nenhum |
| **"Char da conta fora do mundo"** (ler/configurar/chamar) | **corrigido**: recusado antes de ler o estado | antes **gravava** ajustes no arquivado |
| **Transferência do banco por nome** | **corrigido**: recusada ("arquivado: não recebe transferências") | antes **gravava** o ouro no arquivado |
| Caçada offline em segundo plano (a cada 10 min) | pula o arquivado (`consolidarUm` → `arquivado`) | nenhum |
| Server Save diário | só confere as colunas-índice derivadas; nunca toca no JSON | nenhum |
| Reinício do servidor | o preenchimento de colunas do boot só toca as colunas-índice das linhas sem elas | nenhum no estado |
| Party | só com quem está online, e o arquivado não fica online | nenhum |
| Amigos, guildas, perfil do site | só leitura: aparece com o level e a vocação do Draevor | nenhum (decisão de exibição) |
| **Ranking** (site, ranking, arena) | **lista todo mundo (A4)** | nenhum, mas o level 500 do Draevor domina o ranking do PoE |
| **Mercado** | **ofertas abertas dos arquivados continuam no balcão (A3)**; o que eles vendem vira crédito na tabela `creditos` | nenhum no estado; itens e ouro do Draevor entram no PoE |
| Presentes da equipe | vão para quem joga; o arquivado nunca reivindica | nenhum |
| Contagem de online (Ausentes) | quem caçava offline ao ser arquivado conta como online por até 12 h após a última atividade (colunas-índice) | nenhum; some sozinho |
| **Migração de classe da Engine** | reescreve todos da classe, **arquivados inclusive (A5)**, só por ação explícita do admin | grava, se o admin migrar uma classe do Draevor |
| Coins, premium e ouro no arquivado | ficam guardados, mas inacessíveis | decisão sua (ex.: passar os coins para a conta) |

Testado em `testes/personagens-legado.test.mjs` (6 testes): marca, lista, `play` recusado sem converter, criação com a conta cheia,
consolidação, transferência e "char fora do mundo". Os dois últimos foram conferidos **falhando** sem a proteção.

## 10. Estratégia de migração final

| Fase | O quê | Precisa de você |
|---|---|---|
| **F0** (esta etapa, não commitada) | oficial sem chave; bootstrap único; legados arquivados; E e A2 corrigidos; diagnóstico | revisar e autorizar o commit |
| **F1** (antes do deploy, sem refatoração grande) | A1: entrada só em áreas do PoE, cidades, pináculos e arena PvP. A3/A4/A5. Dados do PoE no repositório (seção 7). Testes: fixture do PoE, C adaptadas, B marcadas como clássico, D trocada → **suíte oficial verde** | as decisões de A1 (lista), A3, A4 e dos dados |
| **F2** (staging, `docker-compose.staging.yml`) | subir com uma **cópia** do banco de produção: arquivados listados, **nenhuma escrita** em linha de legado (hash do `estado` antes/depois de horas rodando), personagem novo do PoE, caçada offline, Validação | autorizar a cópia |
| **F3** (produção) | merge na main e `/srv/draevor/bin/deploy.sh` (com backup). Saída de emergência: `DRAEVOR_CLASSICO=1` no `.env` + reinício. **Ainda não verificado:** o que acontece com um personagem do PoE no modo clássico (fazer na F2) | autorizar merge e deploy |
| **F4** (com o PoE estável) | aposentar o modo clássico: colapsar as 166 portas (fica o ramo PoE), apagar o código só do Draevor depois de verificar dependências (terreno das hunts e bestiário **ficam**), B → D, limpar `ITENS_POE` de comentários e textos | autorizar |

## Mapa do `ITENS_POE`

- **Lida pelo jogo:** em lugar nenhum. A porta é `catalogo.ligado()` = `!DRAEVOR_CLASSICO && dados presentes`. Linha morta:
  `tools/importar-atos-poe.mjs:100` (`process.env.ITENS_POE ??= '1'`).
- **Texto que o usuário ainda vê dizendo "ITENS_POE=1"** (corrigir em F1): `admin/itens-poe-http.mjs:111` e `:113`;
  `frontend/client/src/editor-itens-poe.mjs:40`, `editor-poe-telas.mjs:26`, `editor-pendencias-poe.mjs:23`.
- **Comentários "só com ITENS_POE=1"/"só local":** ~70 no código e 6 `_nota` em `gamedata/itens-poe` (limpar em F4, quando a frase
  deixar de ser verdade também para o clássico).
- **Testes:** 24 arquivos ainda fazem `process.env.ITENS_POE = '1'` (sem efeito); saem quando forem tocados.
- **O que a porta controla, PoE × Draevor:** ver seção 1 (166 chamadas + constantes de carga + 3 sinais do cliente). **Consolidável?**
  Já está numa função só; o passo seguinte é o colapso da F4, não um mecanismo novo.

## Problemas encontrados

| Id | Problema | Categoria | Situação |
|---|---|---|---|
| E | `admin/validacao-runner.mjs` carregava o jogo sem o PoE: as fases do `poe-ato-1` viravam "hunt que não existe" e a Validação bloquearia toda aprovação (V5/V6) | E | **corrigido** (usa o bootstrap) |
| A1 | Hunts e bosses do Draevor alcançáveis por `startHunt` direto no oficial (verificado: `troll-cave` e `werelions-1` entram). Na `werelions-1` o personagem do PoE **não mata nada** (0 abates em 2 h offline) | A | **corrigido** (08/10): só conteúdo do PoE — áreas, chefes de ato/pináculo e a arena PvP (`Cacadas.conteudoDoJogoOficial`); hunts e bosses do Draevor são recusados no servidor |
| A2 | Threads do tique (`SIMULADORES_TIQUE`) sem o PoE: quebrariam em área do PoE se ligadas (desligadas em produção) | A latente | **corrigido** |
| A3 | Mercado: ofertas abertas dos arquivados continuam compráveis/vendíveis por personagens do PoE (o mercado não tem porta do PoE) | A | **corrigido** (08/10): as ofertas dos arquivados voltam aos donos como crédito no boot (`Mercado.devolverOfertasDosArquivados`); o mercado só aceita itens do PoE |
| A4 | Ranking do site, do jogo e da arena lista os arquivados (level 500 do Draevor no ranking do PoE, teto 100) | A | **corrigido** (08/10): só personagens do PoE no ranking do jogo, do site e da arena (`Legado.sqlDoPoe`, conferido também no PostgreSQL) |
| A5 | `migrarClasse` (Engine) reescreve o estado dos arquivados da classe | A | **corrigido** (08/10): `migrarClasse(..., { pular: Legado.arquivado })` |
| L1 | Transferência do banco por nome gravava ouro no arquivado | efeito colateral | **corrigido** + teste |
| L2 | "Char da conta fora do mundo" lia e gravava ajustes no arquivado | efeito colateral | **corrigido** + teste |
| T1 | Textos de tela ainda mandam "ligar com ITENS_POE=1" (5 lugares) | texto | **corrigido** (08/10) |
| D1 | Dados do PoE fora do repositório: produção não sobe com este código sem eles; o motor de gemas é código externo executado em tempo de execução | deploy | **corrigido** (08/10, decisão do dono: tudo no repositório): `gamedata/itens-poe/` (catálogo, ícones, gemas, suportes, os 23 pools) e o motor de gemas em `systems/itens-poe/compilador-de-gemas/` |
| G1 | 19 gemas e 33 suportes com status "não funciona" no catálogo | conteúdo | decidir se caem em produção |
| X1 | Duas falhas do clássico que já existiam antes (não são da migração): `editor-conteudo` ("a v2 aparece como indisponível") e `prey-combate` (loot 10★) | — | anotado |

## Relatório (08/10, fim da F1)

- **Sistemas oficiais:** os da seção 5. O jogo sobe no PoE sem variável; todo processo (servidor, os dois workers, a Validação, os testes)
  carrega o mesmo jogo pelo bootstrap `itens-poe/iniciar.mjs`.
- **Decisões do dono aplicadas:** A1 só conteúdo do PoE (áreas, chefes de ato/pináculo, arena PvP); só itens do PoE entram no personagem
  em todo caminho (`itens-poe/so-itens-do-poe.mjs`, `podeEntrar`); A3 as ofertas dos arquivados voltam como crédito; A4 ranking só do PoE;
  A5 `migrarClasse` pula os arquivados; coins dos arquivados ficam guardadas; dados do PoE no repositório.
- **Itens:** raro sem modificador corrigido (base sem pool só cai como Único: 0 em 80 mil drops); os 23 pools especiais importados e
  ligados às moedas (Vaal, Veiled, os 6 Exalted de influência, os 8 orbes eldritch, Conflito, Domínio). Status das moedas: 64 funcionam,
  7 em parte, 124 não.
- **Ainda legados:** os da seção 6, desligados pela porta enquanto o modo clássico existir; o terreno das hunts e o bestiário seguem
  servindo às áreas do PoE.
- **Testes:** `node --test "game/testes/*.test.mjs"` — **3.472 testes, 2.867 passam, 0 falham**, 603 pulados com o motivo (as marcas B e C
  no oficial; o "só no oficial" no clássico) e 2 TODO (falhas anteriores à migração). Os irmãos `<x>.classico.test.mjs` (116) rodam os B
  e C no clássico dentro da mesma suíte. Matriz teste a teste: [`migracao-poe-matriz.md`](migracao-poe-matriz.md).
- **Postgres:** o SQL novo (ranking, site, devolução do mercado, consolidação, arena) conferido num Postgres descartável.
- **Pendências antes do deploy:** F2 — ensaio num staging com uma CÓPIA do banco de produção (no primeiro boot, todo personagem do Draevor
  fica arquivado e as ofertas deles no mercado viram crédito); a sua autorização para merge e deploy.

### Personagens arquivados: apagar (decisão do dono, 08/10)

O dono revogou o "arquivados ficam guardados" de 07/10: os arquivados podem ser apagados — o personagem inteiro, com o ouro, os itens e as
coins que estavam nele; as contas ficam. Quem apaga é o dono, com `game/admin/apagar-arquivados.mjs` dentro do container do jogo: sem
argumento só lista; `--apagar --confirmo=N` apaga os N listados (N diferente da lista de agora = nada apagado). Backup antes
(`/srv/draevor/bin/backup.sh`). Conferido no SQLite (`testes/apagar-arquivados.test.mjs`) e num Postgres descartável.

### Achados para decidir depois

| Achado | Onde |
|---|---|
| Limpar uma área do PoE vale 0 na economia dos encontros (o loot do PoE não tem preço de NPC): o editor recusaria toda recompensa numa área do PoE | `encontros-etapa6` (C) |
| Os tiers eldritch exigem iLvl 75 (dado do PoEDB): itens da campanha abaixo disso não recebem | `moedas.mjs` |
| Tradução dos pools: corrompidos 63%, veiled 64%, influências 42–58%, eldritch 16–18% (únicos 37%, árvore 24%) | `gamedata/itens-poe` |
| Em 36 dos 204 modificadores de monstro do PoE o jogo aplica uma aproximação com números diferentes do texto do PoE | `mobs-raridade` (C) |
| A Store perdeu os produtos que entregam item do Draevor (Exp Potion, Stamina Extension, Tier Up...) | `loja.mjs` (`FORA_DA_LOJA`) |
| Voltar ao clássico com personagens do PoE já criados não foi verificado | — |
| Com `Math.random` fixo (só em teste) algum laço não termina; não identificado | — |
| Um teste antigo do editor de itens grava linhas no histórico local `database/dados/item-power-edicoes.jsonl` (desde 05/10; só dado local) | `item-power-editor` |

## O que mudou no worktree (nada commitado desde `c2533b6`)

Código do jogo: `itens-poe/{iniciar,so-itens-do-poe}.mjs` (novos), `personagem/legado.mjs` (novo), `itens-poe/compilador-de-gemas/` (o
motor de gemas, copiado da coleção), `catalogo.mjs`, `gemas-poe.mjs`, `suportes-poe.mjs`, `jogo.mjs`, `gerar.mjs`, `moedas.mjs`,
`cacadas.mjs`, `hunt/combate.mjs`, `campanha.mjs` (a mensagem do Cruel no PoE), `sessao.mjs`, `banqueiro.mjs`, `mercado.mjs`, `ranking.mjs`,
`site.mjs`, `arena.mjs`, `loja.mjs` e os outros caminhos de entrada de item, `banco.mjs` (`migrarClasse` com `pular`; `DRAEVOR_SQLITE` só
para os testes), `backend/index.mjs`, os dois workers, `admin/{validacao-runner,itens-poe-http}.mjs`, textos das telas do editor.
Dados: `gamedata/itens-poe/` (catálogo, ícones, gemas, suportes, pools; "sempre" corrigido em 13 textos). Ferramentas:
`tools/importar-poe-itens.mjs`, `game/tools/importar-gemas-poe.mjs`. Testes: as marcas, os irmãos, `apoio*.mjs` e 5 arquivos novos
(`so-itens-do-poe`, `itens-poe-pools`, `moedas-pools`, `personagens-legado`, `isolamento-dos-testes`). Documentação: estes dois
documentos e as 8 skills em `.claude/skills/`.

**Não são meus e ficam fora de qualquer commit:** `gamedata/atos/poe-ato-1.json`, `gamedata/atos/_versoes/`,
`gamedata/overrides/_versoes/`, `gamedata/overrides/classes-poe.json`.
