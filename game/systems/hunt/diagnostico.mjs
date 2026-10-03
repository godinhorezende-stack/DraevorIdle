// O DIAGNÓSTICO do movimento (dono, 03/10): por que o personagem parou, quantas vezes o kite decidiu e o que cada decisão custou. Desligado por padrão (custa um `if`);
// liga com `MOV_DIAG=1` no ambiente. Os contadores ficam em `hunt.diag` (não vão para o banco: a propriedade não é enumerável) e saem em `resumo(hunt)`.
export const ligado = process.env.MOV_DIAG === '1';

const diag = (hunt) => {
  if (!hunt.diag) Object.defineProperty(hunt, 'diag', { value: { motivos: {}, tempoMs: {}, chamadas: {} }, enumerable: false, writable: true, configurable: true });
  return hunt.diag;
};

/** Conta uma decisão (ex.: `kite:recuo-1-casa`, `kite:desistiu-sem-ganho`, `kite:deslize-sem-saida`). */
export function contar(hunt, motivo) {
  if (!ligado) return;
  const d = diag(hunt);
  d.motivos[motivo] = (d.motivos[motivo] ?? 0) + 1;
}

/** Mede o tempo de uma função (a BFS, o recuo): `medir(hunt, 'recuoPlanejado', () => ...)`. */
export function medir(hunt, nome, fn) {
  if (!ligado) return fn();
  const t0 = process.hrtime.bigint();
  try {
    return fn();
  } finally {
    const d = diag(hunt);
    d.tempoMs[nome] = (d.tempoMs[nome] ?? 0) + Number(process.hrtime.bigint() - t0) / 1e6;
    d.chamadas[nome] = (d.chamadas[nome] ?? 0) + 1;
  }
}

/** Os contadores e os tempos médios, para a ferramenta e os testes. */
export function resumo(hunt) {
  const d = hunt?.diag;
  if (!d) return { motivos: {}, tempos: {} };
  return { motivos: { ...d.motivos }, tempos: Object.fromEntries(Object.keys(d.chamadas).map((n) => [n, { chamadas: d.chamadas[n], totalMs: +d.tempoMs[n].toFixed(3), mediaMs: +(d.tempoMs[n] / d.chamadas[n]).toFixed(4) }])) };
}
