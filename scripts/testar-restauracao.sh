#!/usr/bin/env bash
# Testa o ÚLTIMO backup restaurando-o num banco TEMPORÁRIO e isolado (`restauracao_teste_*`) dentro do container postgres
# — nunca no banco de produção. Confere que os personagens (e os que estão em caçada offline) vieram, e apaga o temporário.
# Uso: scripts/testar-restauracao.sh [arquivo.sql.gz]   (sem argumento: o mais recente de backups/)
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$RAIZ/game/docker"
[ -f "$DOCKER_DIR/.env" ] || { echo "Faltou game/docker/.env" >&2; exit 1; }
set -a
# shellcheck source=/dev/null
source "$DOCKER_DIR/.env"
set +a
cd "$DOCKER_DIR"
ARQUIVO="${1:-$(ls -1t "$RAIZ"/backups/jogo-*.sql.gz | head -n1)}"
[ -f "$ARQUIVO" ] || { echo "Nenhum backup encontrado." >&2; exit 1; }
USUARIO="${POSTGRES_USER:-jogo}"
TEMP="restauracao_teste_$(date +%s)"
psql() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$USUARIO" "$@"; }
trap 'psql -d postgres -c "DROP DATABASE IF EXISTS $TEMP" >/dev/null 2>&1 || true' EXIT
echo "==> restaurando $ARQUIVO em $TEMP (isolado)"
gzip -t "$ARQUIVO"
psql -d postgres -c "CREATE DATABASE $TEMP" >/dev/null
gunzip -c "$ARQUIVO" | psql -d "$TEMP" -q >/dev/null
PERSONAGENS="$(psql -d "$TEMP" -tA -c 'SELECT COUNT(*) FROM personagens')"
OFFLINE="$(psql -d "$TEMP" -tA -c 'SELECT COUNT(*) FROM personagens WHERE caca_offline_desde IS NOT NULL')"
[ "$PERSONAGENS" -gt 0 ] || { echo "ERRO: restaurou sem personagens." >&2; exit 1; }
echo "==> OK: $PERSONAGENS personagens ($OFFLINE em caçada offline). Banco temporário removido."
