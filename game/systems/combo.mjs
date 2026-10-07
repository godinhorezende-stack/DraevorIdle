// O COMBO: a fileira de ataque da barra (os 11 slots `attack` de
// `Acoes.PAPEL_DO_SLOT`), percorrida pelo loop automático da caçada.
//
// ---- PRIORIDADE pela ordem dos slots (pedido do dono, 01/10) ----
//
// A cada tique a varredura começa SEMPRE no slot 1 da fileira e para na
// primeira magia que de fato sai: se a do slot 1 está disponível, é ela, sempre;
// em recarga, a próxima disponível; quando ela volta, recupera a vez. Não é
// rodízio — antes havia um cursor (`hunt.cursorDoCombo`) que avançava a cada
// magia lançada e fazia o slot 1 esperar a volta inteira pela fileira.
//
// O que impede o slot 1 de sair sozinho para sempre (o defeito que o rodízio
// tinha corrigido) é a recarga INDIVIDUAL de cada magia: com o cooldown global
// de 2 s (`R.GLOBAL_SPELL_COOLDOWN`), a magia de recarga curta sai sempre que
// pode, e as de baixo preenchem os buracos dela.
//
// Slot que não pode executar (recarga própria, mana, alvo, alcance, condição,
// vazio, desligado) é pulado com o motivo. Bloqueio da fileira INTEIRA (o
// cooldown global, a recarga do grupo de ataque, a conjuração em andamento)
// para a varredura: nada sai neste tique — uma magia por vez, nunca duas.
//
// ---- Os MODOS de execução (fase B da revisão, decisões do dono, 01/10) ----
//
// O jogador escolhe na tela da barra (`estado.settings.modoDasMagias`):
//   prioridade (padrão): o de cima — a do slot 1 sempre que puder;
//   limite N:  a ordem dos slots, mas numa volta de W execuções (W = as magias
//              que podem entrar) a de maior prioridade (a primeira fora de
//              recarga) sai até N vezes e cada
//              uma das outras 1 vez, revezando-se nas brechas: com N = 2,
//              "Fire, Fire, Ice, Death, Fire, Fire, Light...". Se nenhuma outra
//              puder sair, ela sai mesmo assim — a janela nunca fica vazia por
//              causa do limite. N de 1 a 3 (`settings.limiteDasMagias`, padrão 2);
//   rotacao:   todas se revezam — a volta começa no slot seguinte ao da última que
//              saiu (`hunt.cursorDoCombo`), pulando as que não podem.
// Só a ORDEM muda: quem decide se sai continua sendo `Acoes.disparar`, igual nos
// três. As Regras de Uso entram por cima da ordem do modo (filtram e põem as
// preferidas na frente); o limite vale por último, também sobre elas.
//
// Quem decide se a skill sai continua sendo SÓ `Acoes.disparar` (servidor):
// recarga individual, recarga do grupo, cooldown global, mana, alvo, alcance e
// condições estão lá — inclusive para o clique/tecla manual. Este arquivo só
// decide a ORDEM em que os slots são tentados.
import * as Acoes from './acoes.mjs';
import * as R from './regras.mjs';
import * as RegrasDeUso from './skills/regras-de-uso.mjs';

/** Os índices da barra que são da fileira de ataque, em ordem (11..21). */
export const SLOTS_DO_COMBO = Acoes.PAPEL_DO_SLOT.map((papel, i) => (papel === 'attack' ? i : -1)).filter((i) => i >= 0);
/*
 * ---- A barra do PoE (dono, 07/10: "a rotação, o limite e a prioridade têm de funcionar com várias skills") ----
 * No modo PoE os 8 slots são todos 'skill' (qualquer gema em qualquer slot), então a fileira de ataque não é fixa: são os slots que têm
 * uma habilidade de ATAQUE/dano (o papel 'attack' da gema: projéteis, corpo a corpo, magias de dano, movimento), na ordem da barra. Auras,
 * arautos, clamores, guardas, maldições e lacaios ('suporte') continuam no sustento (`cacadas`), todo tique, pela ordem da barra.
 */
const BARRA_DO_POE = Acoes.PAPEL_DO_SLOT.length > 0 && Acoes.PAPEL_DO_SLOT.every((papel) => papel === 'skill');
const ehDeAtaque = (id) => !!id && (Acoes.POR_ID_PUBLICO(id)?.papeis ?? []).includes('attack');
/** Os slots da fileira de ataque deste personagem, em ordem (fixos fora do PoE; no PoE, os que têm habilidade de ataque). */
export function slotsDoCombo(estado) {
  if (!BARRA_DO_POE) return SLOTS_DO_COMBO;
  const acoes = estado?.actions ?? [];
  return Acoes.PAPEL_DO_SLOT.map((_, i) => i).filter((i) => ehDeAtaque(acoes[i]?.id));
}
/** Este slot é da fileira de ataque (o combo, com os modos) — e não do sustento? */
export const ehDoCombo = (estado, slot) => (BARRA_DO_POE ? ehDeAtaque(estado?.actions?.[slot]?.id) : Acoes.PAPEL_DO_SLOT[slot] === 'attack');
/** A fileira mudou (no PoE: trocou a gema de um slot): a memória dos modos (cursor, histórico) é da fileira de antes — zera. */
function fileiraDoTique(estado, hunt) {
  const slots = slotsDoCombo(estado);
  const assinatura = slots.map((s) => `${s}:${estado.actions?.[s]?.id}`).join(',');
  if (hunt.fileiraDoCombo !== assinatura) {
    hunt.fileiraDoCombo = assinatura;
    delete hunt.cursorDoCombo;
    delete hunt.ultimasDoCombo;
    delete hunt.ultimaOutraDoCombo;
  }
  return slots;
}

// Bloqueios da fileira inteira: esperar, sem pular a vez do slot.
// (CONJURANDO: a skill da vez está sendo conjurada — a fileira espera ela terminar.)
const DA_FILEIRA = new Set(['COOLDOWN_GLOBAL', 'COOLDOWN_DO_GRUPO', 'CONJURANDO']);

export const MODOS = ['prioridade', 'limite', 'rotacao'];
export const MODO_PADRAO = 'prioridade';
export const LIMITE_PADRAO = 2;
export const LIMITES = [1, 2, 3];
/** Quantas execuções o histórico do modo Limite guarda (W nunca passa de 11, a fileira inteira). */
const HISTORICO = 11;

/** O modo e o limite deste personagem (sempre válidos: um valor estranho vira o padrão). */
export function modoDe(estado) {
  const modo = MODOS.includes(estado?.settings?.modoDasMagias) ? estado.settings.modoDasMagias : MODO_PADRAO;
  const limite = LIMITES.includes(estado?.settings?.limiteDasMagias) ? estado.settings.limiteDasMagias : LIMITE_PADRAO;
  return { modo, limite };
}

/** `send({t:'modoDasMagias', modo, limite?})` — o jogador escolhe na tela da barra. */
export function definirModo(estado, { modo, limite } = {}) {
  if (!MODOS.includes(modo)) return { ok: false, erro: 'Modo desconhecido.' };
  if (limite != null && !LIMITES.includes(Number(limite))) return { ok: false, erro: 'O limite vai de 1 a 3.' };
  const settings = (estado.settings ??= {});
  settings.modoDasMagias = modo;
  if (limite != null) settings.limiteDasMagias = Number(limite);
  // Trocou de modo: o cursor e o histórico de antes não valem para o novo.
  if (estado.hunt) {
    delete estado.hunt.cursorDoCombo;
    delete estado.hunt.ultimasDoCombo;
    delete estado.hunt.ultimaOutraDoCombo;
  }
  const nomes = { prioridade: 'Prioridade', limite: `Limite (${modoDe(estado).limite} por janela)`, rotacao: 'Rotação' };
  return { ok: true, notice: `Ordem das magias de ataque: ${nomes[modo]}.` };
}

/**
 * A ordem em que as posições da fileira (0..10) são tentadas neste tique, pelo
 * modo, pelas Regras de Uso ativas e pelo limite — nesta ordem.
 */
export function ordemDoTique(estado, hunt, regras) {
  const acoes = estado.actions ?? [];
  const slots = fileiraDoTique(estado, hunt);
  const total = slots.length;
  if (!total) return [];
  const idDe = (posicao) => acoes[slots[posicao]]?.id;
  const { modo, limite } = modoDe(estado);
  // 1. O modo: do slot 1 (prioridade, limite) ou do slot seguinte ao último que saiu (rotação).
  const inicio = modo === 'rotacao' ? (((hunt.cursorDoCombo ?? 0) % total) + total) % total : 0;
  let ordem = Array.from({ length: total }, (_, passo) => (inicio + passo) % total);
  // 2. As Regras de Uso: só as que elas deixam, as preferidas primeiro (empate: a ordem do modo).
  if (regras.length) {
    ordem = ordem
      .filter((posicao) => !idDe(posicao) || RegrasDeUso.permitida(idDe(posicao), regras, { ataque: true }))
      .map((posicao, i) => ({ posicao, i, peso: RegrasDeUso.peso(idDe(posicao), regras) }))
      .sort((a, b) => b.peso - a.peso || a.i - b.i)
      .map((x) => x.posicao);
  }
  // 3. O limite (o que o dono aprovou: com N = 2 e quatro magias, "Fire, Fire, Ice, Death, Fire,
  //    Fire, Light..."): numa volta de W execuções seguidas (W = as magias que podem entrar),
  //    a de MAIOR prioridade (a primeira da ordem) sai até N vezes — nunca a volta inteira — e
  //    cada uma das outras no máximo 1 vez, revezando-se nas brechas a partir da seguinte à
  //    última delas que saiu. Quem bateu o teto vai para o fim da fila: se nenhuma outra puder
  //    sair, ela sai mesmo assim (a janela nunca fica vazia por causa do limite).
  hunt.topoDoCombo = null;
  if (modo === 'limite') {
    const ativos = ordem.filter((posicao) => {
      const a = acoes[slots[posicao]];
      return a?.id && a.enabled !== false;
    });
    const w = ativos.length;
    if (w > 1) {
      // A de maior prioridade AGORA: a primeira que não está em recarga (o slot 1 de recarga longa,
      // recarregando, não segura as de baixo — a seguinte assume a vez dele).
      const agora = hunt.clock ?? 0;
      const recarregando = (posicao) => (hunt.cooldowns?.[idDe(posicao)]?.ate ?? 0) > agora;
      const topo = ativos.find((p) => !recarregando(p)) ?? ativos[0];
      hunt.topoDoCombo = topo;
      const teto = (posicao) => (posicao === topo ? Math.min(limite, w - 1) : 1);
      // A volta que ESTA execução fecharia: as últimas W−1.
      const ultimas = (hunt.ultimasDoCombo ?? []).slice(-(w - 1));
      const cheia = (posicao) => ultimas.filter((id) => id === idDe(posicao)).length >= teto(posicao);
      const outras = ativos.filter((p) => p !== topo);
      const k = outras.indexOf(hunt.ultimaOutraDoCombo);
      const fila = [topo, ...(k >= 0 ? [...outras.slice(k + 1), ...outras.slice(0, k + 1)] : outras)];
      ordem = [...fila.filter((p) => !cheia(p)), ...fila.filter(cheia), ...ordem.filter((p) => !fila.includes(p))];
    }
  }
  return ordem;
}

/*
 * ---- O log do combo ----
 *
 * Desligado por padrão (é uma linha por tentativa, quatro vezes por segundo
 * por jogador caçando). Liga com a variável de ambiente `DRAEVOR_COMBO_LOG=1`
 * no servidor, ou com `ouvirCombo(fn)` — que é como os testes leem as linhas.
 */
let ouvinte = null;
export const ouvirCombo = (fn) => {
  ouvinte = fn;
};
const LOG_NO_CONSOLE = globalThis.process?.env?.DRAEVOR_COMBO_LOG === '1';
const hora = (ms) => new Date(ms).toISOString().slice(11, 23);

let quemAgora = null;
function registrar(linha) {
  linha.quem ??= quemAgora;
  ouvinte?.(linha);
  if (!LOG_NO_CONSOLE) return;
  const partes = [`[COMBO] ${linha.quem ?? ''} ${linha.evento ?? ''}`.trim()];
  if (linha.slot != null) partes.push(`Slot: ${linha.slot}`, `Skill: ${linha.skill ?? '—'}`);
  partes.push(`Timestamp: ${hora(linha.parede)} (relógio ${linha.relogio} ms)`);
  if (linha.desdeUltimaMs != null) partes.push(`Intervalo desde última execução: ${linha.desdeUltimaMs} ms`);
  if (linha.recargaRestanteMs != null) partes.push(`Cooldown restante: ${linha.recargaRestanteMs} ms`);
  if (linha.resultado) partes.push(`Resultado: ${linha.resultado}`);
  if (linha.motivo) partes.push(`Motivo: ${linha.motivo}`);
  console.log(partes.join(' | '));
}

/**
 * Um tique do combo: tenta os slots da fileira de ataque na ordem do MODO
 * (`ordemDoTique`) e para no primeiro que executar (ou num bloqueio da fileira
 * inteira). Devolve os eventos da skill que saiu (vazio se nenhuma).
 */
export function tiqueDoCombo(estado, hunt, personagem, alvo) {
  const acoes = estado.actions ?? [];
  quemAgora = personagem?.nome ?? null;
  const parede = hunt.ultimoTique ?? Date.now();
  const relogio = hunt.clock ?? 0;
  const desde = () => (hunt.ultimoAtaqueEm == null ? null : relogio - hunt.ultimoAtaqueEm);
  // A mesma trava de sempre: juntando bichos, a fileira de ataque espera.
  if (hunt.lurando) return [];

  // A ordem: a dos slots (1, 2, 3...) — e, com REGRAS DE USO ativas
  // (`regras-de-uso.mjs`, configuradas pelo jogador), só as skills que elas
  // deixam, as preferidas primeiro (empate: a ordem dos slots).
  const ordem = ordemDoTique(estado, hunt, RegrasDeUso.ativas(estado, hunt, alvo));
  const slots = slotsDoCombo(estado);
  const total = slots.length;
  for (const posicao of ordem) {
    const slot = slots[posicao];
    const action = acoes[slot];
    // Vazio ou desligado: não há o que tentar (e nem o que registrar a cada tique).
    if (!action?.id || action.enabled === false) continue;
    const linha = { slot: posicao + 1, indice: slot, skill: action.id, parede, relogio, desdeUltimaMs: desde() };
    if (!Acoes.condicoesDoSlotBatem(action, estado, alvo, hunt)) {
      Acoes.marcarParado(hunt, slot, Acoes.falhaDaCondicao(action, estado, alvo, hunt));
      registrar({ ...linha, resultado: 'IGNORADA', motivo: 'CONDICAO' });
      continue;
    }
    const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo);
    const recarga = hunt.cooldowns?.[action.id];
    const recargaRestanteMs = recarga ? Math.max(0, recarga.ate - relogio) : 0;
    if (resultado.ok) {
      // `logico`: o instante em que ela conta (relógio lógico — `R.instanteLogico`); `relogio` é o do tique.
      registrar({ ...linha, resultado: 'EXECUTADA', recargaRestanteMs, logico: hunt.ultimoAtaqueEm });
      // A memória dos modos: o slot seguinte para a rotação, e o histórico para o limite.
      hunt.cursorDoCombo = (posicao + 1) % total;
      // (Limite: a última das OUTRAS que saiu — a próxima brecha começa na seguinte a ela.)
      if (hunt.topoDoCombo != null && posicao !== hunt.topoDoCombo) hunt.ultimaOutraDoCombo = posicao;
      const ultimas = (hunt.ultimasDoCombo ??= []);
      ultimas.push(action.id);
      if (ultimas.length > HISTORICO) ultimas.splice(0, ultimas.length - HISTORICO);
      return resultado.eventos;
    }
    registrar({
      ...linha,
      resultado: 'IGNORADA',
      motivo: resultado.motivo ?? resultado.erro,
      recargaRestanteMs: resultado.motivo === 'COOLDOWN' ? resultado.faltaMs : recargaRestanteMs,
    });
    // Bloqueio da fileira inteira (cooldown global, grupo, conjuração): nada sai neste tique.
    if (DA_FILEIRA.has(resultado.motivo)) return [];
  }
  return [];
}

/** O cooldown global base (a cadência do combo sem Cast Speed). */
export const COOLDOWN_GLOBAL_MS = R.GLOBAL_SPELL_COOLDOWN;
