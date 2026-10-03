// A configuração do SERVER SAVE diário (`server-save.mjs`), num lugar só. Mesmo padrão da limpeza do chão:
// valor padrão + variável de ambiente (`SERVER_SAVE_*`); valor inválido volta ao padrão e o erro vai para o log.

export const SERVER_SAVE = Object.freeze({
  enabled: true,
  intervalHours: 24, // múltiplo de 24: o save é diário, em horário de relógio (não "24 h depois do boot")
  timezone: 'America/Sao_Paulo',
  horaLocal: '05:00', // HH:MM no fuso acima — hora de pouco movimento
  warningsMinutes: Object.freeze([5, 1]),
  maintenanceMode: false, // `modo-de-manutencao.mjs`: bloqueia ENTRADAS novas. Nunca é ligado pelo save diário.
  batchSize: 100, // quantos personagens por lote na gravação e na verificação (cedendo o laço entre lotes)
});

/**
 * As garantias do offline farm NÃO são opções: valem sempre, em código (`server-save.mjs` nunca
 * escreve em `hunt`, `xp`, loot nem recompensas — só nas colunas-índice derivadas, quando divergem do JSON).
 * Ficam aqui só como documentação executável, e os testes conferem uma por uma.
 */
export const GARANTIAS_DO_OFFLINE_FARM = Object.freeze([
  'nunca cancela, reinicia ou encurta uma caçada offline',
  'nunca altera offlineDesde, ausencia, xp, loot nem recompensas pendentes',
  'a única escrita em personagem ausente é a das colunas-índice derivadas do JSON, condicionada ao estado lido',
  'nunca apaga recompensas pendentes nem registros de idempotência',
]);

export const MENSAGENS = Object.freeze({
  aviso5: '[SERVER SAVE] O salvamento diário do servidor acontecerá em 5 minutos. Seu offline farm será preservado.',
  aviso1: '[SERVER SAVE] O Server Save começará em 1 minuto. Seu progresso de offline farm será preservado.',
  inicio: '[SERVER SAVE] Iniciando rotina de salvamento do mundo.',
  concluido: '[SERVER SAVE] Salvamento concluído com sucesso!',
  falha: '[SERVER SAVE] Ocorreu uma falha durante o salvamento. O servidor continuará funcionando enquanto a situação é verificada.',
});

/** A mensagem de aviso para `min` minutos antes (só 5 e 1 têm texto próprio). */
export const mensagemDoAviso = (min) => (min === 1 ? MENSAGENS.aviso1 : min === 5 ? MENSAGENS.aviso5 : `[SERVER SAVE] O salvamento diário do servidor acontecerá em ${min} minutos. Seu offline farm será preservado.`);

const TIMEZONES_OK = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export function validarConfig(sobrescritas = {}, env = process.env) {
  const erros = [];
  const bruto = { ...SERVER_SAVE };
  const doEnv = { enabled: env.SERVER_SAVE_ENABLED, intervalHours: env.SERVER_SAVE_INTERVAL_HOURS, timezone: env.SERVER_SAVE_TIMEZONE, horaLocal: env.SERVER_SAVE_HORA, maintenanceMode: env.MAINTENANCE_MODE, batchSize: env.SERVER_SAVE_BATCH_SIZE };
  for (const [k, v] of Object.entries(doEnv)) if (v !== undefined && v !== '') bruto[k] = v;
  Object.assign(bruto, sobrescritas);
  const config = { ...SERVER_SAVE, warningsMinutes: [...SERVER_SAVE.warningsMinutes] };

  const bool = (nome) => {
    if (typeof bruto[nome] === 'boolean') config[nome] = bruto[nome];
    else if (/^(0|false|off|nao|não)$/i.test(String(bruto[nome]))) config[nome] = false;
    else if (/^(1|true|on|sim)$/i.test(String(bruto[nome]))) config[nome] = true;
    else erros.push(`${nome} inválido (${bruto[nome]}): usando ${config[nome]}`);
  };
  bool('enabled');
  bool('maintenanceMode');

  const horas = Number(bruto.intervalHours);
  if (Number.isInteger(horas) && horas >= 24 && horas % 24 === 0 && horas <= 24 * 30) config.intervalHours = horas;
  else erros.push(`intervalHours inválido (${bruto.intervalHours}): precisa ser múltiplo de 24; usando ${config.intervalHours}`);

  if (typeof bruto.timezone === 'string' && TIMEZONES_OK(bruto.timezone)) config.timezone = bruto.timezone;
  else erros.push(`timezone inválido (${bruto.timezone}): usando ${config.timezone}`);

  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(bruto.horaLocal));
  if (m) config.horaLocal = `${m[1].padStart(2, '0')}:${m[2]}`;
  else erros.push(`horaLocal inválida (${bruto.horaLocal}): use HH:MM; usando ${config.horaLocal}`);

  if (Array.isArray(bruto.warningsMinutes) && bruto.warningsMinutes.every((n) => Number.isInteger(n) && n >= 1 && n < 24 * 60)) config.warningsMinutes = [...new Set(bruto.warningsMinutes)].sort((a, b) => b - a);
  else erros.push(`warningsMinutes inválido: usando ${config.warningsMinutes}`);

  const lote = Number(bruto.batchSize);
  if (Number.isInteger(lote) && lote >= 1 && lote <= 5000) config.batchSize = lote;
  else erros.push(`batchSize inválido (${bruto.batchSize}): usando ${config.batchSize}`);
  return { config, erros };
}
