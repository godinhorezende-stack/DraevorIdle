#!/usr/bin/env bash
# `pg_dump` diário (cron/systemd timer no VPS chama isto) com rotação — ver
# docs/deploy.md, "Backup". Roda pg_dump DENTRO do container `postgres` do
# compose (mesma versão do servidor, sem precisar de client Postgres no
# host) e grava comprimido em backups/ (fora do container, sobrevive a um
# `docker compose down`).
#
# Uso:
#   scripts/backup-postgres.sh              # backup + rotação (30 dias)
#   RETENCAO_DIAS=7 scripts/backup-postgres.sh
#
# Restaurar (teste isto de verdade antes de precisar de verdade, de dentro
# de game/docker/):
#   gunzip -c ../../backups/jogo-AAAAMMDD-HHMMSS.sql.gz | \
#     docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$RAIZ/game/docker"

if [ ! -f "$DOCKER_DIR/.env" ]; then
  echo "Faltou game/docker/.env — sem POSTGRES_USER/POSTGRES_DB não dá pra saber o que copiar." >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$DOCKER_DIR/.env"
set +a
cd "$DOCKER_DIR"

RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
PASTA_BACKUPS="$RAIZ/backups"
mkdir -p "$PASTA_BACKUPS"

CARIMBO="$(date +%Y%m%d-%H%M%S)"
ARQUIVO="$PASTA_BACKUPS/jogo-$CARIMBO.sql.gz"

echo "==> pg_dump ($POSTGRES_DB) -> $ARQUIVO"
TEMPORARIO="$ARQUIVO.parcial"
trap 'rm -f "$TEMPORARIO"' EXIT
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-jogo}" --format=plain "${POSTGRES_DB:-jogo}" \
  | gzip > "$TEMPORARIO"

# Valida ANTES de aceitar: gzip íntegro, e o dump traz a tabela dos personagens (onde mora o estado do offline farm).
# Um backup que não passa aqui é descartado e o ÚLTIMO BACKUP VÁLIDO NUNCA É APAGADO.
if ! gzip -t "$TEMPORARIO"; then
  echo "ERRO: o backup novo está corrompido — descartado; os anteriores ficam intactos." >&2
  exit 1
fi
if ! gunzip -c "$TEMPORARIO" | grep -q 'CREATE TABLE public.personagens'; then
  echo "ERRO: o backup novo não tem a tabela personagens — descartado; os anteriores ficam intactos." >&2
  exit 1
fi
mv "$TEMPORARIO" "$ARQUIVO"
trap - EXIT

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "==> OK (validado) — $TAMANHO"

# Rotação: só depois do novo validado, e sempre sobram os 3 mais recentes, mesmo que velhos.
echo "==> apagando backups com mais de ${RETENCAO_DIAS} dias (mantendo ao menos os 3 mais recentes)"
ls -1t "$PASTA_BACKUPS"/jogo-*.sql.gz | tail -n +4 | while read -r antigo; do
  if [ -n "$(find "$antigo" -mtime "+${RETENCAO_DIAS}" -print)" ]; then
    echo "$antigo"
    rm -f "$antigo"
  fi
done
