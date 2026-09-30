// O COMBO: a fileira de ataque da barra (os 11 slots `attack` de
// `Acoes.PAPEL_DO_SLOT`), percorrida em RODÍZIO pelo loop automático da caçada.
//
// ---- O defeito que isto corrige ----
//
// O `autoDisparo` (cacadas.mjs) percorria a barra inteira a partir do slot 0 em
// todo tique e disparava o PRIMEIRO slot de ataque que estivesse pronto. A
// primeira magia que saía ligava a recarga do grupo de ataque (1 s no efetivo,
// ver `recargaDe` em acoes.mjs), e as seguintes ficavam em "Ainda
// recarregando". No tique em que o grupo liberava, a varredura recomeçava do
// slot 0 — e as magias do começo da fileira, de recarga curta, já estavam
// prontas de novo. Medido (sorcerer, 11 magias diferentes, 30 s): só o slot 1
// saiu, 30 vezes; com uma magia de 4 s no slot 1, os slots 1 e 2 se revezavam e
// do 3 ao 11 nada saía.
//
// ---- O rodízio ----
//
// Um cursor por caçada (`hunt.cursorDoCombo`, 0..10 dentro da fileira). A cada
// tique a varredura começa no cursor e dá a volta (…, 11, 1, 2, …); o primeiro
// slot que EXECUTA de verdade avança o cursor para o seguinte a ele. Slot que
// não pode executar (recarga própria, mana, alvo, alcance, condição, vazio,
// desligado) é pulado com o motivo — como já era: pular não gasta a vez de
// ninguém. Quando o bloqueio é da fileira inteira (o intervalo do combo ou a
// recarga do grupo de ataque), a varredura para ali e o cursor não anda: o
// slot da vez espera, em vez de ser pulado.
//
// Quem decide se a skill sai continua sendo SÓ `Acoes.disparar`: recarga
// individual, recarga do grupo, o intervalo mínimo do combo
// (`R.COMBO_SKILL_INTERVAL_MS`), mana, alvo, alcance e condições estão lá. Este
// arquivo só decide a ORDEM em que os slots são tentados.
import * as Acoes from './acoes.mjs';
import * as R from './regras.mjs';

/** Os índices da barra que são da fileira de ataque, em ordem (11..21). */
export const SLOTS_DO_COMBO = Acoes.PAPEL_DO_SLOT.map((papel, i) => (papel === 'attack' ? i : -1)).filter((i) => i >= 0);

// Bloqueios da fileira inteira: esperar, sem pular a vez do slot.
// (CONJURANDO: a skill da vez está sendo conjurada — a fileira espera ela terminar.)
const DA_FILEIRA = new Set(['INTERVALO_DO_COMBO', 'COOLDOWN_DO_GRUPO', 'CONJURANDO']);

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
 * Um tique do combo: tenta os slots da fileira de ataque a partir do cursor e
 * para no primeiro que executar (ou num bloqueio da fileira inteira).
 * Devolve os eventos da skill que saiu (vazio se nenhuma).
 */
export function tiqueDoCombo(estado, hunt, personagem, alvo) {
  const acoes = estado.actions ?? [];
  const total = SLOTS_DO_COMBO.length;
  const inicio = ((hunt.cursorDoCombo ?? 0) % total + total) % total;
  quemAgora = personagem?.nome ?? null;
  const parede = hunt.ultimoTique ?? Date.now();
  const relogio = hunt.clock ?? 0;
  const desde = () => (hunt.ultimoAtaqueEm == null ? null : relogio - hunt.ultimoAtaqueEm);
  // A mesma trava de sempre: juntando bichos, a fileira de ataque espera.
  if (hunt.lurando) return [];

  for (let passo = 0; passo < total; passo++) {
    const posicao = (inicio + passo) % total;
    const slot = SLOTS_DO_COMBO[posicao];
    const action = acoes[slot];
    // Vazio ou desligado: não há o que tentar (e nem o que registrar a cada tique).
    if (!action?.id || action.enabled === false) continue;
    const linha = { slot: posicao + 1, indice: slot, skill: action.id, parede, relogio, desdeUltimaMs: desde() };
    if (!Acoes.condicoesDoSlotBatem(action, estado, alvo, hunt)) {
      registrar({ ...linha, resultado: 'IGNORADA', motivo: 'CONDICAO' });
      continue;
    }
    const resultado = Acoes.disparar(estado, hunt, personagem, slot, alvo);
    const recarga = hunt.cooldowns?.[action.id];
    const recargaRestanteMs = recarga ? Math.max(0, recarga.ate - relogio) : 0;
    if (resultado.ok) {
      registrar({ ...linha, resultado: 'EXECUTADA', recargaRestanteMs });
      hunt.cursorDoCombo = (posicao + 1) % total;
      // Passou do último slot da fileira: a volta seguinte começa do slot 1.
      if (hunt.cursorDoCombo === 0) registrar({ evento: 'FIM DO CICLO → volta ao Slot 1', parede, relogio });
      return resultado.eventos;
    }
    registrar({
      ...linha,
      resultado: 'IGNORADA',
      motivo: resultado.motivo ?? resultado.erro,
      recargaRestanteMs: resultado.motivo === 'COOLDOWN' ? resultado.faltaMs : recargaRestanteMs,
    });
    // Bloqueio da fileira inteira: o slot da vez espera, ninguém é pulado.
    if (DA_FILEIRA.has(resultado.motivo)) return [];
  }
  return [];
}

export const INTERVALO_DO_COMBO_MS = R.COMBO_SKILL_INTERVAL_MS;
