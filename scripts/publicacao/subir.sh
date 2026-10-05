#!/usr/bin/env bash
# Constrói e sobe os serviços a partir do checkout JÁ posicionado no commit certo (publicar.sh/rollback.sh cuidam do git). É o "rabo" do /srv/draevor/bin/deploy.sh
# atual: pré-compressão, BACKUP DO BANCO (se falhar, aborta com os containers intocados), `docker compose up -d --build`, `nginx -t && reload`, espera /saude.
# Não mexe em dados dos jogadores (volumes em /srv/draevor/data, fora do checkout). Sem migrações: não há mecanismo separado de migração de banco hoje.
#   subir.sh            sobe tudo
#   subir.sh --so-saude só confere a saúde
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
DOCKER_DIR="$APP/game/docker"
ARQUIVOS_COMPOSE=(-f "$DOCKER_DIR/docker-compose.yml" -f "$DOCKER_DIR/docker-compose.prod.yml" -f "$CONFIG/docker-compose.local.yml")
compose() { docker compose --env-file "$CONFIG/.env" "${ARQUIVOS_COMPOSE[@]}" "$@"; }
DOMINIO="$(grep -m1 '^DOMINIO=' "$CONFIG/.env" 2>/dev/null | cut -d= -f2- || true)"; DOMINIO="${DOMINIO:-mmoidledraevor.io}"
saude() { curl -fsS --max-time 5 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/saude"; }

if [ "${1:-}" = "--so-saude" ]; then saude | grep -q '"ok":true'; exit $?; fi

cd "$APP"
echo "==> pré-comprimindo os estáticos"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then node tools/precomprimir.mjs; node tools/precomprimir.mjs --verificar
else docker run --rm --user "$(id -u):$(id -g)" -v "$APP:/repo" -w /repo node:22-slim sh -c 'node tools/precomprimir.mjs && node tools/precomprimir.mjs --verificar'; fi
if compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "==> backup do banco antes de subir"; /srv/draevor/bin/backup.sh || die 1 "o backup do banco falhou — nada foi alterado nos containers."
fi
echo "==> docker compose up -d --build"; compose up -d --build
echo "==> nginx -t && reload"; compose exec -T nginx nginx -t; compose exec -T nginx nginx -s reload
echo "==> esperando /saude"
for _ in $(seq 1 30); do if saude 2>/dev/null | grep -q '"ok":true'; then echo "==> OK — $(saude)"; compose ps; exit 0; fi; sleep 2; done
die 1 "o jogo não respondeu em https://$DOMINIO/saude."
