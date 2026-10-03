// HOT RELOAD no cliente do jogo (só chega no ambiente local): o servidor manda `{ t: 'contentUpdate', tipo, ids, revisao, ... }` quando a Engine salva um
// recurso, e aqui só o recurso afetado é atualizado — sem recarregar a página, sem mexer na posição nem no estado do personagem.
import { atualizarSpritesDoJogo } from './sprites.mjs';

/**
 * Aplica um aviso. `ctx`: `{ state, redraw }` (o estado do cliente e o redesenho dos painéis). Devolve uma frase para o console/histórico.
 * Nunca lança: uma atualização que falha deixa o jogo como estava.
 */
export async function aplicarContentUpdate(msg, { state, redraw = null } = {}) {
  let resumo = '';
  try {
    if (msg.tipo === 'sprites') {
      const looks = await atualizarSpritesDoJogo(msg);
      resumo = `sprites trocados: ${looks.join(', ') || 'nenhum'}`;
    } else if (msg.tipo === 'monstros') {
      const bestiario = state?.catalog?.bestiary;
      if (bestiario) for (const [chave, entrada] of Object.entries(msg.monstros ?? {})) { if (entrada) bestiario[chave] = entrada; else delete bestiario[chave]; }
      resumo = `monstros: ${(msg.ids ?? []).join(', ')}`;
    } else {
      resumo = `${msg.tipo}: ${(msg.ids ?? []).join(', ') || 'atualizado'}`;
    }
    document.dispatchEvent(new CustomEvent('draevor:conteudo-atualizado', { detail: msg }));
    redraw?.();
  } catch (e) {
    resumo = `falhou (${e.message}); o jogo segue como estava`;
    console.warn('[hot-reload]', e);
  }
  console.info(`[hot-reload] revisão ${msg.revisao}: ${resumo}`);
  return resumo;
}
