#!/usr/bin/env bash
# Deploy pelo Git: puxa a branch, sobe a stack (rebuild só do que mudou) e
# confere que o jogo respondeu antes de sair. Pensado para rodar NO VPS, de
# dentro do checkout do repositório — não faz nada de rede além do próprio
# `git pull`/`docker compose`.
#
# Uso:
#   scripts/deploy.sh                 # staging: projeto `staging`, nginx só em 127.0.0.1:8081
#   AMBIENTE=producao scripts/deploy.sh   # produção: + docker-compose.prod.yml (portas 80/443)
#
# Variáveis (todas opcionais, com padrão sensato):
#   AMBIENTE   staging (padrão) | producao
#   PORTA_STAGING  porta local do nginx de staging (padrão 8081)
#   BRANCH     branch a puxar (padrão: a que já está com checkout feito)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$RAIZ/game/docker"
cd "$RAIZ"

AMBIENTE="${AMBIENTE:-staging}"
ARQUIVOS_COMPOSE=(-f "$DOCKER_DIR/docker-compose.yml")
case "$AMBIENTE" in
  producao)
    ARQUIVOS_COMPOSE+=(-f "$DOCKER_DIR/docker-compose.prod.yml")
    URL_SAUDE="http://localhost/saude"
    ;;
  staging)
    # Projeto próprio: volumes/redes/containers separados da produção, então
    # roda no mesmo host sem tocar nela (banco incluso). Só em 127.0.0.1.
    export PORTA_STAGING="${PORTA_STAGING:-8081}"
    ARQUIVOS_COMPOSE=(-p staging "${ARQUIVOS_COMPOSE[@]}" -f "$DOCKER_DIR/docker-compose.staging.yml")
    URL_SAUDE="http://127.0.0.1:$PORTA_STAGING/saude"
    ;;
  *)
    echo "AMBIENTE inválido: '$AMBIENTE' (use staging ou producao)." >&2
    exit 1
    ;;
esac

if [ ! -f "$DOCKER_DIR/.env" ]; then
  echo "Faltou game/docker/.env (copie de game/docker/.env.example e ajuste POSTGRES_PASSWORD etc.) — abortando." >&2
  exit 1
fi

BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
echo "==> git pull origin $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
# Só avança se o histórico local está limpo em cima do remoto — nunca
# descarta trabalho não commitado nem reescreve histórico sozinho aqui.
git merge --ff-only "origin/$BRANCH"

# Os `.br`/`.gz` dos estáticos não vão pro git (.gitignore): são saída de
# build, gerados aqui, no checkout que o compose monta como volume
# (read-only) no container — a fonte de verdade é o arquivo versionado. Só
# refaz o que mudou. Caminho normal: o node do próprio host (Ubuntu). Sem
# node no host (ou velho demais), a mesma imagem base do jogo, via Docker.
#
# Obrigatório: se gerar ou conferir falhar, o deploy PARA aqui, antes de
# mexer nos containers — o jogo no ar continua o de antes, inteiro.
NODE_MINIMO=18
precomprimir() {
  if command -v node >/dev/null 2>&1 \
    && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MINIMO" ]; then
    echo "    (node $(node --version) do host)"
    node tools/precomprimir.mjs "$@"
  else
    echo "    (sem node >= $NODE_MINIMO no host: node:22-slim via Docker)"
    docker run --rm --user "$(id -u):$(id -g)" -v "$RAIZ:/repo" -w /repo node:22-slim node tools/precomprimir.mjs "$@"
  fi
}
echo "==> pré-comprimindo os estáticos"
if ! precomprimir; then
  echo "ERRO: tools/precomprimir.mjs falhou — deploy abortado, containers intocados." >&2
  exit 1
fi
echo "==> conferindo os .br/.gz contra as fontes"
if ! precomprimir --verificar; then
  echo "ERRO: há .br/.gz diferentes da fonte — deploy abortado, containers intocados." >&2
  exit 1
fi

echo "==> ambiente: $AMBIENTE (${ARQUIVOS_COMPOSE[*]})"
echo "==> docker compose up -d --build"
docker compose "${ARQUIVOS_COMPOSE[@]}" up -d --build

echo "==> esperando o /saude responder..."
por_at_e=30
ok=""
for _ in $(seq 1 "$por_at_e"); do
  if curl -fsS "$URL_SAUDE" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [ -z "$ok" ]; then
  echo "O jogo não respondeu em /saude depois de ${por_at_e}x2s — ver 'docker compose logs game'." >&2
  exit 1
fi

echo "==> OK — $(curl -fsS "$URL_SAUDE")"
docker compose "${ARQUIVOS_COMPOSE[@]}" ps
