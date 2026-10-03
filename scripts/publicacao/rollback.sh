#!/usr/bin/env bash
# VOLTA a produção para uma versão anterior. Uso: rollback.sh [<sha-de-40-hex>]   (sem argumento: o commit que estava no ar antes da última publicação)
# O alvo precisa ser um commit da história de origin/main. Usa `git reset --keep`: move o HEAD sem apagar modificações locais da VPS (e ABORTA se uma modificação local
# seria perdida). Depois sobe tudo de novo (subir.sh, com backup do banco) e confere a saúde. NÃO restaura o banco (os dados dos jogadores nunca são tocados aqui).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
automatico=0; [ "${1:-}" = "--automatico" ] && { automatico=1; shift; }
alvo="${1:-}"
[ -n "$alvo" ] || { [ -s "$ESTADO/anterior" ] && alvo="$(cat "$ESTADO/anterior")"; }
sha_valido "$alvo" || die 64 "não há versão anterior registrada: informe o commit completo (40 hexadecimais)."
[ "${PUB_TRAVA_COM_MIM:-}" = "1" ] || pegar_trava

atual="$(git_app rev-parse HEAD)"
git_app cat-file -e "$alvo^{commit}" 2>/dev/null || die 67 "o commit $alvo não existe no repositório."
git_app merge-base --is-ancestor "$alvo" origin/main || { registrar rollback "$alvo" recusado "fora da historia de origin/main"; die 68 "o commit $alvo não está na história de origin/main: não volto para ele."; }
[ "$alvo" != "$atual" ] || die 70 "a produção já está em $alvo."
registrar rollback "$alvo" iniciada "de $atual"
if ! git_app reset --keep "$alvo" >/dev/null 2>&1; then registrar rollback "$alvo" falhou "reset --keep recusado"; die 71 "o rollback perderia uma modificação local da VPS: nada foi alterado."; fi
"$SUBIR" || { registrar rollback "$alvo" falhou "subir.sh falhou"; die 1 "o rollback não conseguiu subir os serviços: VERIFICAR A PRODUÇÃO."; }
checar_saude || { registrar rollback "$alvo" falhou "saude"; die 1 "o rollback subiu mas o jogo não respondeu na saúde: VERIFICAR A PRODUÇÃO."; }
echo "$alvo" > "$ESTADO/atual"
registrar rollback "$alvo" ok "de $atual"
echo "==> produção de volta em $alvo (era $atual)"
