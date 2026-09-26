// Stamina — as regras que o client original descreve (`painelStamina`,
// hud.mjs) e os números do personagem real capturado:
//
// - em MINUTOS, teto 2520 (42h — `maxStamina`);
// - caçando: -1 min por minuto de caçada (a caçada offline também gasta);
// - parado na cidade (ou deslogado fora de caçada): +1 min a cada 30s
//   (`staminaRegen.segundosPorMinuto: 30`, o do personagem real — "Carregando
//   na cidade");
// - na experiência ela MULTIPLICA (Player.getFinalBonusStamina, o comentário do
//   client): acima de 39h (2340) com premium x1,5; 14h (840) ou menos x0,5;
//   esgotada, x0,5 também;
// - Stamina Extension (item 36725): +20h (1200 min), até o teto.
export const TETO = 2520;
const SEGUNDOS_POR_MINUTO = 30;
export const STAMINA_EXTENSION = 36725;

export function garantir(estado) {
  if (typeof estado.stamina !== 'number') estado.stamina = TETO;
  return estado.stamina;
}

/** Caçando: -1 min por minuto. */
export function gastar(estado, ms) {
  if (!(ms > 0)) return;
  estado.stamina = Math.max(0, garantir(estado) - ms / 60_000);
}

/** Parado fora de caçada: +1 min a cada 30s. */
export function recuperar(estado, ms) {
  if (!(ms > 0)) return;
  estado.stamina = Math.min(TETO, garantir(estado) + ms / 1000 / SEGUNDOS_POR_MINUTO);
}

/** O multiplicador de exp da stamina agora. */
export function fatorDeExp(estado) {
  const s = garantir(estado);
  const premium = (estado.premiumAte ?? 0) > Date.now();
  if (s > 2340 && premium) return 1.5;
  if (s <= 840) return 0.5;
  return 1;
}

/** Stamina Extension: +20h até o teto. */
export function usarExtension(estado) {
  if (garantir(estado) >= TETO) return { ok: false, erro: 'Sua stamina já está cheia.' };
  estado.stamina = Math.min(TETO, estado.stamina + 1200);
  return { ok: true, notice: '+20 horas de stamina.' };
}

/** Os campos que o client lê: `stamina`, `maxStamina`, `staminaRegen`. */
export function paraCliente(estado) {
  const s = garantir(estado);
  const naCidade = !estado.hunt;
  return {
    stamina: s,
    maxStamina: TETO,
    staminaRegen: { ativo: naCidade, cheia: s >= TETO, onde: 'na cidade', segundosPorMinuto: SEGUNDOS_POR_MINUTO },
  };
}
