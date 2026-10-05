#!/usr/bin/env bash
# PUBLICA uma versão que JÁ está na branch principal do repositório. Uso: publicar.sh <sha-de-40-hex>
# Recusa tudo o que não for exatamente a ponta de origin/main (a Engine só publica o que foi integrado por merge manual). Etapas:
#   trava → confere o commit → artefato imutável → posiciona o checkout (ff-only, preservando as modificações locais da VPS) → subir.sh (backup do banco incluso)
#   → saúde → registra. Qualquer falha depois de mexer no checkout dispara o ROLLBACK AUTOMÁTICO para o commit que estava no ar.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
sha="${1:-}"
sha_valido "$sha" || die 64 "informe o commit completo (40 caracteres hexadecimais)."
pegar_trava
export PUB_TRAVA_COM_MIM=1

[ "$(git_app rev-parse --abbrev-ref HEAD)" = "main" ] || die 65 "o checkout de produção não está na branch main."
GIT_TERMINAL_PROMPT=0 git_app fetch -q origin main || die 66 "não consegui consultar o remoto."
git_app cat-file -e "$sha^{commit}" 2>/dev/null || die 67 "o commit $sha não existe no repositório."
git_app merge-base --is-ancestor "$sha" origin/main || { registrar publicar "$sha" recusado "não está em origin/main"; die 68 "o commit $sha NÃO está integrado à branch principal: não publico."; }
ponta="$(git_app rev-parse origin/main)"
[ "$sha" = "$ponta" ] || { registrar publicar "$sha" recusado "a principal avancou"; die 69 "a principal já avançou (ponta $ponta): publique a ponta, ou use rollback.sh para voltar a um commit antigo."; }
anterior="$(git_app rev-parse HEAD)"
[ "$anterior" != "$sha" ] || die 70 "este commit já é o que está em produção."

# O artefato imutável desta versão (a árvore exata do commit, somente leitura): referência para auditoria e para recuperar o que foi ao ar.
artefato="$ESTADO/artefatos/$sha"
if [ ! -d "$artefato" ]; then
  mkdir -p "$artefato"
  git_app archive "$sha" | tar -x -C "$artefato"
  ( cd "$artefato" && find . -type f -print0 | sort -z | xargs -0 sha256sum > "$ESTADO/artefatos/$sha.sha256" )
  chmod -R a-w "$artefato"
fi

registrar publicar "$sha" iniciada "anterior $anterior"
# Posiciona o checkout na ponta da principal. `--ff-only`: nunca cria merge nem apaga o que é só desta VPS (se houver conflito com a modificação local, aborta aqui, sem tocar nos containers).
if ! git_app merge --ff-only "$sha" >/dev/null 2>&1; then registrar publicar "$sha" falhou "git merge --ff-only recusado"; die 71 "não consegui posicionar o checkout (modificação local conflitando?). Nada foi alterado nos containers."; fi

falhou() {
  registrar publicar "$sha" falhou "$1"
  echo "FALHA: $1 — voltando para $anterior" >&2
  if "$DIR_DOS_SCRIPTS/rollback.sh" --automatico "$anterior"; then registrar rollback-automatico "$anterior" ok "voltou apos falha de $sha"; else registrar rollback-automatico "$anterior" falhou "VERIFICAR A PRODUCAO"; fi
  exit 1
}
"$SUBIR" || falhou "subir.sh falhou"
checar_saude || falhou "o jogo não respondeu na verificação de saúde"
[ "$(git_app rev-parse HEAD)" = "$sha" ] || falhou "o checkout não está no commit publicado"

echo "$anterior" > "$ESTADO/anterior"; echo "$sha" > "$ESTADO/atual"
registrar publicar "$sha" ok "publicado; anterior $anterior"
echo "==> versão $sha publicada (anterior: $anterior)"
