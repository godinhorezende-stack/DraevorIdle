// A Forja — as duas abas que o client desenha (`renderForjaTier`,
// `renderForjaAfixos`, panels.mjs), com os preços REAIS capturados
// (`forja.json`, `forjaAfixos.json`):
//
// TIER
//   `forja` → `{pecas, tierMax, ouroDaForja, gold, forjou?}`
//   `forjaSubir {lugar, reforcada}` — chance 50% (reforçada 65%, +50% de ouro).
//     "Se FALHAR, ela CAI para o tier N−1 e o ouro é gasto do mesmo jeito" (no
//     tier 0, só o ouro). A pedra Draevor Tier Up (`tiers.mjs`) nunca falha.
//   `forjaTransferir {de, para}` — a doadora é DESTRUÍDA e a outra fica com o
//     tier dela menos um (a regra do Tibia), pagando o ouro do degrau.
// AFIXOS
//   `forjaAfixos` → `{pecas, essencias, maxAfixos, custos, gold, coins, fez?}`
//   rerroll · transferir (mesmo slot e raridade) · retirar (vira essência) ·
//   inserir (essência do mesmo slot e raridade; a vermelha entra em qualquer)
//   · fundir (3 essências douradas → 1 vermelha, 130% da régua). Cada ação
//   paga em ouro OU em Draevor Coins (`moeda`), e tem a prévia (`forjaAfixoPrevia*`).
import { ITEM_CATALOG, CATALOGO } from './dados.mjs';
import * as A from './afixos.mjs';
import { raridadeDaPeca } from './itens/item.mjs';

const OURO_DA_FORJA = [null, 8e6, 20e6, 40e6, 65e6, 100e6, 250e6, 750e6, 2.5e9, 8e9, 15e9];
const TIER_MAX = 10;
const SLOTS_DE_TIER = new Set(Object.keys(CATALOGO.efeitosDeTier ?? {}));
const CUSTOS = {
  reroll: { ouro: 100_000_000, coins: 25 },
  aumentoDoReroll: 0.2,
  transferencia: { comum: { ouro: 25e6, coins: 5 }, incomum: { ouro: 25e6, coins: 8 }, raro: { ouro: 25e6, coins: 12 }, 'épico': { ouro: 25e6, coins: 20 }, 'lendário': { ouro: 100e6, coins: 35 }, 'mítico': { ouro: 150e6, coins: 50 } },
  retirar: { comum: { ouro: 4e6, coins: 4 }, incomum: { ouro: 8e6, coins: 8 }, raro: { ouro: 12e6, coins: 12 }, 'épico': { ouro: 16e6, coins: 16 }, 'lendário': { ouro: 20e6, coins: 20 }, 'mítico': { ouro: 24e6, coins: 24 } },
  loteDoRetirar: [0, 1, 1.25, 1.5],
  inserir: { comum: { ouro: 4e6, coins: 4 }, incomum: { ouro: 8e6, coins: 8 }, raro: { ouro: 12e6, coins: 12 }, 'épico': { ouro: 16e6, coins: 16 }, 'lendário': { ouro: 20e6, coins: 20 }, 'mítico': { ouro: 24e6, coins: 24 } },
  fusao: { ouro: 100e6, coins: 50 },
  fusaoTotal: { ouro: 300e6, coins: 150 },
  quantasFundem: 3,
  fracaoDaMitica: A.FRACAO_DA_MITICA,
};
const NOME_DO_SLOT = { head: 'elmo', neck: 'colar', body: 'armadura', legs: 'perneira', feet: 'bota', ring: 'anel', weapon: 'arma', shield: 'escudo' };

// ------------------------------------------------------------- lugares

const ondeNome = (l) => (l.onde === 'equip' ? 'no corpo' : l.onde === 'pouch' ? 'na bolsa de loot' : 'na mochila');
const mesmoLugar = (a, b) => a && b && a.onde === b.onde && (a.onde === 'equip' ? a.slot === b.slot : Number(a.indice) === Number(b.indice));

/** Todas as peças com lugar: `[{lugar, peca}]`. */
function pecas(estado) {
  const lista = [];
  for (const [slot, p] of Object.entries(estado.equipment ?? {})) if (p) lista.push({ lugar: { onde: 'equip', slot }, peca: p });
  (estado.inventory ?? []).forEach((p, indice) => lista.push({ lugar: { onde: 'bag', indice }, peca: p }));
  (estado.pouch ?? []).forEach((p, indice) => lista.push({ lugar: { onde: 'pouch', indice }, peca: p }));
  return lista;
}

function acharPeca(estado, lugar) {
  if (!lugar) return null;
  if (lugar.onde === 'equip') return estado.equipment?.[lugar.slot] ?? null;
  const lista = lugar.onde === 'pouch' ? estado.pouch : estado.inventory;
  return lista?.[Number(lugar.indice)] ?? null;
}

function destruir(estado, lugar) {
  if (lugar.onde === 'equip') estado.equipment[lugar.slot] = null;
  else (lugar.onde === 'pouch' ? estado.pouch : estado.inventory).splice(Number(lugar.indice), 1);
}

// ------------------------------------------------------------- dinheiro

const saldoDeOuro = (estado) => (estado.gold ?? 0) + (estado.bank ?? 0);
function pagar(estado, custo, moeda) {
  if (moeda === 'coin') {
    if ((estado.coins ?? 0) < custo.coins) return `Faltam ${custo.coins - (estado.coins ?? 0)} Draevor Coins.`;
    estado.coins -= custo.coins;
    return null;
  }
  if (saldoDeOuro(estado) < custo.ouro) return `Faltam ${(custo.ouro - saldoDeOuro(estado)).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, custo.ouro);
  estado.gold -= doBolso;
  estado.bank = (estado.bank ?? 0) - (custo.ouro - doBolso);
  return null;
}
const vezes = (c, n) => ({ ouro: Math.round(c.ouro * n), coins: Math.round(c.coins * n) });

// ================================================================ TIER

function custoDaSubida(tier) {
  if (tier >= TIER_MAX) return null;
  const base = OURO_DA_FORJA[tier + 1];
  return {
    subida: { tier: tier + 1, ouro: base, base, extra: 0, chance: 50 },
    reforcada: { tier: tier + 1, ouro: base * 1.5, base, extra: base * 0.5, chance: 65 },
  };
}

export function viewDoTier(estado, forjou = null) {
  const lista = pecas(estado)
    // A bolsa de loot ENTRA: o retrato real capturado lista as 116 peças dela
    // ("na bolsa de loot") junto das vestidas e das da mochila.
    .filter(({ peca }) => SLOTS_DE_TIER.has(ITEM_CATALOG[peca.id]?.slot))
    .map(({ lugar, peca }) => {
      const tier = Math.floor(peca.tier ?? 0);
      const c = custoDaSubida(tier);
      return {
        lugar, vestida: lugar.onde === 'equip', ondeNome: ondeNome(lugar), id: peca.id, nome: ITEM_CATALOG[peca.id]?.name, slot: ITEM_CATALOG[peca.id]?.slot, tier,
        subida: c?.subida ?? null, reforcada: c?.reforcada ?? null,
        doa: tier > 0 ? { tier: tier - 1, ouro: OURO_DA_FORJA[tier] } : null,
      };
    });
  return { t: 'forja', pecas: lista, tierMax: TIER_MAX, ouroDaForja: OURO_DA_FORJA, gold: saldoDeOuro(estado), ...(forjou ? { forjou } : {}) };
}

export function subirTier(estado, { lugar, reforcada }) {
  const peca = acharPeca(estado, lugar);
  if (!peca || !SLOTS_DE_TIER.has(ITEM_CATALOG[peca.id]?.slot)) return { erro: 'Essa peça não aceita tier.' };
  const tier = Math.floor(peca.tier ?? 0);
  const c = custoDaSubida(tier);
  if (!c) return { erro: `Já está no tier ${TIER_MAX}.` };
  const custo = reforcada ? c.reforcada : c.subida;
  const falta = pagar(estado, { ouro: custo.ouro, coins: Infinity }, 'gold');
  if (falta) return { erro: falta };
  const sucesso = Math.random() * 100 < custo.chance;
  peca.tier = sucesso ? tier + 1 : Math.max(0, tier - 1);
  if (!peca.tier) delete peca.tier;
  const nome = ITEM_CATALOG[peca.id]?.name;
  return {
    forjou: { sucesso, id: peca.id, nome, de: tier, para: peca.tier ?? 0 },
    notice: sucesso ? `${nome} subiu para o tier ${peca.tier}!` : `A forja falhou — ${nome} ${tier > 0 ? `caiu para o tier ${tier - 1}` : 'continua no tier 0'}.`,
  };
}

export function transferirTier(estado, { de, para }) {
  const doadora = acharPeca(estado, de);
  const recebe = acharPeca(estado, para);
  if (!doadora || !recebe || mesmoLugar(de, para)) return { erro: 'Escolha duas peças diferentes.' };
  const tier = Math.floor(doadora.tier ?? 0);
  if (!tier) return { erro: 'Essa peça não tem tier para passar.' };
  if (!SLOTS_DE_TIER.has(ITEM_CATALOG[recebe.id]?.slot)) return { erro: 'A outra peça não aceita tier.' };
  if ((recebe.tier ?? 0) >= tier - 1) return { erro: `${ITEM_CATALOG[recebe.id]?.name} já tem tier ${recebe.tier ?? 0} — não ganharia nada.` };
  const falta = pagar(estado, { ouro: OURO_DA_FORJA[tier], coins: Infinity }, 'gold');
  if (falta) return { erro: falta };
  recebe.tier = tier - 1;
  if (!recebe.tier) delete recebe.tier;
  destruir(estado, de);
  return { forjou: { sucesso: true, id: recebe.id, nome: ITEM_CATALOG[recebe.id]?.name, de: 0, para: tier - 1 }, notice: `${ITEM_CATALOG[recebe.id]?.name} agora é tier ${tier - 1}. ${ITEM_CATALOG[doadora.id]?.name} foi consumida.` };
}

// ================================================================ AFIXOS

/*
 * A raridade da PEÇA: a do drop (sistema de itens, decisão do dono: "drop
 * manda em tudo, forja também"); peça antiga, sem ela, cai na do catálogo.
 * O limite de atributos também é o da raridade (Comum 1 ... Mítico 6).
 */
const raridadeDe = (peca) => raridadeDaPeca(peca);
const vagasDe = (peca) => Math.max(0, A.maxAtributos(raridadeDe(peca)) - (peca?.af?.length ?? 0));
const slotDe = (id) => ITEM_CATALOG[id]?.slot;

function viewDaPeca({ lugar, peca }) {
  const slot = slotDe(peca.id);
  const af = peca.af ?? [];
  return {
    lugar, vestida: lugar.onde === 'equip', ondeNome: ondeNome(lugar), id: peca.id, nome: ITEM_CATALOG[peca.id]?.name, slot,
    rarity: raridadeDe(peca),
    afixos: af.map((a) => ({ ...A.viewDoAfixo(a, slot, peca.id), proximoReroll: { ...proximoReroll(a), vezes: a.rr ?? 0 } })),
    vagas: vagasDe(peca),
    peca,
  };
}

const proximoReroll = (a) => vezes(CUSTOS.reroll, 1 + CUSTOS.aumentoDoReroll * (a.rr ?? 0));

function viewDaEssencia({ lugar, peca }) {
  const a = peca.af?.[0];
  return { lugar, slot: peca.afixoDe ?? null, raridade: peca.mitica ? 'mítico' : peca.raridade ?? null, mitica: !!peca.mitica, afixo: a ? A.viewDoAfixo(a, null) : null, peca };
}

export function viewDosAfixos(estado, fez = null) {
  const todas = pecas(estado);
  return {
    t: 'forjaAfixos',
    pecas: todas.filter(({ peca }) => A.aceitaAfixo(peca.id)).map(viewDaPeca),
    essencias: todas.filter(({ lugar, peca }) => lugar.onde === 'bag' && peca.id === A.ID_DA_ESSENCIA && peca.af?.length).map(viewDaEssencia),
    maxAfixos: A.maxAtributos('mítico'),
    custos: CUSTOS,
    gold: saldoDeOuro(estado),
    coins: estado.coins ?? 0,
    ...(fez ? { fez } : {}),
  };
}

function essencia(peca, a, { mitica = false } = {}) {
  return { id: A.ID_DA_ESSENCIA, count: 1, af: [{ ...a }], afixoDe: slotDe(peca?.id) ?? peca?.afixoDe ?? null, ...(mitica ? { mitica: true } : { raridade: raridadeDe(peca) }) };
}

// ---- rerroll

export function rerrolar(estado, { lugar, indice, moeda }) {
  const peca = acharPeca(estado, lugar);
  const a = peca?.af?.[indice];
  if (!a) return { erro: 'Esse afixo não existe mais.' };
  const falta = pagar(estado, proximoReroll(a), moeda);
  if (falta) return { erro: falta };
  const antes = A.viewDoAfixo(a, slotDe(peca.id), peca.id);
  peca.af[indice] = A.rerrolar(slotDe(peca.id), peca.af, indice, peca.id);
  const depois = A.viewDoAfixo(peca.af[indice], slotDe(peca.id), peca.id);
  return { fez: { tipo: 'reroll', id: peca.id, nome: ITEM_CATALOG[peca.id]?.name, antes, depois } };
}

// ---- transferir

function previaDaTransferencia(estado, { de, para, indices }) {
  const doadora = acharPeca(estado, de);
  const recebe = acharPeca(estado, para);
  const base = { de, para, indices: [...(indices ?? [])].sort((x, y) => x - y) };
  if (!doadora?.af?.length || !recebe || mesmoLugar(de, para)) return { ...base, ok: false, reason: 'Escolha duas peças diferentes.' };
  if (slotDe(doadora.id) !== slotDe(recebe.id) || raridadeDe(doadora) !== raridadeDe(recebe)) return { ...base, ok: false, reason: 'Só entre peças do MESMO slot e da MESMA raridade.' };
  const levados = base.indices.map((i) => doadora.af[i]).filter(Boolean);
  if (!levados.length) return { ...base, ok: false, reason: 'Marque pelo menos um afixo.' };
  const vagas = vagasDe(recebe);
  if (levados.length > vagas) return { ...base, ok: false, reason: `${ITEM_CATALOG[recebe.id]?.name} só tem ${vagas} vaga(s).` };
  const repetido = levados.find((a) => (recebe.af ?? []).some((b) => b.id === a.id));
  if (repetido) return { ...base, ok: false, reason: `${ITEM_CATALOG[recebe.id]?.name} já tem ${A.FICHAS[repetido.id]?.nome}.` };
  const slot = slotDe(recebe.id);
  return {
    ...base, ok: true,
    levados: levados.map((a) => A.viewDoAfixo(a, slot, recebe.id)),
    depois: [...(recebe.af ?? []), ...levados].map((a) => A.viewDoAfixo(a, slot, recebe.id)),
    custo: vezes(CUSTOS.transferencia[raridadeDe(recebe)] ?? CUSTOS.transferencia.comum, levados.length),
  };
}

export const previaTransferir = (estado, m) => ({ t: 'forjaAfixoPrevia', ...previaDaTransferencia(estado, m) });

export function transferir(estado, m) {
  const p = previaDaTransferencia(estado, m);
  if (!p.ok) return { erro: p.reason };
  const falta = pagar(estado, p.custo, m.moeda);
  if (falta) return { erro: falta };
  const doadora = acharPeca(estado, m.de);
  const recebe = acharPeca(estado, m.para);
  recebe.af = [...(recebe.af ?? []), ...p.indices.map((i) => ({ ...doadora.af[i], rr: 0 }))];
  const nomeDoadora = ITEM_CATALOG[doadora.id]?.name;
  destruir(estado, m.de);
  return { fez: { tipo: 'transferir', id: recebe.id, nome: ITEM_CATALOG[recebe.id]?.name, levados: p.levados, doadora: nomeDoadora } };
}

// ---- retirar (vira essência)

function previaDoRetirar(estado, { lugar, indices }) {
  const peca = acharPeca(estado, lugar);
  const base = { lugar, indices: [...(indices ?? [])].sort((x, y) => x - y) };
  if (!peca?.af?.length) return { ...base, ok: false, reason: 'Essa peça não tem afixo.' };
  const tirados = base.indices.map((i) => peca.af[i]).filter(Boolean);
  if (!tirados.length || tirados.length > 3) return { ...base, ok: false, reason: 'Marque de 1 a 3 afixos.' };
  const slot = slotDe(peca.id);
  const por = CUSTOS.retirar[raridadeDe(peca)] ?? CUSTOS.retirar.comum;
  return {
    ...base, ok: true,
    tirados: tirados.map((a) => ({ ficha: A.viewDoAfixo(a, slot, peca.id) })),
    depois: peca.af.filter((_, i) => !base.indices.includes(i)).map((a) => A.viewDoAfixo(a, slot, peca.id)),
    custo: vezes(por, tirados.length * CUSTOS.loteDoRetirar[tirados.length]),
  };
}

export const previaRetirar = (estado, m) => ({ t: 'forjaAfixoPreviaRetirar', ...previaDoRetirar(estado, m) });

export function retirar(estado, m) {
  const p = previaDoRetirar(estado, m);
  if (!p.ok) return { erro: p.reason };
  const falta = pagar(estado, p.custo, m.moeda);
  if (falta) return { erro: falta };
  const peca = acharPeca(estado, m.lugar);
  const tirados = p.indices.map((i) => peca.af[i]);
  peca.af = peca.af.filter((_, i) => !p.indices.includes(i));
  if (!peca.af.length) delete peca.af;
  for (const a of tirados) (estado.inventory ??= []).push(essencia(peca, { id: a.id, nivel: A.nivelDe(a), value: a.value }));
  return {
    fez: {
      tipo: 'retirar', id: peca.id, nome: ITEM_CATALOG[peca.id]?.name, slot: slotDe(peca.id), raridade: raridadeDe(peca),
      tirados: tirados.map((a) => A.viewDoAfixo(a, null)), ficaram: (peca.af ?? []).map((a) => A.viewDoAfixo(a, null)),
    },
  };
}

// ---- inserir

function previaDoInserir(estado, { lugar, essencias }) {
  const peca = acharPeca(estado, lugar);
  const base = { lugar, essencias: essencias ?? [] };
  if (!peca || !A.aceitaAfixo(peca.id)) return { ...base, ok: false, reason: 'Essa peça não aceita afixo.' };
  const ess = base.essencias.map((l) => acharPeca(estado, l));
  if (!ess.length || ess.length > 3 || ess.some((e) => e?.id !== A.ID_DA_ESSENCIA)) return { ...base, ok: false, reason: 'Escolha de 1 a 3 essências.' };
  const vagas = vagasDe(peca);
  if (ess.length > vagas) return { ...base, ok: false, reason: `Só ${vagas} vaga(s) nesta peça.` };
  const slot = slotDe(peca.id);
  for (const e of ess) {
    if (e.afixoDe && e.afixoDe !== slot) return { ...base, ok: false, reason: `Essa essência é de ${NOME_DO_SLOT[e.afixoDe] ?? e.afixoDe} — só entra no mesmo slot.` };
    if (!e.mitica && e.raridade && e.raridade !== raridadeDe(peca)) return { ...base, ok: false, reason: `Essa essência é ${e.raridade} — só entra numa peça ${e.raridade} (a vermelha entra em qualquer).` };
  }
  const ids = [...(peca.af ?? []).map((a) => a.id), ...ess.map((e) => e.af[0].id)];
  if (new Set(ids).size < ids.length) return { ...base, ok: false, reason: 'A peça ficaria com o mesmo afixo duas vezes.' };
  return {
    ...base, ok: true,
    entrando: ess.map((e) => ({ ficha: A.viewDoAfixo(e.af[0], slot, peca.id) })),
    depois: [...(peca.af ?? []), ...ess.map((e) => e.af[0])].map((a) => A.viewDoAfixo(a, slot, peca.id)),
    custo: vezes(CUSTOS.inserir[raridadeDe(peca)] ?? CUSTOS.inserir.comum, ess.length),
  };
}

export const previaInserir = (estado, m) => ({ t: 'forjaAfixoPreviaInserir', ...previaDoInserir(estado, m) });

export function inserir(estado, m) {
  const p = previaDoInserir(estado, m);
  if (!p.ok) return { erro: p.reason };
  const falta = pagar(estado, p.custo, m.moeda);
  if (falta) return { erro: falta };
  const peca = acharPeca(estado, m.lugar);
  const ess = p.essencias.map((l) => acharPeca(estado, l));
  peca.af = [...(peca.af ?? []), ...ess.map((e) => ({ ...e.af[0], rr: 0 }))];
  // Tira as essências da mochila do maior índice para o menor.
  for (const i of p.essencias.map((l) => Number(l.indice)).sort((x, y) => y - x)) estado.inventory.splice(i, 1);
  return { fez: { tipo: 'inserir', id: peca.id, nome: ITEM_CATALOG[peca.id]?.name, postos: ess.map((e) => A.viewDoAfixo(e.af[0], null)) } };
}

// ---- fundir (3 douradas → 1 vermelha)

function previaDaFusao(estado, { essencias }) {
  const base = { essencias: essencias ?? [] };
  const ess = base.essencias.map((l) => acharPeca(estado, l));
  if (ess.length !== CUSTOS.quantasFundem || ess.some((e) => e?.id !== A.ID_DA_ESSENCIA)) return { ...base, ok: false, reason: 'A fusão pede 3 essências.' };
  // Dourada = Nível 5 (o sistema de itens); antes era "100% da régua".
  if (ess.some((e) => e.mitica || A.nivelDe(e.af[0]) < 5)) return { ...base, ok: false, reason: 'Só essência DOURADA (Nível 5) entra na fusão.' };
  const slot = ess[0].afixoDe;
  if (ess.some((e) => e.afixoDe !== slot)) return { ...base, ok: false, reason: 'As três precisam ser do mesmo slot.' };
  // O afixo que sai: o que mais aparece entre as três (empate: a primeira).
  const conta = {};
  for (const e of ess) conta[e.af[0].id] = (conta[e.af[0].id] ?? 0) + 1;
  const id = Object.entries(conta).sort((a, b) => b[1] - a[1])[0][0];
  const vermelha = { id, nivel: 5, value: A.valorNaRegua(id, A.FRACAO_DA_MITICA * 100) };
  return { ...base, ok: true, slot, raridade: 'mítico', ficha: A.viewDoAfixo(vermelha, null), afixo: vermelha, custo: CUSTOS.fusaoTotal };
}

export const previaFundir = (estado, m) => {
  const { afixo, ...resto } = previaDaFusao(estado, m);
  return { t: 'forjaAfixoPreviaFundir', ...resto };
};

export function fundir(estado, m) {
  const p = previaDaFusao(estado, m);
  if (!p.ok) return { erro: p.reason };
  const falta = pagar(estado, p.custo, m.moeda);
  if (falta) return { erro: falta };
  for (const i of p.essencias.map((l) => Number(l.indice)).sort((x, y) => y - x)) estado.inventory.splice(i, 1);
  estado.inventory.push({ id: A.ID_DA_ESSENCIA, count: 1, af: [p.afixo], afixoDe: p.slot, mitica: true });
  return { fez: { tipo: 'fundir', ficha: p.ficha, slot: p.slot, slotNome: NOME_DO_SLOT[p.slot] ?? null, raridade: 'mítico' } };
}
