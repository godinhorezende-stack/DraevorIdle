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
import { simples } from '../combate/modificadores.mjs';
import { reducaoDeArmaduraPoe } from '../combate/formulas.mjs';
import { readFileSync, existsSync } from 'node:fs';
import * as AtributosDoPersonagem from '../personagem/atributos.mjs';

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
  const valor = limitar(simples(base * fator, { fixos: fixo, pct }).bruto, L.atributoMaximo);
  const origens = [{ fonte: 'Base', valor: Math.round(base * 100) / 100 }];
  if (fator !== 1) origens.push({ fonte: 'Fator da faixa, classe e espécie', fator: Math.round(fator * 1000) / 1000 });
  if (fixo) origens.push({ fonte: 'Fixo', valor: fixo });
  if (pct) origens.push({ fonte: 'Aumentos/reduções (modificadores)', pct });
  return { valor, origens };
}

// ---------------------------------------------------------------- precisão, evasão, armadura

// (lote A5d, dono 20/10) O MONSTRO DO PoE (`itens-poe/monstros.mjs`): a evasão e a precisão como no PoE 1 — a tabela do PoE no nível do monstro
// (`data.monsterEvasionTable` / `data.monsterAccuracyTable` do PoB, 1–100) × o multiplicador do TIPO dele (o "Monster Type Multiplier" do
// tooltip do poedb — `gamedata/itens-poe/monstros-defesa-poe.json`, de `tools/importar-defesa-monstros-poe.mjs`); o `evasaoPct` (o Evasivo) e o
// `precisaoPct` por cima. O nível é o efetivo que chega (`Atributos.levelDoBicho`: o do PoE — nos mapas, o do mapa — + o `levelExtra` da raridade).
// Sem a página do poedb: evasão × 1, precisão × a mediana dos importados. A curva do Draevor não vale para eles.
const ARQ_DEFESA_POE = new URL('../../gamedata/itens-poe/monstros-defesa-poe.json', import.meta.url);
export const DEFESA_POE = existsSync(ARQ_DEFESA_POE) ? JSON.parse(readFileSync(ARQ_DEFESA_POE, 'utf8')) : { tabelas: { evasao: [], precisao: [] }, monstros: {}, padrao: { evasao: 1, precisao: 1 } };
const poeDe = (m) => BESTIARY[m?.key]?.poe ?? null;
/** A Base Stat do PoE (`evasao` ou `precisao`) no nível (1–100). */
export const tabelaPoe = (qual, level) => DEFESA_POE.tabelas?.[qual]?.[Math.max(1, Math.min(100, Math.round(Number(level) || 1))) - 1] ?? 0;
/**
 * O multiplicador do tipo do monstro do PoE (`evasao` ou `precisao`): o da variante do NÍVEL dele (`porNivel[poe.nivel]` — o nível da área da
 * campanha onde o slug aparece, quando a variante do poedb daquele nível difere), senão o geral (o da variante de nível 68+ — o dos mapas), senão o
 * padrão.
 */
export const multiplicadorPoe = (qual, m) => multiplicadorDoSlug(qual, poeDe(m)?.slug, poeDe(m)?.nivel);
/** O multiplicador pelo slug do poedb e o nível da campanha (o mesmo de `multiplicadorPoe`, sem o bestiário). */
export function multiplicadorDoSlug(qual, slug, nivel) {
  const d = DEFESA_POE.monstros?.[slug];
  return d?.porNivel?.[nivel]?.[qual] ?? d?.[qual] ?? DEFESA_POE.padrao?.[qual] ?? 1;
}
/** (lote A5d) A evasão e a precisão de COMBATE de um monstro do PoE pelo slug, no nível (sem os modificadores) — as telas da engine. */
export const defesaPoeDoSlug = (slug, nivel) => ({ evasao: Math.round(tabelaPoe('evasao', nivel) * multiplicadorDoSlug('evasao', slug, nivel)), precisao: Math.round(tabelaPoe('precisao', nivel) * multiplicadorDoSlug('precisao', slug, nivel)) });
/** (lote A5d) A defesa do monstro TÍPICO do PoE no nível (a tabela × o multiplicador padrão) — a da ficha e a do simulador sem alvo. */
export const padraoPoe = (qual, level) => tabelaPoe(qual, level) * (DEFESA_POE.padrao?.[qual] ?? 1);
/**
 * (lote A5d) As chances da FICHA do modo PoE contra o monstro típico do PoE do mesmo nível — as mesmas contas do combate (`Defesa.errou`,
 * `Defesa.esquivou`): a evasão e a precisão pela tabela do PoE × o multiplicador padrão; o Evasivo, `evasivoPct` por cima. `{ acerto, acertoEvasivo, esquiva }`.
 */
export function chancesNoLevelPoe(precisao, evasao, level, evasivoPct = 100) {
  const ev = padraoPoe('evasao', level);
  const pr = padraoPoe('precisao', level);
  return {
    acerto: AtributosDoPersonagem.chanceDeAcerto(precisao, level, ev),
    acertoEvasivo: AtributosDoPersonagem.chanceDeAcertoEvasivo(precisao, level, evasivoPct, ev),
    esquiva: Math.min(0.95, AtributosDoPersonagem.chanceDeEsquiva(evasao, level, pr)),
  };
}
/** O atributo do monstro do PoE com as parcelas: `{ valor, origens }`. */
function comporPoe(qual, m, level, pct) {
  const tabela = tabelaPoe(qual, level);
  const mult = multiplicadorPoe(qual, m);
  const base = Math.round(tabela * mult);
  const origens = [{ fonte: `Tabela do PoE (nível ${Math.max(1, Math.min(100, Math.round(Number(level) || 1)))})`, valor: tabela }, { fonte: 'Multiplicador do tipo do monstro (poedb)', fator: mult }];
  if (pct) origens.push({ fonte: 'Aumentos/reduções (modificadores)', pct });
  return { valor: simples(base, { pct }).bruto, origens };
}

/** A precisão do bicho (o rating com que ele acerta o jogador) neste level. */
export const precisaoDe = (m, level) => (poeDe(m) ? comporPoe('precisao', m, level, m?.precisaoPct ?? 0) : compor('precisao', daCurva('precisao', level), level, m, { pct: m?.precisaoPct ?? 0 })).valor;
/** A evasão do bicho (o rating com que ele evita o golpe do jogador) neste level. */
export const evasaoDe = (m, level) => (poeDe(m) ? comporPoe('evasao', m, level, m?.evasaoPct ?? 0) : compor('evasao', daCurva('evasao', level), level, m, { pct: m?.evasaoPct ?? 0 })).valor;

/** A armadura do bicho: a do bestiário (`armor`), a curva, os fatores e os modificadores (`armaduraPct`). Sem `key` no bestiário, zero. */
export function armaduraDe(m, level) {
  // O monstro do PoE: a armadura do PoE (sem a curva do Draevor), como está.
  if (BESTIARY[m?.key]?.poe) return Math.min(L.armaduraMaxima, simples(BESTIARY[m.key].poe.armadura ?? 0, { pct: m?.armaduraPct ?? 0 }).bruto);
  const base = (BESTIARY[m?.key]?.armor ?? 0) + daCurva('armadura', level);
  return Math.min(L.armaduraMaxima, compor('armadura', base, level, m, { pct: m?.armaduraPct ?? 0 }).valor);
}

/** O bloqueio do bicho (0–1): só quem for configurado (espécie ou modificador). */
export const bloqueioDe = (m) => limitar(((especieDe(m)?.bloqueio ?? 0) + (m?.bloqueio ?? 0)), L.bloqueioMaximo) / 100;
/** A redução de dano do bicho (0–1), separada da armadura e da resistência. */
export const reducaoDeDano = (m) => limitar(((especieDe(m)?.reducaoDeDano ?? 0) + (m?.reducaoDeDano ?? 0)), L.reducaoDeDanoMaxima) / 100;

/**
 * O bicho bloqueou este golpe? (`rng` para o teste; `fator`: o do atacante — PoE, "Chance de Inimigos Bloquearem … reduzida".) (lote A2, dono 19/10:
 * + `menosPontos` — a Redução de Chance de Bloqueio do PoE, "Inimigos possuem -20% de chance de Bloquear", e o Subjugado no bicho: pontos de %.)
 */
export const bloqueou = (m, rng = Math.random, fator = 1, { menosPontos = 0 } = {}) => {
  const b = Math.max(0, bloqueioDe(m) - (Number(menosPontos) || 0) / 100) * fator;
  return b > 0 && rng() < b;
};
/**
 * (lote A2) O SUBJUGADO do PoE (a Redução de Chance de Bloqueio: "Habilidades Suportadas infligem Subjugado por 4 segundos ao Bloquear", "Subjugado
 * aplica -5% à chance de Bloquear"): cada bloqueio do bicho contra a habilidade suportada põe um, com a duração dele; acumulam sem limite. `pontos`:
 * a soma dos que valem agora.
 */
export function subjugar(m, ms, pct, agora) {
  if (!m) return;
  const lista = ((m.estados ??= {}).subjugado ?? []).filter((x) => x.ate > agora);
  lista.push({ ate: agora + ms, pct });
  m.estados.subjugado = lista;
}
export const subjugadoPontos = (m, agora) => (Array.isArray(m?.estados?.subjugado) ? m.estados.subjugado.filter((x) => x.ate > agora).reduce((t, x) => t + (Number(x.pct) || 0), 0) : 0);

/**
 * A fração do golpe físico que a ARMADURA do bicho corta (0–1): armadura / (armadura + coeficiente × dano do golpe), no máximo o teto do
 * PoE (90%) — a mesma conta da armadura do jogador (`combate/formulas.mjs`). Zero com a armadura desligada na config, sem armadura ou sem dano.
 */
export function reducaoDeArmadura(m, level, danoDoGolpe, coeficiente) {
  if (!CONFIG.armaduraDoMob.ativa || !(danoDoGolpe > 0)) return 0;
  return reducaoDeArmaduraPoe(armaduraDe(m, level), danoDoGolpe, coeficiente);
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
    // (lote A5d) o monstro do PoE: as mesmas contas do combate (`precisaoDe`, `evasaoDe`, `armaduraDe`), com as parcelas.
    precisao: esp.poe ? comporPoe('precisao', m, level, m.precisaoPct ?? 0) : compor('precisao', daCurva('precisao', level), level, m, { pct: m.precisaoPct ?? 0 }),
    evasao: esp.poe ? comporPoe('evasao', m, level, m.evasaoPct ?? 0) : compor('evasao', daCurva('evasao', level), level, m, { pct: m.evasaoPct ?? 0 }),
    armadura: esp.poe ? { valor: armaduraDe(m, level), origens: [{ fonte: 'Armadura do PoE', valor: esp.poe.armadura ?? 0 }, ...(m.armaduraPct ? [{ fonte: 'Aumentos/reduções (modificadores)', pct: m.armaduraPct }] : [])] } : compor('armadura', (esp.armor ?? 0) + daCurva('armadura', level), level, m, { pct: m.armaduraPct ?? 0 }),
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

/**
 * O dano EXTRA por elemento em % do golpe (o mapa do endgame: "Monstros causam X% do Dano como Dano Extra de Fogo" — `m.danoExtraPct`,
 * `itens-poe/mapas-areas.aplicarEfeitos`): `[{ elemento, pct }]`.
 */
const SEM_DANO_EXTRA = Object.freeze([]);
export const danoExtraPctDoBicho = (m) => (m?.danoExtraPct ? Object.entries(m.danoExtraPct).filter(([, v]) => Number(v) > 0).map(([elemento, pct]) => ({ elemento, pct: Number(pct) })) : SEM_DANO_EXTRA);

/** Os efeitos de dano contínuo que o golpe do mob põe no jogador: `[{ tipo, chance, pctDoGolpe, duracaoMs? }]` (espécie + ataque). */
export const efeitosDoGolpe = (m, ataque = null) => [...(especieDe(m)?.efeitos ?? []), ...(ataque?.efeitos ?? [])].filter((x) => x?.tipo && x.pctDoGolpe > 0);
