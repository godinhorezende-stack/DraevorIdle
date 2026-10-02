// O MOTOR ÚNICO de modificadores de atributo (flat / increased / more) — puro: sem estado, sem sorteio, sem I/O.
//
// Um modificador é `{ id, tipo, valor, escopo, fonte, condicao?, alvo?, ate? }`:
//   tipo   'flat' (soma no valor) | 'increased' (% ADITIVA, negativa = reduced) | 'more' (% MULTIPLICATIVA independente, negativa = less)
//   escopo 'local' (só a peça/fonte dona) | 'global' (o atributo todo)
//   condicao (ctx) => boolean — só entra se verdadeira (buff ativo, "enquanto cheio de vida"…)
//   alvo   tag de habilidade/dano a que vale (ex.: 'projectile'); sem `alvo` vale sempre; com `alvo`, só se `ctx.tags` o tiver
//   ate    relógio de expiração (ms) — passa do relógio de `ctx.agora`, o modificador sai (buff que acabou)
//
// A conta (a de sempre do PoE, a que o Draevor já usava solta em ficha.mjs e mobs/atributos.mjs):
//   1. flat LOCAL → increased LOCAL → more LOCAL   (a peça sozinha: o dano da arma, a armadura da peça)
//   2. + flat GLOBAL                               (soma dos locais já prontos + os planos globais)
//   3. × (1 + Σ increased global − Σ reduced)      (UMA soma só: dois "+20%" e "+30%" valem +50%)
//   4. × Π (1 + more/100)                          (cada more é um fator independente: 30% e 20% → 1,30 × 1,20 = 1,56)
//   5. limite e arredondamento do atributo (`{ min, max, arredondar }`).
// O `fator`/`base` do atributo (curva, classe, espécie) entra como `base` ou como `more` de quem chama.
// Devolve o `valor` e as `partes` (o detalhamento que a ficha e o editor mostram) — a conta e a tela são a mesma.

export const TIPOS = ['flat', 'increased', 'more'];
export const ESCOPOS = ['local', 'global'];

/** O modificador vale agora? (condição, validade e alvo) */
export function vale(m, ctx = {}) {
  if (!m || !Number.isFinite(Number(m.valor))) return false;
  if (m.ate != null && ctx.agora != null && ctx.agora >= m.ate) return false;
  if (m.alvo && !(ctx.tags ?? []).includes(m.alvo)) return false;
  if (typeof m.condicao === 'function' && !m.condicao(ctx)) return false;
  return true;
}

const soma = (lista, tipo, escopo) => lista.reduce((n, m) => (m.tipo === tipo && (m.escopo ?? 'global') === escopo ? n + Number(m.valor) : n), 0);
const produtoDosMore = (lista, escopo) => lista.reduce((n, m) => (m.tipo === 'more' && (m.escopo ?? 'global') === escopo ? n * (1 + Number(m.valor) / 100) : n), 1);

/** `n` arredondado em `casas` casas (0 = inteiro). */
export const arredondar = (n, casas = 0) => { const f = 10 ** casas; return Math.round(n * f) / f; };

/**
 * Calcula UM atributo. `base`: o valor antes dos modificadores; `mods`: a lista; `ctx`: `{ agora, tags, … }` das condições;
 * `limite`: `{ min, max, casas }`. Retorna `{ valor, bruto, excedente, partes }` — `bruto` é antes do limite, `excedente` o que o limite cortou.
 */
export function calcular(base, mods = [], ctx = {}, limite = {}) {
  const ativos = mods.filter((m) => vale(m, ctx));
  const partes = [{ fonte: 'Base', tipo: 'base', valor: base }];
  // 1. Local: a peça sozinha.
  let v = (base + soma(ativos, 'flat', 'local')) * Math.max(0, 1 + soma(ativos, 'increased', 'local') / 100) * produtoDosMore(ativos, 'local');
  // 2–4. Global: planos, aumentos somados, mores independentes.
  const flatG = soma(ativos, 'flat', 'global');
  const incG = soma(ativos, 'increased', 'global');
  v = (v + flatG) * Math.max(0, 1 + incG / 100) * produtoDosMore(ativos, 'global'); // reduced demais zera, nunca inverte o sinal
  for (const m of ativos) partes.push({ fonte: m.fonte ?? m.id ?? '?', tipo: m.tipo, escopo: m.escopo ?? 'global', valor: Number(m.valor) });
  // 5. Limite e arredondamento.
  const min = limite.min ?? -Infinity;
  const max = limite.max ?? Infinity;
  const bruto = Number.isFinite(v) ? v : 0;
  const limitado = Math.max(min, Math.min(max, bruto));
  return { valor: arredondar(limitado, limite.casas ?? 0), bruto, excedente: Math.max(0, bruto - limitado), partes };
}

/** O mesmo que `calcular`, devolvendo só o número (os laços quentes: sem montar a lista de partes). */
export function valorDe(base, mods = [], ctx = {}, limite = {}) {
  return calcular(base, mods, ctx, limite).valor;
}

/** Tira da lista os modificadores de uma fonte (peça desequipada, buff que acabou, passiva desligada). Não muda a lista original. */
export const semFonte = (mods, fonte) => mods.filter((m) => m.fonte !== fonte);

/** Conveniência para as contas de sempre: `(base + fixos) × (1 + pct/100)`, com `more` opcionais (fatores %). */
export function simples(base, { fixos = 0, pct = 0, mores = [] } = {}, limite = {}) {
  const mods = [];
  if (fixos) mods.push({ tipo: 'flat', valor: fixos, fonte: 'Fixo' });
  if (pct) mods.push({ tipo: 'increased', valor: pct, fonte: 'Aumentos' });
  for (const m of mores) mods.push({ tipo: 'more', valor: m, fonte: 'More' });
  return calcular(base, mods, {}, limite);
}
