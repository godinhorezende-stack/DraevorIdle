// As TAGS de cada skill (magia, runa, item de uso) e do golpe básico — o que
// as especializações consultam (`personagem/especializacoes.mjs`).
//
// O dono: "criar um sistema de tags para que o motor consiga identificar
// automaticamente: Melee, Ranged, Spell, Physical, Fire, ... Projectile, Area,
// Single Target, Cone, Wave, Line, Buff, Debuff". As tags saem dos campos que
// o catálogo já tem (`kind`, `element`, `area`/`forma`, `projetil`, `heals`,
// `papeis`, `cadeia`, `summon`), mais as exceções de
// `gamedata/skills/tags.json`. Skill nova no catálogo ganha tags sozinha.
//
// E a CLASSE RECOMENDADA: as vocações de antes (o catálogo do original) — só
// uma recomendação agora; nada bloqueia por classe (modelo Path of Exile).
import { readFileSync } from 'node:fs';

const EXCECOES = JSON.parse(readFileSync(new URL('../../gamedata/skills/tags.json', import.meta.url), 'utf8')).excecoes ?? {};
export const ELEMENTOS = ['physical', 'fire', 'earth', 'energy', 'ice', 'holy', 'death'];

/** A forma pega só para a frente (onda/cone/varredura)? — as casas vêm olhando para o norte. */
const soParaFrente = (forma) => forma.some(([, dy]) => dy < 0) && !forma.some(([, dy]) => dy > 0);
/** Uma linha só (feixe): todas as casas na mesma coluna. */
const emLinha = (forma) => forma.length > 2 && forma.every(([dx]) => dx === 0);

/** As tags de uma entrada do catálogo de ações (`ACTION_CATALOG`). */
export function tagsDaAcao(entry) {
  if (!entry) return [];
  const t = new Set();
  if (entry.kind === 'spell') t.add('spell');
  if (entry.kind === 'rune') t.add('spell').add('rune');
  if (entry.kind === 'item') t.add('item');
  const el = entry.element === 'poison' ? 'earth' : entry.element;
  if (ELEMENTOS.includes(el)) t.add(el);
  if (el === 'healing' || entry.heals || entry.papeis?.includes('hp')) t.add('healing');
  const forma = Array.isArray(entry.forma) && entry.forma.length ? entry.forma : null;
  if (forma) {
    if (emLinha(forma)) t.add('line');
    else if (soParaFrente(forma)) t.add('wave');
    else t.add('area');
  } else if (entry.area) t.add('area');
  if (entry.cadeia) t.add('chain');
  // O `projetil` do catálogo é o efeito que voa: só é Projectile de verdade se vai longe (o Brutal Strike tem um, e é corpo a corpo).
  if (entry.projetil && (entry.range ?? 1) > 1) t.add('projectile');
  if (!forma && !entry.area && !entry.cadeia && (entry.papeis?.includes('attack'))) t.add('single');
  if (entry.papeis?.includes('suporte')) t.add('buff');
  if (entry.papeis?.includes('velocidade')) t.add('buff').add('mobility');
  if (entry.summon) t.add('summon');
  // Golpe físico de magia: perto (alcance 1, ou área em volta de quem lança) é Melee; de longe, Ranged.
  if (el === 'physical' && entry.papeis?.includes('attack')) {
    const emVolta = (forma || entry.area) && !entry.miraNoChao && !entry.alvoNoCentro;
    t.add((entry.range ?? 1) <= 1 || emVolta ? 'melee' : 'ranged');
  }
  const exc = EXCECOES[entry.id];
  for (const x of exc?.mais ?? []) t.add(x);
  for (const x of exc?.menos ?? []) t.delete(x);
  return [...t];
}

/**
 * As tags do golpe BÁSICO (auto-ataque): `categoria` é a da arma
 * (`categoriaDaArma`: 'corpo', 'distancia' ou 'magica'); `elemento` o da wand/rod.
 */
export function tagsDoGolpe(categoria, elemento = null) {
  if (categoria === 'magica') {
    const el = elemento === 'poison' ? 'earth' : elemento;
    return ['attack', 'ranged', 'projectile', 'single', ...(ELEMENTOS.includes(el) ? [el] : [])];
  }
  if (categoria === 'distancia') return ['attack', 'ranged', 'projectile', 'single', 'physical'];
  return ['attack', 'melee', 'single', 'physical'];
}

/** A classe recomendada da skill: as vocações do catálogo (vazio = todas). */
export const classeRecomendada = (entry) => [...new Set((entry?.vocations ?? []).map((v) => String(v).toLowerCase()))];
