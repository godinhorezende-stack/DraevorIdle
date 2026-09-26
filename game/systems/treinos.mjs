// Treino online (o pátio) e treino offline — as regras que o client descreve
// (`MODOS_DE_TREINO`, `confirmarOffline`, `porQueNaoDaParaDeixarOffline` em
// panels.mjs/main.mjs):
//
// - ONLINE: "Você vai ao pátio e bate num boneco que não morre. Rende como
//   caçar." É uma hunt com id 'treino' (o client mostra a faixa do treino por
//   esse id) na sala real do treino online (`TREINO_MAP`), entre dois Target
//   Dummy (`bonecos`). O golpe é o da caçada (2s, perícia da arma; wand/rod e
//   magia treinam o magic level). "O pátio de treino para quando você sai."
// - OFFLINE: "Você sai do jogo treinando. Rende menos que o pátio (...) e gasta
//   a stamina de treino, que caçar devolve." Escolhe a perícia (o escudo sobe
//   junto), o personagem volta para a lista e, na volta, o tempo fora vira
//   treino (`treinoPendente`, o mesmo relatório do Exercise). A stamina de
//   treino (`treinoStamina`) é o tanque de 12h do personagem real.
// - O Exercise também continua com o jogador fora (o client permite sair
//   "treinando" com ele) — ver `voltaDoTreino`.
//
// Ritmos (medidos com o mesmo tempo e o mesmo ponto de partida): offline 0,5x
// o pátio, Exercise 5x o pátio. Perícias: 0,25 / 0,5 / 2,5 tentativas por
// segundo (o pátio é o golpe da caçada, 1 a cada 2s). Magic level: a mana que o
// personagem regenera, x0,5 / x1 / x5. O original só diz que o offline "rende
// menos" e que a arma de carga é a mais rápida — as proporções são nossas.
import * as Treino from './treino.mjs';
import * as Exercicio from './exercicio.mjs';

export const TANQUE_MS = 12 * 3_600_000;
const TENTATIVAS_OFFLINE_POR_S = 0.25;
const EXERCISE_OFFLINE_MAX_MS = 12 * 3_600_000;

/*
 * A sala do treino online (`TREINO_MAP`), como o `state.hunt` original a manda:
 * o personagem em (18,12), cercado, entre dois Target Dummy (look 1142).
 */
export const PARTIDA_DO_PATIO = { x: 18, y: 12 };

/** Os bonecos da sala real do treino online. */
export function bonecos() {
  return [
    { uid: 'dummy:1', nome: 'Target Dummy', look: 1142, x: 19, y: 11 },
    { uid: 'dummy:2', nome: 'Target Dummy', look: 1142, x: 17, y: 11 },
  ];
}

// ---------------------------------------------------- stamina de treino

export function tanque(estado) {
  if (typeof estado.treinoTanque !== 'number') estado.treinoTanque = TANQUE_MS;
  return estado.treinoTanque;
}

/** Caçar devolve: o tempo de caçada volta para o tanque. */
export function encherTanque(estado, ms) {
  if (ms > 0) estado.treinoTanque = Math.min(TANQUE_MS, tanque(estado) + ms);
}

export function tanqueParaCliente(estado) {
  const restante = tanque(estado);
  const fracao = restante / TANQUE_MS;
  return { restante, teto: TANQUE_MS, fracao, baixa: fracao < 0.25, vazia: restante <= 0 };
}

// ---------------------------------------------------------- offline

/** `send({t:'training', action:'start', mode:'offline', skill})`. */
export function comecarOffline(estado, { skill }) {
  if (estado.hunt) return { ok: false, erro: 'Saia da caçada para treinar offline.' };
  if (tanque(estado) <= 0) return { ok: false, erro: 'Sua stamina de treino acabou — caçar devolve.' };
  const validas = ['fist', 'club', 'sword', 'axe', 'distance', 'magic'];
  if (!validas.includes(skill)) return { ok: false, erro: 'Escolha uma perícia.' };
  if (estado.exercicio?.treinando) estado.exercicio.treinando = false;
  estado.training = { mode: 'offline', skill, desde: Date.now() };
  return { ok: true, sair: true };
}

/**
 * Na volta (`entrarNoPersonagem`): o treino offline e o Exercise que ficaram
 * rodando viram progresso. Devolve o `treinoPendente` para o welcome, ou null.
 */
export function voltaDoTreino(estado, vistoEm) {
  const antes = Treino.paraCliente(estado);
  let segundos = 0;
  let gastos = null;
  let exercise = false;

  const t = estado.training;
  if (t?.mode === 'offline') {
    const ms = Math.min(Date.now() - t.desde, tanque(estado));
    estado.treinoTanque = tanque(estado) - ms;
    segundos = Math.round(ms / 1000);
    if (t.skill === 'magic') Treino.gastarMana(estado, Math.round(segundos * Treino.manaDoPatioPorSegundo(estado) * 0.5));
    else Treino.treinar(estado, t.skill, Math.floor(segundos * TENTATIVAS_OFFLINE_POR_S));
    Treino.treinar(estado, 'shielding', Math.floor(segundos * TENTATIVAS_OFFLINE_POR_S));
    estado.training = null;
  }

  // Exercise que ficou treinando com o jogador fora.
  if (estado.exercicio?.treinando && vistoEm) {
    const ms = Math.min(Date.now() - vistoEm, EXERCISE_OFFLINE_MAX_MS);
    const fim = Exercicio.tique(estado, ms);
    const rel = fim ?? Exercicio.parar(estado).relatorio;
    if (fim == null && estado.exercicio) estado.exercicio.treinando = true; // continua treinando na volta
    gastos = rel?.gastos ?? null;
    segundos = Math.max(segundos, Math.round(ms / 1000));
    exercise = true;
  }

  if (!t && !exercise) return null;
  const agora = Treino.paraCliente(estado);
  const ganho = [];
  for (const [skill, v] of [...Object.entries(agora.skills), ['magic', agora.magic]]) {
    const de = skill === 'magic' ? antes.magic : antes.skills[skill];
    if (v.value === de.value && Math.abs(v.percent - de.percent) < 1e-9) continue;
    ganho.push({ skill, de: de.value, dePercent: de.percent, para: v.value, paraPercent: v.percent, niveis: v.value - de.value });
  }
  return { ganho, gastos, segundos, exercise };
}

/** Ganho entre dois retratos de `Treino.paraCliente`. */
function ganhoEntre(antes, agora) {
  const ganho = [];
  for (const [skill, v] of [...Object.entries(agora.skills), ['magic', agora.magic]]) {
    const de = skill === 'magic' ? antes.magic : antes.skills[skill];
    if (!de || (v.value === de.value && Math.abs(v.percent - de.percent) < 1e-9)) continue;
    ganho.push({ skill, de: de.value, dePercent: de.percent, para: v.value, paraPercent: v.percent, niveis: v.value - de.value });
  }
  return ganho;
}

/** Saindo do pátio: o mesmo `treinoReport` do Exercise, com o que subiu lá. */
export function relatorioDoPatio(estado) {
  const hunt = estado.hunt;
  if (hunt?.huntId !== 'treino') return null;
  const ganho = hunt.treinoAntes ? ganhoEntre(hunt.treinoAntes, Treino.paraCliente(estado)) : [];
  return { t: 'treinoReport', ganho, gastos: [], segundos: Math.round((Date.now() - hunt.startedAt) / 1000), exercise: false };
}

/** O que a lista de personagens mostra ("Treinando offline: axe"). */
export function fazendo(estado) {
  if (estado.training?.mode === 'offline') return { tipo: 'offline', onde: `Treinando offline: ${estado.training.skill === 'magic' ? 'magic level' : estado.training.skill}` };
  if (estado.exercicio?.treinando) return { tipo: 'offline', onde: 'Treinando no exercise' };
  return null;
}
