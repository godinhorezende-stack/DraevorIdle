// Quais gemas ativas cada suporte do PoE suporta, exatamente como no PoE (`gamedata/itens-poe/suportes-compat.json`, da coleção do Drive
// — tools/importar-compat-de-suportes.mjs). A gema ativa leva a marca `poe-sup:<bits>` nas tags e o suporte o `indicePoe` dele; quem
// confere é `compativel` (engine/sockets-de-gema.mjs, o mesmo no servidor e na tela). Suporte sem lista segue a regra das tags.
import { readFileSync, existsSync } from 'node:fs';

const ARQ = new URL('../../gamedata/itens-poe/suportes-compat.json', import.meta.url);
const DADOS = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : { suportes: [], ativas: {} };
const INDICE = new Map(DADOS.suportes.map((s, i) => [s, i]));

/** O índice do suporte no mapa (ou null: sem lista, vale a regra das tags). */
export const indiceDoSuporte = (slug) => INDICE.get(slug) ?? null;
/** A marca da gema ativa (`poe-sup:<bits>`), ou null se nenhum suporte a suporta pela lista. */
export const tagDaAtiva = (slug) => (DADOS.ativas[slug] ? `poe-sup:${DADOS.ativas[slug]}` : null);

/**
 * (17/10, lote G3) Os suportes que ACRESCENTAM UM TIPO à habilidade suportada, como no PoE ("added types"): o Suporte de Armadilha a torna
 * Armadilha, os de Mina (Explosão em Cadeia, Alto Impacto, Locus) a tornam Mina. No mesmo grupo ligado, os suportes que exigem esse tipo (as
 * Armadilhas Múltiplas, a Montagem Ágil, o Dano de Armadilha e Mina…) passam a suportar a habilidade — `engine/sockets-de-gema.compativelNoGrupo`.
 */
export const ADICIONA_TIPOS = Object.freeze({
  Trap_Support: ['poe:Armadilha'],
  Blastchain_Mine_Support: ['poe:Mina'],
  'High-Impact_Mine_Support': ['poe:Mina'],
  Locus_Mine_Support: ['poe:Mina'],
});
