// Proficiência de arma — a regra que o cliente (panels.mjs `renderProficiency`)
// diz morar no servidor.
//
// Do original (Zoros e Zotod; `api-mapeada/servidor/proficiency.json` e os
// welcomes de 2026-09-24/25):
// - A proficiência é POR ARMA (item), e a arma pertence a um grupo ("Sanguine
//   1H Sword") que define os perks; o steel axe do Zotod estava no nível 4 e o
//   hand axe, do mesmo grupo, no 0.
// - A view: `level` conta os limiares passados até a maestria (o steel axe tem
//   3 níveis de perk e estava no 4, com next 1.500.000); `max` é sempre 7;
//   `current`/`next` são os limiares em volta; `percent` o caminho entre eles.
//   Conferido: Zoros, sanguine blade, 89.765 de XP → nível 3, 80.000 → 300.000, 4,4386%.
// - As 3 tabelas de XP (knight, padrão, besta) — espada, machado, clava e punho
//   na de knight; besta na de 600; o resto na padrão.
// - XP por morte: ~163,7 por bicho entre duas capturas do Zoros (39.834 mortes,
//   quase todas de bichos 4 estrelas = 165 na tabela do Canary).
// - O alerta do botão: um nível liberado sem perk escolhido.
//
// Do Canary (weapon_proficiency.cpp, base do original — os perks das 678 armas
// batem um a um): XP por estrela do bestiary e por raridade de boss, a maestria
// (2 níveis além do último perk), e o que cada perk faz no combate.
//
// ESTIMADO (o original não mostrou): trocar de perk é de graça; os perks só
// valem com a arma na mão; XP também para quem está na party (com a arma dele).
// Sem efeito aqui (o jogo não tem o sistema por trás): aumento de magia
// específica (spellAugment), magic level especializado, chance/dano de acerto
// elemental, perfect shot e chance de acerto à distância.
import { readFileSync } from 'node:fs';
import { CATALOGO } from '../nucleo/dados.mjs';
import * as Treino from './treino.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/proficiencia.json', import.meta.url), 'utf8'));
const BESTIARY = CATALOGO.bestiary;
/** O `max` da view: sempre 7 no original (as estrelas da tela). */
const MAX_DA_VIEW = 7;

export const ehArma = (itemId) => !!DADOS.armas[itemId];

function limites(itemId) {
  const arma = DADOS.armas[itemId];
  const tabela = DADOS.tabelas[arma.tabela];
  const niveis = DADOS.grupos[arma.proficiency].length;
  const maestria = Math.min(tabela.length, niveis + DADOS.niveisDeMaestria);
  return { arma, tabela, niveis, maestria, maximo: tabela[maestria - 1] };
}

function nivelDoXp(xp, tabela, maestria) {
  let n = 0;
  while (n < maestria && xp >= tabela[n]) n++;
  return n;
}

const armaNaMao = (estado) => estado.equipment?.weapon?.id ?? null;
const dados = (estado, itemId) => estado.proficiencia?.[itemId] ?? { xp: 0, perks: {} };

function temNaMochila(estado, itemId) {
  if (armaNaMao(estado) === itemId) return true;
  for (const onde of ['inventory', 'pouch']) if ((estado[onde] ?? []).some((p) => p?.id === itemId)) return true;
  return Object.values(estado.equipment ?? {}).some((p) => p?.id === itemId);
}

/** A ficha de uma arma, no formato do original (null se ela não tem proficiência). */
export function vista(estado, itemId) {
  if (!ehArma(itemId)) return null;
  const { arma, tabela, maestria } = limites(itemId);
  const meu = dados(estado, itemId);
  const xp = meu.xp;
  const level = nivelDoXp(xp, tabela, maestria);
  const current = level ? tabela[level - 1] : 0;
  const next = level < maestria ? tabela[level] : current;
  return {
    itemId,
    itemName: arma.name,
    equipped: armaNaMao(estado) === itemId,
    name: arma.proficiency,
    level,
    max: MAX_DA_VIEW,
    experience: xp,
    current,
    next,
    percent: next > current ? ((xp - current) / (next - current)) * 100 : 100,
    levels: DADOS.grupos[arma.proficiency].map((perks, i) => ({
      level: i + 1,
      unlocked: xp >= tabela[i],
      chosen: meu.perks[i + 1] ?? null,
      perks: perks.map(({ classe, elemento, tipoDeDano, alcance, ...p }) => p),
    })),
  };
}

/** A da arma na mão — vai no `character.proficiency` (null sem arma com proficiência). */
export const vistaDaMao = (estado) => vista(estado, armaNaMao(estado));

/**
 * A vitrine: todas as armas com proficiência. A da mão primeiro, depois as que
 * ele tem (por XP, como no original: shiny blade 2,09 kk, jagged sword 571 mil,
 * relic sword 153 mil...), e o resto pelo level mínimo e pelo nome.
 */
export function lista(estado) {
  const mao = armaNaMao(estado);
  const todas = Object.entries(DADOS.armas).map(([id, a]) => {
    const itemId = Number(id);
    const { tabela, maestria } = limites(itemId);
    const xp = dados(estado, itemId).xp;
    return {
      itemId,
      name: a.name,
      proficiency: a.proficiency,
      skill: a.skill,
      twoHanded: a.twoHanded,
      level: nivelDoXp(xp, tabela, maestria),
      experience: xp,
      minLevel: a.minLevel,
      vocations: a.vocations,
      equipped: mao === itemId,
      owned: temNaMochila(estado, itemId),
    };
  });
  return todas.sort((a, b) => b.equipped - a.equipped || b.owned - a.owned || b.experience - a.experience || a.minLevel - b.minLevel || a.name.localeCompare(b.name));
}

/**
 * `{t:'proficiency'}` abre a tela (a arma da mão + a vitrine); com `itemId`,
 * a ficha daquela arma; `action:'perk'` escolhe o perk de um nível liberado.
 * Devolve `{ok, view, list?}`.
 */
export function comando(estado, m) {
  if (m.action === 'perk') {
    const view = vista(estado, Number(m.itemId));
    if (!view) return { ok: false, erro: 'Essa arma não tem proficiência.' };
    const nivel = view.levels[Number(m.level) - 1];
    if (!nivel) return { ok: false, erro: 'Nível de proficiência inválido.' };
    if (!nivel.unlocked) return { ok: false, erro: 'Esse nível ainda não foi liberado.' };
    if (!nivel.perks.some((p) => p.slot === Number(m.slot))) return { ok: false, erro: 'Perk inválido.' };
    estado.proficiencia ??= {};
    const meu = (estado.proficiencia[view.itemId] ??= { xp: 0, perks: {} });
    meu.perks[nivel.level] = Number(m.slot);
    return { ok: true, view: vista(estado, view.itemId) };
  }
  if (m.itemId != null) {
    const view = vista(estado, Number(m.itemId));
    return view ? { ok: true, view } : { ok: false, erro: 'Essa arma não tem proficiência.' };
  }
  return { ok: true, view: vistaDaMao(estado), list: lista(estado) };
}

// ---------------------------------------------------------------------------
// A experiência: cada morte dá XP à arma da mão.

/** Quanto uma morte rende: boss pela raridade, o resto pelas estrelas do bestiary. */
export function xpDaMorte(key) {
  const b = BESTIARY[key];
  if (!b) return 0;
  const raridade = DADOS.raridade[key];
  if (b.boss && raridade) return DADOS.xpDoBoss[raridade];
  return DADOS.xpPorEstrela[b.stars ?? 0] ?? 0;
}

export function ganharXp(estado, key) {
  const itemId = armaNaMao(estado);
  if (!ehArma(itemId)) return;
  const ganho = xpDaMorte(key);
  if (!ganho) return;
  estado.proficiencia ??= {};
  const meu = (estado.proficiencia[itemId] ??= { xp: 0, perks: {} });
  meu.xp = Math.min(limites(itemId).maximo, meu.xp + ganho);
}

// ---------------------------------------------------------------------------
// Os perks escolhidos da arma da mão, somados.

const VAZIO = Object.freeze({
  ataque: 0, defesa: 0, pericias: {}, critChance: 0, critDano: 0, critChanceBasico: 0, critDanoBasico: 0,
  critChanceRunas: 0, critDanoRunas: 0, lifeLeech: 0, manaLeech: 0, contraBoss: 0, contraClasse: {},
  vidaNoAcerto: 0, manaNoAcerto: 0, vidaNaMorte: 0, manaNaMorte: 0, periciaNoBasico: {}, periciaNaMagia: {}, periciaNaCura: {}, alcance: 0,
});

export function bonus(estado) {
  const itemId = armaNaMao(estado);
  const meu = estado.proficiencia?.[itemId];
  if (!ehArma(itemId) || !meu) return VAZIO;
  const { arma, tabela } = limites(itemId);
  const b = structuredClone(VAZIO);
  const somar = (obj, k, v) => (obj[k] = (obj[k] ?? 0) + v);
  DADOS.grupos[arma.proficiency].forEach((perks, i) => {
    const slot = meu.perks[i + 1];
    if (slot == null || meu.xp < tabela[i]) return;
    const p = perks.find((x) => x.slot === slot);
    if (!p) return;
    switch (p.type) {
      case 'attackDamage': b.ataque += p.value; break;
      case 'defense': case 'weaponShieldMod': b.defesa += p.value; break;
      case 'skillBonus': if (p.skill) somar(b.pericias, p.skill, p.value); break;
      case 'critChance': b.critChance += p.value; break;
      case 'critDamage': b.critDano += p.value; break;
      case 'critChanceAutoAttack': b.critChanceBasico += p.value; break;
      case 'critDamageAutoAttack': b.critDanoBasico += p.value; break;
      case 'critChanceRunes': b.critChanceRunas += p.value; break;
      case 'critDamageRunes': b.critDanoRunas += p.value; break;
      case 'lifeLeech': b.lifeLeech += p.value; break;
      case 'manaLeech': b.manaLeech += p.value; break;
      case 'bossDamage': b.contraBoss += p.value; break;
      case 'bestiaryDamage': if (p.classe) somar(b.contraClasse, p.classe, p.value); break;
      case 'lifeOnHit': b.vidaNoAcerto += p.value; break;
      case 'manaOnHit': b.manaNoAcerto += p.value; break;
      case 'lifeOnKill': b.vidaNaMorte += p.value; break;
      case 'manaOnKill': b.manaNaMorte += p.value; break;
      case 'skillAsDamageAutoAttack': if (p.skill) somar(b.periciaNoBasico, p.skill, p.value); break;
      case 'skillAsDamageSpells': if (p.skill) somar(b.periciaNaMagia, p.skill, p.value); break;
      case 'skillAsHealingSpells': if (p.skill) somar(b.periciaNaCura, p.skill, p.value); break;
      case 'attackRange': b.alcance += p.value; break;
      default: break; // spellAugment, specialMagicLevel, elemental, perfect shot, ranged hit: ver o topo
    }
  });
  return b;
}

/** "% da perícia vira dano/cura": a soma de ceil(perícia × fração) de cada perícia. */
export function daPericia(estado, porPericia, bonusDePericia = {}) {
  let total = 0;
  for (const [pericia, fracao] of Object.entries(porPericia)) {
    total += Math.ceil((Treino.valor(estado, pericia) + (bonusDePericia[pericia] ?? 0)) * fracao);
  }
  return total;
}

/** Dano a mais contra boss (powerful foe) e contra a classe do bestiary do alvo. */
export function fatorContra(prof, alvo) {
  if (!prof || !alvo?.key) return 1;
  const b = BESTIARY[alvo.key];
  if (!b) return 1;
  return (1 + (b.boss ? prof.contraBoss : 0)) * (1 + (prof.contraClasse[b.class] ?? 0));
}

/** Vida/mana a mais: por acerto do golpe básico, ou por morte. */
export function curar(estado, vida, mana, eventos, quem, pos) {
  const ganhoVida = Math.min(vida, Math.max(0, (estado.maxHp ?? 0) - (estado.hp ?? 0)));
  const ganhoMana = Math.min(mana, Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
  if (ganhoVida > 0) {
    estado.hp += ganhoVida;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoVida, color: '#00ff66' });
  }
  if (ganhoMana > 0) {
    estado.mana += ganhoMana;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoMana, color: '#4fc3ff' });
  }
}
