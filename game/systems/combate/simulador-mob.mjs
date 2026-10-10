// O SIMULADOR do lado do MONSTRO (etapa 5, dono 02/10): quanto o jogador demora para matar um monstro, quanto dano recebe por segundo, a chance
// de morrer, o efeito de cada defesa e de cada modificador. Estende `combate/simulador.mjs` (o lado do jogador) com as MESMAS contas do jogo:
// `Ficha.combate`, `mobs/atributos.mjs` (precisão, evasão, armadura, bloqueio, crítico, intervalo), `Poderes.ataquesParaFicha` (os ataques do
// bicho), a armadura do PoE, as proteções, e `Raridade` (os modificadores). É uma estimativa por esperança (+ Monte Carlo com semente fixa para a
// chance de morte): não roda o motor da caçada, não conta poções, regeneração nem dano contínuo — diga isso ao interpretar a chance de morte.
import * as Ficha from '../ficha.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import * as Raridade from '../mobs/raridade.mjs';
import * as Mobs from '../mobs/atributos.mjs';
import * as Poderes from '../poderes.mjs';
import * as R from '../regras.mjs';
import * as Limites from './limites.mjs';
import * as F from './formulas.mjs';
import { criarMonstro, BESTIARY } from '../hunt/monstros.mjs';
import { resistenciaEfetivaDe, fracaoFisicaDoPoe } from '../hunt/resistencia.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';

/** Um gerador pseudo-aleatório com semente (mulberry32): a mesma entrada dá o mesmo resultado. */
function semente(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O monstro da simulação: o do bestiário × a escala da fase × a raridade e os modificadores (os mesmos passos do jogo). */
export function montarMob({ key, raridade = 'normal', modificadores = [], escala = null }) {
  if (!BESTIARY[key]) return null;
  const m = criarMonstro({ key, x: 0, y: 0 }, null);
  if (escala) {
    m.maxHp = Math.max(1, Math.round((m.maxHp ?? m.hp) * (escala.vida ?? 1)));
    m.hp = m.maxHp;
    m.forca = (m.forca ?? 1) * (escala.dano ?? 1);
  }
  return Raridade.aplicar(m, { raridade, modificadores });
}

/** Os ataques do bicho como a simulação os vê: `[{ tipo, elemento, min, max, chance, intervaloMs, extras }]` (melee e magias). */
function ataquesDe(m, nivelDoMob) {
  const lista = Poderes.ataquesParaFicha(m.key);
  const forca = m.forca ?? 1;
  if (!lista) {
    return [{ tipo: 'melee', elemento: 'physical', min: R.ataqueDoMonstro(m) * forca, max: R.ataqueDoMonstro(m) * forca, chance: 100, intervaloMs: Mobs.intervaloDoGolpe(m), extras: [], estimado: true }];
  }
  return lista.filter((a) => a.max > 0 || a.tipo === 'melee').map((a) => ({
    tipo: a.tipo,
    elemento: a.elemento,
    min: a.min * forca,
    max: a.max * forca,
    chance: a.chance,
    // O melee bate no intervalo do mob (2 s ÷ velocidade, com limites); a magia, no intervalo dela (do arquivo).
    intervaloMs: a.tipo === 'melee' ? Mobs.intervaloDoGolpe(m) : Math.max(250, a.intervalo),
    extras: a.tipo === 'melee' ? Mobs.danoExtraDoGolpe(m) : Mobs.danoExtraDoGolpe(null, a),
  }));
}

/** As defesas do jogador contra UM ataque do mob — cada uma como um fator (1 = não reduz): esquiva, bloqueio, armadura, proteção, crítico. */
function defesasContra(ficha, m, nivelDoMob, a, danoMedio) {
  const melee = a.tipo === 'melee';
  const esquiva = melee ? Atributos.chanceDeEsquiva(ficha.evasion ?? 0, nivelDoMob, Mobs.precisaoDe(m, nivelDoMob)) : 0;
  const bloqueio = melee ? ((ficha.blockChance ?? 0)) : 0;
  const prot = Limites.resistenciaDoJogador(ficha.protection?.[a.elemento] ?? 0);
  const armadura = a.elemento === 'physical' ? F.reducaoDeArmaduraPoe(ficha.armor ?? 0, danoMedio) : 0;
  const crit = Mobs.critico(m);
  const fatorCritico = 1 + crit.chance * (crit.fator - 1);
  return {
    esquiva: 1 - esquiva,
    bloqueio: 1 - bloqueio,
    armadura: 1 - armadura,
    protecao: 1 - prot / 100,
    gemas: 1 - (ficha.danoRecebidoDasGemas ?? 0),
    critico: fatorCritico,
    // PoE 1 (dono, 10/10): no físico, a armadura e a redução física adicional SOMAM, no teto (`fatorFisico`).
    soma: a.elemento === 'physical' && ModsPoe.somaFisicaDoPoe() ? { armadura, adicional: ModsPoe.reducaoFisicaAdicional(ficha) } : null,
  };
}

/** A armadura × a proteção do golpe (`d`, de `defesasContra`) — no PoE, a soma das duas no teto. `sem`: a defesa a ignorar. */
const fatorFisico = (d, sem = null) => (d.soma
  ? 1 - Limites.reducaoFisicaTotal(sem === 'armadura' ? 0 : d.soma.armadura, sem === 'protecao' ? 0 : d.soma.adicional) / 100
  : (sem === 'armadura' ? 1 : d.armadura) * (sem === 'protecao' ? 1 : d.protecao));

/** O dano por segundo que o mob causa no jogador, por esperança, com (ou sem) cada defesa. `sem`: o nome da defesa a ignorar. */
function dpsDoMob(ficha, m, nivelDoMob, ataques, sem = null) {
  let total = 0;
  const porElemento = {};
  for (const a of ataques) {
    const dano = (a.min + a.max) / 2;
    const d = defesasContra(ficha, m, nivelDoMob, a, dano);
    const f = (k) => (sem === k ? 1 : d[k]);
    const tentativasPorS = (a.chance / 100) * (1000 / a.intervaloMs);
    const primario = dano * f('esquiva') * f('bloqueio') * fatorFisico(d, sem) * f('gemas') * d.critico;
    porElemento[a.elemento] = (porElemento[a.elemento] ?? 0) + primario * tentativasPorS;
    let porGolpe = primario;
    // O dano de outros tipos no mesmo golpe (cada um com a proteção do seu tipo; sem armadura).
    for (const x of a.extras ?? []) {
      const prot = sem === 'protecao' ? 0 : Limites.resistenciaDoJogador(ficha.protection?.[x.elemento] ?? 0);
      const extra = ((x.min + x.max) / 2) * (1 - prot / 100) * f('esquiva') * f('bloqueio') * f('gemas') * d.critico;
      porElemento[x.elemento] = (porElemento[x.elemento] ?? 0) + extra * tentativasPorS;
      porGolpe += extra;
    }
    total += porGolpe * tentativasPorS;
  }
  return { dps: total, porElemento };
}

/** O dano por segundo do JOGADOR no mob (o golpe básico): precisão × evasão do bicho, bloqueio dele, crítico, armadura, redução e resistência. */
function dpsDoJogador(ficha, m, nivelDoMob) {
  const hunt = { clock: 0, escala: { nivel: nivelDoMob - (m.levelExtra ?? 0) } };
  const { min, max } = ficha.damage;
  const medio = (min + max) / 2;
  const acerto = Atributos.chanceDeAcerto(ficha.accuracy ?? 0, nivelDoMob, Mobs.evasaoDe(m, nivelDoMob));
  const bloqueio = Mobs.bloqueioDe(m);
  const armadura = Mobs.reducaoDeArmadura(m, nivelDoMob, medio, F.PARAMETROS.armadura.poe.coeficiente);
  const reducao = Mobs.reducaoDeDano(m);
  const resEfetiva = resistenciaEfetivaDe(hunt, m, 'physical', ficha);
  const crit = Math.min(1, ficha.critChance ?? 0);
  const fatorCritico = 1 + crit * ((ficha.critMultiplier ?? 1.5) - 1);
  // (No PoE, o físico: a armadura e a redução física adicional do bicho somadas, no teto — `fracaoFisicaDoPoe`, a mesma conta do golpe.)
  const fisico = ModsPoe.somaFisicaDoPoe() ? fracaoFisicaDoPoe(hunt, m, medio, ficha) : (1 - armadura) * Limites.danoAposResistencia(1, resEfetiva);
  const porGolpe = medio * fisico * (1 - reducao) * fatorCritico * acerto * (1 - bloqueio);
  const golpesPorS = 1000 / Math.max(1, ficha.intervaloDoGolpeMs ?? 2000);
  return { dps: porGolpe * golpesPorS * (1 + (ficha.ataqueDuplo ?? 0)), acerto, golpesPorS, armadura, reducao, bloqueio };
}

/**
 * Simula a luta de UM personagem contra UM monstro: `{ mob, jogador, mobNoJogador, defesas, chanceDeMorte, ... }`.
 * `dpsDoJogador`: opcional — use o DPS efetivo do simulador de habilidades (`simulador.mjs`) quando for medir uma gema; sem ele, vale o golpe básico.
 */
export function simularLuta(estado, { mob, level = estado.level ?? 1, lutas = 300, semente: seed = 1, dpsDoJogador: dpsFornecido = null } = {}) {
  const m = montarMob(mob);
  if (!m) return { ok: false, erro: 'Criatura desconhecida.' };
  const ficha = Ficha.combate(estado);
  const nivelDoMob = level + (m.levelExtra ?? 0);
  const ataques = ataquesDe(m, nivelDoMob);
  const eu = dpsDoJogador(ficha, m, nivelDoMob);
  const dps = dpsFornecido ?? eu.dps;
  const segundosParaMatar = dps > 0 ? m.maxHp / dps : Infinity;
  const { dps: dpsNele, porElemento } = dpsDoMob(ficha, m, nivelDoMob, ataques);
  // O efeito de cada defesa: quanto do dano do mob ela corta (o dano sem ela contra o com).
  const defesas = {};
  for (const d of ['esquiva', 'bloqueio', 'armadura', 'protecao', 'gemas']) {
    const sem = dpsDoMob(ficha, m, nivelDoMob, ataques, d).dps;
    defesas[d] = sem > 0 ? Math.round((1 - dpsNele / sem) * 1000) / 10 : 0;
  }
  // Monte Carlo (semente fixa): a luta em passos de 0,25 s; cada ataque do mob rola a chance, a esquiva, o bloqueio e o crítico.
  const rng = semente(seed);
  const vidaDoJogador = (estado.maxHp ?? estado.hp ?? 0) + (ficha.energyShield ?? 0);
  let mortes = 0;
  let danoTotal = 0;
  let tempoTotal = 0;
  for (let l = 0; l < lutas; l++) {
    let hp = vidaDoJogador;
    let t = 0;
    const proximo = ataques.map((a) => rng() * a.intervaloMs);
    const duracao = segundosParaMatar * (0.8 + rng() * 0.4);
    while (t < duracao * 1000 && hp > 0) {
      ataques.forEach((a, i) => {
        if (t < proximo[i]) return;
        proximo[i] += a.intervaloMs;
        if (rng() * 100 >= a.chance) return;
        const d = defesasContra(ficha, m, nivelDoMob, a, (a.min + a.max) / 2);
        if (rng() >= d.esquiva || rng() >= d.bloqueio) return;
        const crit = Mobs.critico(m);
        const fator = crit.chance > 0 && rng() < crit.chance ? crit.fator : 1;
        const sorteado = a.min + rng() * (a.max - a.min);
        let dano = sorteado * fatorFisico(d) * d.gemas * fator;
        for (const x of a.extras ?? []) dano += (x.min + rng() * (x.max - x.min)) * (1 - Limites.resistenciaDoJogador(ficha.protection?.[x.elemento] ?? 0) / 100) * d.gemas * fator;
        hp -= dano;
        danoTotal += dano;
      });
      t += 250;
    }
    tempoTotal += Math.min(t / 1000, duracao);
    if (hp <= 0) mortes++;
  }
  return {
    ok: true,
    mob: { nome: m.name, raridade: m.raridade ?? 'normal', modificadores: m.mods ?? [], level: nivelDoMob, vida: m.maxHp, atributos: Mobs.atributosFinais(m, nivelDoMob), ataques },
    jogador: { dpsNoMob: Math.round(dps * 10) / 10, chanceDeAcerto: eu.acerto, segundosParaMatar: Math.round(segundosParaMatar * 10) / 10, vida: Math.round(vidaDoJogador) },
    mobNoJogador: { dps: Math.round(dpsNele * 10) / 10, porElemento: Object.fromEntries(Object.entries(porElemento).map(([k, v]) => [k, Math.round(v * 10) / 10])), danoPorLuta: Math.round(dpsNele * segundosParaMatar) },
    defesas,
    chanceDeMorte: Math.round((mortes / lutas) * 1000) / 1000,
    danoMedioPorLuta: Math.round(danoTotal / lutas),
    lutas,
    aviso: 'Estimativa: sem poções, regeneração nem dano contínuo; o DPS do jogador é o do golpe básico (ou o informado).',
  };
}

/** O efeito dos MODIFICADORES: a mesma luta sem e com cada modificador (e com todos), para ver o quanto cada um muda. */
export function efeitoDosModificadores(estado, { key, level, raridade = 'raro', modificadores = [], lutas = 200 }) {
  const base = simularLuta(estado, { mob: { key, raridade }, level, lutas });
  const resumo = (r) => ({ vida: r.mob.vida, segundosParaMatar: r.jogador.segundosParaMatar, danoRecebidoPorSegundo: r.mobNoJogador.dps, chanceDeMorte: r.chanceDeMorte });
  return {
    base: resumo(base),
    porModificador: Object.fromEntries(modificadores.map((id) => [id, resumo(simularLuta(estado, { mob: { key, raridade, modificadores: [id] }, level, lutas }))])),
    todos: resumo(simularLuta(estado, { mob: { key, raridade, modificadores }, level, lutas })),
  };
}

/** Várias classes (ou builds) contra o mesmo mob: `estados` é `{ nome: estado }`. */
export function compararClasses(estados, { mob, level, lutas = 200 }) {
  return Object.fromEntries(Object.entries(estados).map(([nome, e]) => {
    const r = simularLuta(e, { mob, level: level ?? e.level, lutas });
    return [nome, r.ok ? { dpsNoMob: r.jogador.dpsNoMob, segundosParaMatar: r.jogador.segundosParaMatar, danoRecebidoPorSegundo: r.mobNoJogador.dps, chanceDeMorte: r.chanceDeMorte } : r];
  }));
}

/** A progressão entre faixas de level: o mesmo mob (com a escala da fase por level) contra o personagem. `escalaPorLevel(level)` → `{ vida, dano }`. */
export function progressao(estado, { mob, niveis, escalaPorLevel = () => null, lutas = 200 }) {
  return niveis.map((level) => {
    const r = simularLuta(estado, { mob: { ...mob, escala: escalaPorLevel(level) }, level, lutas });
    return { level, ...(r.ok ? { vida: r.mob.vida, segundosParaMatar: r.jogador.segundosParaMatar, danoRecebidoPorSegundo: r.mobNoJogador.dps, chanceDeMorte: r.chanceDeMorte } : { erro: r.erro }) };
  });
}
