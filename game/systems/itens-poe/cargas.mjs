// As CARGAS do PoE — Tolerância, Frenesi e Poder (sistema de itens do PoE — só com ITENS_POE=1; em produção nada disto roda).
//
// Números base do PoE: até 3 de cada (+ "+N ao Máximo de Cargas de X"), 10 s; ganhar uma renova a duração de TODAS daquele tipo; quando
// a duração acaba, todas daquele tipo somem. Por carga:
//   Tolerância — +4% de redução de dano físico (phys_res) e +4% em todas as resistências elementais.
//   Frenesi    — +4% de velocidade de ataque e de conjuração, e 4% MAIS dano (multiplica o golpe — `fatorDeDano`).
//   Poder      — +40% de chance de crítico (aumentada: crit_chance_inc).
//   (+ os mods "por carga": movimento e evasão por Frenesi; dano e dano mágico por Poder.)
// As cargas moram na CAÇADA (`hunt.cargasPoe`): saiu da caçada, acabaram. Os efeitos entram como atributos somados (`adds`, juntados em
// `Afixos.soma`), então a ficha é refeita quando o número muda (`Ficha.invalidar`, por quem chama).
import { ligado } from './catalogo.mjs';

export const TIPOS = ['tolerancia', 'frenesi', 'poder'];
export const NOME = { tolerancia: 'Tolerância', frenesi: 'Frenesi', poder: 'Poder' };
export const BASE = { maximo: 3, duracaoMs: 10_000 };

const n = (af, k) => Number(af?.[k]) || 0;
/** O máximo de cargas do tipo (3 + os mods). */
export const maximo = (af, tipo) => Math.max(0, BASE.maximo + n(af, `max_${tipo}`));
/** A duração (ms) das cargas do tipo (+ a duração das cargas em geral). */
export const duracao = (af, tipo) => Math.round(BASE.duracaoMs * (1 + (n(af, `duracao_${tipo}`) + n(af, 'duracao_cargas')) / 100));

/** As chaves dos atributos de carga (o que a ficha guarda em `ficha.cargas`, para os ganchos não somarem tudo a cada acerto). */
const CHAVES = [...TIPOS.flatMap((t) => [`max_${t}`, `duracao_${t}`, `carga_${t}_ao_matar`]), 'duracao_cargas', 'carga_qualquer_ao_matar', 'carga_frenesi_ao_acertar_unico', 'dano_por_poder'];
export const regrasDaSoma = (af) => Object.fromEntries(CHAVES.filter((k) => n(af, k)).map((k) => [k, n(af, k)]));

/** As cargas ATIVAS agora (`{ tolerancia, frenesi, poder }`, números). */
export function ativas(estado) {
  const c = estado?.hunt?.cargasPoe;
  const agora = estado?.hunt?.clock ?? 0;
  return Object.fromEntries(TIPOS.map((t) => [t, c?.[t] && c[t].ate > agora ? c[t].n : 0]));
}

/** As cargas ativas como cartões de buff da caçada (o cliente desenha junto dos buffs de magia). */
export function buffs(estado) {
  const c = estado?.hunt?.cargasPoe;
  const agora = estado?.hunt?.clock ?? 0;
  if (!c) return [];
  return TIPOS.filter((t) => c[t] && c[t].ate > agora).map((t) => ({ icone: null, nome: `Cargas de ${NOME[t]} ×${c[t].n}`, resta: c[t].ate - agora, tipo: 'cargaPoe', carga: t, n: c[t].n }));
}

/** Ganha uma carga do tipo (até o máximo) e renova a duração de todas dele. Devolve true se o número ou a duração mudou. */
export function ganhar(estado, tipo, af) {
  const hunt = estado?.hunt;
  if (!ligado() || !hunt || !TIPOS.includes(tipo)) return false;
  const max = maximo(af, tipo);
  if (max <= 0) return false;
  const agora = hunt.clock ?? 0;
  const c = (hunt.cargasPoe ??= {});
  const atual = c[tipo] && c[tipo].ate > agora ? c[tipo].n : 0;
  c[tipo] = { n: Math.min(max, atual + 1), ate: agora + duracao(af, tipo) };
  return true;
}

/** Tira as cargas vencidas. Devolve true se alguma sumiu (a ficha precisa ser refeita). */
export function vencer(estado) {
  const c = estado?.hunt?.cargasPoe;
  if (!c) return false;
  const agora = estado.hunt.clock ?? 0;
  let mudou = false;
  for (const t of TIPOS) if (c[t] && c[t].ate <= agora) {
    delete c[t];
    mudou = true;
  }
  return mudou;
}

/** O que as cargas ativas somam (`adds`, as mesmas chaves dos itens). `af`: a soma sem as cargas (para os mods "por carga"). */
export function adds(estado, af) {
  if (!ligado()) return null;
  const { tolerancia, frenesi, poder } = ativas(estado);
  if (!tolerancia && !frenesi && !poder) return null;
  const s = {};
  const mais = (k, v) => {
    if (v) s[k] = (s[k] ?? 0) + v;
  };
  mais('phys_res', 4 * tolerancia);
  for (const el of ['fire_res', 'ice_res', 'energy_res']) mais(el, 4 * tolerancia);
  mais('atk_speed', 4 * frenesi);
  mais('cast_speed', 4 * frenesi);
  mais('move_speed', n(af, 'move_speed_por_frenesi') * frenesi);
  mais('evasion_pct', n(af, 'evasion_pct_por_frenesi') * frenesi);
  mais('crit_chance_inc', 40 * poder);
  mais('spell_dmg', n(af, 'spell_dmg_por_poder') * poder);
  return s;
}

/** O fator do dano do golpe pelas cargas: 4% MAIS por Frenesi e o "Dano aumentado por Carga de Poder" (`Ficha.rolarCritico`). */
export function fatorDeDano(estado, af) {
  if (!ligado()) return 1;
  const { frenesi, poder } = ativas(estado);
  return (1 + 0.04 * frenesi) * (1 + (n(af, 'dano_por_poder') * poder) / 100);
}

/**
 * Ao matar um bicho: as chances "de ganhar uma Carga de X ao Matar" (e a de "Poder, Frenesi ou Tolerância", que sorteia o tipo). Devolve
 * os tipos ganhos.
 */
export function aoMatar(estado, af, rng = Math.random) {
  const ganhos = [];
  for (const t of TIPOS) if (rng() * 100 < n(af, `carga_${t}_ao_matar`) && ganhar(estado, t, af)) ganhos.push(t);
  if (rng() * 100 < n(af, 'carga_qualquer_ao_matar')) {
    const t = TIPOS[Math.floor(rng() * TIPOS.length)];
    if (ganhar(estado, t, af)) ganhos.push(t);
  }
  return ganhos;
}

/** Ao acertar: "Carga de Frenesi ao Acertar um Inimigo Único" (Único = chefe). Devolve os tipos ganhos. */
export function aoAcertar(estado, af, alvo, rng = Math.random) {
  const chefe = !!(alvo?.boss || alvo?.chefe || alvo?.raridade === 'unico' || alvo?.raridade === 'boss');
  if (chefe && rng() * 100 < n(af, 'carga_frenesi_ao_acertar_unico') && ganhar(estado, 'frenesi', af)) return ['frenesi'];
  return [];
}
