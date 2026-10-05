# Publicação para a VPS (etapa 6 — desenho e scripts; NADA foi instalado na VPS)

Scripts em `scripts/publicacao/` (testados em `testes/publicacao.test.mjs` contra repositórios e pastas temporários, com `subir.sh` e a saúde substituídos por stubs — nada toca em `/srv/draevor`, Docker ou na VPS):

| Script | O que faz |
|---|---|
| `publicar.sh <sha40>` | Trava exclusiva (código 75 se houver outra publicação) → `git fetch origin main` → exige que o commit **seja exatamente a ponta de `origin/main`** (recusa commit de branch, não integrado, ou que não é mais a ponta) → recusa se já é o que está no ar → **artefato imutável** (`git archive` somente-leitura + `sha256` de cada arquivo em `releases/artefatos/<sha>`) → `git merge --ff-only` (preserva as modificações locais da VPS; conflito aborta **antes** de tocar nos containers) → `subir.sh` → verificação de saúde → grava `atual`/`anterior`. Qualquer falha depois de mexer no checkout dispara **rollback automático** para o commit que estava no ar. |
| `rollback.sh [sha40]` | Sem argumento volta ao `anterior` registrado. O alvo precisa estar na história de `origin/main`. Usa `git reset --keep` (não perde modificação local; aborta se fosse perder). Depois sobe tudo e confere a saúde. **Não restaura o banco** (dados de jogadores nunca são tocados). |
| `subir.sh` | O "rabo" do `/srv/draevor/bin/deploy.sh` atual: pré-compressão, **backup do banco** (falhou → aborta com os containers intocados), `docker compose up -d --build`, `nginx -t && reload`, espera `/saude`. Mesmo compose e mesmos volumes (`/srv/draevor/data`, fora do checkout), porta 8080 e roteamento do nginx **inalterados**. |
| `entrada.sh` | O **único** comando que a chave SSH da Engine pode rodar (`command=` no `authorized_keys`). Aceita só `publicar <sha40>`, `rollback`, `rollback <sha40>` e `status`; todo o resto sai com 126 (inclusive injeção). |
| `authorized_keys.exemplo` | Modelo da linha `command="…/entrada.sh",restrict ssh-ed25519 <chave pública>`. Não contém chave real. |

Cada evento vira uma linha JSON em `releases/releases.log` (quando, ação, sha, resultado, detalhe, por). Migrações de banco: **não existem hoje** como mecanismo separado — o backup antes de subir é a rede de segurança; um sistema de migrações é uma decisão futura.

## O que está na VPS hoje (lido, não alterado)
- `/srv/draevor/app` (checkout na `main`, com uma modificação local em `game/docker/nginx/conf.d/default.conf` e `certbot/` não versionado), `/srv/draevor/bin/{deploy,backup,renovar-tls}.sh`, `/srv/draevor/config/docker-compose.local.yml` (dados em `/srv/draevor/data`), `origin = git@github.com:godinhorezende-stack/DraevorIdle.git`.
- Por isso `merge --ff-only` e `reset --keep`: ambos respeitam essa modificação local.

## Para instalar (cada passo exige a sua autorização explícita; nada disto foi feito)
1. Copiar `scripts/publicacao/` para `/srv/draevor/bin/publicacao/` (dono do operador, sem escrita para o usuário de publicação) e criar `/srv/draevor/releases/`.
2. Criar um **usuário só para publicação** (sem sudo, sem shell interativo) com permissão apenas de executar esses scripts (grupo docker é necessário para `docker compose`: é a parte sensível do desenho — discutir) e gerar a chave **na máquina do dono**; instalar só a chave pública com a linha de `authorized_keys.exemplo`.
3. **Homologação antes de produção**: uma stack paralela (outro `name:` de compose, outra porta, banco vazio, outro diretório de dados) para provar `publicar.sh` e `rollback.sh` de ponta a ponta sem tocar na produção. Só depois a produção.
4. A Engine (etapa 7) chamará `ssh publicacao@vps "publicar <sha>"` e mostrará o painel de deploy (versão atual, histórico, logs do `releases.log`, saúde, botões com confirmação).

## Riscos conhecidos
- O usuário de publicação precisa falar com o Docker (equivale a poder alto na máquina): por isso o `command=` fixo, `restrict`, validação rígida do sha e a regra "só a ponta da principal".
- `reset --keep` recusa o rollback se uma modificação local seria perdida: nesse caso a decisão é do operador.
- A saúde padrão (`/saude` com `"ok":true`) prova que o jogo responde, não que a mudança de conteúdo está correta; a verificação do commit é pelo `git rev-parse HEAD` do checkout.
