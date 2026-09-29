// Quem está CAÇANDO de aba fechada agora — para o número de online e a página
// /online (ver `site.mjs`) e o contador do jogo (o `welcome`, sessao.mjs).
//
// "isso está mudando a quantidade de online? (tem que mudar)". Num jogo idle o
// personagem que caça offline está jogando: ele entra no número, com o
// detalhamento (`conectados` / `cacandoOffline`) nas respostas, e na lista com
// o selo de "caçando offline".
//
// A leitura é pelas colunas-índice (`caca_offline_ate > agora`, ver
// `database/caca-offline.mjs`), guardada em memória e refeita a cada minuto (e
// depois de cada rodada da consolidação): o número vai em toda página de
// status e em todo `welcome`, e não pode custar uma consulta a cada vez.
// Quem está conectado sai da lista na hora de ler (`vivas`): o autosave de quem
// caça online grava o personagem "como se fosse sair" (para sobreviver a uma
// queda do servidor), e sem isso ele contaria duas vezes.
import { banco } from '../database/banco.mjs';

const ATUALIZAR_MS = 60_000;
const TETO_DA_LISTA = 500;

const consulta = banco.prepare(
  banco.dialeto === 'postgres'
    ? `SELECT nome, vocacao, caca_offline_ate AS ate,
         (estado::jsonb #>> '{level}')::int AS level,
         (estado::jsonb #>> '{xp}')::numeric AS xp,
         estado::jsonb ->> 'outfit' AS outfit,
         estado::jsonb #>> '{hunt,huntId}' AS hunt
       FROM personagens WHERE caca_offline_ate > ?
       ORDER BY caca_offline_ate DESC LIMIT ${TETO_DA_LISTA}`
    : `SELECT nome, vocacao, caca_offline_ate AS ate,
         json_extract(estado, '$.level') AS level,
         json_extract(estado, '$.xp') AS xp,
         json_extract(estado, '$.outfit') AS outfit,
         json_extract(estado, '$.hunt.huntId') AS hunt
       FROM personagens WHERE caca_offline_ate > ?
       ORDER BY caca_offline_ate DESC LIMIT ${TETO_DA_LISTA}`,
);

let lista = [];
let vivas = null;
let relogio = null;

/** Relê do banco quem está caçando offline. */
export async function atualizar(agora = Date.now()) {
  try {
    const linhas = await consulta.all(agora);
    lista = linhas.map((r) => {
      let outfit = null;
      try {
        outfit = typeof r.outfit === 'string' ? JSON.parse(r.outfit) : r.outfit ?? null;
      } catch {
        outfit = null;
      }
      return { nome: r.nome, vocacao: r.vocacao, level: Number(r.level) || 1, xp: Number(r.xp) || 0, outfit, huntId: r.hunt ?? null, ate: Number(r.ate) };
    });
  } catch (e) {
    console.error('ausentes ->', e.message);
  }
}

/** Liga à lista de sessões vivas e começa a atualizar (o servidor chama no boot). */
export function ligar(mapaDeVivas) {
  vivas = mapaDeVivas;
  if (relogio) return;
  atualizar();
  relogio = setInterval(() => atualizar(), ATUALIZAR_MS);
  relogio.unref();
}

/** Os que estão caçando offline AGORA (sem quem está conectado). */
export function agora(momento = Date.now()) {
  return lista.filter((a) => a.ate > momento && !vivas?.get(a.nome)?.personagem);
}

/** Quantos estão caçando offline agora. */
export const contagem = (momento = Date.now()) => agora(momento).length;

/** A caçada offline de alguém, se ele estiver caçando de aba fechada agora (senão `null`). */
export function cacando(nome, momento = Date.now()) {
  const alvo = String(nome ?? '').toLowerCase();
  return agora(momento).find((a) => a.nome.toLowerCase() === alvo) ?? null;
}
