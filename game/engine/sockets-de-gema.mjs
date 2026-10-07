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

/*
 * Suporte do PoE com a lista do PoE (`indicePoe`) e gema ativa do PoE (a marca `poe-sup:<bits>` nas tags): vale o bit — exatamente o
 * que o PoE suporta (`systems/itens-poe/compat-suportes.mjs`). Sem a marca ou sem o índice, a regra das tags de sempre.
 */
const BITS = new Map();
function bitLigado(base64, i) {
  let bytes = BITS.get(base64);
  if (!bytes) {
    const bin = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    BITS.set(base64, bytes);
  }
  return !!((bytes[i >> 3] ?? 0) & (1 << (i & 7)));
}

/** A support vale para uma skill com estas tags? (`requer` todas, `algum` uma, `exclui` nenhuma) */
export function compativel(suporte, tags) {
  if (Number.isInteger(suporte?.indicePoe)) {
    const marca = (tags ?? []).find((x) => typeof x === 'string' && x.startsWith('poe-sup:'));
    if (marca) return bitLigado(marca.slice(8), suporte.indicePoe);
    // Gema ativa do PoE sem marca nenhuma: nenhum suporte da lista a suporta.
    if ((tags ?? []).some((x) => typeof x === 'string' && x.startsWith('poe:'))) return false;
  }
  const t = new Set(tags ?? []);
  if ((suporte?.requer ?? []).some((x) => !t.has(x))) return false;
  if ((suporte?.algum ?? []).length && !suporte.algum.some((x) => t.has(x))) return false;
  if ((suporte?.exclui ?? []).some((x) => t.has(x))) return false;
  return true;
}
