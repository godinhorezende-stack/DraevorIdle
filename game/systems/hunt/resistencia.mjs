// A RESISTÊNCIA do bicho ao tipo de dano — a mesma regra em todo golpe.
//
// Auditoria dos atributos (dono, 29/09): "o cálculo deve ser baseado no tipo
// de dano efetivamente produzido pelo ataque". Todo dano do jogador passa por
// aqui, pelo TIPO (physical, fire, energy, earth, ice, death, holy).
//
// `elements` do bestiário: +20 = resiste 20% (toma 80%), −10 = fraco (toma
// 110%). Na sala de boss a resistência tem teto (`RESISTENCIA_MAXIMA_DE_BOSS`).
//
// Limites e penetração (dono, 02/10): a resistência do bicho passa pelo teto dele (`combate/limites.json`), depois SUBTRAI a
// penetração do atacante naquele tipo (`combate/limites.mjs`) — uma conta só, a mesma do golpe, do charm e do balão.
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { BESTIARY } from './monstros.mjs';
import * as R from '../regras.mjs';
import * as Limites from '../combate/limites.mjs';
import * as Formulas from '../combate/formulas.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import * as AtributosDoMob from '../mobs/atributos.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';

/** A resistência (em %) do bicho ao `tipo`, com o teto do boss e o piso da fraqueza (antes do teto de resistência e da penetração). */
export function resistenciaDe(hunt, alvo, tipo) {
  // A do bestiário + a dos modificadores do mob (`resist`, ver `mobs/raridade.mjs`).
  // (+ a que os buffs das mecânicas dão por um tempo: Endurecido — `mobs/buffs.mjs`.)
  // (- a janela de vulnerabilidade de um boss único depois que o escudo dele quebra — `bosses-unicos/boss.mjs`.)
  const vulneravel = alvo?.boss?.vulnerabilidade && (hunt?.clock ?? 0) < alvo.boss.vulnerabilidade.ate ? alvo.boss.vulnerabilidade.pct : 0;
  // (- o Causticar do PoE nas resistências elementais: "Inflige Causticar em Inimigos ao Bloquear" — `itens-poe/mods-poe.mjs`.)
  const causticado = ['fire', 'ice', 'energy'].includes(tipo) ? ModsPoe.causticado(alvo, hunt?.clock ?? 0) + ModsPoe.exposicao(alvo, hunt?.clock ?? 0, tipo) : 0;
  // (+ o Equilíbrio Elemental do PoE: +25 / −50 pelos elementos que acertaram o bicho por último.)
  const r = (BESTIARY[alvo?.key]?.elements?.[tipo] ?? 0) + (alvo?.resist?.[tipo] ?? 0) + BuffsDeMob.resistencia(alvo, hunt?.clock ?? 0, tipo) - vulneravel - causticado + ModsPoe.equilibrio(alvo, hunt?.clock ?? 0, tipo);
  const comBoss = hunt?.isBoss ? Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, r) : r;
  // A fraqueza só vai até o piso (`fraquezaMaxima`); o teto de cima fica para `resistenciaEfetivaDe`.
  return Math.max(-Limites.LIMITES.resistenciaDoMob.fraquezaMaxima, comBoss);
}

/**
 * A resistência EFETIVA do bicho a um golpe do atacante (`ficha`): a do bicho, no teto, menos a penetração do atacante naquele tipo.
 * Sem `ficha`, é a resistência do bicho no teto (sem penetração).
 */
export function resistenciaEfetivaDe(hunt, alvo, tipo, ficha = null) {
  return Limites.resistenciaEfetiva(Limites.resistenciaDoMob(resistenciaDe(hunt, alvo, tipo)), Limites.penetracaoDe(ficha?.penetracao, tipo));
}

/**
 * `valor` de dano do `tipo` depois das defesas do bicho: a ARMADURA (só no golpe FÍSICO — com a `ficha` do atacante, que marca o golpe; o
 * dano contínuo não passa por ela), a redução de dano do bicho (separada), a resistência ao elemento e a penetração do atacante.
 * (`mobs/atributos.mjs`: armadura, bloqueio e redução vêm da espécie e dos modificadores.)
 */
export function resistido(hunt, alvo, tipo, valor, ficha = null, { armadura = true } = {}) {
  let v = valor;
  // PoE: "Acertos ignoram a Redução de Dano Físico dos Monstros Inimigos" (a ficha do golpe sorteou): sem armadura nem resistência física.
  if (ficha?.ignoraReducaoFisica && tipo === 'physical') return Math.max(0, Math.round(v));
  if (ficha && armadura && tipo === 'physical') v *= 1 - AtributosDoMob.reducaoDeArmadura(alvo, Atributos.levelDoBicho(hunt, alvo), valor, Formulas.PARAMETROS.armadura.poe.coeficiente);
  const reducao = AtributosDoMob.reducaoDeDano(alvo);
  if (reducao > 0) v *= 1 - reducao;
  // (+ os estados do PoE no bicho: Cinzas, Intimidado, Definhado.)
  if (ficha) v *= ModsPoe.fatorRecebidoPeloBicho(alvo, tipo, ficha, hunt?.clock ?? 0);
  return Math.max(0, Math.round(Limites.danoAposResistencia(v, resistenciaEfetivaDe(hunt, alvo, tipo, ficha))));
}
