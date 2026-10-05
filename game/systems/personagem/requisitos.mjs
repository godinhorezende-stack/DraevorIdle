// REQUISITOS de atributo do equipamento — o modelo Path of Exile (decisão do
// dono): nenhuma peça é "só de uma classe"; ela pede STR/DEX/INT.
//
// Os atributos pedidos saem das CLASSES RECOMENDADAS da peça (as vocações do
// catálogo; ver `gamedata/classes.json#requisitos`) e basta ter UM deles —
// assim nenhuma classe perde o que já usava: peça de knight pede STR; de
// knight e paladin, STR ou DEX; de sorcerer/druid, INT; de monk, STR ou DEX.
// Peça de todas as vocações não pede. O valor cresce com o level mínimo.
import { CONFIG } from './especializacoes.mjs';

const R = CONFIG.requisitos;
export const NOME_DO_ATRIBUTO = { str: 'STR', dex: 'DEX', int: 'INT' };

/** O requisito de uma peça do catálogo: `{ atributos: ['str', ...], valor }` (basta um), ou null. */
export function requisitoDe(meta) {
  const vocs = [...new Set((meta?.vocations ?? []).map((v) => String(v).toLowerCase()))];
  if (!vocs.length) return null;
  const atributos = [...new Set(vocs.flatMap((v) => R.atributoDaClasse[v] ?? []))];
  const valor = Math.ceil((Number(meta.minLevel) || 0) * R.porLevelMinimo);
  if (!atributos.length || valor <= 0) return null;
  return { atributos, valor };
}

/**
 * Este personagem cumpre? `atributos` = os totais dele (`Ficha.combate(estado).atributos`).
 * Devolve null (cumpre) ou o texto do que falta.
 */
export function falta(meta, atributos) {
  // Peça do sistema de itens do PoE (só com ITENS_POE=1): os requisitos da base, TODOS valem (como no PoE).
  const doPoe = meta?.poe?.requisitos;
  if (doPoe) {
    const faltam = Object.entries(doPoe).filter(([a, v]) => (atributos?.[a] ?? 0) < v);
    return faltam.length ? `Requer ${faltam.map(([a, v]) => `${v} ${NOME_DO_ATRIBUTO[a]}`).join(' e ')}.` : null;
  }
  const req = requisitoDe(meta);
  if (!req) return null;
  if (req.atributos.some((a) => (atributos?.[a] ?? 0) >= req.valor)) return null;
  return `Requer ${req.atributos.map((a) => `${req.valor} ${NOME_DO_ATRIBUTO[a]}`).join(' ou ')}.`;
}
