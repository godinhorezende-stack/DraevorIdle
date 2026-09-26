// Afixos ("Atributos extras", as estrelas da peça) — o sorteio no drop, a soma
// do que está vestido e a regra de guardar na venda automática.
//
// Formato na peça (o do original, capturado em `forjaAfixos`):
// `af: [{id, tier, value, rr?}]` — `id` do `catalog.afixos` (38 no total, com
// `min`/`max` da régua), `value` já no número final ("+3.1%"), `rr` quantas
// vezes aquele posto foi rerrolado. A essência (item 900001) leva um afixo só
// e `afixoDe` (o slot de onde saiu), `raridade` e `mitica` (a vermelha).
//
// O sorteio saiu dos 137 drops reais capturados (conta Zotod, caça normal):
//   quantos afixos: 1 → 73%, 2 → 24%, 3 → 3%
//   tier de cada afixo: T1 90% (régua 0–26%), T2 8% (22–59%), T3 2% (95–100%)
//   "torto" (não é do grupo natural do slot, "não é desta peça"): 31%
// O boss rola na fonte de cima: um degrau de tier a mais (a captura só tem
// drop de caverna; o original diz só que "o tier diz de que fonte a peça veio").
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as R from './regras.mjs';
import * as Gemas from './gemas.mjs';
import * as Imbuements from './imbuements.mjs';

export const FICHAS = CATALOGO.afixos ?? {};
export const ID_DA_ESSENCIA = 900001;
export const MAX_AFIXOS = 3;
export const FRACAO_DA_MITICA = 1.3;
export const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];

const ELEMENTOS = ['fire', 'energy', 'earth', 'ice', 'death', 'holy'];
const SKILLS = ['skill_fist', 'skill_club', 'skill_sword', 'skill_axe', 'skill_distance', 'skill_magic', 'skill_shielding'];
const OFENSIVOS = ['atk_flat', 'crit_chance', 'crit_dmg', 'life_leech', 'mana_leech', 'atk_speed', ...ELEMENTOS.map((e) => `${e}_dmg`), 'onslaught', 'weapon_atk_pct', 'exp_bonus', 'loot_bonus', 'protect_all'];
const DEFENSIVOS = ['armor_flat', 'hp_max', 'mana_max', 'phys_res', ...ELEMENTOS.filter((e) => e !== 'holy').map((e) => `${e}_res`), 'hp_regen', 'spell_dmg', 'spell_heal', 'weapon_atk_pct', 'loot_bonus'];
// O grupo natural de cada slot — o que a captura mostra SEM a marca "torto".
const NATIVOS = {
  weapon: [...OFENSIVOS, ...SKILLS],
  head: [...DEFENSIVOS, ...SKILLS],
  body: [...DEFENSIVOS, ...SKILLS],
  legs: [...DEFENSIVOS, ...SKILLS],
  feet: [...DEFENSIVOS, 'speed', ...SKILLS],
  shield: [...DEFENSIVOS, ...SKILLS],
  neck: Object.keys(FICHAS),
  ring: Object.keys(FICHAS),
  // A mochila aparece na lista de afixos do original (vazia, 3 vagas), mas a
  // captura não tem nenhum afixo nela para dizer o grupo — e nenhum drop de
  // mochila com afixo (ver `rolarDrop`). Nada fica "torto" nela.
  backpack: Object.keys(FICHAS),
};
const SLOTS_COM_AFIXO = new Set(Object.keys(NATIVOS));

/*
 * ---- Na ARMA, só a perícia DELA é natural ----
 *
 * Na captura, o hand axe tem skill_axe normal e skill_magic "torto"; a dagger
 * (sword) tem skill_sword normal e distance, shielding e magic tortos. Em elmo e
 * bota, qualquer perícia é natural. A wand/rod treina magic.
 */
function nativosDe(slot, itemId) {
  if (slot !== 'weapon') return NATIVOS[slot] ?? Object.keys(FICHAS);
  const meta = ITEM_CATALOG[itemId];
  const pericia = meta?.wand ? 'magic' : meta?.skill;
  return pericia ? [...OFENSIVOS, `skill_${pericia}`] : NATIVOS.weapon;
}

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const arredonda = (ficha, v) => (ficha.tipo === 'flat' ? Math.round(v) : Math.round(v * 10) / 10);

/** Onde o valor cai na régua do afixo, em % (100 = o topo; a vermelha passa). */
export function pctDe(a) {
  const f = FICHAS[a.id];
  if (!f || f.max <= f.min) return 0;
  return Math.round(((a.value - f.min) / (f.max - f.min)) * 100);
}

export const valorNaRegua = (id, pct) => {
  const f = FICHAS[id];
  return arredonda(f, f.min + (Math.max(0, pct) / 100) * (f.max - f.min));
};

/** Os afixos que ainda não estão na peça, do grupo natural (ou torto). */
function escolherId(slot, jaTem, torto, itemId) {
  const nativos = nativosDe(slot, itemId).filter((id) => FICHAS[id]);
  const pool = torto ? Object.keys(FICHAS).filter((id) => !nativos.includes(id)) : nativos;
  return sorteio(pool.filter((id) => !jaTem.includes(id))) ?? sorteio(nativos.filter((id) => !jaTem.includes(id)));
}

const ehTorto = (slot, id, itemId) => !nativosDe(slot, itemId).includes(id);

/** Um afixo novo (T1/T2/T3 pela fonte). `degrau` 0 = caverna, 1 = boss. */
function novoAfixo(slot, jaTem, degrau = 0, itemId = null) {
  const torto = Math.random() < 0.31;
  const id = escolherId(slot, jaTem, torto, itemId);
  if (!id) return null;
  const r = Math.random();
  let tier = r < 0.9 ? 1 : r < 0.983 ? 2 : 3;
  tier = Math.min(3, tier + degrau);
  // A régua de cada tier, do dado real (T1 cai mais embaixo, T3 no topo).
  const pct = tier === 1 ? 26 * Math.random() ** 1.3 : tier === 2 ? 22 + 37 * Math.random() : 95 + 5 * Math.random();
  return { id, tier, value: valorNaRegua(id, pct) };
}

/** A peça aceita afixo? (equipável, não empilha, de um slot com afixo) */
export function aceitaAfixo(id) {
  const meta = ITEM_CATALOG[id];
  return !!meta && !meta.stackable && SLOTS_COM_AFIXO.has(meta.slot);
}

/** Os afixos de um drop: `null` se a peça não aceita. */
export function rolarDrop(id, { boss = false } = {}) {
  if (!aceitaAfixo(id)) return null;
  const slot = ITEM_CATALOG[id].slot;
  if (slot === 'backpack') return null; // mochila com afixo só pela forja (ver `NATIVOS`)
  const r = Math.random();
  const quantos = boss ? (r < 0.5 ? 1 : r < 0.85 ? 2 : 3) : r < 0.73 ? 1 : r < 0.97 ? 2 : 3;
  const af = [];
  for (let i = 0; i < quantos; i++) {
    const a = novoAfixo(slot, af.map((x) => x.id), boss ? 1 : 0, id);
    if (a) af.push(a);
  }
  return af;
}

/** Rerroll: outro sorteio SEMPRE acima do pct atual (no topo: outro afixo, em 100%). */
export function rerrolar(slot, af, indice, itemId = null) {
  const atual = af[indice];
  const pctAtual = Math.min(100, pctDe(atual));
  const outros = af.filter((_, i) => i !== indice).map((a) => a.id);
  const torto = Math.random() < 0.31;
  let id = Math.random() < 0.5 && pctAtual < 100 ? atual.id : escolherId(slot, [...outros, ...(pctAtual >= 100 ? [atual.id] : [])], torto, itemId);
  id ??= atual.id;
  const pctSorteado = pctAtual >= 100 ? 100 : pctAtual + 1 + Math.random() * (100 - pctAtual - 1);
  let value = valorNaRegua(id, pctSorteado);
  /*
   * "Sempre acima" tem de valer no NÚMERO, não só no sorteio: numa régua curta
   * (perícia vai de 1 a 3) o arredondamento devolvia o mesmo valor — Shielding
   * +2 (50%) virava Shielding +2 (50%), e o reroll era pago sem mudar nada.
   * Mesmo afixo abaixo do topo: pelo menos um degrau (+1, ou +0,1 no %).
   */
  const f = FICHAS[id];
  if (id === atual.id && pctAtual < 100 && f && value <= atual.value) {
    value = Math.min(f.max, arredonda(f, atual.value + (f.tipo === 'flat' ? 1 : 0.1)));
  }
  const pct = pctDe({ id, value });
  const tier = pct >= 95 ? 3 : pct >= 34 ? 2 : 1;
  return { id, tier, value, rr: (atual.rr ?? 0) + 1 };
}

// ------------------------------------------------------- o que está vestido

/** A soma de cada afixo nas peças VESTIDAS: `{atk_flat: 7, crit_chance: 1.3, ...}`. */
export function soma(estado) {
  const total = {};
  for (const [slot, peca] of Object.entries(estado.equipment ?? {})) {
    if (!peca?.af?.length || slot === 'backpack') continue;
    for (const a of peca.af) if (FICHAS[a.id]) total[a.id] = (total[a.id] ?? 0) + Number(a.value || 0);
  }
  return total;
}

/** O que vale agora de um afixo (0 se não tem). Cache por tique fica para depois. */
export const de = (estado, id) => soma(estado)[id] ?? 0;

// ------------------------------------------------------------ a tela

export function viewDoAfixo(a, slot, itemId = null) {
  const f = FICHAS[a.id] ?? { nome: a.id, tipo: 'pct', min: 0, max: 1 };
  const rr = a.rr ?? 0;
  return {
    id: a.id,
    nome: f.nome,
    tipo: f.tipo,
    valor: a.value,
    tier: a.tier ?? 1,
    pct: pctDe(a),
    min: f.min,
    max: f.max,
    torto: slot ? ehTorto(slot, a.id, itemId) : false,
    rerrolls: rr,
    texto: `${f.nome} +${a.value}${f.tipo === 'pct' ? '%' : ''}`,
  };
}

// ------------------------------------------- guardar na venda automática

/** A cor da peça: a do melhor afixo (1 azul, 2 roxa, 3 dourada, 4 vermelha). */
export function corDaPeca(p) {
  let q = 0;
  for (const a of p.af ?? []) {
    const pct = pctDe(a);
    q = Math.max(q, pct > 100 ? 4 : pct >= 67 ? 3 : pct >= 34 ? 2 : 1);
  }
  return q;
}

/**
 * A venda automática GUARDA esta peça? As regras da tela do filtro de loot:
 * tier e imbuement nunca vendem; `guardarAfixo` (0 nada, 1 qualquer estrela,
 * 2 roxa para cima, 3 só dourada) com `guardarEstrelas` (quantas no mínimo) e
 * `itemRules.soAfixo` (só nestes itens); `guardarRaridade` (0 não olha, 1
 * incomum para cima ... 5 só mítico).
 */
export function guarda(estado, p) {
  if (p.tier || p.imbu?.length) return true;
  if (p.id === ID_DA_ESSENCIA) return true;
  const s = estado.settings ?? {};
  const pisoRaridade = Number(s.guardarRaridade ?? 0);
  if (pisoRaridade > 0) {
    const r = RARIDADES.indexOf(ITEM_CATALOG[p.id]?.rarity ?? 'comum');
    if (r >= pisoRaridade) return true;
  }
  if (!p.af?.length) return false;
  const cor = Number(s.guardarAfixo ?? 1);
  if (!cor) return false;
  const soEm = estado.itemRules?.soAfixo ?? [];
  if (soEm.length && !soEm.includes(p.id)) return false;
  const quantas = Number(s.guardarEstrelas ?? 0);
  if (quantas && p.af.length < quantas) return false;
  const q = corDaPeca(p);
  return cor === 1 ? q >= 1 : cor === 2 ? q >= 2 : q >= 3;
}

// ------------------------------------------- vida/mana máxima e capacidade

/** A capacidade com o afixo "Capacidade" das peças vestidas. */
// + o imbuement "Increase Capacity" (% da capacidade), nas botas e na armadura.
export const capacidade = (estado) =>
  (R.maxCapacity(estado.vocation, estado.level ?? 1) + de(estado, 'capacity') + Gemas.bonus(estado).capacidade) * (1 + Imbuements.bonus(estado).capacidadePct / 100);

/**
 * "Vida máxima" e "Mana máxima" (% da base do level). Aplicados como diferença
 * sobre `maxHp`/`maxMana` (o resto do jogo lê esses dois campos), marcando o
 * quanto já foi posto em `afixoMax` — vestir, tirar e subir de level chamam
 * isto de novo e só a diferença entra ou sai.
 */
export function sincronizarMaximos(estado) {
  const base = R.statsBase(estado.vocation, estado.level ?? 1);
  const t = soma(estado);
  const quer = { hp: Math.round((base.maxHp * (t.hp_max ?? 0)) / 100), mana: Math.round((base.maxMana * (t.mana_max ?? 0)) / 100) };
  const tem = estado.afixoMax ?? { hp: 0, mana: 0 };
  if (quer.hp === tem.hp && quer.mana === tem.mana) return;
  estado.maxHp = (estado.maxHp ?? 0) + quer.hp - tem.hp;
  estado.maxMana = (estado.maxMana ?? 0) + quer.mana - tem.mana;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.afixoMax = quer;
}
