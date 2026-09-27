// Tier das peças — a subida com a pedra da Store e os efeitos de cada
// slot, no formato do personagem real capturado (`tiers`, `tierMax`,
// `proximoTier`) e da tela da mochila (`confirmarTier`, inventory.mjs):
//
// - "Sobe uma peça um tier. O tier N pede N Tier Ups e 10kk de ouro — o ouro é o
//   mesmo em todo degrau, quem sobe é a quantidade de pedras. Vai até o tier
//   10." (o texto da loja). O dado real bate: `proximoTier` do personagem
//   capturado = `{tier: 1, cores: 1, ouro: 10000000}` em cada peça vestida.
// - Só as peças VESTIDAS dos slots que têm efeito (`catalog.efeitosDeTier`:
//   arma, elmo, armadura, botas). O tier fica NA PEÇA (`peca.tier`) e viaja com
//   ela para a mochila, o depósito e o mercado.
// - O efeito tem chance = a·t² + b·t + c (em %) — a mesma conta do balão do
//   item (tooltip.mjs), com os coeficientes do catálogo real:
//     arma  Onslaught      golpe 60% mais forte
//     elmo  Momentum       tira 2s dos cooldowns a cada golpe
//     corpo Ruse           desvia do golpe inteiro
//     botas Amplification  reforça os imbuements (este servidor ainda não tem
//                          imbuement — o efeito aparece, mas não há o que reforçar)
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';

export const ITEM_TIER_UP = 50051;
export const TIER_MAX = 10;
const OURO_POR_DEGRAU = 10_000_000;
const EFEITOS = CATALOGO.efeitosDeTier ?? {};

const pedrasNaMochila = (estado) => (estado.inventory ?? []).filter((p) => p.id === ITEM_TIER_UP).reduce((a, p) => a + (p.count ?? 1), 0);

/** As peças vestidas que aceitam tier: `[[slot, peca]]`. */
function vestidas(estado) {
  return Object.entries(estado.equipment ?? {}).filter(([slot, peca]) => peca && EFEITOS[slot]);
}

/** A chance (0..1) do efeito de tier de um slot, pelo tier da peça vestida nele. */
export function chance(estado, slot) {
  const t = Math.floor(estado.equipment?.[slot]?.tier ?? 0);
  const e = EFEITOS[slot];
  if (!t || !e) return 0;
  return (e.a * t * t + e.b * t + e.c) / 100;
}

export const rolar = (estado, slot) => Math.random() < chance(estado, slot);

/** `send({t:'tierUp', itemId})` — sobe um tier da peça VESTIDA com esse id. */
export function subir(estado, { itemId }) {
  const id = Number(itemId);
  const achada = vestidas(estado).find(([, p]) => p.id === id);
  if (!achada) return { ok: false, erro: `${ITEM_CATALOG[id]?.name ?? 'Essa peça'} não aceita tier — vista uma arma, um elmo, uma armadura ou botas.` };
  const [, peca] = achada;
  const atual = Math.floor(peca.tier ?? 0);
  if (atual >= TIER_MAX) return { ok: false, erro: `Essa peça já está no tier ${TIER_MAX}, o máximo.` };
  const pedras = atual + 1;
  if (pedrasNaMochila(estado) < pedras) return { ok: false, erro: `O tier ${pedras} pede ${pedras} Tier Up na mochila (você tem ${pedrasNaMochila(estado)}).` };
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  if (total < OURO_POR_DEGRAU) return { ok: false, erro: `Faltam ${(OURO_POR_DEGRAU - total).toLocaleString('pt-BR')} de ouro (bolso + banco).` };
  // Pedras: tira da mochila, da pilha do fim para o começo.
  let falta = pedras;
  const inv = estado.inventory;
  for (let i = inv.length - 1; i >= 0 && falta > 0; i--) {
    if (inv[i].id !== ITEM_TIER_UP) continue;
    const tira = Math.min(inv[i].count ?? 1, falta);
    inv[i].count = (inv[i].count ?? 1) - tira;
    falta -= tira;
    if (inv[i].count <= 0) inv.splice(i, 1);
  }
  const doBolso = Math.min(estado.gold ?? 0, OURO_POR_DEGRAU);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (OURO_POR_DEGRAU - doBolso);
  peca.tier = atual + 1;
  const efeito = EFEITOS[ITEM_CATALOG[id]?.slot] ?? Object.values(EFEITOS).find(Boolean);
  return { ok: true, notice: `${ITEM_CATALOG[id]?.name ?? 'Peça'} agora é tier ${peca.tier}.` + (efeito ? ` ${efeito.nome}: ${(chance(estado, achada[0]) * 100).toFixed(2)}% de ${efeito.resumo}.` : '') };
}

/** `tiers`, `tierMax` e `proximoTier`, como o personagem real. */
export function paraCliente(estado) {
  const tiers = {};
  const proximoTier = {};
  for (const [slot, peca] of vestidas(estado)) {
    const t = Math.floor(peca.tier ?? 0);
    const e = EFEITOS[slot];
    if (t > 0) tiers[peca.id] = { tier: t, slot, efeito: e.id, nome: e.nome, resumo: e.resumo, percent: chance(estado, slot) * 100 };
    if (t < TIER_MAX) proximoTier[peca.id] = { tier: t + 1, cores: t + 1, ouro: OURO_POR_DEGRAU };
  }
  return { tiers, tierMax: TIER_MAX, proximoTier };
}
