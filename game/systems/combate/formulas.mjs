// As FÓRMULAS do combate, puras — a conta que o pipeline, o registro e o simulador usam (dono, 02/10).
//
// Nada de estado de caçada nem de sorteio escondido: quem chama passa o `roll`. Os coeficientes vêm de `gamedata/combate/formulas.json`.
// O que está LIGADO ao combate hoje é o modo 'tibia' da armadura e o 'draevor' do acerto; as fórmulas do 'poe' estão aqui, testadas,
// para a etapa em que o dono aprovar a troca (cada uma atrás do seu `modo`).
import { readFileSync } from 'node:fs';

export const PARAMETROS = JSON.parse(readFileSync(new URL('../../gamedata/combate/formulas.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- modificadores (increased/reduced e more/less)

/**
 * O dano com os modificadores: `base × (1 + Σ aumentos − Σ reduções) × Π more × Π less`. Os increased/reduced SOMAM entre si (em %);
 * cada more/less multiplica uma vez (em %: +40 = ×1,4; −20 = ×0,8). Cada modificador: `{ valor, origem?, condicao?, duracao? }`.
 * Devolve o número e as parcelas (a origem de cada uma) para o registro e a ficha.
 */
export function combinarModificadores(base, { aumentos = [], reducoes = [], mais = [], menos = [] } = {}) {
  const soma = (l) => l.reduce((n, m) => n + (Number(m.valor) || 0), 0);
  const aditivo = 1 + (soma(aumentos) - soma(reducoes)) / 100;
  let multiplicativo = 1;
  for (const m of mais) multiplicativo *= 1 + (Number(m.valor) || 0) / 100;
  for (const m of menos) multiplicativo *= 1 - (Number(m.valor) || 0) / 100;
  return { valor: base * Math.max(0, aditivo) * multiplicativo, aditivo: Math.max(0, aditivo), multiplicativo, parcelas: { aumentos, reducoes, mais, menos } };
}

// ---------------------------------------------------------------- crítico

/** O fator do crítico a partir do multiplicador em % (150 → 1,5). */
export const fatorCritico = (multiplicadorPct) => (Number(multiplicadorPct) || 0) / 100;

/** O dano médio esperado com crítico: `dano × (1 + chance × (fator − 1))`. */
export const danoMedioComCritico = (dano, chance, fator) => dano * (1 + Math.max(0, Math.min(1, chance)) * (fator - 1));

// ---------------------------------------------------------------- armadura

/** O modo 'tibia' (o de hoje): quanto a armadura absorve do golpe. `roll` de 0 a 1. */
export function absorcaoPorArmadura(armadura, roll) {
  const t = PARAMETROS.armadura.tibia;
  return Math.floor(armadura * (t.fatorMinimo + roll * t.faixa));
}

/** O modo 'poe': a redução (0–1) do dano FÍSICO de UM golpe: armadura / (armadura + coeficiente × dano). */
export function reducaoDeArmaduraPoe(armadura, danoFisico, coeficiente = PARAMETROS.armadura.poe.coeficiente) {
  if (!(armadura > 0) || !(danoFisico > 0)) return 0;
  return armadura / (armadura + coeficiente * danoFisico);
}

// ---------------------------------------------------------------- acerto e evasão

/** O modo 'poe': a chance de acerto = precisão / (precisão + (evasão / 4)^0,8), entre 5% e 95%. */
export function chanceDeAcertoPoe(precisao, evasao) {
  const p = PARAMETROS.acerto.poe;
  if (!(precisao > 0)) return p.minimo;
  const bruta = precisao / (precisao + Math.pow(Math.max(0, evasao) / p.divisorDaEvasao, p.expoente));
  return Math.min(p.maximo, Math.max(p.minimo, bruta));
}

/**
 * A ENTROPIA do acerto (distribuição pseudo-aleatória, como a do PoE): em vez de sorteios independentes, a chance de acertar cresce a cada
 * erro seguido (`C × (erros + 1)`) e volta ao começo no acerto — a taxa de longo prazo é a `chance`, e as sequências de acertos ou de erros
 * ficam bem mais curtas que as do sorteio puro. `C` sai da chance (`constanteDaEntropia`).
 */
export function constanteDaEntropia(chance) {
  const p = Math.max(0, Math.min(1, Number(chance) || 0));
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // A taxa de acerto de uma constante C: 1 / E[tentativas até acertar]; a bisseção acha o C que dá `p`.
  const taxa = (c) => {
    let sobrevive = 1;
    let esperado = 0;
    for (let n = 1; n <= 10000; n++) {
      const hit = Math.min(1, c * n);
      esperado += n * sobrevive * hit;
      sobrevive *= 1 - hit;
      if (sobrevive < 1e-12) break;
    }
    return 1 / esperado;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (taxa(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Um teste de acerto com entropia: `erros` é quantos erros seguidos o atacante já levou (começa em 0). Devolve `{ acertou, erros }`. */
export function acertoComEntropia(chance, erros, roll) {
  const c = constanteDaEntropia(chance);
  const acertou = roll < Math.min(1, c * ((erros ?? 0) + 1));
  return { acertou, erros: acertou ? 0 : (erros ?? 0) + 1 };
}

// ---------------------------------------------------------------- bloqueio

/** O bloqueio final: o total no teto do tipo ('golpe' ou 'magia'), nunca negativo. */
export function bloqueioFinal(total, tipo = 'golpe', bonusDeLimite = 0) {
  const teto = (tipo === 'magia' ? PARAMETROS.bloqueio.limiteDaMagia : PARAMETROS.bloqueio.limiteDoGolpe) + (bonusDeLimite || 0);
  return Math.max(0, Math.min(teto, Number(total) || 0));
}

// ---------------------------------------------------------------- arredondamento e DPS

/** O arredondamento do dano final (uma vez, no fim). */
export const arredondar = (v) => (PARAMETROS.arredondamento.modo === 'floor' ? Math.floor(v) : Math.round(v));

/** O DPS teórico: dano médio por golpe × golpes por segundo × chance de acerto × (o fator do crítico esperado). */
export const dpsTeorico = (danoMedioPorGolpe, golpesPorSegundo, chanceDeAcerto = 1) => danoMedioPorGolpe * golpesPorSegundo * chanceDeAcerto;
