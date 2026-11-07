// As duas colunas-índice da caçada offline (`personagens.caca_offline_desde` e
// `caca_offline_ate`), calculadas do `estado` num lugar só.
//
// O `estado` é um JSON: achar quem está caçando de aba fechada lendo o JSON de
// todo personagem funciona com poucos, e pesa com muitos. As colunas copiam o
// que importa para uma busca com índice — e TODA gravação de estado passa por
// `colunasDaCacaOffline` (ver `banco.mjs`: criar, gravar, regravar, e a
// consolidação), então elas nunca desencontram do JSON.
//
//   desde — até onde a ausência já foi calculada (`hunt.offlineDesde`);
//   ate   — até quando ela ainda caça: o limite da caça offline contado da saída
//           (o dono, 07/11/2026: 4 h para free, 12 h para VIP — `limiteDoOffline`).
//           `null` quando acabou (morreu, bateu o limite) — não há mais o que
//           avançar, só o login a fazer.
// "Ainda caçando" é `ate > agora`; "tem o que consolidar" é `ate > desde`.

/** As horas de caça offline (o dono, 07/11/2026 — a stamina saiu): free e VIP (premium). */
export const HORAS_DO_OFFLINE = Object.freeze({ free: 4, vip: 12 });
/** O maior limite (o do VIP). */
export const AUSENCIA_MAXIMA_MS = HORAS_DO_OFFLINE.vip * 3_600_000;
/** O limite da caça offline de quem saiu em `momento`: o VIP (premium ativo na saída) caça 12 h; o free, 4 h. */
export const limiteDoOffline = (estado, momento) => ((estado?.premiumAte ?? 0) > momento ? HORAS_DO_OFFLINE.vip : HORAS_DO_OFFLINE.free) * 3_600_000;

/** `[desde, ate]` para gravar junto do estado (os dois `null` fora de caçada offline). */
export function colunasDaCacaOffline(estado) {
  const hunt = estado?.hunt;
  const desde = hunt?.offlineDesde;
  if (!(desde > 0)) return [null, null];
  const a = hunt.ausencia;
  if (a?.morreu || a?.esgotou) return [Math.round(desde), null];
  const inicio = a?.inicio ?? desde;
  return [Math.round(desde), Math.round(inicio + (a?.limiteMs ?? limiteDoOffline(estado, inicio)))];
}
