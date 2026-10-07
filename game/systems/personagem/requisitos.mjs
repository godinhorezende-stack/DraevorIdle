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
  // Requisitos EXPLÍCITOS da base (`reqStr`/`reqDex`/`reqInt`, definidos no editor de itens — `engine/arma.mjs`): o estilo Path of Exile de verdade, em que a arma pede os atributos
  // listados e o personagem precisa ter TODOS. Sem nenhum deles, vale a regra derivada abaixo (e as peças de antes seguem iguais).
  const explicitos = Object.fromEntries([['str', meta?.reqStr], ['dex', meta?.reqDex], ['int', meta?.reqInt]].filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Math.ceil(Number(v))]));
  if (Object.keys(explicitos).length) return { atributos: Object.keys(explicitos), valor: Math.max(...Object.values(explicitos)), porAtributo: explicitos, todos: true };
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
/**
 * Os requisitos de atributo de uma peça do PoE com os mods dela ("Requisito de Força aumentado em X%", "+N de Força Requisitada", "Não
 * possui Requisitos de Atributos") e os do personagem ("Itens e Gemas têm o Requisito de Atributos reduzido em X%"). null sem requisito.
 */
export function requisitosDaPeca(meta, peca = null, afGlobal = null) {
  const base = meta?.poe?.requisitos;
  if (!base) return null;
  const af = peca?.poe?.af ?? {};
  if (Number(af.sem_requisitos) > 0) return null;
  const global = Number(afGlobal?.req_atributos_pct) || 0;
  const r = {};
  for (const [a, v] of Object.entries(base)) r[a] = Math.max(0, Math.round(v * (1 + ((Number(af[`req_${a}_pct`]) || 0) + global) / 100) + (Number(af[`req_${a}_flat`]) || 0)));
  for (const a of ['str', 'dex', 'int']) if (!(a in r) && Number(af[`req_${a}_flat`]) > 0) r[a] = Number(af[`req_${a}_flat`]);
  return r;
}

export function falta(meta, atributos, peca = null, afGlobal = null) {
  // Peça do sistema de itens do PoE (só com ITENS_POE=1): os requisitos da base, TODOS valem (como no PoE).
  const doPoe = requisitosDaPeca(meta, peca, afGlobal);
  if (doPoe) {
    const faltam = Object.entries(doPoe).filter(([a, v]) => (atributos?.[a] ?? 0) < v);
    return faltam.length ? `Requer ${faltam.map(([a, v]) => `${v} ${NOME_DO_ATRIBUTO[a]}`).join(' e ')}.` : null;
  }
  const req = requisitoDe(meta);
  if (!req) return null;
  if (req.todos) {
    const faltam = Object.entries(req.porAtributo).filter(([a, v]) => (atributos?.[a] ?? 0) < v);
    return faltam.length ? `Requer ${Object.entries(req.porAtributo).map(([a, v]) => `${v} ${NOME_DO_ATRIBUTO[a]}`).join(', ')}.` : null;
  }
  if (req.atributos.some((a) => (atributos?.[a] ?? 0) >= req.valor)) return null;
  return `Requer ${req.atributos.map((a) => `${req.valor} ${NOME_DO_ATRIBUTO[a]}`).join(' ou ')}.`;
}
