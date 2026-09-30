// As REGRAS DE USO AUTOMÁTICO das skills, por TAG (etapa 5 do plano, 30/09):
//   "Se bichos por perto ≥ 3 → preferir skills de ÁREA"
//   "Se boss → só usar skills de ALVO ÚNICO"
//   "Se mana ≤ 20% → não usar skills de BUFF"
// Genéricas: a condição é a mesma dos slots (vida/mana, bichos por perto, boss,
// criatura — `Acoes.condicoesDoSlotBatem`) e o efeito vale para toda skill com a
// tag, sem nome de skill em lugar nenhum. Moram no personagem (`estado.regrasDeUso`).
// Sem regra, a barra funciona como sempre.
//
//   preferir:  as skills com a tag são tentadas PRIMEIRO na rotação de ataque;
//   somente:   na rotação de ataque, só as skills com a tag saem;
//   bloquear:  as skills com a tag não saem (ataque, buff, suporte — cura e poção não).
import * as Acoes from '../acoes.mjs';
import * as Tags from './tags.mjs';
import { ACTION_CATALOG } from '../dados.mjs';

export const ACOES_DA_REGRA = ['preferir', 'somente', 'bloquear'];
export const MAXIMO_DE_REGRAS = 12;
// As tags que uma regra pode citar (as das skills; ver tags.mjs).
export const TAGS = ['attack', 'spell', 'rune', 'physical', 'fire', 'earth', 'energy', 'ice', 'holy', 'death', 'healing', 'melee', 'ranged', 'projectile', 'area', 'single', 'wave', 'line', 'chain', 'buff', 'mobility', 'summon', 'hit', 'ground'];
const TIPOS_DE_CONDICAO = new Set(['stat', 'perto', 'boss', 'nome']);

const POR_ID = new Map([...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes, ...ACTION_CATALOG.items].map((e) => [e.id, e]));
const tagsCache = new Map();
const tagsDe = (id) => {
  if (!tagsCache.has(id)) tagsCache.set(id, Tags.tagsDaAcao(POR_ID.get(id)));
  return tagsCache.get(id);
};

/** Uma condição válida (o mesmo formato das do slot) ou null. */
function condicao(c) {
  if (!c || !TIPOS_DE_CONDICAO.has(c.kind ?? 'stat')) return null;
  const kind = c.kind ?? 'stat';
  if (kind === 'boss') return { kind, op: c.op === 'nao' ? 'nao' : 'sim' };
  if (kind === 'perto') return { kind, op: c.op === 'lte' ? 'lte' : 'gte', value: Math.max(0, Math.min(25, Math.round(Number(c.value) || 0))) };
  if (kind === 'nome') return { kind, op: c.op === 'diferente' ? 'diferente' : 'igual', names: (Array.isArray(c.names) ? c.names : []).map(String).slice(0, 20) };
  return {
    kind,
    who: c.who === 'target' ? 'target' : 'self',
    stat: c.stat === 'mana' ? 'mana' : 'hp',
    op: c.op === 'gte' ? 'gte' : 'lte',
    value: Math.max(0, Number(c.value) || 0),
    percent: c.percent !== false,
  };
}

/** A lista que o cliente mandou, limpa: só regras bem formadas, até `MAXIMO_DE_REGRAS`. */
export function sanear(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .slice(0, MAXIMO_DE_REGRAS)
    .map((r) => ({
      nome: String(r?.nome ?? '').slice(0, 40),
      ativa: r?.ativa !== false,
      quando: (Array.isArray(r?.quando) ? r.quando : []).map(condicao).filter(Boolean).slice(0, 4),
      acao: ACOES_DA_REGRA.includes(r?.acao) ? r.acao : 'preferir',
      tags: (Array.isArray(r?.tags) ? r.tags : []).filter((t) => TAGS.includes(t)).slice(0, 4),
    }))
    .filter((r) => r.tags.length);
}

/** As regras que valem AGORA: ligadas e com todas as condições batendo. */
export function ativas(estado, hunt, alvo) {
  const lista = estado?.regrasDeUso;
  if (!lista?.length) return [];
  return lista.filter((r) => r.ativa !== false && Acoes.condicoesDoSlotBatem({ conditions: r.quando }, estado, alvo, hunt));
}

const bate = (r, tags) => r.tags.some((t) => tags.includes(t));

/**
 * Esta skill pode sair, pelas regras ativas? `ataque`: é da rotação de ataque (o
 * `somente` só vale nela). Cura e poção nunca são barradas por regra.
 */
export function permitida(id, regras, { ataque = true } = {}) {
  if (!regras.length) return true;
  const tags = tagsDe(id);
  if (tags.includes('healing') || POR_ID.get(id)?.kind === 'item') return true;
  if (regras.some((r) => r.acao === 'bloquear' && bate(r, tags))) return false;
  const somente = regras.filter((r) => r.acao === 'somente');
  if (ataque && somente.length && !somente.some((r) => bate(r, tags))) return false;
  return true;
}

/** O peso de preferência da skill (quantas regras `preferir` ativas batem com ela). */
export const peso = (id, regras) => regras.filter((r) => r.acao === 'preferir' && bate(r, tagsDe(id))).length;
