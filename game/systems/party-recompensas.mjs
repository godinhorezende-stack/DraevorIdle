// As REGRAS DE RECOMPENSA da party, em funções puras (sem estado do jogo): quanto de XP, quem leva o item e como o ouro se divide.
// Quem aplica é `hunt/combate.mjs` (`matarMonstro`, `soltarDrops`); o desenho das regras e as simulações estão em `docs/party.md`
// e `tools/simular-party.mjs`.
//
//  - XP: peso de cada integrante = nível ^ k (k = `expoenteDeXp`, 1,5 como no Path of Exile 1; `PARTY_XP_EXPOENTE` no ambiente).
//    A fatia de cada um é o peso dele sobre a soma dos pesos. Dois jogadores do mesmo nível ficam com partes iguais; sem
//    limite de diferença de nível.
//  - ITEM: sorteio uniforme (sem peso por nível, dano, distância ou setor) entre quem PODE levar; um dono só, com id de drop.
//  - OURO: partes iguais; o resto (0 a n−1 unidades) é distribuído um a um, começando por quem não recebeu o resto da vez
//    anterior (`vezDoResto`), para ninguém ser favorecido por vários eventos seguidos.
//  - Auditoria: cada item sorteado vira um registro (`auditoria`, anel de 500) — de onde veio, quem concorria, quem levou.
export const PARTY_RECOMPENSAS = Object.freeze({ expoenteDeXp: 1.5, auditoriaMaxima: 500 });

/** O expoente em vigor (variável de ambiente validada: entre 0,5 e 3; inválido volta ao padrão). */
export function expoenteDeXp(env = process.env) {
  const n = Number(env.PARTY_XP_EXPOENTE);
  return Number.isFinite(n) && n >= 0.5 && n <= 3 ? n : PARTY_RECOMPENSAS.expoenteDeXp;
}

export const pesoDeXp = (level, k = expoenteDeXp()) => Math.max(1, Number(level) || 1) ** k;

/** As fatias (somam 1) de cada nível da lista. */
export function partesDeXp(niveis, k = expoenteDeXp()) {
  if (!niveis.length) return [];
  const pesos = niveis.map((l) => pesoDeXp(l, k));
  const soma = pesos.reduce((a, b) => a + b, 0);
  return pesos.map((p) => p / soma);
}

/** `total` inteiro em `n` partes: quem está a partir de `inicio` (circular) leva a unidade extra do resto. A soma é sempre `total`. */
export function dividirOuro(total, n, inicio = 0) {
  total = Math.max(0, Math.floor(total));
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (((i - inicio) % n + n) % n < resto ? 1 : 0));
}
/** Quem começa o resto do PRÓXIMO evento: logo depois de quem recebeu a última unidade. */
export const proximoInicioDoResto = (total, n, inicio = 0) => (n > 0 ? (inicio + (Math.floor(total) % n)) % n : 0);

/** Sorteio uniforme entre os candidatos (`null` se não há). */
export function sortearDono(candidatos, rng = Math.random) {
  if (!candidatos.length) return null;
  return candidatos[Math.min(candidatos.length - 1, Math.floor(rng() * candidatos.length))];
}

// ---- auditoria dos sorteios (memória do processo; só para conferência e diagnóstico) ----
const anel = [];
let sequencia = 0;
export const novoIdDeDrop = () => `d${Date.now().toString(36)}-${(sequencia++).toString(36)}`;
export function registrarSorteio(registro) {
  anel.push({ em: Date.now(), ...registro });
  if (anel.length > PARTY_RECOMPENSAS.auditoriaMaxima) anel.shift();
  return registro;
}
export const auditoria = () => [...anel];
export const limparAuditoria = () => void (anel.length = 0);
