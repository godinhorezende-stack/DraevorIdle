// O horário do Server Save: "todo dia às HH:MM no fuso X", sem depender de quando o servidor subiu.
// Só `Intl` (sem biblioteca): o fuso entra pela diferença entre o relógio de parede do fuso e o UTC.

/** Quanto o fuso está à frente do UTC no instante `ms` (negativo para o Brasil), em ms. */
function deslocamento(ms, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comoUtc - Math.floor(ms / 1000) * 1000;
}

/** O instante (ms UTC) em que o relógio de parede de `timeZone` marca `ano-mes-dia hora:minuto`. */
function instanteLocal(ano, mes, dia, hora, minuto, timeZone) {
  const chute = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let t = chute - deslocamento(chute, timeZone);
  t = chute - deslocamento(t, timeZone); // 2ª passada: o deslocamento certo é o do instante final (horário de verão)
  return t;
}

const dataLocal = (ms, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day };
};

/** O primeiro horário do save ESTRITAMENTE depois de `depoisDe` (ms), no passo de `dias` dias a partir do dia local seguinte quando já passou. */
export function proximoSlot(depoisDe, { timezone, horaLocal }) {
  const [h, m] = horaLocal.split(':').map(Number);
  const { ano, mes, dia } = dataLocal(depoisDe, timezone);
  for (let i = 0; i <= 2; i++) {
    const d = new Date(Date.UTC(ano, mes - 1, dia + i));
    const t = instanteLocal(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, m, timezone);
    if (t > depoisDe) return t;
  }
  throw new Error('proximoSlot: sem horário');
}
