#!/usr/bin/env bash
# Funções comuns de publicar.sh / rollback.sh / subir.sh. NÃO é executável sozinho (só `source`).
# Tudo parametrizável por variável de ambiente (os testes apontam para pastas temporárias); os padrões são os da VPS.
APP="${PUB_APP:-/srv/draevor/app}"
ESTADO="${PUB_ESTADO:-/srv/draevor/releases}"          # releases.log, atual, anterior, trava, artefatos
CONFIG="${PUB_CONFIG:-/srv/draevor/config}"
DIR_DOS_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBIR="${PUB_SUBIR_CMD:-$DIR_DOS_SCRIPTS/subir.sh}"     # constrói e sobe os serviços (backup do banco incluído)
SAUDE="${PUB_SAUDE_CMD:-}"                              # vazio = usa a verificação padrão do subir.sh
LOG="$ESTADO/releases.log"
TRAVA="$ESTADO/publicacao.trava"
REGEX_SHA='^[0-9a-f]{40}$'

agora() { date -u +%Y-%m-%dT%H:%M:%SZ; }
die() { local codigo="$1"; shift; echo "ERRO: $*" >&2; exit "$codigo"; }
# Uma linha JSON por evento (só campos que controlamos: sha de 40 hex, palavras fixas e uma mensagem sem aspas nem barras).
registrar() {
  local acao="$1" sha="$2" resultado="$3" detalhe="${4:-}"
  mkdir -p "$ESTADO"
  detalhe="${detalhe//[\"\\]/ }"; detalhe="${detalhe//$'\n'/ }"
  printf '{"quando":"%s","acao":"%s","sha":"%s","resultado":"%s","detalhe":"%s","por":"%s"}\n' "$(agora)" "$acao" "$sha" "$resultado" "${detalhe:0:300}" "${PUB_POR:-desconhecido}" >> "$LOG"
}
# Trava exclusiva contra publicações/rollbacks simultâneos (liberada sozinha quando o processo termina).
pegar_trava() {
  mkdir -p "$ESTADO"
  exec 9>"$TRAVA"
  flock -n 9 || die 75 "há outra publicação ou rollback em andamento (trava $TRAVA)."
}
git_app() { git -C "$APP" "$@"; }
sha_valido() { [[ "${1:-}" =~ $REGEX_SHA ]]; }
# O jogo está de pé? (o comando de saúde de teste ou o padrão do subir.sh: HTTPS do domínio resolvido para esta máquina, exige "ok":true)
checar_saude() {
  if [ -n "$SAUDE" ]; then bash -c "$SAUDE"; else "$DIR_DOS_SCRIPTS/subir.sh" --so-saude; fi
}
