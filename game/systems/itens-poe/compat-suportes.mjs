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
