// As regras dos SOCKETS de gema que o servidor e a tela usam iguais (uma fonte
// só): quais sockets estão ligados entre si e se uma support vale para uma
// skill pelas tags dela. O servidor decide (`systems/skills/gemas.mjs`); a tela
// usa estas mesmas funções para mostrar, ANTES de encaixar, o que vai valer.

/** Os GRUPOS de sockets ligados de uma peça (`{ abertos, links }`): listas de índices abertos conectados. */
export function gruposLigados(s) {
  const grupos = [];
  let atual = [];
  for (let i = 0; i < (s?.abertos ?? 0); i++) {
    atual.push(i);
    if (!(i + 1 < s.abertos && s.links?.[i])) {
      grupos.push(atual);
      atual = [];
    }
  }
  return grupos;
}

/** O grupo ligado que contém o socket `indice` (vazio se o socket está bloqueado). */
export const grupoDoSocket = (s, indice) => gruposLigados(s).find((g) => g.includes(indice)) ?? [];

/** A support vale para uma skill com estas tags? (`requer` todas, `algum` uma, `exclui` nenhuma) */
export function compativel(suporte, tags) {
  const t = new Set(tags ?? []);
  if ((suporte?.requer ?? []).some((x) => !t.has(x))) return false;
  if ((suporte?.algum ?? []).length && !suporte.algum.some((x) => t.has(x))) return false;
  if ((suporte?.exclui ?? []).some((x) => t.has(x))) return false;
  return true;
}
