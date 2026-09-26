// Charms e o bestiary que paga por eles — a regra que o cliente (panels.mjs
// `renderCharms`, chat.mjs `bestiaryDone`/`event.charm`) diz morar no servidor.
//
// Do original (Zoros, 2026-09-25, `api-mapeada/captura-charms-0925/`):
// - `character.bestiary` = { chave da criatura: mortes }. Cada criatura paga os
//   `charmPoints` do catálogo UMA vez, quando as mortes chegam a `toKill`.
//   Conferido: as 24 completas do Zoros somam 495; ele gastou 240 (Wound tier 1)
//   e tem 255 — pontos = ganhos − gastos, sem saldo inicial.
// - `character.charmPoints` e `charmNext` (o menor preço entre os que ainda sobem;
//   null com todos no máximo) — o alerta do botão de Charms.
// - A view `{points, spent, list}`: cada charm com `tier`, `chance` (a do tier
//   atual; travado, a do 1º), `cost` (o preço do próximo tier, null no máximo)
//   e `assigned` (a criatura). Um saldo só paga major e minor.
// - O disparo: `{t:'dmg', v, foe:true, charm:'Wound', alvo, color:'#ff0000'}`.
//   O Wound do Zoros no Crazed Winter Rearguard (5.200 de vida) bateu 260 cravado:
//   5% da vida, sem armadura.
//
// Do Canary (data/scripts/systems/bestiary_charms.lua e src/io/iobestiary.cpp),
// que é a base do original — nomes, textos, preços, efeitos e a chance do 1º tier
// batem com a view: a chance dos tiers 2 e 3 (`gamedata/charms.json`) e as contas
// de dano (teto de 2x o level no dano elemental, 8% da vida do bicho no
// Overpower/Overflux, 6x o level no Carnage).
//
// Defensivos também apontam para uma criatura (o dono: "defensivo tbm tenho que
// escolher a criatura") e só valem contra ela.
//
// ESTIMADO (o original não mostrou): tirar a criatura de um charm é de graça;
// Bless, Scavenge, Gut e Fatal Hold não têm o que fazer aqui (não há perda na morte, esfolar nem fuga de bicho), nem o
// Adrenaline Burst (o passo do jogador na caçada já é o mínimo, 1 tique) e o
// Cleanse (não há condição negativa no jogador).
import { readFileSync } from 'node:fs';
import { CATALOGO } from '../nucleo/dados.mjs';
import * as R from '../nucleo/regras.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/charms.json', import.meta.url), 'utf8'));
export const CHARMS = DADOS.charms;
const POR_ID = new Map(CHARMS.map((c) => [c.id, c]));
const BESTIARY = CATALOGO.bestiary;

/** Os ids de efeito do OTServ (utils_definitions.hpp) que o cliente desenha. */
const EFEITO = {
  CONST_ME_DRAWBLOOD: 1,
  CONST_ME_POFF: 3,
  CONST_ME_EXPLOSIONAREA: 5,
  CONST_ME_GREEN_RINGS: 9,
  CONST_ME_HITAREA: 10,
  CONST_ME_ENERGYHIT: 12,
  CONST_ME_HITBYFIRE: 16,
  CONST_ME_SMALLCLOUDS: 39,
  CONST_ME_HOLYDAMAGE: 40,
  CONST_ME_ICEATTACK: 44,
};
const COR = { physical: '#ff0000', fire: '#ff9900', earth: '#00ff00', ice: '#99ffff', energy: '#cc33cc', death: '#990000', holy: '#ffff00' };

const ID = {
  cripple: 7, parry: 8, dodge: 9, numb: 11,
  lowBlow: 16, vampiric: 18, voidsCall: 19, savage: 20, voidInversion: 22,
  carnage: 23, overpower: 24, overflux: 25,
};
/** Os seis de 5% da vida em um elemento (Wound, Enflame, Poison, Freeze, Zap, Curse) e o Divine Wrath. */
const ELEMENTAIS = [1, 2, 3, 4, 5, 6, 17];
/** Cripple e Numb: paralisia de 10 s (`CONDITION_PARALYZE`, 10000 no Canary). */
export const PARALISIA_MS = 10_000;

export function garantir(estado) {
  estado.bestiary ??= {};
  estado.charms ??= { tiers: {}, alvos: {}, gastos: 0 };
  return estado.charms;
}

const tierDe = (estado, id) => estado.charms?.tiers?.[id] ?? 0;
const chanceDoTier = (charm, tier) => charm.chances[Math.max(1, tier) - 1];

/** Pontos que o bestiary já pagou: `charmPoints` de cada criatura com as mortes fechadas. */
export function pontosGanhos(estado) {
  let total = 0;
  for (const [key, mortes] of Object.entries(estado.bestiary ?? {})) {
    const b = BESTIARY[key];
    if (b?.toKill > 0 && mortes >= b.toKill) total += b.charmPoints ?? 0;
  }
  return total;
}

export const pontos = (estado) => pontosGanhos(estado) - (estado.charms?.gastos ?? 0);

/** O menor preço entre os charms que ainda sobem (null com todos no máximo). */
export function proximoPreco(estado) {
  let menor = null;
  for (const c of CHARMS) {
    const tier = tierDe(estado, c.id);
    if (tier < c.points.length && (menor == null || c.points[tier] < menor)) menor = c.points[tier];
  }
  return menor;
}

export function paraCliente(estado) {
  return { bestiary: estado.bestiary ?? {}, charmPoints: pontos(estado), charmNext: proximoPreco(estado) };
}

export function vista(estado) {
  return {
    points: pontos(estado),
    spent: estado.charms?.gastos ?? 0,
    list: CHARMS.map(({ chances, ...c }) => {
      const tier = tierDe(estado, c.id);
      return { ...c, chance: chanceDoTier({ chances }, tier), tier, cost: tier < c.points.length ? c.points[tier] : null, assigned: estado.charms?.alvos?.[c.id] ?? null };
    }),
  };
}

export function comando(estado, m) {
  garantir(estado);
  if (!m.action) return { ok: true };
  const charm = POR_ID.get(Number(m.id));
  if (!charm) return { ok: false, erro: 'Charm desconhecido.' };
  const tier = tierDe(estado, charm.id);
  if (m.action === 'upgrade') {
    if (tier >= charm.points.length) return { ok: false, erro: 'Este charm já está no máximo.' };
    const preco = charm.points[tier];
    if (pontos(estado) < preco) return { ok: false, erro: `Faltam ${preco - pontos(estado)} pontos de charm.` };
    estado.charms.gastos += preco;
    estado.charms.tiers[charm.id] = tier + 1;
    return { ok: true };
  }
  if (m.action === 'assign') {
    if (!tier) return { ok: false, erro: 'Libere o charm antes de escolher a criatura.' };
    if (m.monster == null) {
      delete estado.charms.alvos[charm.id];
      return { ok: true };
    }
    if (!BESTIARY[m.monster]) return { ok: false, erro: 'Criatura desconhecida.' };
    if (!estado.bestiary[m.monster]) return { ok: false, erro: 'Você ainda não matou essa criatura.' };
    estado.charms.alvos[charm.id] = m.monster;
    return { ok: true };
  }
  return { ok: false, erro: 'Ação de charm desconhecida.' };
}

// ---------------------------------------------------------------------------
// O bestiary: cada morte conta; fechando, paga os pontos (uma vez).

export function contarMorte(estado, key, eventos) {
  const b = BESTIARY[key];
  if (!b) return;
  garantir(estado);
  const mortes = (estado.bestiary[key] = (estado.bestiary[key] ?? 0) + 1);
  if (b.toKill > 0 && mortes === b.toKill && b.charmPoints) eventos?.push({ t: 'bestiaryDone', name: b.name, points: b.charmPoints });
}

// ---------------------------------------------------------------------------
// No combate.

/** Tier > 0 e apontado para esta criatura. */
const noBicho = (estado, id, key) => tierDe(estado, id) > 0 && estado.charms?.alvos?.[id] === key;
const dispara = (estado, id) => Math.random() * 100 < chanceDoTier(POR_ID.get(id), tierDe(estado, id));

function bater(estado, hunt, bicho, charm, valor, eventos) {
  const v = Math.max(1, Math.round(valor));
  bicho.hp -= v;
  const fx = EFEITO[charm.effect];
  if (fx) eventos.push({ t: 'fx', id: fx, uid: bicho.uid, x: bicho.x, y: bicho.y });
  eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v, foe: true, charm: charm.name, alvo: bicho.name, color: COR[charm.element] ?? '#ff0000' });
  if (hunt.sessao) hunt.sessao.danoDosCharms = (hunt.sessao.danoDosCharms ?? 0) + v;
}

/**
 * Depois do GOLPE BÁSICO do jogador (arma ou wand/rod) numa criatura: os
 * ofensivos apontados para ela. Magia e runa não rolam charm — medido no
 * original: em ~3 min no Rearguard, ~24 golpes básicos e ~300 acertos de magia
 * deram UM Wound (5%/acerto em tudo daria ~16; só no básico, ~1,2).
 * Bicho que já caiu não dispara nada.
 */
export function aoAcertar(estado, hunt, bicho, eventos) {
  if (!estado.charms || bicho.dummy || bicho.hp <= 0) return;
  for (const id of ELEMENTAIS) {
    if (!noBicho(estado, id, bicho.key) || !dispara(estado, id)) continue;
    const charm = POR_ID.get(id);
    const bruto = Math.min(estado.level * 2, Math.ceil(bicho.maxHp * (charm.percent / 100)));
    const resistencia = BESTIARY[bicho.key]?.elements?.[charm.element] ?? 0;
    bater(estado, hunt, bicho, charm, R.applyElement(bruto, hunt.isBoss ? Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, resistencia) : resistencia), eventos);
    if (bicho.hp <= 0) return;
  }
  for (const [id, maximo] of [[ID.overpower, estado.maxHp], [ID.overflux, estado.maxMana]]) {
    if (!noBicho(estado, id, bicho.key) || !dispara(estado, id)) continue;
    const charm = POR_ID.get(id);
    bater(estado, hunt, bicho, charm, Math.min(Math.ceil(bicho.maxHp * 0.08), Math.ceil((maximo ?? 0) * (charm.percent / 100))), eventos);
    if (bicho.hp <= 0) return;
  }
  if (noBicho(estado, ID.cripple, bicho.key) && dispara(estado, ID.cripple)) bicho.paralisadoAte = (hunt.clock ?? 0) + PARALISIA_MS;
}

/** Low Blow (+chance de crítico) e Savage Blow (+dano crítico), na criatura apontada. Em pontos de %. */
export function criticoExtra(estado, key) {
  if (!estado.charms || !key) return { chance: 0, dano: 0 };
  return {
    chance: noBicho(estado, ID.lowBlow, key) ? chanceDoTier(POR_ID.get(ID.lowBlow), tierDe(estado, ID.lowBlow)) : 0,
    dano: noBicho(estado, ID.savage, key) ? chanceDoTier(POR_ID.get(ID.savage), tierDe(estado, ID.savage)) : 0,
  };
}

/** Vampiric Embrace e Void's Call: leech extra (fração) — só com equipamento que já dá aquele leech. */
export function leechExtra(estado, key, ficha) {
  if (!estado.charms || !key) return { vida: 0, mana: 0 };
  return {
    vida: (ficha.lifeLeech ?? 0) > 0 && noBicho(estado, ID.vampiric, key) ? chanceDoTier(POR_ID.get(ID.vampiric), tierDe(estado, ID.vampiric)) / 100 : 0,
    mana: (ficha.manaLeech ?? 0) > 0 && noBicho(estado, ID.voidsCall, key) ? chanceDoTier(POR_ID.get(ID.voidsCall), tierDe(estado, ID.voidsCall)) / 100 : 0,
  };
}

/** Carnage: a criatura apontada morre e, com a chance, o estouro pega as 4 casas do lado. */
export function aoMatar(estado, hunt, morto, eventos) {
  if (!noBicho(estado, ID.carnage, morto.key) || !dispara(estado, ID.carnage)) return;
  const charm = POR_ID.get(ID.carnage);
  const dano = Math.min(Math.ceil(morto.maxHp * (charm.percent / 100)), estado.level * 6);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const x = morto.x + dx;
    const y = morto.y + dy;
    eventos.push({ t: 'fx', id: EFEITO.CONST_ME_DRAWBLOOD, x, y });
    const vizinho = hunt.monstros.find((m) => m.x === x && m.y === y && m.hp > 0 && !m.dummy && m !== morto);
    if (vizinho) bater(estado, hunt, vizinho, charm, dano, eventos);
  }
}

/** Dodge: antes do golpe da criatura apontada — true quando desviou (o golpe inteiro). */
export function desviou(estado, hunt, personagem, bicho, eventos) {
  if (!noBicho(estado, ID.dodge, bicho.key) || !dispara(estado, ID.dodge)) return false;
  eventos.push({ t: 'fx', id: EFEITO.CONST_ME_POFF, uid: 'player', x: hunt.pos.x, y: hunt.pos.y });
  eventos.push({ t: 'block', uid: 'player', quem: personagem?.nome, x: hunt.pos.x, y: hunt.pos.y, color: '#999999', charm: 'Dodge' });
  return true;
}

/**
 * Depois de levar `dano` da criatura apontada: Parry devolve o golpe e Numb a paralisa.
 */
export function depoisDeApanhar(estado, hunt, bicho, dano, eventos) {
  if (!estado.charms || dano <= 0) return;
  if (noBicho(estado, ID.parry, bicho.key) && bicho.hp > 0 && dispara(estado, ID.parry)) bater(estado, hunt, bicho, POR_ID.get(ID.parry), dano, eventos);
  if (noBicho(estado, ID.numb, bicho.key) && dispara(estado, ID.numb)) bicho.paralisadoAte = (hunt.clock ?? 0) + PARALISIA_MS;
}

/** Void Inversion: o dreno de mana da criatura apontada vira ganho de mana. */
export function inverteDreno(estado, bicho) {
  return noBicho(estado, ID.voidInversion, bicho.key) && dispara(estado, ID.voidInversion);
}

/** Bicho paralisado (Cripple/Numb) anda muito devagar — o passo dele vezes este fator. */
export const FATOR_DA_PARALISIA = 4;
export const paralisado = (bicho, agora) => (bicho.paralisadoAte ?? 0) > agora;
