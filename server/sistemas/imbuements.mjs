// Imbuements — a regra que o cliente (panels.mjs `renderImbuements`, sheet.mjs)
// diz morar no servidor.
//
// Do original (Zoros, welcomes de 2026-09-24 e 2026-09-25):
// - Na PEÇA: `imbu: [{id, left}]` (o `left` em ms). No personagem, por slot
//   vestido: `imbuements: {weapon: [{id, name, left, paused}]}`.
// - O tempo só corre CAÇANDO: entre as duas capturas o `totals.time` do Zoros
//   subiu 50.301 s e o Strike dele perdeu 50.340 s (72 h = `durationMs` cheio).
// - `imbuementSlots`/`imbuementTipos` por slot saem da peça vestida (o
//   `imbuementslot` do items.xml, no item-catalog): 0/`[]` numa peça sem encaixe,
//   `null` quando a peça não restringe ou não há peça.
// - O catálogo (`catalog.imbuements`, 72): preço em ouro, reagentes, custo de
//   remoção, a duração e o efeito de cada grau.
//
// Efeitos (o `effect` do catálogo, unidades do OTServ — centésimos de %):
// crítico (chance e dano), life/mana leech, perícia (+N), proteção elemental
// (%), velocidade (+N), capacidade (%), e o dano elemental: X% do golpe físico da
// arma vira o elemento (passa pela resistência do bicho).
//
// ESTIMADO (o original não mostrou): tirar cobra o `removeCost` do catálogo
// (15 mil) do bolso; a mesma categoria não entra duas vezes na mesma peça (como
// no Tibia); os reagentes saem da mochila e da bolsa, as peças limpas primeiro.
// "Paralysis Removal" não faz nada (o jogo não paralisa o jogador).
import { CATALOGO, ITEM_CATALOG } from '../nucleo/dados.mjs';
import { contarGuardadas, tirarGuardadas } from './inventario.mjs';

export const CATALOGO_DE_IMBUEMENTS = CATALOGO.imbuements ?? [];
const POR_ID = new Map(CATALOGO_DE_IMBUEMENTS.map((m) => [m.id, m]));
/** Os slots que o cliente conhece, na ordem do `imbuementSlots` real. */
const SLOTS = ['head', 'neck', 'body', 'legs', 'feet', 'ring', 'weapon', 'shield', 'ammo', 'backpack'];
const PERICIA = { shield: 'shielding', magicpoints: 'magic' };

const vivos = (peca) => (peca?.imbu ?? []).filter((i) => i.left > 0 && POR_ID.has(i.id));

/** Os encaixes e os tipos aceitos de cada slot vestido (formato do original). */
export function encaixes(estado) {
  const imbuementSlots = {};
  const imbuementTipos = {};
  for (const slot of SLOTS) {
    const item = ITEM_CATALOG[estado.equipment?.[slot]?.id];
    imbuementSlots[slot] = item?.imbuementSlots ?? 0;
    imbuementTipos[slot] = item ? item.imbuementTipos ?? null : null;
  }
  return { imbuementSlots, imbuementTipos };
}

export function paraCliente(estado) {
  const imbuements = {};
  for (const slot of SLOTS) {
    const lista = vivos(estado.equipment?.[slot]);
    // O `left` vai arredondado ao minuto (para cima, como o `formatLeft` do
    // cliente conta): a tela só mostra minutos, e o original manda assim (Zoros:
    // 254.940.000, 204.600.000 — minutos cheios). Em ms, ele mudaria a cada
    // segundo caçando e refaria mochila e inventário no cliente toda vez.
    if (lista.length) imbuements[slot] = lista.map((i) => ({ id: i.id, name: POR_ID.get(i.id).name, left: Math.ceil(i.left / 60000) * 60000, paused: !estado.hunt }));
  }
  return { imbuements, ...encaixes(estado) };
}

/** `{t:'imbue', slot, id}` aplica; `{t:'imbue', action:'remove', slot, id}` tira. */
export function comando(estado, m) {
  const slot = m.slot;
  const peca = estado.equipment?.[slot];
  if (!peca) return { ok: false, erro: 'Nada equipado neste encaixe.' };
  const item = ITEM_CATALOG[peca.id];
  const imb = POR_ID.get(m.id);
  if (!imb) return { ok: false, erro: 'Imbuement desconhecido.' };

  if (m.action === 'remove') {
    const i = (peca.imbu ?? []).findIndex((x) => x.id === imb.id);
    if (i < 0) return { ok: false, erro: 'Esse imbuement não está nesta peça.' };
    const custo = imb.removeCost ?? 0;
    if ((estado.gold ?? 0) < custo) return { ok: false, erro: `Tirar custa ${custo} gold.` };
    estado.gold -= custo;
    peca.imbu.splice(i, 1);
    if (!peca.imbu.length) delete peca.imbu;
    return { ok: true };
  }

  const total = item?.imbuementSlots ?? 0;
  if (!total) return { ok: false, erro: 'Esta peça não aceita imbuement.' };
  if (imb.slots?.length && !imb.slots.includes(slot)) return { ok: false, erro: 'Esse imbuement não serve neste encaixe.' };
  if (Array.isArray(item.imbuementTipos) && item.imbuementTipos.length && !item.imbuementTipos.includes(imb.category)) {
    return { ok: false, erro: 'Esta peça não aceita esse tipo de imbuement.' };
  }
  const ativos = vivos(peca);
  if (ativos.length >= total) return { ok: false, erro: 'Os encaixes desta peça já estão ocupados — remova um primeiro.' };
  if (ativos.some((x) => POR_ID.get(x.id).category === imb.category)) return { ok: false, erro: 'Esta peça já tem um imbuement desse tipo.' };
  if ((estado.gold ?? 0) < imb.price) return { ok: false, erro: `Faltam ${imb.price - (estado.gold ?? 0)} gold.` };
  for (const r of imb.items) {
    const { limpas, comExtras } = contarGuardadas(estado, r.id);
    if (limpas + comExtras < r.count) return { ok: false, erro: `Faltam ${r.count - limpas - comExtras}x ${ITEM_CATALOG[r.id]?.name ?? r.id}.` };
  }
  for (const r of imb.items) tirarGuardadas(estado, r.id, r.count);
  estado.gold -= imb.price;
  peca.imbu = [...ativos, { id: imb.id, left: imb.durationMs }];
  return { ok: true };
}

/** Caçando, o relógio de cada imbuement vestido anda; o que zera sai da peça. */
export function consumir(estado, ms) {
  for (const slot of SLOTS) {
    const peca = estado.equipment?.[slot];
    if (!peca?.imbu?.length) continue;
    for (const i of peca.imbu) i.left -= ms;
    peca.imbu = peca.imbu.filter((i) => i.left > 0);
    if (!peca.imbu.length) delete peca.imbu;
  }
}

/** Os efeitos somados das peças vestidas. */
export function bonus(estado) {
  const b = { critChance: 0, critDano: 0, lifeLeech: 0, manaLeech: 0, pericias: {}, protecao: {}, velocidade: 0, capacidadePct: 0, elemental: null };
  for (const slot of SLOTS) {
    for (const ativo of vivos(estado.equipment?.[slot])) {
      const e = POR_ID.get(ativo.id).effect ?? {};
      if (e.type === 'skill' && e.value === 'critical') {
        b.critChance += (e.chance ?? 0) / 10000;
        b.critDano += (e.bonus ?? 0) / 10000;
      } else if (e.type === 'skill' && e.value === 'lifeleech') b.lifeLeech += (e.bonus ?? 0) / 10000;
      else if (e.type === 'skill' && e.value === 'manaleech') b.manaLeech += (e.bonus ?? 0) / 10000;
      else if (e.type === 'skill') {
        const p = PERICIA[e.value] ?? e.value;
        b.pericias[p] = (b.pericias[p] ?? 0) + (e.bonus ?? 0);
      } else if (e.type === 'reduction') b.protecao[e.combat] = (b.protecao[e.combat] ?? 0) + (e.amount ?? 0);
      else if (e.type === 'speed') b.velocidade += e.amount ?? 0;
      else if (e.type === 'capacity') b.capacidadePct += e.amount ?? 0;
      else if (e.type === 'damage' && slot === 'weapon') b.elemental = { tipo: e.combat, pct: e.amount ?? 0 };
    }
  }
  return b;
}
