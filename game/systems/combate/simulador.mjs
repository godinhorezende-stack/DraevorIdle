// O SIMULADOR de combate (dono, 02/10): compara builds, armas e habilidades com as MESMAS contas do jogo — `danoMostrado` (o dano de
// uma habilidade com a gema e os suportes), `Ficha.combate` (crítico, penetração, ataque duplo), `Limites` (resistência efetiva) e
// `Atributos` (acerto) — sem fórmula própria. Devolve o dano mínimo, máximo, médio, crítico e o DPS TEÓRICO (sem alvo) e EFETIVO (contra
// um alvo com parâmetros definidos), os golpes para derrotá-lo e a mitigação defensiva. `medirNoMotor` roda o motor de verdade
// (`Acoes.disparar`), para separar o DPS teórico do medido.
import * as Acoes from '../acoes.mjs';
import * as Ficha from '../ficha.mjs';
import * as Gemas from '../skills/gemas.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import * as Limites from './limites.mjs';
import * as F from './formulas.mjs';
import { registrarGolpe, definirNivel, nivelDoRegistro, limparRegistro, ultimosGolpes } from './registro.mjs';

/** A gema de ataque (a entrada do catálogo de ações) que o personagem tem equipada com este id. */
function entradaDaHabilidade(estado, id) {
  const cat = Acoes.catalogo(estado);
  return [...cat.spells, ...cat.runes].find((a) => a.id === id) ?? null;
}

/**
 * Simula UMA habilidade (gema de ataque) de um personagem contra um alvo.
 * `alvo`: `{ level, hp, resistencias: { fire: 30, ... }, boss }` (a resistência do alvo em %, já com o que ele tem; o teto do bicho vale).
 */
export function simular(estado, id, alvo = {}) {
  const entry = entradaDaHabilidade(estado, id);
  if (!entry || !entry.damage || entry.heals) return { ok: false, erro: 'Habilidade de ataque não encontrada.' };
  const ficha = Ficha.combate(estado);
  const efeito = Gemas.ehSkillDeGema(entry) ? Gemas.efeitoNaSkill(estado, entry.id) : null;
  const tipo = entry.element ?? 'physical';
  // A entrada do catálogo já traz o `damage` calculado por `danoMostrado` (o do balão): é o mesmo número que o motor usa.
  const { min, max } = entry.damage;
  const medio = (min + max) / 2;
  // Crítico: a chance FINAL (com o suporte, no teto) e o multiplicador (separados, como no jogo).
  const chanceCritica = Math.min(Limites.LIMITES.critico.chanceMaxima / 100, Math.max(0, ficha.critChance + (efeitoCritico(efeito, 'critChance') / 100)));
  const fator = ficha.critMultiplier + efeitoCritico(efeito, 'critDano') / 100;
  // O alvo: resistência efetiva (o teto do bicho menos a penetração do atacante nesse tipo) e a chance de acerto (a magia sempre acerta).
  const resistenciaDoAlvo = Limites.resistenciaDoMob(alvo.resistencias?.[tipo] ?? 0);
  const penetracao = Limites.penetracaoDe(ficha.penetracao, tipo);
  const resistenciaEfetiva = Limites.resistenciaEfetiva(resistenciaDoAlvo, penetracao);
  const passa = Limites.danoAposResistencia(1, resistenciaEfetiva);
  const chanceDeAcerto = entry.kind === 'spell' || entry.kind === 'rune' ? 1 : Atributos.chanceDeAcerto(ficha.accuracy, alvo.level ?? estado.level ?? 1);
  // A cadência: a recarga da própria magia ou o intervalo global entre ataques, o que for maior (o motor espera os dois).
  // Gema do PoE: os tempos do PoE (sem o intervalo global do Draevor) — o tempo de uso, ou a recarga repartida pelas cargas, o que for maior.
  // (A estimativa não leva a lentidão passageira do personagem — resfriado agora não muda o DPS da ficha.)
  const poe = entry.poeGema ? Acoes.temposDaGemaPoe(estado, entry, efeito, ficha, { doJogador: false }) : null;
  const cadenciaMs = poe
    ? Math.max(poe.uso, poe.recarga ? poe.recarga / Math.max(1, poe.cargas) : 0, 1)
    : Math.max(entry.cooldown ?? 0, entry.groupCooldown ?? 0, Acoes.intervaloGlobal(estado), efeito ? Gemas.tempoDeConjuracao(estado, entry.id, ficha.castSpeed) : 0, 1);
  const usosPorSegundo = 1000 / cadenciaMs;
  const golpesPorUso = 1 + (ficha.ataqueDuplo ?? 0);
  const medioComCritico = F.danoMedioComCritico(medio, chanceCritica, fator);
  const medioNoAlvo = medioComCritico * passa;
  const dpsTeorico = medioComCritico * usosPorSegundo * golpesPorUso;
  const dpsEfetivo = F.dpsTeorico(medioNoAlvo * golpesPorUso, usosPorSegundo, chanceDeAcerto);
  return {
    ok: true,
    habilidade: entry.name,
    tipo,
    dano: { minimo: min, maximo: max, medio: F.arredondar(medio), critico: F.arredondar(max * fator), medioComCritico: F.arredondar(medioComCritico) },
    critico: { chance: chanceCritica, fator },
    ataqueDuplo: ficha.ataqueDuplo ?? 0,
    cadencia: { ms: cadenciaMs, usosPorSegundo },
    dpsTeorico: F.arredondar(dpsTeorico),
    alvo: {
      resistencia: resistenciaDoAlvo,
      penetracao,
      resistenciaEfetiva,
      chanceDeAcerto,
      danoMedioPorGolpe: F.arredondar(medioNoAlvo),
      dpsEfetivo: F.arredondar(dpsEfetivo),
      golpesParaDerrotar: alvo.hp ? Math.ceil(alvo.hp / Math.max(1, medioNoAlvo * golpesPorUso)) : null,
      segundosParaDerrotar: alvo.hp && dpsEfetivo > 0 ? Math.round((alvo.hp / dpsEfetivo) * 10) / 10 : null,
    },
  };
}

const efeitoCritico = (efeito, chave) => Number(efeito?.[chave]) || 0;

/** A MITIGAÇÃO do personagem contra um golpe: a proteção do elemento, a armadura (modo 'tibia': a média da absorção) e a esquiva. */
export function mitigacao(estado, { dano, tipo = 'physical', levelDoAtacante = estado.level ?? 1 } = {}) {
  const ficha = Ficha.combate(estado);
  const protecao = Limites.resistenciaDoJogador(ficha.protection?.[tipo] ?? 0);
  const aposProtecao = Limites.danoAposResistencia(dano, protecao);
  const absorvido = tipo === 'physical' ? (F.absorcaoPorArmadura(ficha.armor ?? 0, 0) + F.absorcaoPorArmadura(ficha.armor ?? 0, 1)) / 2 : 0;
  const aposArmadura = Math.max(0, aposProtecao - absorvido);
  return {
    protecaoPct: protecao,
    danoAposProtecao: F.arredondar(aposProtecao),
    armaduraAbsorvidaMedia: F.arredondar(absorvido),
    danoMedioRecebido: F.arredondar(aposArmadura),
    chanceDeEsquiva: tipo === 'physical' ? Atributos.chanceDeEsquiva(ficha.evasion ?? 0, levelDoAtacante) : 0,
    reducaoTotalPct: dano > 0 ? Math.round((1 - aposArmadura / dano) * 1000) / 10 : 0,
  };
}

/**
 * O DPS MEDIDO: dispara a habilidade `n` vezes no motor de verdade (o `Acoes.disparar` de uma caçada), com a recarga zerada a cada uso,
 * e mede o dano médio por uso. Compara com `simular(...).dano.medioComCritico` (o teórico) — as duas têm de bater, na média.
 * `preparar(estado)` deixa o personagem na caçada com o alvo (a quem chama cabe montar; ver os testes).
 */
export function medirNoMotor(estado, id, n, { slot, alvo }) {
  const antes = nivelDoRegistro();
  definirNivel(1);
  limparRegistro();
  const golpes = [];
  for (let i = 0; i < n; i++) {
    estado.hunt.cooldowns = {};
    estado.hunt.ultimoAtaqueEm = null;
    estado.mana = estado.maxMana;
    Acoes.disparar(estado, estado.hunt, { id: 0, nome: 'simulador' }, slot, alvo);
    // O registro é um anel de `capacidade` golpes: esvazia a cada uso para não perder nenhum.
    golpes.push(...ultimosGolpes(1e6).filter((g) => g.origem === 'gema' && g.habilidade === id));
    limparRegistro();
  }
  definirNivel(antes);
  const total = golpes.reduce((a, g) => a + g.danoFinal, 0);
  return { usos: n, golpes: golpes.length, danoMedioPorGolpe: golpes.length ? total / golpes.length : 0, danoMedioPorUso: total / n, taxaDeCritico: golpes.length ? golpes.filter((g) => g.critico).length / golpes.length : 0 };
}

export { registrarGolpe };
