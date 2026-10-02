// Os ATRIBUTOS FINAIS dos monstros (dono, 02/10) — precisão, evasão, armadura, bloqueio e redução de dano, e o detalhamento (a origem de
// cada parcela) de todos os atributos do bicho: vida, dano, velocidade, resistências.
//
// Config em `gamedata/mobs/atributos.json`. NÃO é um segundo motor: vida, dano e resistência seguem entrando nos mesmos campos de sempre
// (`maxHp`, `forca`, `resist` — escala da fase em `campanha.mjs`, raridade em `mobs/raridade.mjs`); aqui ficam as CURVAS dos atributos que
// antes eram constantes soltas (precisão e evasão do bicho) ou não valiam (armadura, bloqueio) e a conta que junta tudo:
//   final = (base × fator da curva × fator da faixa × fator da classe × fator da espécie + fixos) × (1 + aumentos − reduções) × more
// Os valores padrão reproduzem os de hoje. O resultado de um atributo é guardado por instância enquanto nada que o muda mudar.
import { BESTIARY } from '../hunt/monstros.mjs';
import { CONFIG as RARIDADES } from './raridade.mjs';

import { CONFIG, daCurva } from './curvas.mjs';

export { CONFIG, daCurva };
const L = CONFIG.limites;

const limitar = (v, max) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));

/** O fator da faixa de level para um atributo. */
function fatorDaFaixa(atributo, level) {
  const lista = CONFIG.faixas.lista;
  const faixa = lista.find((f) => level <= f.ate) ?? lista[lista.length - 1];
  return faixa?.fatores?.[atributo] ?? 1;
}
const fatorDaClasse = (atributo, m) => CONFIG.porClasse.fatores?.[BESTIARY[m?.key]?.class]?.[atributo] ?? 1;
const especieDe = (m) => CONFIG.porEspecie.especies?.[m?.key] ?? null;
const fatorDaEspecie = (atributo, m) => especieDe(m)?.fatores?.[atributo] ?? 1;

/** O atributo na sua forma completa, com as parcelas. `base`: o valor antes dos fatores; `pct`: aumentos − reduções em %. */
function compor(atributo, base, level, m, { pct = 0, fixos = 0 } = {}) {
  const fator = fatorDaFaixa(atributo, level) * fatorDaClasse(atributo, m) * fatorDaEspecie(atributo, m);
  const fixo = fixos + (especieDe(m)?.fixos?.[atributo] ?? 0);
  const valor = limitar((base * fator + fixo) * (1 + pct / 100), L.atributoMaximo);
  const origens = [{ fonte: 'Base', valor: Math.round(base * 100) / 100 }];
  if (fator !== 1) origens.push({ fonte: 'Fator da faixa, classe e espécie', fator: Math.round(fator * 1000) / 1000 });
  if (fixo) origens.push({ fonte: 'Fixo', valor: fixo });
  if (pct) origens.push({ fonte: 'Aumentos/reduções (modificadores)', pct });
  return { valor, origens };
}

// ---------------------------------------------------------------- precisão, evasão, armadura

/** A precisão do bicho (o rating com que ele acerta o jogador) neste level. */
export const precisaoDe = (m, level) => compor('precisao', daCurva('precisao', level), level, m, { pct: m?.precisaoPct ?? 0 }).valor;
/** A evasão do bicho (o rating com que ele evita o golpe do jogador) neste level. */
export const evasaoDe = (m, level) => compor('evasao', daCurva('evasao', level), level, m, { pct: m?.evasaoPct ?? 0 }).valor;

/** A armadura do bicho: a do bestiário (`armor`), a curva, os fatores e os modificadores (`armaduraPct`). Sem `key` no bestiário, zero. */
export function armaduraDe(m, level) {
  const base = (BESTIARY[m?.key]?.armor ?? 0) + daCurva('armadura', level);
  return Math.min(L.armaduraMaxima, compor('armadura', base, level, m, { pct: m?.armaduraPct ?? 0 }).valor);
}

/** O bloqueio do bicho (0–1): só quem for configurado (espécie ou modificador). */
export const bloqueioDe = (m) => limitar(((especieDe(m)?.bloqueio ?? 0) + (m?.bloqueio ?? 0)), L.bloqueioMaximo) / 100;
/** A redução de dano do bicho (0–1), separada da armadura e da resistência. */
export const reducaoDeDano = (m) => limitar(((especieDe(m)?.reducaoDeDano ?? 0) + (m?.reducaoDeDano ?? 0)), L.reducaoDeDanoMaxima) / 100;

/** O bicho bloqueou este golpe? (`rng` para o teste.) */
export const bloqueou = (m, rng = Math.random) => {
  const b = bloqueioDe(m);
  return b > 0 && rng() < b;
};

/**
 * A fração do golpe físico que a ARMADURA do bicho corta (0–1): armadura / (armadura + coeficiente × dano do golpe). Zero com a armadura
 * desligada na config, sem armadura ou sem dano.
 */
export function reducaoDeArmadura(m, level, danoDoGolpe, coeficiente) {
  if (!CONFIG.armaduraDoMob.ativa || !(danoDoGolpe > 0)) return 0;
  const a = armaduraDe(m, level);
  return a > 0 ? a / (a + coeficiente * danoDoGolpe) : 0;
}

// ---------------------------------------------------------------- o detalhamento (origem de cada atributo)

const guardados = new WeakMap();
const chaveDe = (m, level) => `${level}|${m.maxHp}|${m.forca}|${m.levelExtra ?? 0}|${m.raridade ?? ''}|${(m.mods ?? []).join(',')}|${m.precisaoPct ?? 0}|${m.evasaoPct ?? 0}|${m.armaduraPct ?? 0}`;

/**
 * Todos os atributos finais do bicho com a ORIGEM de cada um, para o editor e o bestiário: `{ vida, dano, precisao, evasao, armadura,
 * bloqueio, reducaoDeDano, velocidadeDeAtaque, resistencias, level }`. `level`: o do bicho nesta caçada. Guardado por instância e refeito
 * só quando algo que o muda mudou (vida, força, raridade, modificadores, level).
 */
export function atributosFinais(m, level) {
  const chave = chaveDe(m, level);
  const g = guardados.get(m);
  if (g?.chave === chave) return g.valor;
  const esp = BESTIARY[m?.key] ?? {};
  const raridade = RARIDADES.raridades[m.raridade ?? 'normal'] ?? RARIDADES.raridades.normal;
  const valor = {
    level,
    vida: { valor: m.maxHp ?? esp.hp ?? 0, origens: [{ fonte: 'Base da espécie', valor: esp.hp ?? 0 }, { fonte: 'Escala da fase e raridade', fator: esp.hp ? Math.round(((m.maxHp ?? esp.hp) / esp.hp) * 1000) / 1000 : 1, raridade: m.raridade ?? 'normal', fatorDaRaridade: raridade.vida }] },
    dano: { valor: m.forca ?? 1, origens: [{ fonte: 'Multiplicador de dano (escala da fase × raridade × modificadores)', fator: m.forca ?? 1, fatorDaRaridade: raridade.dano }] },
    precisao: compor('precisao', daCurva('precisao', level), level, m, { pct: m.precisaoPct ?? 0 }),
    evasao: compor('evasao', daCurva('evasao', level), level, m, { pct: m.evasaoPct ?? 0 }),
    armadura: compor('armadura', (esp.armor ?? 0) + daCurva('armadura', level), level, m, { pct: m.armaduraPct ?? 0 }),
    bloqueio: bloqueioDe(m),
    reducaoDeDano: reducaoDeDano(m),
    velocidadeDeAtaque: m.velocidadeDeAtaque ?? 1,
    resistencias: { ...(esp.elements ?? {}) },
  };
  guardados.set(m, { chave, valor });
  return valor;
}

// ---------------------------------------------------------------- o ATAQUE do mob: velocidade, crítico, dano de vários tipos, efeitos

const A = CONFIG.ataque;

/** A velocidade de ataque final do mob (1 = normal): a do modificador × os buffs, no intervalo configurado. */
export const velocidadeDeAtaque = (m, buffPct = 0) => Math.max(A.velocidadeMinima, Math.min(A.velocidadeMaxima, (m?.velocidadeDeAtaque ?? 1) * (1 + (buffPct || 0) / 100)));

/** O intervalo (ms) até o próximo golpe do mob: `base` (o do boss ou o padrão) × a lentidão ÷ a velocidade, nunca abaixo do mínimo. */
export function intervaloDoGolpe(m, { base = A.intervaloBaseMs, lentidao = 1, buffPct = 0 } = {}) {
  return Math.max(A.intervaloMinimoMs, Math.round((base * lentidao) / velocidadeDeAtaque(m, buffPct)));
}

/**
 * O crítico do mob neste ataque: `{ chance (0–1), fator }`. A chance soma a da espécie (ou do ataque) e a do modificador; sem nenhuma, 0
 * (nenhum mob tem crítico por padrão). O fator vem do ataque, da espécie ou do modificador, ou do padrão.
 */
export function critico(m, ataque = null) {
  const e = especieDe(m) ?? {};
  const chance = limitar((ataque?.critChance ?? e.critChance ?? 0) + (m?.critChance ?? 0), CONFIG.critico.chanceMaxima) / 100;
  const pct = ataque?.critMultiplicador ?? e.critMultiplicador ?? (m?.critMultiplicador ? CONFIG.critico.multiplicadorPadraoPct + m.critMultiplicador : CONFIG.critico.multiplicadorPadraoPct);
  return { chance, fator: Math.max(1, pct / 100) };
}

/** Rola o crítico UMA vez: `{ critico, fator }` (fator 1 quando não critica). */
export function rolarCritico(m, ataque = null, rng = Math.random) {
  const c = critico(m, ataque);
  return c.chance > 0 && rng() < c.chance ? { critico: true, fator: c.fator } : { critico: false, fator: 1 };
}

/** O dano de OUTROS tipos que o golpe corpo a corpo da espécie traz (`danoExtra`), normalizado: `[{ elemento, min, max }]`. */
export function danoExtraDoGolpe(m, ataque = null) {
  const lista = [...(especieDe(m)?.danoExtra ?? []), ...(ataque?.extras ?? [])];
  return lista.filter((x) => x?.elemento && Math.max(x.min ?? 0, x.max ?? 0) > 0).map((x) => ({ elemento: x.elemento, min: Math.max(0, Math.min(x.min ?? 0, x.max ?? 0)), max: Math.max(0, x.min ?? 0, x.max ?? 0) }));
}

/** Os efeitos de dano contínuo que o golpe do mob põe no jogador: `[{ tipo, chance, pctDoGolpe, duracaoMs? }]` (espécie + ataque). */
export const efeitosDoGolpe = (m, ataque = null) => [...(especieDe(m)?.efeitos ?? []), ...(ataque?.efeitos ?? [])].filter((x) => x?.tipo && x.pctDoGolpe > 0);
