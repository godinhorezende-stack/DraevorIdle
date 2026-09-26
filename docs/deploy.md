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
scripts/deploy.sh                    # staging: puxa a branch e sobe de novo (rebuild só do que mudou)
AMBIENTE=producao scripts/deploy.sh  # produção: usa também docker-compose.prod.yml
```

O script: `git fetch` + `git checkout` + `git merge --ff-only` (nunca reescreve
histórico nem descarta mudança local — se o merge não for fast-forward, ele
para e avisa em vez de forçar), depois `docker compose up -d --build` e só
termina depois de confirmar `/saude` respondendo. Se `/saude` não responder em
~1 minuto, ele sai com erro (`docker compose logs game` para investigar) —
não fica um deploy "pela metade" sem avisar.

`game/frontend/`, `game/gamedata/` e `api-mapeada/` são montados como volume
a partir do checkout (não entram na imagem Docker) — um `git pull` já
atualiza os três sem rebuild; só o código (`game/{backend,engine,database,
websocket,systems,admin}/`) pede rebuild da imagem (o que `deploy.sh` sempre
faz, com `--build`, mesmo que às vezes seja um no-op pelo cache do Docker).

## 6. Staging e produção no mesmo host

`docker-compose.yml` é a base dos dois; `docker-compose.prod.yml` só some em
cima quando `AMBIENTE=producao` (limites de memória, rotação de log, o
serviço `certbot`). Rodar staging E produção ao mesmo tempo no MESMO host
não funciona só trocando o arquivo — as duas tentariam ouvir a mesma porta 80.
Duas opções (nenhuma testada neste repo — decida com o time antes de contar
com isto):

- Dois checkouts do repo, dois `.env` (`POSTGRES_DB` diferente em cada),
  `docker compose -p staging ...` / `docker compose -p producao ...` (nomes
  de projeto diferentes isolam volumes/redes) e portas de nginx diferentes
  num deles (staging, por exemplo, só em `127.0.0.1:8080`/`8443`, sem
  domínio público).
- Dois VPS separados — staging não compete por porta/CPU com produção.

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

## 9. O que este repositório NÃO cobre ainda

- Redis: existe no compose (`docker compose --profile scale up -d redis`) mas
  nenhum código do jogo fala com ele — só entra quando o jogo virar mais de
  um processo (ver `docs/auditoria-performance.md`, Fase 6/trilha de infra).
- Métricas de verdade em `/saude` (duração do tique, atraso do event loop,
  heap) — hoje é só `{ok, online}`.
- Firewall (`ufw`/`iptables`)/fail2ban no próprio VPS — fora do escopo do
  Docker Compose; configurar direto no host (só as portas 22/80/443 abertas
  é o mínimo razoável).
- Qualquer teste contra um VPS, domínio ou DNS de verdade.
