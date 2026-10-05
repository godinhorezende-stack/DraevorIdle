# Engine — auditoria e plano de reorganização (pedido de 03/10)

Etapa **só de auditoria e plano**: nenhum código foi alterado. Tudo abaixo foi conferido no repositório (`frontend/client/src/editor-*.mjs`,
`admin/*.mjs`, `gamedata/`, `systems/`).

## 1. Estado atual da navegação

Casca: `frontend/editor-conteudo.html` + `editor-conteudo.mjs` (`GRUPOS`, `ABAS`, `lerEndereco`, `irPara`) + `editor-ui.mjs` (`navegacao`) + `editor-tema.css`.
Hoje: 3 grupos (Mundo, Entidades, Biblioteca), 13 itens, rota por `#aba/id` (URLs atuais), item ativo destacado, aviso de "alterações não salvas".
**Não existe:** recolher/expandir grupos, menu recolhido com tooltips, estado do menu guardado, comportamento para telas pequenas (o desenho foi
"só desktop" por decisão anterior sua — o pedido novo pede também dispositivos menores), indicadores de "em desenvolvimento".

## 2. Capacidade REAL de cada ferramenta (o que grava, onde, por qual rota)

Legenda: **Completa** = cria/edita/duplica/exclui com validação e persistência; **Parcial** = edita parte; **Consulta** = só leitura.

| Item do menu | Capacidade | Grava em (fonte oficial) | Rotas (`/api/mapas/_conteudo/…` salvo indicado) | Observação |
|---|---|---|---|---|
| Visão geral (`geral`) | Consulta | — | `auditoria`, `opcoes` | resumo e problemas |
| Mapa do mundo (`mapa`) | **Completa** (nós, tipos, conexões, metadados dos Atos) | `campanha-conteudo.json` | `mapa`, `mapa/validar` | não cria/exclui fase (a fase vem de `campanha.json`) |
| Fases e encontros (`fase`) | **Completa** (encontros: baú, boss, onda, captura…; descrição, ambiente, requisitos) | `encontros/<hunt>.json`, `campanha-conteudo.json` | `fase/<id>`, `fase/<id>/encontros`, `…/validar`, `…/meta` | |
| Hunts (`hunts`) | **Consulta** (mapa, monstros, distribuição, dificuldade, drops esperados) | — | `hunts`, `hunts/painel` | falta editar nível/dificuldade/requisitos (hoje em `campanha.json`/`catalog-real.json`) |
| Mapas (`mapas`) + antigo `/editor` | **Completa** para mapas do editor (chão + spawns); **Parcial** para mapa real (só spawns) | `hunts/<id>-map.json` | `/api/mapas*`, `mapas/validar` | duas telas para a mesma coisa (a antiga fica até você aprovar remover) |
| Acts (`atos`) | **Completa** (rascunhos, ligações, recompensas, versões, publicação) | `atos/<id>.json`, `atos/_versoes/…` | `atos-editor*` | legados só leitura; duplicar para editar |
| Mobs (`mobs`) | **Consulta** | — (bestiário vem do Canary, `catalog-real.json`) | `biblioteca/*` | |
| Bosses únicos (`bosses`) | **Completa** (criar, editar, duplicar, excluir com checagem de uso, validar) | `bosses-unicos.json` | `bosses`, `bosses/validar` | os 87 bosses do catálogo são Consulta |
| Itens, Outfits, Montarias | **Consulta** (ficha, sprite, tooltip real) | — (Canary: `item-catalog.json`, `outfits.json`, `mounts-real.json`) | `biblioteca/*` | |
| Biblioteca | **Consulta** (todas as categorias, busca global, "onde é usado") | — | `biblioteca/*` | |
| *(sem tela)* Modo beta | só API | memória + `modo-beta.json` | `modo-beta` (em `backend/index.mjs`) | **falta tela** |
| *(sem tela)* Server Save / manutenção | só API | — | `server-save` | **falta tela** |

Resumo: **edição completa** em 5 ferramentas (Mapa do mundo, Fases e encontros, Mapas, Acts, Bosses únicos); **parcial** em 1 (mapa real);
**só consulta** em 6 (Visão geral, Hunts, Mobs, Itens/Outfits/Montarias, Biblioteca); 2 funções de administração **sem tela**.

## 3. A estrutura proposta contra o que existe (nada de página fictícia)

| Grupo / item proposto | Hoje | O que falta para existir de verdade |
|---|---|---|
| **Gerenciamento** · Visão geral | ✔ existe (consulta) | — |
| **Mundo e campanha** · Mapa do mundo | ✔ completa | — |
| · Editor de mapas | ✔ (aba nova + antigo) | remover o antigo depois da sua validação |
| · Hunts e áreas | consulta | edição: nível/dificuldade por fase (`campanha.json`), requisitos, referência de mapa (editor de dados) |
| · Acts e campanhas | ✔ completa | — |
| · Fases e encontros | ✔ completa | — |
| **Conteúdo do jogo** · Mobs | consulta | edição exige **camada de overrides** (ver §4) — dado é do Canary |
| · Bosses | únicos: completa; catálogo: consulta | unificar numa tela só ("Bosses"), mantendo as duas fontes |
| · Itens e equipamentos | consulta | regras de item são editáveis (`gamedata/itens/*.json`: tiers, raridades, atributos, pools, preços); o catálogo-base é Canary → overrides |
| · Gemas | **sem tela** | dados: `gemas/*.json` (389 KB, 6 arquivos) → leitura primeiro, depois edição de `config`/`reforcos` |
| · Habilidades e magias | **sem tela** | dados: `action-catalog*.json` (Canary), `skills/tags.json`, `gemas/skills.json` → leitura + overrides |
| · Outfits / Montarias | consulta | só consulta enquanto o dado for Canary (overrides para nome/descrição) |
| · NPCs | **sem tela** | os NPCs ficam em `city-meta.json` (`npcs`: id, nome, posição, look, `tipo` banco/loja) — editor possível (posição, aparência, tipo) |
| · Efeitos e projéteis | **sem tela** | `effect-sprites.json`, `missile-sprites.json` → consulta visual; edição só de referência |
| **Sistemas e balanceamento** · Drops e recompensas | parcial: prévia/tabela visual, recompensas de ato, tabelas de encontro | tela central (tabelas `encontros.json`, recompensas, simulador); o loot de mobs é Canary → overrides |
| · Combate e atributos | **sem tela** | `combate/{controle,dot,formulas,limites}.json`, `atributos-principais.json`, `mobs/atributos.json`, `itens/atributos.json` |
| · Classes e progressão | **sem tela** | `classes.json`, `arvore/*.json`, `passivas/*.json`, `proficiencia.json` (553 KB) |
| · Economia e loja | **sem tela** | `store-real.json`, `itens/precos-de-venda.json`, `craft-receitas.json`, `desmanche.json` |
| · Quests e eventos | **sem tela** | `tarefas.json`, `diario.json`, `sets-de-marco.json`, encontros (já editáveis) |
| **Recursos** · Biblioteca | ✔ consulta | — |
| · Testes e beta | só API | tela do modo beta (liga/desliga, estado, atos em beta) — rápido |
| · Contas e permissões | **ausente** | `contas` não tem papel; ver §5 |
| · Configurações | só API | tela de Server Save/manutenção; configs do servidor |

## 4. Decisões de arquitetura (propostas)

1. **Três tipos de fonte, três tratamentos.**
   - **(A) Autoral** (feito pelo dono, lido no boot): `campanha*.json`, `encontros*`, `bosses-unicos.json`, `atos/`, `instancias.json`, `combate/*`, `itens/*`, `mobs/*`, `gemas/config`, `classes`, `arvore`, `economia`: **edição direta** com esquema e validação.
   - **(B) Importada do Canary/captura** (`catalog-real.json`, `item-catalog.json`, `action-catalog*.json`, `outfits.json`, `mounts-real.json`, `gemas.json`): **não se edita o arquivo** (os geradores sobrescreveriam e se perderia o que veio do original). Proposta: camada de **`gamedata/overrides/<categoria>.json`** aplicada por cima no boot, validada, versionada e desligável — o dado original continua intacto e o dono vê "original × sobrescrito".
   - **(C) Estado em banco** (contas, personagens, mercado): fora do editor de conteúdo; só consulta/ações auditadas.
2. **Quatro estados separados:** visualização → edição local (rascunho no navegador, "alterações não salvas") → salvamento (grava o arquivo no servidor onde o editor roda; hoje já é assim nos editores completos) → publicação (o arquivo vai com o **commit/deploy** e o jogo lê no boot — reinício controlado). Não há recarga a quente.
3. **Produção não pode ser alterada pelo editor por acidente:** hoje o editor via túnel grava no container de produção, e um `docker restart` (sem recriar) aplicaria o arquivo. Proposta: gravação do editor **desligada em produção** (`ENGINE_GRAVA=0`), ligada em desenvolvimento; o fluxo oficial é editar localmente → commit → deploy.
4. **Dependências antes de excluir/alterar:** reaproveitar o "onde é usado" da Biblioteca e o validador de atos; toda exclusão/alteração crítica mostra os usos e exige confirmação; excluir = **desativar** quando houver uso.
5. **Menu:** só entram itens que tenham tela real; futuros aparecem quando a tela existir (sem badge "em breve" para página inexistente). O selo "em desenvolvimento" é só para telas que já existem mas são parciais (ex.: Hunts = consulta).

## 5. Permissões (precisa da sua decisão)

Hoje a proteção é **só de rede** (nginx tranca `/api/mapas`; só chega por túnel SSH). O jogo não tem papel por conta (`contas`: id, email, senha, criada_em). Para "validar permissões no servidor":
- **Proposta:** lista de administradores por e-mail (`ADMINS`, inicialmente `god.rafa365@gmail.com`) + login na Engine com a conta do jogo; as rotas de ESCRITA do editor passam a exigir sessão de administrador, além do bloqueio de rede.
- Alternativa mínima: manter só a rede e documentar que não há papéis.

## 6. Plano de execução incremental (cada etapa: auditoria do que existe → implementar → teste → PR; sem mexer em gameplay/balanceamento/dados sem aprovação)

1. **Menu e casca** (sem tela nova de conteúdo): reorganizar `GRUPOS` na estrutura proposta usando só o que existe; grupos recolhíveis; menu recolhido com tooltips; estado guardado; destaque da rota ativa; ícones; responsivo (gaveta em tela pequena); selo "consulta"/"parcial" por item; URLs atuais mantidas. Itens hoje: Gerenciamento (Visão geral) · Mundo e campanha (Mapa do mundo, Mapas, Hunts, Acts, Fases e encontros) · Conteúdo (Mobs, Bosses únicos, Itens, Outfits, Montarias) · Recursos (Biblioteca).
2. **Recursos que já existem sem tela:** *Testes e beta* (modo beta) e *Configurações* (Server Save/manutenção) — só expõem rotas que já existem; leitura de estado + ações com confirmação.
3. **Permissões no servidor** (se aprovada a §5): administrador por e-mail, sessão, proteção das rotas de escrita, trava de produção (`ENGINE_GRAVA`).
4. **Hunts e áreas → edição** do que é autoral: nível por dificuldade e requisitos de fase (`campanha.json`) com validação, impacto na progressão e aviso de balanceamento. *(precisa de autorização — mexe em progressão.)*
5. **Camada de overrides (B)** com o primeiro caso de uso: **Mobs** (nome, vida, dano, defesa, resistências, exp, loot, ataques) e **Bosses do catálogo**; mostrar original × sobrescrito, validar, versionar, "onde é usado". *(precisa de autorização — pode mexer em balanceamento; o editor só produz o arquivo, o jogo só muda quando você publica.)*
6. **Itens e equipamentos:** editor das regras autorais (`gamedata/itens/*`) e overrides do catálogo-base.
7. **Sistemas autorais:** Combate e atributos, Classes e progressão, Economia e loja, Quests e eventos, Gemas, Habilidades — um editor por arquivo/família, com esquema e validação, na ordem de menor risco.
8. **NPCs, Efeitos e projéteis:** consulta visual primeiro; edição do que for referência.
9. **Fechamento:** relatório final de capacidades, testes de regressão e a remoção do editor antigo `/editor` se você aprovar.

## 7. Relatório de funcionalidades (pedido §7)

- **Ferramentas existentes:** 12 telas + 2 funções de administração sem tela (§2).
- **Só reorganizadas na etapa 1:** nenhuma ferramenta nova; muda a estrutura do menu.
- **Edição completa:** Mapa do mundo, Fases e encontros, Mapas (do editor), Acts, Bosses únicos.
- **Edição parcial:** Mapas reais (só spawns).
- **Só consulta:** Visão geral, Hunts, Mobs, Itens, Outfits, Montarias, Biblioteca.
- **Ausentes:** Gemas, Habilidades e magias, NPCs, Efeitos e projéteis, Combate e atributos, Classes e progressão, Economia e loja, Quests e eventos, Contas e permissões, telas de Testes/beta e Configurações.
- **Componentes reutilizáveis:** `el`/`navegacao`/`cabecalho`/modais/editor JSON (`editor-ui.mjs`), `retrato`/`previa` (`editor-sprites.mjs`), `criarBiblioteca` (consulta com "onde é usado"), `tabelaDeDrops`, validadores (`encontros/modelo`, `atos-modelo`, `mapa/spawns`, `bosses-unicos/catalogo`).
- **Limitações de persistência/publicação:** sem recarga a quente; o arquivo gravado só vale no boot; produção não deve ser editada (§4.3); dado Canary exige overrides (§4.1).
- **Conflito a resolver:** a Engine foi decidida como "só desktop"; o pedido novo quer menu utilizável em telas menores — o plano cobre o MENU (gaveta); as telas de edição densas (canvas de mapas e atos) seguem desktop-first.

## Decisões do dono (03/10) e andamento
1. **Permissões:** login na Engine com a conta do jogo + administradores por e-mail (começando por `god.rafa365@gmail.com`), além do bloqueio de rede. *(etapa 3)*
2. **Produção:** a gravação do editor é desligada em produção; edição só local (editar → commit → deploy). *(etapa 3)*
3. **Overrides:** camada `gamedata/overrides/<categoria>.json` por cima do dado do Canary, original intacto. *(etapa 5)*
4. **Balanceamento:** autorizado construir as telas de edição (Hunts, Mobs…); o editor só gera o arquivo, nada muda no jogo até você publicar (commit + deploy). Nenhum valor atual é alterado por mim.
5. **Telas pequenas:** só o MENU vira gaveta; as telas densas (mapas, atos) seguem desktop-first.
6. **Ordem:** seguir as etapas do plano, uma por vez, com PR e testes.

**Etapa 1 — menu e casca (feita):** `editor-menu.mjs` (estado, grupos, recolhido, marcas), `GRUPOS`/`ABAS` reorganizados (Gerenciamento · Mundo e campanha · Conteúdo do jogo · Recursos; o grupo "Sistemas e balanceamento" só aparece quando tiver tela), menu recolhível em trilho de ícones com dicas, grupos que expandem/recolhem, estado guardado no navegador, gaveta com botão ☰ em telas ≤ 900 px, marcas "consulta"/"parcial", rota ativa destacada. URLs atuais mantidas.

**Etapa 2 — Testes e beta + Configurações (feita):** `admin/operacao.mjs` (estado e ações do beta, da manutenção e do Server Save, com registro das ações do processo), rotas `operacao`, `operacao/beta`, `operacao/manutencao`, `operacao/server-save` (as rotas antigas `modo-beta` e `server-save` continuam e usam o mesmo módulo); telas em `editor-operacao.mjs`, no grupo Recursos. São controles do servidor em execução (não editam arquivo): o beta e a manutenção voltam ao padrão no reinício; ações de risco pedem confirmação. Limite: o registro de ações é em memória (permanente só com o login/auditoria da etapa 3) e o Server Save só aparece se estiver rodando no processo.

**Etapa 3 — permissões e produção só leitura (feita):**
- `admin/acesso.mjs` + `acesso-http.mjs`: login com a **conta do jogo** (senha scrypt, a mesma do jogo) cujo e-mail está em `gamedata/engine.json` (`admins`, começa por `god.rafa365@gmail.com`; `ENGINE_ADMINS` substitui). Sessão na memória do processo (12 h), cookie `engine_sessao` HttpOnly + SameSite=Strict (+ Secure atrás de HTTPS), `Path=/api/mapas` — o editor antigo `/editor` usa o mesmo cookie. Limite de 5 tentativas por IP/10 min, checagem de origem nos pedidos que mudam algo.
- Vale para TODA rota `/api/mapas*`, antes das demais, em cima do bloqueio de rede. Em **produção** (NODE_ENV=production, container ou `ENGINE_MODO=producao`): login obrigatório e **gravação de arquivos desligada** — o servidor responde 403 `gravacao-desligada`. Operar o servidor (beta, manutenção, Server Save) e os POST que só validam/pré-visualizam continuam permitidos ao administrador. POST desconhecido = grava (nega por padrão).
- Em desenvolvimento (sua máquina) nada exige login e tudo grava. `ENGINE_GRAVA=1` religa a gravação em produção; `ENGINE_EXIGE_LOGIN=0|1` ajusta o login.
- **Achado importante:** em produção `gamedata/` é montado SOMENTE LEITURA no container, exceto `gamedata/hunts` (→ `/srv/draevor/data/mapas`, gravável). Ou seja, antes desta etapa só o editor de MAPAS conseguia gravar em produção (e isso fica fora do Git: "data/mapas não sincroniza"); encontros, bosses, atos e campanha já falhavam com erro de disco. Agora todos retornam a mesma mensagem clara. Para editar mapas no servidor de novo, é preciso `ENGINE_GRAVA=1` no `.env` do servidor — o fluxo oficial passa a ser editar local → commit → deploy.

**Etapa 4 — níveis da campanha em Hunts e áreas (feita):** vista "Níveis da campanha" (`#hunts/niveis`, `editor-campanha.mjs`, `admin/campanha-editor.mjs`; botão também no painel de cada hunt). Edita, para as 48 fases e os 4 bosses de ato de `gamedata/campanha.json`: level original, level alvo nas 3 dificuldades e a fase travada (`pular`). **Não** edita a estrutura (quais fases, ordem, ato: isso é dos Acts) nem a escala (expoentes) e as faixas das dificuldades (só leitura). Fluxo em quatro tempos visíveis na tela: **editar** (só na tela) → **pré-visualizar** (o servidor devolve erros, avisos e o impacto % na vida/dano/exp com a MESMA conta do jogo, sem gravar) → **salvar** (grava só os campos editados, com a cópia da versão anterior em `gamedata/campanha-versoes/`; restaurar disponível) → **publicar** (commit + deploy; o jogo lê no boot). Avisos de BALANCEAMENTO (vida ±25%+), PROGRESSÃO (travar/destravar fase) e escada do ato que desce; erros bloqueiam (inteiro 1–5000, Normal ≤ Cruel ≤ Merciless, hunt/boss existem). Em produção os campos ficam desabilitados e o servidor recusa a gravação (etapa 3). Requisitos de fase (`exige`, level recomendado) já são editáveis em Fases e encontros — não foram duplicados. O teste CE6 prova, num processo novo do jogo (`DRAEVOR_CAMPANHA`), que o arquivo salvo é o que o jogo lê. Nenhum valor atual foi alterado.

**Etapa 5 — camada de overrides, primeiro caso: Mobs (feita):**
- `systems/overrides.mjs` (validação, aplicação e leitura; PURAS e testadas) + `gamedata/overrides/monstros.json` (só as DIFERENÇAS; não existe até o dono salvar o primeiro override). No boot, `dados.mjs` aplica por cima do bestiário e `poderes.mjs` aplica os ataques; o `catalog-real.json` (Canary) NUNCA é tocado. Entrada inválida é ignorada com aviso no log, sem afetar os outros monstros nem derrubar o servidor.
- O que se edita (só o que tem suporte real no jogo): nome, classe, estrelas, vida, experiência, armadura, velocidade, resistências por elemento (junta com as do original), loot (substitui a lista; chance é fração), ataques (substituem; tipo, elemento, dano mín/máx, intervalo, chance, forma…), sprite (um `look` que já existe) e cores. **Variação** (duplicar): um monstro novo nascido de um existente (`base`); a cópia leva as alterações do monstro de origem.
- Fluxo igual ao dos níveis da campanha: **editar → pré-visualizar** (original × efetivo, variação %, dano por segundo e valor do loot, avisos de balanceamento ≥25% e de USO — onde o monstro aparece) **→ salvar** (arquivo + versão anterior em `gamedata/overrides/_versoes/monstros/`) **→ publicar** (commit + deploy). Reverter apaga a entrada (o original volta); variação em uso não se apaga; desligar uma entrada ou a camada inteira não apaga nada.
- Tela: Mobs (Biblioteca de consulta) ganhou "Editar mobs (overrides)" e "Editar este monstro" na ficha; editor com abas Geral, Resistências, Ataques, Loot, Sprite e Onde é usado, com o original ao lado de cada campo. O marcador do menu passou de "consulta" para "parcial".
- Prova: o teste OV7 sobe um processo NOVO do jogo apontado para os overrides salvos e confere que o monstro nasce na hunt com a vida nova, que a variação existe, que os ataques mudaram e que o inválido foi ignorado; sem arquivo, o jogo é o original.
- Limites: só monstros (bosses do catálogo e itens entram nas próximas etapas, pelo mesmo mecanismo); não cria monstro do zero (só variação de um existente); personagens com caçada já gravada mantêm os valores de antes nos bichos já criados (comportamento que o jogo já tinha para qualquer mudança no bestiário).

## Auditoria dos módulos "de consulta" — editores completos (pedido de 03/10)

Verificado no código (não pelo selo do menu). "Boot" = o jogo só lê no início do servidor; "quente" = vale sem reiniciar.

| Módulo | Fonte dos dados | O que EDITA hoje (real) | Recarga | O que falta para "editor completo" | Exige mudança de backend/estrutura? |
|---|---|---|---|---|---|
| **Mobs** | `catalog-real.json` → `bestiary` (1840, Canary) + `monstro-poderes.json` (193 com ataques) | **Editar** vida, exp, armadura, velocidade, nome, classe, estrelas, resistências, loot, ataques, sprite/cores (overrides) · **Duplicar** como variação · reverter, desligar, versões (Etapa 5) | Boot | Criar mob do ZERO (hoje só variação); abas Habilidades/Comportamento/Invocações (o bestiário não tem esses campos: comportamento vem de `mobs/modificadores.json` e das mecânicas por modificador; invocação é mecânica de boss único); animações do sprite; "categorias e níveis" (o mob não tem level próprio: o level vem da fase) | Criar do zero: pequeno (aceitar `novo` com campos obrigatórios em `overrides.mjs`). Comportamento/invocação: só via modificadores existentes ou boss único — sem campo novo no jogo |
| **Bosses únicos** | `bosses-unicos.json` | **Completo** (criar, editar, duplicar, excluir c/ checagem de uso, validar) — `editor-bosses.mjs` | Boot em produção; no servidor de desenvolvimento o cadastro vale na hora (`registrar`) | Distinguir boss de ato / de hunt / miniboss na lista (já há `categoria`); editar os 87 bosses do CATÁLOGO (que são monstros do bestiário + hunt com `cooldownHours`/`task`) | Os 87: os overrides de monstros já cobrem os atributos; cooldown/portal NÃO se mexe (regra fixa) |
| **Itens** | `item-catalog.json` (6178, Canary) + regras autorais `gamedata/itens/*.json` + `armas/*.json` | **Editar** nome, raridade-base, peso, level mín., slots de imbuement, ataque, defesa, armadura, compra, venda (overrides de ITENS, esta etapa) · reverter, desligar, versões | Boot | Criar/duplicar item (precisa de sprite: o cliente lê `item-sprites.json` por id — um id novo exige "emprestar" o desenho de outro, como já faz `DESENHO_EMPRESTADO`, e levar isso ao cliente); atributos/modificadores/prefixos/sockets de uma peça (os adds NÃO moram no item: saem das REGRAS de geração `itens/*.json`); prévia do tooltip do EFETIVO (hoje o balão real é do original); regras de drop por item | Criar item: **sim** (id novo + sprite emprestado enviado ao cliente). Regras de geração: editor de valores com a MESMA validação do boot (já extraída: `validar(dados)`) |
| **Outfits** | `outfits.json` (544 KB: folhas de sprite por look) + `mounts-real.json` + atlas PNG em `gamedata/sprites/` | **Nada** (consulta) | Boot (+ imagens estáticas) | Editar nome/vocação/preço/variações (addons); criar outfit exige IMAGEM nova + descritor da folha; "validar arquivos associados" | **Sim**: pipeline de upload/validação de assets e descritor da folha de sprite |
| **Montarias** | `mounts-real.json` + `outfits.json` | **Nada** (consulta) | Boot | Editar nome/velocidade/preço(?)/referências; criar exige o mesmo pipeline de assets | **Sim**: o mesmo dos outfits |
| **Biblioteca** | todos os cadastros | consulta; agora **abre o editor** de mob e de item pela ficha (botões "Editar este monstro/item") | — | Abrir editor de boss/outfit/montaria (quando existirem) | Não |

**Leitura do estado quanto às exigências gerais**
- *Autenticação, permissões e produção protegida:* feitas na Etapa 3 (login por e-mail de administrador; gravação de arquivos desligada em produção). 
- *Validação no backend:* todos os editores validam no servidor (a tela só apresenta). 
- *Proteção contra sobrescrita silenciosa e concorrência:* **ainda não** — o salvar não confere se o arquivo mudou desde que a tela abriu. Próximo passo de infraestrutura: enviar a "versão" lida e recusar 409 se divergir. 
- *Registro de alterações administrativas:* **ainda não** (só o histórico de versões dos arquivos e o registro em memória das ações de operação). Próximo passo: log append-only de cada gravação (quem, quando, o quê). 
- *Backup/recuperação:* existe por arquivo (versões só de acréscimo + restaurar). 
- *Recarga sem reiniciar:* nenhum editor de dados importados aplica a quente — tudo é no boot (publicar = commit + deploy). Os bosses únicos aplicam na hora só no servidor de desenvolvimento.
- *Menu:* "Mobs" e "Itens" estão como **parcial** (editam por override; falta criar do zero e as abas pedidas). Outfits, Montarias e Biblioteca seguem **consulta** até terem salvamento real.

**Ordem das próximas etapas (sem alteração destrutiva)**
1. Infra comum: controle de concorrência (409) + log de auditoria das gravações.
2. Mobs: criar do zero; abas Atributos/Combate/Drops/Visual/Referências organizadas como pedido.
3. Itens: editor das REGRAS de geração (raridades, tiers, atributos, pools, efeitos, preços) + criar/duplicar item com sprite emprestado + prévia do tooltip do efetivo.
4. Bosses do catálogo (atributos via overrides de monstros) e distinção por tipo na lista.
5. Outfits e Montarias: primeiro edição dos cadastros existentes (nomes, vocação, preços); criar com assets só depois do pipeline de upload.
6. Fechamento do menu e regressão.

## Infraestrutura comum dos editores (controle de concorrência + auditoria)

- **Concorrência**: cada leitura devolve uma `revisao` (hash do arquivo, `ausente` se não existe). Campanha, overrides de Mobs e de Itens conferem a revisão em salvar/reverter/duplicar/ativo/restaurar; Atos conferem a `versao`. Revisão velha → HTTP 409 `conflito`, nada é gravado, e a tela abre o modal "Conflito de edição" (recarregar ou continuar vendo a sua).
- **Auditoria**: `admin/auditoria.mjs` grava uma linha JSON por login, falha de login, logout, recusa, gravação e operação (quem, IP, rota, resumo em nomes de campo, resultado). Nunca guarda senha nem o conteúdo editado. Arquivo em `database/dados/engine-auditoria.jsonl` (rotaciona em 5 MB); lido em Configurações (`GET auditoria`).
- **Limites**: editores antigos (bosses únicos, fase meta/encontros, mapa do mundo, `/api/mapas`) ainda não conferem revisão; um cliente que omite `revisao` não é checado.

## Editor universal de sprites (monstros, outfits e montarias)

Auditoria e arquitetura em `docs/editor-de-sprites-auditoria.md`. Resumo: uma folha PNG por `look` (quadros em linhas; direção/camada/addon/pose em colunas), cadastro em `outfits.json`; overrides em `gamedata/overrides/sprites/<look>.png` + `sprites.json`, aplicados pelo cliente do jogo. Menu: "Editor de sprites" (`parcial`: edita monstros, outfits e montarias; efeitos, projéteis e ícones de itens não entram). Também abre pelo botão "Editar sprite" da Biblioteca e do editor de Mobs.
