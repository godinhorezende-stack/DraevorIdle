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
//   ate   — até quando ela ainda caça: o teto de `AUSENCIA_MAXIMA_MS` contado da
//           saída, ou o fim da stamina (1 min por minuto), o que vier antes.
//           `null` quando acabou (morreu, a stamina zerou) — não há mais o que
//           avançar, só o login a fazer.
// "Ainda caçando" é `ate > agora`; "tem o que consolidar" é `ate > desde`.
import { TETO as STAMINA_TETO } from '../systems/stamina.mjs';

/** Teto de uma caçada offline, contado da saída (a mesma regra da volta, `cacadas.mjs`). */
export const AUSENCIA_MAXIMA_MS = 12 * 3_600_000;

/** `[desde, ate]` para gravar junto do estado (os dois `null` fora de caçada offline). */
export function colunasDaCacaOffline(estado) {
  const hunt = estado?.hunt;
  const desde = hunt?.offlineDesde;
  if (!(desde > 0)) return [null, null];
  const a = hunt.ausencia;
  if (a?.morreu || a?.semStamina) return [Math.round(desde), null];
  const inicio = a?.inicio ?? desde;
  const stamina = typeof estado.stamina === 'number' ? Math.max(0, estado.stamina) : STAMINA_TETO;
  const ate = Math.min(inicio + AUSENCIA_MAXIMA_MS, desde + stamina * 60_000);
  return [Math.round(desde), Math.round(ate)];
}
