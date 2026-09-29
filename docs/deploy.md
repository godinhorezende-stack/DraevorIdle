# Deploy — VPS com Docker

Guia de ponta a ponta para colocar o jogo no ar num VPS: Docker Compose
(`game/docker/docker-compose.yml`), migração do banco
(`game/database/migrar-sqlite-para-postgres.mjs`) e os scripts de `scripts/`.
Tudo aqui foi testado neste repositório contra um Postgres real e um nginx
real, dentro de containers — nenhuma parte foi testada contra um VPS/domínio
de verdade ainda (ver `docs/auditoria-performance.md`, "Trilha de
infraestrutura").

Os comandos `docker compose` abaixo assumem que você está dentro de
`game/docker/` (é onde moram os `docker-compose*.yml` e o `.env`) — os
scripts de `scripts/` (deploy, backup) já fazem isso sozinhos.

## 1. O que o VPS precisa ter

- Docker + Docker Compose plugin (`docker compose version` ≥ v2).
- Uma porta 80/443 livre (nginx) — nenhum outro serviço ouvindo nelas.
- Git, para o `git pull` do deploy.
- Se for usar domínio/TLS: o domínio já apontando (registro A/AAAA) para o IP
  do VPS — o certbot confere isso na hora de emitir o certificado.

## 2. Primeiro deploy

```bash
git clone <url-do-repo> draevoridle
cd draevoridle/game/docker
cp .env.example .env
# editar .env: POSTGRES_PASSWORD (obrigatório), DOMINIO/EMAIL_CERTBOT se for usar TLS
docker compose up -d --build
cd ../.. && node tools/precomprimir.mjs   # opcional: .br/.gz dos estáticos (o deploy.sh faz isto sempre)
```

Isso sobe `postgres` (schema criado sozinho, pelos módulos do jogo — nada de
migration manual num banco novo), `game` (espera o Postgres ficar saudável
antes de iniciar) e `nginx` (HTTP puro na porta 80; TLS vem no passo 4). Confira:

```bash
curl http://SEU_IP/saude          # {"ok":true,"online":0}
docker compose ps                 # os três "Up"/"healthy"
docker compose logs -f game        # acompanhar o boot (aquecimento das grades de hunt, etc.)
```

Se já existir um `jogo.db` (SQLite) de antes com jogadores de verdade, migre
ele para dentro do Postgres do compose ANTES de abrir para o público — ver
seção 3.

## 3. Trazendo dados de um SQLite existente

O `docker-compose.yml` cria o schema do Postgres vazio na primeira subida
(o mesmo código que cria as tabelas em modo SQLite, só que apontando pro
Postgres — ver `game/database/banco.mjs` e cada `game/systems/*.mjs`). Para
copiar contas/personagens/guildas/etc. de um `jogo.db` existente (rode a
partir da raiz do repo, não de dentro de `game/docker/`):

```bash
# Com a stack já no ar (o Postgres precisa estar de pé e acessível):
DATABASE_URL="postgres://jogo:SENHA@localhost:5432/jogo" \
  node game/database/migrar-sqlite-para-postgres.mjs /caminho/para/jogo.db
```

Rodar de novo não duplica linha (`ON CONFLICT DO NOTHING`) — mas não é um
merge de verdade: para uma migração real, rode contra um Postgres recém-criado
(vazio), não em cima de um banco que já tem jogadores criados depois do deploy.

## 4. Ligando TLS (domínio de verdade)

Sem isto o jogo já funciona em HTTP puro (o `docker-compose.yml` já serve
assim por padrão) — WebSocket e tudo mais funcionam sem TLS, só sem cadeado.
Para ligar HTTPS com Let's Encrypt:

```bash
# 1. Emitir o certificado (o nginx já está respondendo em :80, incluindo
#    /.well-known/acme-challenge/ — é o que o certbot usa para provar dono do domínio):
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMINIO" --email "$EMAIL_CERTBOT" --agree-tos --no-eff-email

# 2. Editar game/docker/nginx/conf.d/default.conf:
#    - trocar SEU_DOMINIO pelo domínio de verdade (duas linhas de ssl_certificate*)
#    - descomentar o bloco inteiro do server{} de :443
#    - no server{} de :80, trocar `include game.conf.inc` por
#      `return 301 https://$host$request_uri;` (força HTTPS)

docker compose restart nginx
```

Renovação (o certificado dura 90 dias): agende no HOST, não dentro do
compose — um container `certbot` ficando no ar 90 dias só de plantão não
compensa. No `crontab -e` do VPS:

```cron
0 3 * * 1 cd /caminho/para/draevoridle/game/docker && docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose restart nginx
```

## 5. Deploy de uma atualização (via Git)

```bash
scripts/deploy.sh                    # staging (isolado, 127.0.0.1:8081): puxa a branch e sobe de novo
AMBIENTE=producao scripts/deploy.sh  # produção: usa também docker-compose.prod.yml
```

O script: `git fetch` + `git checkout` + `git merge --ff-only` (nunca reescreve
histórico nem descarta mudança local — se o merge não for fast-forward, ele
para e avisa em vez de forçar), `node tools/precomprimir.mjs` + `--verificar`
(gera os `.br`/`.gz` dos estáticos, que NÃO vão pro git, e confere cada um
contra a fonte; usa o node do host, ou `node:22-slim` via Docker se não houver
node >= 18 — se falhar, o deploy **aborta antes de mexer nos containers**),
depois `docker compose up -d --build` e só
termina depois de confirmar `/saude` respondendo. Se `/saude` não responder em
~1 minuto, ele sai com erro (`docker compose logs game` para investigar) —
não fica um deploy "pela metade" sem avisar.

`game/frontend/`, `game/gamedata/` e `api-mapeada/` são montados como volume
a partir do checkout (não entram na imagem Docker) — um `git pull` já
atualiza os três sem rebuild; só o código (`game/{backend,engine,database,
websocket,systems,admin}/`) pede rebuild da imagem (o que `deploy.sh` sempre
faz, com `--build`, mesmo que às vezes seja um no-op pelo cache do Docker).

## 6. Staging e produção no mesmo host

`docker-compose.yml` é a base; `docker-compose.prod.yml` (produção) e
`docker-compose.staging.yml` (staging) só somam por cima. Staging roda como
projeto Compose separado (`-p staging`): containers, rede e **volumes
próprios — o banco de staging é outro, nunca o da produção** — e o nginx só
escuta em `127.0.0.1:8081` (sem 443, sem domínio), então convive com a
produção nas portas 80/443. Testado: os dois de pé juntos, `/saude` ok nos dois.

```bash
cd caminho/do/checkout          # pode ser uma worktree ou outro clone
cp game/docker/.env.example game/docker/.env   # POSTGRES_PASSWORD de staging
scripts/deploy.sh                # AMBIENTE=staging é o padrão
```

Ver de fora do VPS (túnel SSH): `ssh -L 8081:127.0.0.1:8081 usuario@vps` e abrir
`http://localhost:8081/jogar`. Trocar a porta: `PORTA_STAGING=8082 scripts/deploy.sh`.
Derrubar e apagar o banco de staging: `docker compose -p staging -f
docker-compose.yml -f docker-compose.staging.yml down -v` (o `-p staging`
garante que a produção não é tocada).

Fluxo: branch/worktree -> `scripts/deploy.sh` (staging) -> testar -> merge na
`main` -> `AMBIENTE=producao scripts/deploy.sh` no checkout de produção.

## 7. Backup

```bash
scripts/backup-postgres.sh                 # backup + apaga o que passou de 30 dias
RETENCAO_DIAS=7 scripts/backup-postgres.sh # trocar a janela de retenção
```

Agendar diário no VPS (`crontab -e`):

```cron
0 4 * * * cd /caminho/para/draevoridle && scripts/backup-postgres.sh >> /var/log/draevoridle-backup.log 2>&1
```

Os arquivos ficam em `backups/` (na raiz do repo, fora do git —
`.gitignore`), comprimidos (`pg_dump` + gzip). **Restauração testada** (ver
`scripts/backup-postgres.sh`, comentário do topo; rode de dentro de
`game/docker/`):

```bash
gunzip -c ../../backups/jogo-AAAAMMDD-HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Copie `backups/` para fora do VPS de vez em quando (outro disco, outra
máquina, um bucket) — um backup que só existe no mesmo disco do banco não
sobrevive ao disco morrer.

## 8. Logs e reinício de serviços

```bash
docker compose logs -f game            # logs do jogo (ao vivo)
docker compose logs --tail 200 nginx
docker compose logs --tail 200 postgres

docker compose restart game            # só o jogo (grava todo mundo antes de sair, ver Dockerfile)
docker compose restart nginx           # depois de mexer em game/docker/nginx/conf.d/
docker compose down && docker compose up -d --build   # derruba tudo e sobe de novo
```

## 9a. Redis (opcional — cache entre processos)

```bash
docker compose --profile scale up -d        # sobe também o redis
```

Sem isto (perfil desligado, padrão), o jogo roda exatamente como sempre —
`REDIS_URL` vazia vira cache só em memória, por processo (ver
`game/database/redis.mjs`). Com o perfil ligado E `REDIS_URL` no `.env`
(`REDIS_URL=redis://redis:6379`, já no `.env.example`), o jogo usa o Redis
para cachear leituras caras entre processos (melhorias da conta, guilda de
cada nome — ver `docs/auditoria-performance.md`, seção Redis). Ranking/
presença/pub-sub entre processos **continuam não usando Redis** — só
passam a fazer sentido de verdade a partir de 2+ processos de jogo.

## 9b. Atenção ao reiniciar só o `game` (nginx guarda o IP antigo)

O `upstream game { server game:8080; }` do nginx resolve o nome uma vez, na
subida do nginx — reiniciar só o container do jogo (`docker compose restart
game`, ou uma recriação por rebuild) pode deixar o nginx apontando para o IP
antigo até ELE TAMBÉM ser reiniciado (`docker compose restart nginx`),
derrubando o site inteiro com 502 até alguém perceber. Descoberto rodando a
stack de verdade nesta máquina (não afeta quem só sobe tudo junto do zero).
`scripts/deploy.sh` sobe TODOS os serviços juntos (`up -d --build`), o que
evita isto na maioria dos casos — mas um `docker compose restart game`
manual, isolado, é a armadilha. Correção de verdade (não feita ainda):
trocar o `upstream` estático por `resolver 127.0.0.11 valid=10s;` +
`proxy_pass` com variável, para o nginx re-resolver o IP sozinho.

## 9c. `limit_req` do nginx baixo demais para o carregamento frio do cliente

O cliente não tem bundler (ES modules soltos, ~40+ arquivos `.mjs`/`.json`/
imagens só na tela de personagens/login) — um carregamento frio real dispara
todos esses requests em paralelo, quase no mesmo milissegundo. O
`game.conf.inc` tinha `limit_req zone=http_por_ip burst=40 nodelay;` na
`location /`: qualquer request além do 40º de um mesmo IP num carregamento
frio levava 503 IMEDIATO (por causa do `nodelay`) — sempre nos MESMOS
arquivos (a ordem de import de `main.mjs` é determinística), o que parecia
"ícone quebrado aleatório" no mobile mas também acontecia (com menos
frequência de ser notado) no desktop. Reproduzido e confirmado via
`read_network_requests` do navegador embutido: `gamedata/missile-
sprites.json`, `client/src/traduz.mjs` e `packages/shared/src/formulas.mjs`
voltando 503 toda vez. Corrigido subindo o burst para `burst=200` (mantendo
`rate=20r/s` e `nodelay` — o objetivo é servir o pico de UM carregamento de
página na hora, não afrouxar o limite de abuso sustentado). Confirmado com
dois carregamentos frios completos (desktop e mobile 375×812), zero 503 em
~74–106 requests cada.

## 9d. O que este repositório NÃO cobre ainda

- Métricas de verdade em `/saude` (duração do tique, atraso do event loop,
  heap) — hoje é só `{ok, online}`.
- Firewall (`ufw`/`iptables`)/fail2ban no próprio VPS — fora do escopo do
  Docker Compose; configurar direto no host (só as portas 22/80/443 abertas
  é o mínimo razoável).
- Qualquer teste contra um VPS, domínio ou DNS de verdade.
