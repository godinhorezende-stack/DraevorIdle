// Os SOCKETS das peças do PoE (regra do dono, 05/10 — `itens-poe/regras.json` → `sockets`): o máximo pela classe da peça e pelo item level,
// e o sorteio da peça que cai (totalmente aleatório: de 0 ao máximo, links ao acaso entre vizinhos). Fica num módulo leve porque o sistema
// de gemas (`skills/gemas.mjs`) o consulta para toda peça do PoE.
import { REGRAS, ligado } from './catalogo.mjs';

/** O sistema do PoE está ligado? (atalho para quem já importa este módulo leve) */
export const poeLigado = () => ligado();

const S = () => REGRAS.sockets ?? {};

/** A classe do PoE de uma peça do jogo (`peca.poe.classe`) ou do item do catálogo (`meta.poe.base`: 'Classe/Slug'). */
export const classeDe = (meta, peca = null) => peca?.poe?.classe ?? peca?.poe?.base?.split('/')[0] ?? meta?.poe?.classe ?? meta?.poe?.base?.split('/')[0] ?? null;

/** Quantos sockets o item level permite (`porItemLevel`). Sem item level: o máximo da tabela. */
export function maximoPeloItemLevel(ilvl) {
  const t = S().porItemLevel ?? [];
  if (ilvl == null) return t.at(-1)?.[1] ?? 0;
  let max = 0;
  for (const [nivel, n] of t) if (Number(ilvl) >= nivel) max = Math.max(max, n);
  return max;
}

/** O máximo de sockets de uma peça do PoE: o da classe, limitado pelo item level. */
export const maximo = (classe, ilvl = null) => Math.min(Number(S().porClasse?.[classe]) || 0, maximoPeloItemLevel(ilvl));

/** Os sockets de uma peça do PoE que cai: `{ abertos, links, gemas }` (o formato das gemas), ou null se a classe não tem. */
export function sortear(classe, ilvl, rng = Math.random) {
  const max = maximo(classe, ilvl);
  if (!max) return null;
  const abertos = Math.floor(rng() * (max + 1));
  const chance = Number(S().chanceDeLink ?? 0.5);
  const links = Array.from({ length: max - 1 }, (_, i) => i + 1 < abertos && rng() < chance);
  return { abertos, links, gemas: Array(max).fill(null) };
}
