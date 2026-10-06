// As MISSÕES que dão gemas, como no PoE (dono, 06/10: "implemente as gemas de suporte e suas missões" — e "como no PoE": ao concluir a
// missão o jogador ESCOLHE uma gema da lista da classe dele, no nível 1; só gemas ativas e suportes; a Zuma continua vendendo todas).
// Só com ITENS_POE=1. Os dados: `gamedata/itens-poe/missoes-de-gemas.json` (tools/importar-missoes-de-gemas.mjs, da coleção do Drive).
//
// A missão conclui quando a campanha completa, pela PRIMEIRA vez, a fase onde ela termina (`gatilho.fase`) — ou vence o chefe do ato
// (`gatilho.bossDoAto`, o Malachai do Ato 4). Uma vez por personagem, em qualquer dificuldade. A recompensa fica PENDENTE
// (`estado.missoesPoe[slug].escolhida === null`) até o jogador escolher: a gema vai para a mochila, nível 1, qualidade 0.
import { readFileSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import * as GemasPoe from './gemas-poe.mjs';
import * as SuportesPoe from './suportes-poe.mjs';
import * as Gemas from '../skills/gemas.mjs';

export const MISSOES = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/missoes-de-gemas.json', import.meta.url), 'utf8')).missoes;
const POR_SLUG = new Map(MISSOES.map((m) => [m.slug, m]));

/** O item de uma gema da recompensa (`{ tipo, slug }`), ou null se ela não está no jogo. */
const itemDe = (g) => (g.tipo === 'suporte' ? SuportesPoe.doSlug(g.slug)?.itemId : GemasPoe.doSlug(g.slug)?.itemId) ?? null;

/** As gemas que a missão oferece à classe (ids de item, sem repetir). */
export function opcoes(missao, classe) {
  return [...new Set((missao?.recompensas?.[classe] ?? []).map(itemDe).filter(Boolean))];
}

function concluir(estado, missao) {
  if (!ligado() || !missao) return null;
  const feitas = (estado.missoesPoe ??= {});
  if (feitas[missao.slug]) return null;
  const op = opcoes(missao, estado.classePoe);
  // Classe sem recompensa nesta missão (no PoE algumas só dão para três classes): conclui sem nada para escolher.
  feitas[missao.slug] = { em: Date.now(), escolhida: op.length ? null : 0 };
  return op.length ? missao : null;
}
/** O aviso que vai junto do "Fase completa": as missões que a conclusão fechou e têm recompensa para escolher. */
const aviso = (novas) => (novas.length ? ` Missão concluída: ${novas.map((m) => m.nome).join(', ')} — escolha a sua gema de recompensa.` : '');

/** A campanha completou a fase `huntId` (a primeira vez): conclui as missões que terminam nela. Devolve o texto para o aviso. */
export function aoCompletarFase(estado, huntId) {
  return aviso(MISSOES.filter((m) => m.gatilho?.fase === huntId).map((m) => concluir(estado, m)).filter(Boolean));
}
/** O chefe do ato `ato` caiu: conclui as missões que terminam nele. Devolve o texto para o aviso. */
export function aoVencerBoss(estado, ato) {
  return aviso(MISSOES.filter((m) => Number(m.gatilho?.bossDoAto) === Number(ato)).map((m) => concluir(estado, m)).filter(Boolean));
}

/** As recompensas esperando escolha: `[{ slug, nome, ato, opcoes: [itemId] }]`. */
export function pendentes(estado) {
  if (!ligado()) return [];
  return Object.entries(estado?.missoesPoe ?? {})
    .filter(([, v]) => v?.escolhida === null)
    .map(([slug]) => POR_SLUG.get(slug))
    .filter(Boolean)
    .map((m) => ({ slug: m.slug, nome: m.nome, ato: m.ato, opcoes: opcoes(m, estado.classePoe) }));
}

/** `send({t:'recompensaDeMissao', missao, itemId})` — escolhe a gema (uma da lista da classe) e ela vai para a mochila, nível 1. */
export function escolher(estado, { missao, itemId }) {
  if (!ligado()) return { ok: false, erro: 'As missões do PoE não estão ligadas.' };
  const m = POR_SLUG.get(missao);
  const feita = estado?.missoesPoe?.[missao];
  if (!m || !feita) return { ok: false, erro: 'Essa missão ainda não foi concluída.' };
  if (feita.escolhida !== null) return { ok: false, erro: 'A recompensa desta missão já foi escolhida.' };
  const id = Number(itemId);
  if (!opcoes(m, estado.classePoe).includes(id)) return { ok: false, erro: 'Essa gema não é uma das recompensas desta missão para a sua classe.' };
  (estado.inventory ??= []).push(Gemas.itemDaGema(Gemas.novaGema(id)));
  feita.escolhida = id;
  const def = Gemas.defDaGema(id);
  return { ok: true, notice: `Recompensa de ${m.nome}: ${def?.nome ?? 'gema'} (nível 1) na mochila.` };
}
