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
// Quem decide se a skill sai continua sendo SÓ `Acoes.disparar` (servidor):
// recarga individual, recarga do grupo, cooldown global, mana, alvo, alcance e
// condições estão lá — inclusive para o clique/tecla manual. Este arquivo só
// decide a ORDEM em que os slots são tentados.
import * as Acoes from './acoes.mjs';
import * as R from './regras.mjs';
import * as RegrasDeUso from './skills/regras-de-uso.mjs';

/** Os índices da barra que são da fileira de ataque, em ordem (11..21). */
export const SLOTS_DO_COMBO = Acoes.PAPEL_DO_SLOT.map((papel, i) => (papel === 'attack' ? i : -1)).filter((i) => i >= 0);

// Bloqueios da fileira inteira: esperar, sem pular a vez do slot.
// (CONJURANDO: a skill da vez está sendo conjurada — a fileira espera ela terminar.)
const DA_FILEIRA = new Set(['COOLDOWN_GLOBAL', 'COOLDOWN_DO_GRUPO', 'CONJURANDO']);

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
 * Um tique do combo: tenta os slots da fileira de ataque a partir do PRIMEIRO,
 * em ordem, e para no primeiro que executar (ou num bloqueio da fileira
 * inteira). Devolve os eventos da skill que saiu (vazio se nenhuma).
 */
export function tiqueDoCombo(estado, hunt, personagem, alvo) {
  const acoes = estado.actions ?? [];
  const total = SLOTS_DO_COMBO.length;
  quemAgora = personagem?.nome ?? null;
  const parede = hunt.ultimoTique ?? Date.now();
  const relogio = hunt.clock ?? 0;
  const desde = () => (hunt.ultimoAtaqueEm == null ? null : relogio - hunt.ultimoAtaqueEm);
  // A mesma trava de sempre: juntando bichos, a fileira de ataque espera.
  if (hunt.lurando) return [];

  // A ordem: a dos slots (1, 2, 3...) — e, com REGRAS DE USO ativas
  // (`regras-de-uso.mjs`, configuradas pelo jogador), só as skills que elas
  // deixam, as preferidas primeiro (empate: a ordem dos slots).
  const regras = RegrasDeUso.ativas(estado, hunt, alvo);
  let ordem = Array.from({ length: total }, (_, posicao) => posicao);
  if (regras.length) {
    ordem = ordem
      .filter((posicao) => {
        const id = acoes[SLOTS_DO_COMBO[posicao]]?.id;
        return !id || RegrasDeUso.permitida(id, regras, { ataque: true });
      })
      .map((posicao) => ({ posicao, peso: RegrasDeUso.peso(acoes[SLOTS_DO_COMBO[posicao]]?.id, regras) }))
      .sort((a, b) => b.peso - a.peso || a.posicao - b.posicao)
      .map((x) => x.posicao);
  }
  for (const posicao of ordem) {
    const slot = SLOTS_DO_COMBO[posicao];
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
      registrar({ ...linha, resultado: 'EXECUTADA', recargaRestanteMs });
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
