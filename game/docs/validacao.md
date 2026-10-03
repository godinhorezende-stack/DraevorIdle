# Validação centralizada (Engine) — etapa 2 do plano de publicação

Tela **Validação e versão** (menu Gerenciamento): roda as verificações do conteúdo editável e os testes pertinentes e diz se a versão pode ser aprovada.

## Classificação
- **Aprovado** — nada a apontar. **Aviso** — vale olhar, não impede. **Erro bloqueante** — impede aprovar uma versão.
- Pode aprovar = nenhuma verificação com erro bloqueante **e** testes pertinentes aprovados, os dois para o estado ATUAL (mudou o conteúdo ou o repositório depois → "desatualizado", rode de novo).

## Verificações (rodam num processo à parte que carrega o jogo do disco, ~11 s)
| Verificação | O que confere |
|---|---|
| Integridade (JSON) | todos os arquivos editáveis (overrides, atos, campanha, encontros, hunts, outfits…) parseiam |
| Carga do jogo | o que o servidor **ignoraria no boot** (entrada de override inválida, ato que não entra) |
| Monstros | `validarMonstro` em cada override: campos, loot (itens existem), ataques, sprite (look existe), variações (chave nova, base existe) |
| Itens | `validarItem`: campos, preços, raridade, item existe |
| Sprites | imagem existe, hash bate, PNG decodifica, quadros × cadastro × tamanho, direções, máscara, órfãs |
| Acts | `Atos.validar` (referências, hunts/bosses/ordens duplicados); erro em rascunho vira aviso, em beta/publicado é bloqueante |
| Campanha | hunts e bosses existem, sem hunt repetida, níveis válidos e crescentes |
| Encontros/bosses/mapa | a auditoria dos editores de fases e bosses únicos |
| Referências | itens referenciados que não existem no catálogo (preexistentes do Canary = aviso) |

Os **testes pertinentes** são escolhidos pelos módulos que mudaram (`TESTES_POR_MODULO`); código do jogo ou dado sem teste dedicado pede a suíte completa. O executor roda só `node --test <arquivos de teste da pasta de testes>` (comando fixo) e só no ambiente local.

## Segurança
Somente leitura; nenhuma rota recebe comando; os testes recusam rodar fora do ambiente local; uma execução por vez. `admin/git-local.mjs` só consulta o Git (status/branch/HEAD) — não existe comando que escreva no repositório.

## Módulos
`admin/validacao.mjs` (orquestra), `admin/validacao-verificacoes.mjs`, `admin/validacao-runner.mjs`, `admin/git-local.mjs`, `admin/conteudo-http.mjs` (`GET validacao`, `POST validacao/executar`), `frontend/client/src/editor-validacao.mjs`.

## Próximas etapas
Aprovar e gerar versão (manifesto congelado), Git (branch/commit/push), status pós-merge, executor de deploy/rollback na VPS (só em homologação e com sua autorização), painel de deploy. Ver `docs/engine-publicacao-plano.md`.

## Etapa 3 — painel de alterações e "Aprovar e gerar versão"
- **Alterações**: `git status` (só leitura) filtrado para o que pode ser versionado (`Git.caminhoPermitido`: dentro de `game/`, sem `..`, sem `.env`, banco, `database/`, `_versoes`, auditoria, `.git`). Cada arquivo tem módulo, tamanho, hash e **original (HEAD) × atual**: JSON → tabela campo/original/atual; imagem → tamanhos e hashes; texto → `git diff`.
- **Aprovar**: exige validações sem bloqueante e testes aprovados para o estado atual, um título e arquivos marcados (o que não for marcado fica de fora). Arquivos que só fazem sentido juntos (cadastro de sprites + imagens) precisam ir juntos.
- **Congelamento**: cria `game/database/dados/versoes/<id>/` (fora do Git) com `manifesto.json` (hash sha256 de cada arquivo, módulo, base `branch@head`, validação e testes), `CHANGELOG.md` e uma **cópia somente-leitura** de cada arquivo. Editar depois não altera a versão; a Engine mostra "editado depois da aprovação" e detecta adulteração da cópia. Se o conteúdo mudar *durante* a aprovação, nada é gerado.
- **Descartar**: `aprovada → descartada` (o registro fica). Id: `vAAAA.MM.DD-N`. Tudo vai para a auditoria (`versao-aprovada`, `versao-descartada`).
- A etapa de Git (próxima) montará o commit **a partir das cópias congeladas** (`Versoes.conteudoCongelado`), nunca do disco atual.
- Rotas: `GET alteracoes`, `GET alteracoes/diff?caminho=`, `GET versoes[/id]`, `POST versoes/aprovar|descartar` (gravação: recusado em produção).

## Etapa 4 — envio ao Git
- **Botão "Criar branch e enviar ao Git"** (versão `aprovada`): cria a branch `versao/<id>` com UM commit sobre o commit base da aprovação, montado com o "encanamento" do Git (`read-tree` num índice temporário → `hash-object` das **cópias congeladas** → `write-tree` → `commit-tree` → `update-ref` que só cria) e envia **só essa ref** ao remoto `origin` (`push origin refs/heads/versao/<id>:refs/heads/versao/<id>`).
- **Não toca no seu repositório**: HEAD, branch atual, índice (inclusive o que você já deixou preparado) e arquivos ficam idênticos; alterações suas fora da versão nunca entram. Sem merge, sem `--force`, sem `checkout/reset/pull/fetch`, sem deploy, sem prompt de senha (`GIT_TERMINAL_PROMPT=0`).
- **Autor** do commit = o `user.name/user.email` do repositório (sem eles, recusa). Mensagem = título + changelog.
- **Falha no envio** (rede, credencial, remoto errado): a versão vira `commit-local` (commit e cópias preservados, erro visível, URL sem credenciais) e **"Tentar enviar de novo"** reenvia o MESMO commit. Recusa: versão descartada/já enviada, cópia adulterada, branch já existente, commit base ausente, diferença nula.
- Resultado: status `enviada`, branch, commit, remoto e, para GitHub, o **link de comparação** (`compare/main...versao/<id>`) para abrir o PR. O merge é manual no repositório.
- Módulos: `admin/git-envio.mjs`, `admin/versoes.mjs` (`atualizarStatus`), rota `POST versoes/enviar` (assíncrona: o servidor do jogo não trava no push).

## Etapa 5 — status pós-merge
- **Botão "Consultar status no remoto"** (versões `enviada`/`integrada`): faz `git fetch origin main` (só atualiza a referência `origin/main`) e compara. Nada de merge, checkout, reset, pull ou push; seu diretório, índice e branch não são tocados.
- **Integrada** quando: (a) o commit da versão é **ancestral** de `origin/main` (merge commit ou fast-forward; o commit integrador é o primeiro merge no caminho, ou o próprio commit), ou (b) **por conteúdo** (squash/rebase, que reescrevem o commit): todos os arquivos da versão têm em `origin/main` exatamente o conteúdo congelado e os apagados não existem. Registra no manifesto (`integracao`: commit, modo, ponta da principal, quando) e na auditoria (`versao-integrada`); o status vira `integrada`.
- **Apta para publicação** = integrada na principal. Mostra a ponta da principal que seria publicada (a publicação leva TODA a principal, não só esta versão) e avisa se arquivos da versão foram alterados depois do merge (outra versão mexeu: continua apta, com aviso).
- **Pendente**: ainda não está na principal → diz o que fazer; o status da versão não muda. Se a versão sai da principal depois (revert), a consulta informa e a marca como não apta (o histórico de que já foi integrada fica).
- Falha ao consultar o remoto: erro claro, status anterior mantido; `buscar: false` usa o que já foi baixado. Credenciais nunca aparecem.
- Módulo `admin/git-integracao.mjs`; rota `POST versoes/consultar` ("grava": bloqueada em produção).
