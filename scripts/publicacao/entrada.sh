#!/usr/bin/env bash
# O ÚNICO comando que a chave SSH da Engine pode rodar na VPS (`command=` no authorized_keys). Aceita SOMENTE:
#   publicar <sha40> | rollback | rollback <sha40> | status
# Qualquer outra coisa (inclusive tentativas de injeção) é recusada. Nada de shell interativo, nada de argumento livre.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cmd="${SSH_ORIGINAL_COMMAND:-}"
export PUB_POR="engine"
case "$cmd" in
  status) source "$DIR/lib.sh"; { printf '{"atual":"%s","anterior":"%s"}\n' "$(cat "$ESTADO/atual" 2>/dev/null || true)" "$(cat "$ESTADO/anterior" 2>/dev/null || true)"; tail -n 20 "$LOG" 2>/dev/null || true; } ;;
  rollback) exec "$DIR/rollback.sh" ;;
  *)
    if [[ "$cmd" =~ ^publicar\ ([0-9a-f]{40})$ ]]; then exec "$DIR/publicar.sh" "${BASH_REMATCH[1]}"
    elif [[ "$cmd" =~ ^rollback\ ([0-9a-f]{40})$ ]]; then exec "$DIR/rollback.sh" "${BASH_REMATCH[1]}"
    else echo "comando não permitido" >&2; exit 126; fi ;;
esac
