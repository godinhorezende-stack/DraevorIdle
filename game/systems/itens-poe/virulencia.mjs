// (lote 75 — dono, 17/10: "No máximo, como o PoB") A VIRULÊNCIA do Arauto da Agonia (Herald of Agony do PoE). O PoB não simula o ganho nem a
// perda: usa um número de acúmulos (VirulenceStack, até VirulenceStacksMax). Pela decisão do dono, enquanto o Arauto está ligado e você
// Envenenou com ele há até 4 s (o "Recentemente"), a Virulência fica no MÁXIMO; sem envenenar, ZERA — e o Rastejador Agonizante some
// (`acoes.tiqueDoArautoDaAgonia`). O máximo: os "40 de Virulência Máxima" da gema + a qualidade ("+(0—5) de Virulência Máxima": 0,25 por 1%,
// o qualityStats do PoB) + o "+N de Virulência Máxima" (a Pura Agonia das Ramificadoras — `virulencia_max`). Não escala com o Efeito do Buff
// (no PoB, "unscalable").
import { textosDaGema } from './gemas-poe.mjs';
import { RECENTE_MS } from './condicoes-poe.mjs';

export const SLUG = 'Herald_of_Agony';
// (o id da ação: `GemasPoe.PREFIXO` + o slug — escrito aqui, e não lido de lá na carga: o `gemas-poe.mjs` está no meio de um ciclo de imports
// (gemas-poe → linhas-das-gemas → … → lacaios-poe → aqui) e o PREFIXO ainda não existe quando este módulo carrega; o prefixo é estável — os ids
// salvos dependem dele)
export const ID = `poe-gema:${SLUG}`;
/** A Virulência Máxima a mais por 1% de qualidade (o PoB: `maximum_virulence_stacks` 0,25). */
export const POR_QUALIDADE = 0.25;
/** A base da gema quando o texto não traz a linha ("40 de Virulência Máxima"). */
const BASE = 40;

const daGema = new Map();
/** A Virulência Máxima: a da gema no nível, + a da qualidade, + o "+N de Virulência Máxima" (`af.virulencia_max`). */
export function maxima(nivel = 1, qualidade = 0, af = null) {
  if (!daGema.has(nivel)) {
    const linha = (textosDaGema(SLUG, nivel)?.linhas ?? []).map((l) => /^(\d+) de Virulência Máxima$/.exec(String(l))).find(Boolean);
    daGema.set(nivel, linha ? Number(linha[1]) : BASE);
  }
  return daGema.get(nivel) + Math.floor(Math.max(0, Number(qualidade) || 0) * POR_QUALIDADE) + (Number(af?.virulencia_max) || 0);
}

/**
 * A Virulência AGORA: `max` se o Arauto está ligado (`hunt.buffs[ID]`) e você Envenenou (`ev:envenenar`, `mods-poe.evento`) depois de ligá-lo
 * e há até 4 s ("Ao envenenar um inimigo enquanto possui esse bônus, você recebe Virulência"); senão, 0. O relógio é o da caçada.
 */
export function atual(hunt, max, agora = hunt?.clock ?? 0) {
  const b = hunt?.buffs?.[ID];
  if (!b || !(b.ate > agora)) return 0;
  const ultimo = hunt.poeRecente?.['ev:envenenar'];
  if (ultimo == null || ultimo < (b.desde ?? 0) || agora - ultimo > RECENTE_MS) return 0;
  return Math.max(0, max);
}
