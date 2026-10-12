// As ESTIMATIVAS da Forja do PoE: a chance da próxima tentativa, a média de tentativas e a chance de chegar com o material que o jogador
// tem — calculadas com OS MESMOS pesos e passos do sorteio (`itens-poe/sockets.mjs`: `sortearNumero`, `sortearLinks`,
// `sortearOutrasCores`; as Corroídas de `itens-poe/moedas.mjs`; a Chance com `regras.moedas.chance`). Não é garantia: é a conta exata da
// regra do jogo. Onde a conta não fecha (os modificadores: pool, pesos, vagas e regras da base), a Forja NÃO mostra estimativa.
import * as SocketsPoe from './sockets.mjs';
import { gruposLigados } from '../../engine/sockets-de-gema.mjs';

/** Quantas tentativas no máximo a conta "com o que você tem" percorre. */
export const TENTATIVAS_NA_CONTA = 2000;
const fatorDaQualidade = (q) => 1 + Math.max(0, Math.min(30, Number(q) || 0)) / 100;

/** Resolve `A·x = b` (Gauss com pivô parcial; os sistemas daqui têm no máximo 28 incógnitas). */
function resolver(A, b) {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-15) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let i = 0; i < n; i++) {
      if (i === c || !M[i][c]) continue;
      const f = M[i][c] / M[c][c];
      for (let k = c; k <= n; k++) M[i][k] -= f * M[c][k];
    }
  }
  return M.map((linha, i) => linha[n] / linha[i]);
}

/**
 * Uma CADEIA (o resultado de cada tentativa depende de onde a peça está): `estados` (as chaves que ainda não chegaram), `passo(e)` →
 * `[[proximo, prob], …]` (proximo `null` = chegou), `inicio` (o de agora; pode não estar em `estados`). `{ chance, media, comOQueTem }`.
 * As transições são montadas UMA vez (vetores), e a conta "com o que você tem" anda o vetor de probabilidades — o servidor do jogo não pode
 * gastar mais que uns milissegundos nisto.
 */
function cadeia({ estados, passo, inicio, tem }) {
  const chaves = estados.includes(inicio) ? estados : [...estados, inicio];
  const idx = new Map(chaves.map((e, i) => [e, i]));
  const vivos = new Set(estados);
  // Cada estado: os destinos (índice; −1 = chegou) e as probabilidades.
  const destinos = [];
  const probs = [];
  for (const e of chaves) {
    const lista = passo(e);
    destinos.push(Int32Array.from(lista, ([f]) => (f != null && vivos.has(f) ? idx.get(f) : -1)));
    probs.push(Float64Array.from(lista, ([, p]) => p));
  }
  const i0 = idx.get(inicio);
  let chance = 0;
  for (let k = 0; k < destinos[i0].length; k++) if (destinos[i0][k] < 0) chance += probs[i0][k];
  // A média: E[e] = 1 + Σ P(e→f)·E[f], f entre os que ainda não chegaram.
  const n = estados.length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let i = 0; i < n; i++) for (let k = 0; k < destinos[i].length; k++) if (destinos[i][k] >= 0 && destinos[i][k] < n) A[i][destinos[i][k]] -= probs[i][k];
  const E = n ? resolver(A, Array(n).fill(1)) : [];
  let media = null;
  if (E) {
    media = 1;
    for (let k = 0; k < destinos[i0].length; k++) if (destinos[i0][k] >= 0) media += probs[i0][k] * (destinos[i0][k] < n ? E[destinos[i0][k]] : 0);
    if (i0 < n) media = E[i0];
  }
  let comOQueTem = null;
  if (tem > 0) {
    let dist = new Float64Array(chaves.length);
    let prox = new Float64Array(chaves.length);
    dist[i0] = 1;
    let chegou = 0;
    for (let t = 0; t < Math.min(tem, TENTATIVAS_NA_CONTA); t++) {
      prox.fill(0);
      let resta = 0;
      for (let i = 0; i < chaves.length; i++) {
        const pe = dist[i];
        if (!pe) continue;
        const d = destinos[i];
        const p = probs[i];
        for (let k = 0; k < d.length; k++) {
          if (d[k] < 0) chegou += pe * p[k];
          else {
            prox[d[k]] += pe * p[k];
            resta += pe * p[k];
          }
        }
      }
      [dist, prox] = [prox, dist];
      if (resta < 1e-15) break;
    }
    comOQueTem = Math.min(1, chegou);
  }
  return { chance, media: Number.isFinite(media) ? media : null, comOQueTem };
}
/** Tentativas independentes com a mesma chance `p`. */
const independente = (p, tem) => ({
  chance: p, media: p > 0 ? 1 / p : null,
  comOQueTem: tem > 0 ? 1 - (1 - p) ** Math.min(tem, TENTATIVAS_NA_CONTA) : null,
});

// ---------------------------------------------------------------- SOCKETS
/** O Joalheiro (`sortearNumero`): de `abertos` até pelo menos `alvo` sockets (de `max`), com a qualidade da peça. */
export function joalheiro({ abertos, max, alvo, qualidade = 0, tem = 0 }) {
  const fq = fatorDaQualidade(qualidade);
  const pesos = Object.entries(SocketsPoe.orbes().joalheiro?.pesoPorNumero ?? {}).map(([n, p]) => [Number(n), Number(p)]);
  const passo = (a) => {
    const lista = pesos.map(([n, p]) => [n, p * (n > a ? fq : 1)]).filter(([n, p]) => n >= 1 && n <= max && n !== a && p > 0);
    const total = lista.reduce((t, [, p]) => t + p, 0);
    return total > 0 ? lista.map(([n, p]) => [n >= alvo ? null : n, p / total]) : [];
  };
  return cadeia({ estados: Array.from({ length: Math.max(0, alvo - 1) }, (_, i) => i + 1), passo, inicio: abertos, tem });
}
/** O Joalheiro Corroído (`tJoalheiro`): +1 ou −1 (com 0 ou 1 socket sempre sobe; no máximo sempre desce). */
export function joalheiroCorroido({ abertos, max, alvo, tem = 0 }) {
  const passo = (a) => {
    const subir = a < max ? (a <= 1 ? 1 : 0.5) : 0;
    return [[a + 1 >= alvo ? null : a + 1, subir], [a - 1, 1 - subir]].filter(([, p]) => p > 0);
  };
  return cadeia({ estados: Array.from({ length: Math.max(0, alvo) }, (_, i) => i), passo, inicio: abertos, tem });
}

// ---------------------------------------------------------------- LINKS
const maiorGrupo = (abertos, links) => gruposLigados({ abertos, links }).reduce((m, g) => Math.max(m, g.length), 0);
/**
 * A Fusão (`sortearLinks`): um grupo de pelo menos `alvo` sockets ligados em `abertos`. Primeiro a chance de ligar todos; senão cada link
 * com a chance de link (até 20 sorteios que não liguem todos; no vigésimo, todos menos o primeiro). Uma tentativa não depende da outra.
 */
export function fusao({ abertos, alvo, qualidade = 0, tem = 0 }) {
  if (abertos < 2) return independente(0, tem);
  const fq = fatorDaQualidade(qualidade);
  const todos = Math.min(1, Number(SocketsPoe.orbes().fusao?.chanceDeLigarTodos?.[abertos] ?? 0) * fq);
  const c = Math.min(0.95, SocketsPoe.chanceDeLink() * fq);
  const L = abertos - 1;
  const q = c ** L; // um sorteio que liga todos (é refeito)
  let bons = 0;
  for (let mascara = 0; mascara < 2 ** L - 1; mascara++) {
    const links = Array.from({ length: L }, (_, i) => !!(mascara & (1 << i)));
    const n = links.filter(Boolean).length;
    if (maiorGrupo(abertos, links) >= alvo) bons += c ** n * (1 - c) ** (L - n);
  }
  const refeitos = q < 1 ? (1 - q ** 20) / (1 - q) : 20;
  const ultimo = q ** 20 * (maiorGrupo(abertos, Array.from({ length: L }, (_, i) => i > 0)) >= alvo ? 1 : 0);
  return independente(todos + (1 - todos) * (bons * refeitos + ultimo), tem);
}

// ---------------------------------------------------------------- CORES
const fatorial = (n) => (n <= 1 ? 1 : n * fatorial(n - 1));
/** As contagens possíveis `[r, g, b]` com r + g + b = n. */
function contagens(n) {
  const saida = [];
  for (let r = 0; r <= n; r++) for (let g = 0; g + r <= n; g++) saida.push([r, g, n - r - g]);
  return saida;
}
const cumpre = ([r, g, b, w = 0], d) => r >= (d.R || 0) && g >= (d.G || 0) && b >= (d.B || 0) && w >= (d.W || 0);
/**
 * O Cromático (`sortearOutrasCores`): cada socket aberto com o peso da cor pelo requisito da peça, refazendo até 50 vezes a combinação
 * IGUAL à de agora. `atual`: as cores de agora (`['R','G',…]`, só os abertos); `desejo`: `{ R, G, B }` (pelo menos).
 */
export function cromatico({ atual, requisitos = null, desejo, tem = 0 }) {
  const n = atual.length;
  const pesos = SocketsPoe.pesosDeCor(requisitos);
  const soma = pesos.R + pesos.G + pesos.B;
  const p = { R: pesos.R / soma, G: pesos.G / soma, B: pesos.B / soma };
  // A probabilidade de UMA sequência com estas contagens e quantas sequências têm estas contagens.
  const umaSeq = ([r, g, b]) => p.R ** r * p.G ** g * p.B ** b;
  const quantas = ([r, g, b]) => fatorial(n) / (fatorial(r) * fatorial(g) * fatorial(b));
  const todas = contagens(n);
  const chave = (v) => v.join(',');
  const contar = (cores) => ['R', 'G', 'B', 'W'].map((c) => cores.filter((x) => x === c).length);
  const inicio = contar(atual);
  // O estado é a contagem da sequência de agora (a regra "outra combinação" só depende da probabilidade dela, que só depende da contagem).
  const passo = (k) => {
    const u = k.split(',').map(Number);
    const ps = u[3] > 0 ? 0 : umaSeq(u); // com branco a sequência de agora não sai de novo
    const fica = ps ** 50;
    const fator = ps < 1 ? (1 - fica) / (1 - ps) : 0;
    return todas.map((v) => {
      const mesma = chave(v) === chave(u.slice(0, 3)) && !u[3];
      const pr = (quantas(v) - (mesma ? 1 : 0)) * umaSeq(v) * fator + (mesma ? fica : 0);
      return [cumpre(v, desejo) ? null : chave([...v, 0]), pr];
    }).filter(([, pr]) => pr > 0);
  };
  const estados = todas.filter((v) => !cumpre(v, desejo)).map((v) => chave([...v, 0]));
  return cadeia({ estados, passo, inicio: chave(inicio), tem });
}
/** O Cromático Corroído (`tCromatico`): cada socket aberto R, G, B ou W com a mesma chance, sem refazer. Independente. */
export function cromaticoCorroido({ abertos, desejo, tem = 0 }) {
  let bons = 0;
  for (let r = 0; r <= abertos; r++) for (let g = 0; g + r <= abertos; g++) for (let b = 0; b + g + r <= abertos; b++) {
    const w = abertos - r - g - b;
    if (cumpre([r, g, b, w], desejo)) bons += fatorial(abertos) / (fatorial(r) * fatorial(g) * fatorial(b) * fatorial(w)) / 4 ** abertos;
  }
  return independente(bons, tem);
}

// ---------------------------------------------------------------- RARIDADE
/** A Orbe da Chance: Mágica, Rara ou Única pelos pesos (`regras.moedas.chance`); sem único na base, o "Única" sai Mágica. */
export function chance({ pesos, temUnico, desejo, tem = 0, expurgos = null }) {
  const total = Object.values(pesos).reduce((t, x) => t + Number(x), 0) || 1;
  const pr = { magico: (Number(pesos.magico) || 0) / total, raro: (Number(pesos.raro) || 0) / total, unico: temUnico ? (Number(pesos.unico) || 0) / total : 0 };
  if (!temUnico) pr.magico += (Number(pesos.unico) || 0) / total;
  const p = (desejo ?? []).reduce((t, r) => t + (pr[r] ?? 0), 0);
  // Sem o Expurgo para voltar a Normal, é UMA tentativa só (a peça deixa de ser Normal).
  const tentativas = expurgos == null ? Math.min(1, tem) : Math.min(tem, expurgos + 1);
  return { ...independente(p, tentativas), media: expurgos == null ? null : p > 0 ? 1 / p : null, porRaridade: pr };
}
