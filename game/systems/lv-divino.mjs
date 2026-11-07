// O LV DIVINO (o dono, 07/11/2026: "Lv Divino depois no LV 100") — a experiência continua depois do level máximo do PoE e sobe o Lv
// Divino: cada um dá +1 ponto de passiva (`passivas/arvore.pontos`). O primeiro pede a exp do último level (99 → 100) e cada um
// seguinte 10% a mais (o dono: "Cresce 10% por nível").
//
// Não há estado próprio: o Lv Divino sai da exp total (`estado.xp`) acima do começo do level máximo — a exp passada do 100 já
// estava guardada, e a morte (`morte.mjs`) nunca tira um Lv Divino, como não tira um level.
import * as R from './regras.mjs';

export const CRESCIMENTO = 1.1;

/** A exp do 1º Lv Divino (a do último level da curva), ou 0 sem level máximo (fora do PoE). */
export function expDoPrimeiro() {
  const max = R.levelMaximo();
  if (!Number.isFinite(max)) return 0;
  return R.expForLevel(max) - R.expForLevel(max - 1);
}

/** A exp que o Lv Divino `n` (1, 2, …) pede. */
export const expDoNivel = (n) => Math.round(expDoPrimeiro() * CRESCIMENTO ** (n - 1));

/** A exp total no começo do Lv Divino `n` (0 = o começo do level máximo). */
export function expNoComeco(n) {
  let total = R.expForLevel(R.levelMaximo());
  for (let i = 1; i <= n; i++) total += expDoNivel(i);
  return total;
}

/** `{ nivel, atual, necessario, percent }` do personagem; nivel 0 e percent 0 antes do level máximo. */
export function divino(estado) {
  const max = R.levelMaximo();
  const primeiro = expDoPrimeiro();
  if (!(primeiro > 0) || (estado?.level ?? 1) < max) return { nivel: 0, atual: 0, necessario: primeiro, percent: 0, liberado: false };
  let sobra = Math.max(0, (estado.xp ?? 0) - R.expForLevel(max));
  let nivel = 0;
  // (a conta para cedo: 10% a mais por nível — 200 níveis já pedem ~1,9 bilhão de vezes o primeiro)
  while (nivel < 10_000 && sobra >= expDoNivel(nivel + 1)) {
    sobra -= expDoNivel(nivel + 1);
    nivel++;
  }
  const necessario = expDoNivel(nivel + 1);
  return { nivel, atual: sobra, necessario, percent: Math.max(0, Math.min(1, sobra / Math.max(1, necessario))), liberado: true };
}

/** O Lv Divino do personagem (0 antes do level máximo). */
export const nivel = (estado) => divino(estado).nivel;

/** A exp do piso que a morte não passa: o começo do Lv Divino atual (no level máximo) — antes dele, o do level. */
export function pisoDaExp(estado) {
  const L = estado?.level ?? 1;
  if (!(expDoPrimeiro() > 0) || L < R.levelMaximo()) return R.expForLevel(L);
  return expNoComeco(nivel(estado));
}
