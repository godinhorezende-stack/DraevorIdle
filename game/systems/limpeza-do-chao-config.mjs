// A configuração da LIMPEZA AUTOMÁTICA DO CHÃO (`limpeza-do-chao.mjs`), num lugar só.
//
// Padrão do projeto: valores em constantes, com sobrescrita por variável de ambiente (como `PORTA`
// em `backend/index.mjs`). Valor inválido NÃO derruba o servidor: volta ao padrão, e o erro vai para o log.

export const groundCleanupConfig = Object.freeze({
  enabled: true,
  intervalMinutes: 60,
  warningSeconds: 60,
  batchSize: 500,
});

/** O aviso global, igual para todo mundo (o pedido do dono, palavra por palavra). */
export const MENSAGEM_DO_AVISO = '[SISTEMA] A limpeza do mundo acontecerá em 1 minuto! Recolha os itens que estão no chão, pois todos serão removidos.';

const LIMITES = {
  intervalMinutes: { min: 1, max: 7 * 24 * 60 },
  warningSeconds: { min: 1, max: 3600 },
  batchSize: { min: 1, max: 100000 },
};

/**
 * Junta o padrão, as variáveis de ambiente (`GROUND_CLEANUP_ENABLED`, `_INTERVAL_MINUTES`,
 * `_WARNING_SECONDS`, `_BATCH_SIZE`) e `sobrescritas` (testes). Devolve `{ config, erros }`.
 */
export function validarConfig(sobrescritas = {}, env = process.env) {
  const erros = [];
  const bruto = { ...groundCleanupConfig };
  const doEnv = {
    enabled: env.GROUND_CLEANUP_ENABLED,
    intervalMinutes: env.GROUND_CLEANUP_INTERVAL_MINUTES,
    warningSeconds: env.GROUND_CLEANUP_WARNING_SECONDS,
    batchSize: env.GROUND_CLEANUP_BATCH_SIZE,
  };
  for (const [k, v] of Object.entries(doEnv)) if (v !== undefined && v !== '') bruto[k] = v;
  Object.assign(bruto, sobrescritas);

  const config = { ...groundCleanupConfig };
  if (typeof bruto.enabled === 'boolean') config.enabled = bruto.enabled;
  else if (/^(0|false|off|nao|não)$/i.test(String(bruto.enabled))) config.enabled = false;
  else if (/^(1|true|on|sim)$/i.test(String(bruto.enabled))) config.enabled = true;
  else erros.push(`enabled inválido (${bruto.enabled}): usando ${config.enabled}`);

  for (const [k, { min, max }] of Object.entries(LIMITES)) {
    const n = Number(bruto[k]);
    if (Number.isFinite(n) && n >= min && n <= max) config[k] = k === 'intervalMinutes' ? n : Math.floor(n);
    else erros.push(`${k} inválido (${bruto[k]}): precisa estar entre ${min} e ${max}; usando ${config[k]}`);
  }
  // O aviso precisa caber dentro do ciclo, com folga para o ciclo existir.
  if (config.warningSeconds >= config.intervalMinutes * 60) {
    erros.push(`warningSeconds (${config.warningSeconds}) não cabe em intervalMinutes (${config.intervalMinutes}): usando o padrão dos dois`);
    config.warningSeconds = groundCleanupConfig.warningSeconds;
    config.intervalMinutes = groundCleanupConfig.intervalMinutes;
  }
  return { config, erros };
}
