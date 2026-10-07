// CLASSES e ESPECIALIZAÇÕES NATURAIS — `gamedata/classes.json`.
//
// O dono: "CLASSE ≠ RESTRIÇÃO; CLASSE = ESPECIALIZAÇÃO NATURAL". A classe (a
// vocação; a promoção é a mesma classe) dá especializações, e cada uma dá
// AFINIDADES: bônus de dano quando a skill/golpe tem a tag dela (Fire, Spell,
// Melee...) e bônus de stat (Armour, Life, Accuracy...). Nada aqui bloqueia.
//
// Funções PURAS sobre `estado`; quem soma na conta é a ficha (`ficha.mjs`,
// `Ficha.combate`) — a mesma do combate, da ficha, do balão e da comparação.
// Classe, especialização ou tag nova = dados no JSON, sem mexer no combate.
import * as Passivas from '../passivas/arvore.mjs';
import { readFileSync } from 'node:fs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/classes.json', import.meta.url), 'utf8'));

/** A classe do personagem (a vocação sem a promoção: "elite knight" → knight). */
export function classeDe(estado) {
  const v = String(estado?.vocation ?? 'none').toLowerCase();
  return CONFIG.classes[v] ? v : Object.keys(CONFIG.classes).find((k) => k !== 'none' && v.includes(k)) ?? 'none';
}

/** As especializações naturais da classe: `[{ id, nome, efeitos }]`. */
export function especializacoesDe(estado) {
  // No modo PoE as vocações do Draevor não dão especialização nenhuma (dono, 07/10: "esse bônus de vida Life 15% não existe no PoE — desligue"):
  // no PoE o bônus vem só da classe (atributos), da ascendência e da árvore. Os nós da árvore continuam somando em `efeitos` abaixo.
  if (itensPoeLigado()) return [];
  return (CONFIG.classes[classeDe(estado)]?.especializacoes ?? [])
    .map((id) => ({ id, ...CONFIG.especializacoes[id] }))
    .filter((e) => e.nome);
}

/**
 * Tudo o que as especializações dão, somado: `{ dano: {tag: pct}, stats: {chave: pct},
 * fontes: {tag|stat: [{ especializacao, pct }]} }`. `fontes` é para a ficha
 * dizer de onde veio cada bônus.
 */
export function efeitos(estado) {
  const dano = {};
  const stats = {};
  const fontes = {};
  for (const e of especializacoesDe(estado)) {
    for (const ef of e.efeitos ?? []) {
      const chave = ef.tag ?? ef.stat;
      const pct = Number(ef.dano ?? ef.pct) || 0;
      if (!chave || !pct) continue;
      if (ef.tag) dano[ef.tag] = (dano[ef.tag] ?? 0) + pct;
      else stats[ef.stat] = (stats[ef.stat] ?? 0) + pct;
      (fontes[chave] ??= []).push({ especializacao: e.nome, pct });
    }
  }
  // A ÁRVORE DE PASSIVAS: os nós de "+X% de dano <tag>" e "+X% <stat>" no mesmo formato (e na ficha, com a origem).
  const arv = Passivas.efeitos(estado);
  for (const [tag, pct] of Object.entries(arv.dano)) dano[tag] = (dano[tag] ?? 0) + pct;
  for (const [stat, pct] of Object.entries(arv.stats)) stats[stat] = (stats[stat] ?? 0) + pct;
  for (const [chave, lista] of Object.entries(arv.fontes)) (fontes[chave] ??= []).push(...lista);
  return { dano, stats, fontes };
}

/**
 * A afinidade de dano (em %) que vale para uma skill/golpe com estas `tags`:
 * a soma das especializações cuja tag está nela. `{ pct, fontes: [{ tag, especializacao, pct }] }`.
 * `danoPorTag` é o `efeitos(...).dano` (a ficha passa o dela, já calculado).
 */
export function afinidade(danoPorTag, tags, fontesPorTag = null) {
  let pct = 0;
  const fontes = [];
  for (const tag of new Set(tags ?? [])) {
    const v = danoPorTag?.[tag];
    if (!v) continue;
    pct += v;
    for (const f of fontesPorTag?.[tag] ?? [{ especializacao: tag, pct: v }]) fontes.push({ tag, ...f });
  }
  return { pct, fontes };
}
