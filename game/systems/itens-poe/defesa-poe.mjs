// (lotes A5d/A5e, dono 20/10) As TABELAS de defesa dos monstros do PoE e os multiplicadores do tipo (`gamedata/itens-poe/monstros-defesa-poe.json`,
// de `tools/importar-defesa-monstros-poe.mjs`): evasão, precisão e armadura = round(tabela[nível] × multiplicador). Módulo puro (só lê o JSON) —
// `mobs/atributos.mjs` (o combate) e `itens-poe/mapas-areas.mjs` (os monstros levados ao nível do mapa) usam o mesmo, sem ciclo de imports.
import { readFileSync, existsSync } from 'node:fs';

const ARQ = new URL('../../gamedata/itens-poe/monstros-defesa-poe.json', import.meta.url);
export const DEFESA_POE = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : { tabelas: { evasao: [], precisao: [], armadura: [] }, monstros: {}, padrao: { evasao: 1, precisao: 1, armadura: 1 } };

/** O nível da tabela (1–100). */
export const nivelDaTabela = (level) => Math.max(1, Math.min(100, Math.round(Number(level) || 1)));
/** A Base Stat do PoE (`evasao`, `precisao` ou `armadura`) no nível (1–100). */
export const tabelaPoe = (qual, level) => DEFESA_POE.tabelas?.[qual]?.[nivelDaTabela(level) - 1] ?? 0;
/** O multiplicador pelo slug do poedb e o nível da campanha: `porNivel[nivel]`, senão o geral (o das variantes de nível 68+), senão o padrão. */
export function multiplicadorDoSlug(qual, slug, nivel) {
  const d = DEFESA_POE.monstros?.[slug];
  return d?.porNivel?.[nivel]?.[qual] ?? d?.[qual] ?? DEFESA_POE.padrao?.[qual] ?? 1;
}
/** (lote A5d) A evasão e a precisão de COMBATE de um monstro do PoE pelo slug, no nível (sem os modificadores) — as telas da engine. */
export const defesaPoeDoSlug = (slug, nivel) => ({ evasao: Math.round(tabelaPoe('evasao', nivel) * multiplicadorDoSlug('evasao', slug, nivel)), precisao: Math.round(tabelaPoe('precisao', nivel) * multiplicadorDoSlug('precisao', slug, nivel)) });
/** (lote A5e) A armadura de COMBATE de um monstro do PoE pelo slug, no nível (sem os modificadores nem o teto). */
export const armaduraPoeDoSlug = (slug, nivel) => Math.round(tabelaPoe('armadura', nivel) * multiplicadorDoSlug('armadura', slug, nivel));
