# Editor de mapas (`/editor`) — auditoria de TODAS as funções

Feita antes de qualquer mudança, para que nada se perca quando o editor ganhar a casca nova (aba "Mapas" do `/editor/conteudo`).
Tudo abaixo foi lido no código: `game/frontend/editor.html`, `game/frontend/client/src/editor.mjs` (716 linhas), `game/admin/mapas.mjs`,
rotas em `game/backend/index.mjs` (linhas ~163–184), `game/systems/mapa/spawns.mjs`, `game/admin/migrar-spawns.mjs`,
`game/admin/raridade-dos-mapas.mjs`.

## 1. Arquivos e rotas

| O quê | Onde |
|---|---|
| Página | `frontend/editor.html` (rota `/editor`, `backend/index.mjs:63`) |
| Lógica da tela | `frontend/client/src/editor.mjs` |
| Regras de gravação | `admin/mapas.mjs` (`listar`, `carregar`, `salvar`, `salvarSpawns`, `ehMapaReal`, `bestiarioParaEditor`, `criaturasPorHunt`, `cidadeParaEditor`, `raridadesParaEditor`, `atributosDoMob`, `PALETA_DO_EDITOR`) |
| Formato/validação dos spawns | `systems/mapa/spawns.mjs` (`TIPOS`, `PADRAO`, `normalizar`, `spawnsDoMapa`, `validar`) |
| Dados | `gamedata/hunts/<id>-map.json` (130 arquivos; em produção `gamedata/hunts` é sobreposto por `data/mapas`) |
| Scripts de manutenção | `admin/migrar-spawns.mjs` (migração única dos pontos capturados → `spawns`), `admin/raridade-dos-mapas.mjs` (grava raridade/modificadores pela distribuição `gamedata/mobs/distribuicao.json`; `--gravar`, `--refazer`) |
| Rotas HTTP (prefixo `/api/mapas`, trancado ao público pelo nginx) | `GET /api/mapas/opcoes` · `GET /api/mapas/atributos-do-mob?key&level&raridade&mods` · `GET /api/mapas` (lista de ids) · `GET /api/mapas/<id>` (o mapa) · `POST /api/mapas` (salvar) |
| Testes que cobrem | `testes/mapa-spawns.test.mjs`, `testes/raridade-dos-mapas.test.mjs`, `testes/minimapa.test.mjs` (leitura do mapa) — o `mapa-editor.test.mjs` é do MAPA DO MUNDO (`campanha-conteudo`), outro assunto |

## 2. Inventário de funções (checklist F1–F40)

Cada linha é uma função que a nova tela precisa manter. `[servidor]` = regra que já mora no servidor (a tela só pede).

### Mapa (arquivo)
- **F1** Novo mapa com largura/altura (5–300); nasce TUDO bloqueado e sem chão, o dono "cava" o andável.
- **F2** Id do mapa (`^[a-z0-9-]{3,40}$`), campo livre; salvar sem id é recusado com aviso.
- **F3** Listar mapas existentes (select) e abrir um (carrega o JSON inteiro, mostra `largura`/`altura`).
- **F4** Distinguir **mapa do editor** (atlas da cidade, 1 andar: chão + spawns editáveis) de **mapa real** (atlas próprio ou vários andares: SÓ spawns). Selo na barra: "Mapa novo" / "Mapa do editor — chão e spawns" / "Mapa real — só os spawns".
- **F5** Salvar mapa do editor: grava o arquivo inteiro (`width, height, cell, atlas, palette, z:7, levels:[7], floors, stacks, blocked, opaque, avoid, custom:true, spawns`). `[servidor]` valida grade (`blocked`/`stacks` = largura×altura).
- **F6** Salvar mapa real: só o bloco `spawns` (o servidor recusa gravar a grade por cima — `salvarSpawns`); tela exige o MESMO id que foi aberto.
- **F7** Compatibilidade com o formato antigo `posicoes` (um bicho por ponto → spawn de quantidade 1, raio 0), na leitura e no POST.
- **F8** Mensagem de sucesso diferente por tipo ("Spawns de X salvos (n)" / "Salvo — já dá pra jogar com startHunt").
- **F9** Erro de gravação de disco explicado (editor grava no servidor de desenvolvimento).

### Desenho
- **F10** Desenhar o chão com as SPRITES REAIS do atlas do próprio mapa (pilhas, offsets `dx/dy`, altura), por andar.
- **F11** Andares: select com "(entrada)" e contagem de spawns por andar; trocar de andar desmarca o spawn.
- **F12** Zoom 25/50/75/100/150% (mapa > 20 000 casas abre a 50%).
- **F13** Mostrar bloqueado (vermelho; casa sem chão escura) — sempre ligado no mapa novo.
- **F14** Mostrar raio dos spawns (retângulo).
- **F15** Criatura do spawn desenhada com a sprite/outfit do jogo (`drawCreature`), com fallback enquanto a folha carrega (re-tenta).
- **F16** Anel da cor da raridade sob a criatura e "×N" da quantidade.
- **F17** Casa sob o mouse realçada + barra de status (`x, y, andar · vazio/bloqueado/andável · spawn id: nome`).
- **F18** Centralizar (scroll suave) no spawn clicado na lista e no primeiro do andar ao abrir.

### Ferramentas
- **F19** Spawn: clique numa casa andável marca um spawn com a criatura escolhida; clique num spawn existente seleciona/desseleciona. Recusas com aviso: sem criatura escolhida; casa não andável.
- **F20** Apagar spawn (ferramenta) e botão ✕ na lista.
- **F21** Pincel (arrastar; pinta chão andável com o piso escolhido) — só mapa do editor; no real avisa "o chão não é editado aqui".
- **F22** Parede (arrastar; bloqueia) — só mapa do editor.
- **F23** Paleta de pisos (índices seguros `PALETA_DO_EDITOR` = 40, 579, 571, 569, 555, 713, 718, 554, com a sprite real); desabilitada em mapa real.
- **F24** Ajuda contextual de cada ferramenta.

### Spawn (propriedades)
- **F25** Criatura: lista com sprite, nome, HP, classe e marca "boss"; "Deste mapa / hunt" primeiro (criaturas da hunt do catálogo + já usadas), resto por busca (nome ou key, até 60).
- **F26** Trocar a criatura do spawn selecionado clicando na lista (senão vira a "criatura do próximo spawn").
- **F27** Raio (0–10) e quantidade (1–20) — do spawn selecionado ou "valem para o próximo".
- **F28** Raridade (normal/modificado/raro/elite/único/boss… `Raridade.opcoesParaEditor`), com cor, e o teto de modificadores por raridade.
- **F29** Modificadores: checkbox com descrição; travados pelo teto, pelas raridades permitidas de cada um e pelas incompatibilidades (com dica do motivo). Regra "normal + modificador = modificado". `[servidor]` fonte das regras.
- **F30** Atributos CALCULADOS do monstro do spawn (painel por `GET atributos-do-mob`): vida, dano, precisão, evasão, armadura, bloqueio, resistências, com a ORIGEM de cada parcela, os ataques e os erros/avisos das combinações; nível editável; resposta descartada se chegou fora de ordem (`pedidoDoPainel`).
- **F31** Lista de spawns do andar (id · criatura ×qtd (x,y), cor da raridade, modificadores) com contagem "n de m no mapa".
- **F32** `tipo` do spawn (`normal|elite|miniboss|boss`) preservado; `raridade` do tipo antigo vira "normal" explícito se o dono volta a normal.
- **F33** Ids de spawn únicos (`s1, s2…` sem repetir).

### Servidor (regras que não podem se perder)
- **F34** `validar(spawns, {largura, altura})` em toda gravação (ponto dentro do mapa, criatura do bestiário, raridade/modificadores válidos, ids únicos…).
- **F35** `normalizar` preenche padrões (raio 2, quantidade 1, tipo normal, peso 1).
- **F36** Mapa salvo vira hunt jogável na hora (`mapaRealCapturado` lê o arquivo) — "já dá pra jogar com startHunt".
- **F37** `bestiarioParaEditor` (key, name, hp, look, colors, boss, classe), `criaturasPorHunt`, `cidadeParaEditor`, `raridadesParaEditor` (dados que a tela usa).

### Fora da tela, mas parte do "editor de mapas"
- **F38** `migrar-spawns.mjs` (migração única; `--gravar`).
- **F39** `raridade-dos-mapas.mjs` (completa raridade pela distribuição; semente fixa por mapa+spawn; `--refazer`).
- **F40** Em produção os mapas vêm de `data/mapas` (sobrepõe `gamedata/hunts`): gravar pelo editor só vale no servidor onde ele roda.

## 3. Regras para a migração para a casca nova
1. **Não remover nada do `/editor` atual** enquanto a aba nova não cobrir F1–F37 com teste. O `/editor` continua como está (as rotas `/api/mapas*` não mudam).
2. A aba nova fala com as MESMAS rotas e as MESMAS regras do servidor (nenhuma regra nova no cliente).
3. A cada função migrada, marcar aqui (tabela abaixo) com o teste que a prova.

## 4. Lacunas que a auditoria achou no editor atual (não são regressões)
- Não há **desfazer/refazer** nem **confirmação ao sair com alterações não salvas** no `/editor`.
- Não há **validação ao vivo** dos spawns (só ao salvar; o erro vem como um aviso de uma linha).
- Não há **distribuição por raridade do mapa** à vista (quantos normais/elite/raro/único/boss tem o mapa vs. `distribuicao.json`).
- Não há **painel por hunt** (mapa + monstros + distribuição + dificuldade + drops no mesmo lugar) — é o item seguinte, abaixo.
- O chão só se edita no mapa do editor; mapas reais não permitem pintar (por desenho: evita apagar o capturado).

## 5. O que a Etapa 6 entregou (e o que ficou de fora)
- **Auditoria dos mapas:** este documento (F1–F40). O `/editor` **não foi alterado**, só ganhou `?mapa=<id>` (abre o mapa pedido) para o painel de hunts linkar. Nenhuma das F1–F37 foi migrada para a casca nova ainda: a migração fica para a próxima etapa, função por função, com teste por linha desta tabela.
- **Painel por hunt** (`#hunts` no `/editor/conteudo`, `admin/hunts.mjs` + `editor-hunts.mjs`): mapa (arquivo, tamanho, andares, tipo, minimapa de spawns por raridade e andar, link para o editor de mapas), monstros (quantidade esperada por limpeza e % dos bichos, vida na escala), distribuição de raridade (contra o alvo de `distribuicao.json`), dificuldade (multiplicadores por dificuldade da campanha) e drops esperados. Somente leitura.
- **Drops — tabela visual** (`editor-drops.mjs`): item com sprite real, chance, barra do esperado por limpeza/execução, valor NPC, origem; ordenável. Usada no loot esperado da hunt (monstros e encontros) e na prévia da recompensa de ato.
- **Limites:** o loot dos monstros é do bestiário (Canary) e não é editável aqui; a prévia é estimativa por chance (sem Buff Power, prey nem afixo de loot). Hunts VIP/especial/divina não têm spawns no mapa: o painel mostra o cadastro, sem quantidade nem distribuição.

## 6. Migração para a casca nova — rastreio F# → onde mora → teste
Aba **Mapas** de `/editor/conteudo` (`editor-mapas.mjs` = tela; `editor-mapas-logica.mjs` = regras puras; servidor inalterado salvo `validarSpawns`). O `/editor` antigo **continua**, ligado na navegação como "Editor de mapas (antigo)".

| F | Função | Onde (novo) | Prova |
|---|---|---|---|
| F1 | Novo mapa (tudo bloqueado, 5–300) | `novoMapa`, `tamanhoValido`, `criarNovo` | `editor-mapas.test.mjs` F1/F2/F4 + smoke (passo 1) |
| F2 | Id válido; salvar sem id recusa | `ID_VALIDO`, `corpoDeSalvar` | teste F5/F6/F8 |
| F3 | Listar e abrir mapas | `carregarLista`, `abrirPeloId` | smoke passos 1 e 9 |
| F4 | Mapa do editor × mapa real (selo) | `ehMapaReal`, `pintarTudo` | teste F1/F2/F4 + smoke 9 |
| F5/F6/F8 | Salvar (grade inteira × só spawns; mesmo id no real; mensagens) | `corpoDeSalvar`, `mensagemDeSalvo` | teste F5/F6/F8 + smoke 8 e 11 |
| F7 | Formato antigo `posicoes` | `spawnsDoMapaAberto` | teste F7/F10/F11/F31 |
| F9 | Erro de gravação explicado | servidor (`salvarSpawns`), mensagem mostrada por `dizer` | `mapa-spawns.test.mjs` (servidor) |
| F10 | Chão com sprites reais do atlas, por andar | `desenharFundo`/`desenharPilha`, `gradeDe` | teste F7/F10 (grade); desenho verificado só por simulação |
| F11/F31 | Andares com contagem e "(entrada)"; lista do andar | `spawnsPorAndar`, `montarAndares` | teste F7/F10/F11/F31 + smoke 9 |
| F12 | Zoom 25–150% (50% se > 20 000 casas) | `#mp-zoom`, `abrir` | smoke 9 (andares/zoom) |
| F13/F14 | Mostrar bloqueado / raio | `desenharMarcas` | só visual (simulado) |
| F15/F16 | Sprite da criatura, anel da raridade, ×N | `desenharMarcas` | só visual (simulado) |
| F17 | Casa sob o mouse + status | `casaDoPonteiro`, `textoDaCasa` | teste F17 |
| F18 | Centralizar no spawn | `centralizar` | só visual |
| F19/F20/F26 | Marcar/apagar spawn, trocar criatura | `motivoParaNaoMarcar`, `novoSpawn`, `aplicarFerramenta`, `escolherBicho` | teste F19/F20/F26/F33 + smoke 3–4 |
| F21/F22 | Pincel e parede (só mapa do editor) | `pintarCasa` | teste F21/F22 + smoke 2 |
| F23/F24 | Paleta de pisos e ajuda | `montarPaleta`, `AJUDA` | só visual |
| F25 | Lista de criaturas (deste mapa, busca, 60) | `gruposDeBichos` | teste F25 |
| F27 | Raio 0–10, quantidade 1–20 | `limitarRaio`, `limitarQuantidade` | teste F27 |
| F28/F32 | Raridade, normal+mod = modificado, tipo antigo | `comRaridade`, `aplicarRaridade` | teste F28/F32 |
| F29 | Modificadores travados (teto, raridade, incompatível) com motivo | `estadoDoModificador` | teste F29 |
| F30 | Atributos calculados pelo servidor, origem de cada parcela | `montarAtributos` (rota `atributos-do-mob`) | smoke 10 |
| F33 | Ids únicos | `novoId` | teste F19/F20/F26/F33 |
| F34/F35/F36/F37 | Validação, padrões, mapa jogável, dados do editor | servidor (inalterado) | `mapa-spawns.test.mjs`, `raridade-dos-mapas.test.mjs` |
| F38–F40 | Scripts de manutenção e dados em produção | inalterados | — |

**Lacunas da auditoria resolvidas na aba nova:** desfazer/refazer (Ctrl+Z / Ctrl+Y), validação ao vivo dos spawns (lista TODOS os erros e marca o spawn), aviso de alterações não salvas (o mesmo da Engine) e a distribuição de raridade à vista. **Ainda só no `/editor` antigo?** Nada: todas as funções F1–F37 estão na aba nova; o antigo fica até você validar na prática e decidir removê-lo.
**Limitação:** o desenho (sprites no canvas) e o arrastar do pincel foram exercitados em jsdom (sem navegador real); a lógica por trás tem teste.
