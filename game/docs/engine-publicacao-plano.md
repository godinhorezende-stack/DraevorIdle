# Plano: Engine local → validação → aprovação → Git → merge manual → deploy manual

Status: **plano para aprovação** (nenhuma parte além do Hot Reload foi implementada). Regra mestra mantida: nada vai ao Git sem aprovação explícita, o merge é manual, o deploy é manual.

## 1. Diagnóstico do estado atual
- **A Engine roda dentro do mesmo processo do jogo** (`backend/index.mjs`, `/editor/conteudo`). Hoje o "ambiente local" é um worktree na própria VPS (servidor em `PORTA=8081` visto por túnel SSH). Isso contradiz o isolamento pedido: dev e produção estão na mesma máquina e na mesma conta Unix.
- **Onde salva**: arquivos do repositório (`game/gamedata/overrides/*`, `gamedata/atos/*`, `campanha.json`, `data/mapas`), com versões append-only em `_versoes/` e controle de revisão (409). Auditoria em `database/dados/engine-auditoria.jsonl`.
- **Banco/serviços**: SQLite local por padrão; Postgres só com `DATABASE_URL` (produção, container). Redis: `database/redis.mjs`. Local não precisa de escrita em produção — e agora o Hot Reload se recusa a ligar com banco remoto.
- **Deploy atual**: `/srv/draevor/bin/deploy.sh` — exige estar em `main`, `git merge --ff-only origin/main`, pré-compressão, **backup do banco**, `docker compose up -d --build`, `nginx -t && reload`, espera `/saude`. Jogo na 8080 (container), nginx em 80/443. **Não há** rollback de código, histórico de publicações, nem trava contra deploy concorrente.
- **Auth da Engine**: login por conta do jogo + lista de admins + trava de rede; produção com gravação desligada.

## 2. Arquitetura proposta (reaproveitando o que existe)
1. **Ambiente local = a máquina do dono** (ou um segundo checkout fora de `/srv/draevor`), com a Engine em modo desenvolvimento. Nunca na conta/pasta de produção. *(Decisão 1.)*
2. **Hot Reload**: implementado (ver `docs/hot-reload.md`).
3. **Validação centralizada** (`systems/validacao.mjs`): um registro de verificações (integridade de JSON, campos obrigatórios, IDs duplicados, referências, compatibilidade entre módulos) reaproveitando `validarMonstro/validarItem/validarMeta/validarAto/validarConfig`, mais a suíte `npm test`. Resultado `aprovado | aviso | bloqueante`; painel na Engine; executar de novo a qualquer momento.
4. **Painel de alterações**: `git status/diff` restrito a `game/gamedata/**` (e `game/frontend/client/**` quando for o caso), agrupado por módulo, com original × atual (JSON) e histórico (auditoria).
5. **Aprovar e gerar versão**: congela o conjunto exato de arquivos (lista + hash de cada um) num manifesto `versoes/<id>.json`; qualquer edição posterior fora do manifesto não entra. Exige validação sem bloqueantes.
6. **Git**: ao aprovar → id de versão (`v2026.10.03-1`), changelog gerado do manifesto, branch `versao/<id>`, commit só dos arquivos do manifesto, `git push` dessa branch. Falhou o push → a versão fica salva localmente (manifesto + commit local) para nova tentativa. **Sem merge automático.**
7. **Pós-merge**: a Engine consulta `git fetch` + `merge-base --is-ancestor` para saber se o commit da versão está em `origin/main` e mostra "apta para publicação".
8. **Deploy**: botão **Deploy para produção** que NÃO executa comandos arbitrários: chama um executor **fixo** na VPS (script `/srv/draevor/bin/publicar.sh <commit>` via SSH com chave dedicada restrita por `command=` no `authorized_keys`, só aceita um commit SHA que seja ancestral de `origin/main`). O script faz: trava (flock) contra concorrência, `git fetch`, checa ancestralidade, artefato imutável (`/srv/draevor/releases/<sha>`), backup do banco (já existe), `docker compose up -d --build`, migrações (hoje não há sistema de migrações separado: precisa ser definido), `nginx -t/reload`, `/saude`, registro em `releases.log`. Falha → rollback automático para o release anterior.
9. **Rollback**: `/srv/draevor/bin/rollback.sh` (também fixo, com confirmação na UI), trocando para o release anterior; dados de jogadores nunca são tocados (o banco só é restaurado por decisão manual, como hoje).
10. **Painel de deploy**: versão/commit em produção, disponível para deploy, histórico, logs (somente leitura do `releases.log`), saúde (`/saude`), botões com confirmação.
11. **Segurança**: a UI nunca recebe shell; segredos fora do repositório (chave SSH só na máquina do dono, `.env` fora do git); toda aprovação/publicação/rollback vai para a auditoria; autenticação da Engine mantida.

## 3. Etapas (cada uma com testes)
- **E1 (feita)**: Hot Reload.
- **E2 (feita)**: validação centralizada + painel (aprovado/aviso/bloqueante) — ver `docs/validacao.md`.
- **E3 (feita)**: painel de alterações (diff/histórico) + Aprovar e gerar versão (manifesto congelado).
- **E4 (feita)**: Git (branch, commit, push, retry) — testado contra um repositório remoto temporário.
- **E5 (feita)**: status pós-merge (ancestralidade com `origin/main`).
- **E6 (scripts e testes locais prontos; NADA instalado na VPS — ver `docs/publicacao.md`)**: executor de deploy na VPS (`publicar.sh`/`rollback.sh`, releases imutáveis, trava, saúde) — **mexe na VPS: só com sua autorização**, primeiro em homologação.
- **E7**: painel de deploy/rollback na Engine + auditoria.
- **E8**: ensaio completo em homologação (inclui rollback), antes de qualquer uso em produção.

## 4. Decisões que preciso de você
1. **Onde roda a Engine "local"?** No seu PC (Windows) ou continua no worktree da VPS? Para o isolamento pedido, o ideal é o seu PC (com clone próprio e Node + banco SQLite local).
2. **Como a Engine chega à VPS para o deploy?** Proposta: SSH com chave dedicada, restrita a um único comando fixo. Alternativa: o botão só mostra o comando para você rodar (mais seguro, menos automático).
3. **Homologação**: existe/pode existir uma segunda stack (outra porta/compose) para provar deploy e rollback sem tocar na produção? Sem ela não dá para "comprovar o rollback em homologação" com honestidade.
4. **Migrações de banco**: hoje não há mecanismo separado; posso criar um (arquivos numerados, transacionais, com backup) ou manter "sem migrações" por enquanto.
5. **Branch principal e proteção**: confirmar `main` e se há proteção/regra de PR no GitHub (o push da branch de versão precisa de credencial própria).
