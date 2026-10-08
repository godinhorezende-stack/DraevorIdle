// Store. Só as prateleiras com preço REAL capturado (`CATALOGO.storePrices`,
// e os 200/500 coins do Buff Power, citados no próprio comentário do dono em
// `game/frontend/client/src/panels.mjs:10103`) — nada de item/montaria/outfit/pacote
// inventado. As prateleiras sem preço real ficam de propósito como `[]`: o
// cliente já sabe desenhar "Nada por aqui ainda." para uma lista vazia.
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as Premium from './premium.mjs';
import { CATALOGO, CHARACTER_TEMPLATE, STORE_REAL } from './dados.mjs';
import { ITEM_CATALOG } from './dados.mjs';

/*
 * ---- O que se compra vai para as CHEGADAS ----
 *
 * Dono, 06/10: "tire boss pouch e store inbox, tudo comprado pela store vai para chegadas". O item comprado na Store não cai na
 * mochila: vai para a caixa Chegadas do Depósito (sem teto, sem peso) — de lá o jogador tira para a mochila. (Antes era a Store
 * Inbox; o que ainda estava nela foi para as Chegadas — `Deposito.garantir`.)
 */
export const VAGAS_DA_INBOX = 2000;
function porNaInbox(estado, id, count = 1, extras = {}) {
  Deposito.porNasChegadas(estado, { ...extras, id, count });
}
import * as Boosts from './boosts.mjs';
import * as Deposito from './deposito.mjs';
import { podeEntrar, MENSAGEM as SO_ITENS_DO_POE } from './itens-poe/so-itens-do-poe.mjs';

const DIA_MS = 24 * 60 * 60 * 1000;

/*
 * Cópia PRÓPRIA da parte da loja que muda por personagem — `CHARACTER_TEMPLATE`
 * é compartilhado e só de leitura, mesmo padrão de `Recompensas.estadoInicial()`.
 * `autoTask` não tem molde capturado (o campo não existe em `character-template.
 * json`); o comentário do dono em `panels.mjs` diz que ele "chegou com a mesma
 * forma, mesma coisa praticamente" do Auto Boss — por isso o mesmo `{passe,
 * passeAte}`, e não um objeto inventado do zero.
 */
export function estadoInicial() {
  return {
    preyThirdSlot: false,
    blessings: [],
    premiumAte: 0,
    autoBoss: { passe: false, passeAte: 0 },
    autoTask: { passe: false, passeAte: 0 },
    efeitosBuffPower: {}, // { [itemId]: true } — quais o personagem já comprou
  };
}

/** Os 7 ids reais de blessing do `catalog.blessings` (ver `dados.mjs`). */
const IDS_DAS_BLESSINGS = CATALOGO.blessings.map((b) => b.id);

/** Os 3 itens reais do Buff Power, do `character-template.json` (`efeitos.buffPower`). */
const ITENS_DO_BUFF_POWER = CHARACTER_TEMPLATE.efeitos.buffPower; // [{id,item,nome,custo,...}]
const PRECO_BUFF_POWER_UNIDADE = 200; // "200 Draevor Coins cada" — panels.mjs:10103
const PRECO_BUFF_POWER_TRIO = 500; // "ou os 3 por 500 Draevor Coins" — panels.mjs:10103

const cartaoDePremium = (dias) => ({
  id: `premium-${dias}`,
  name: `Premium — ${dias} dias`,
  blurb: 'Soma dias de conta premium — não substitui, empilha.',
  coins: CATALOGO.storePrices[`premium-${dias}`],
  owned: false,
  kind: 'premium',
});

const cartaoDePasseDePlataforma = (kind, prefixo, dias, estado) => {
  const id = dias === 7 ? prefixo : `${prefixo}-14`;
  const passe = estado[kind === 'autoBoss' ? 'autoBoss' : 'autoTask'];
  return {
    id,
    name: kind === 'autoBoss' ? 'Auto Boss sem limite' : 'Auto Task sem limite',
    blurb: 'Vale para todos os personagens da conta.',
    coins: CATALOGO.storePrices[id],
    days: dias,
    kind,
    owned: passe.passe === true && passe.passeAte > Date.now(),
    ativoAte: passe.passeAte ?? 0,
  };
};

/** `send({t:'store'})` — o catálogo inteiro, prateleira por prateleira. */
/** Todas as entradas da loja real, por id — o preço e o que cada uma entrega. */
const PRATELEIRAS = ['services', 'boosts', 'pacotes', 'itens', 'buffpower', 'upgrades', 'extras', 'mounts', 'outfits', 'utilities'];
/*
 * O TREINO saiu do jogo (dono, 06/10 — `sem-treino.mjs`): a prateleira de Exercise, o Scroll Speed Exercise e os Pacotes Treinador
 * não se vendem mais (nem aparecem, nem se compram por id).
 */
// (No modo PoE o Buff Power também sai da Store — dono, 07/10: "esse buff power não vai existir".)
// (No jogo oficial só entra item do PoE — dono, 07/10: o produto que ENTREGA item do Draevor na Store Inbox sai da Store. Serviço cujo
// `itemId` é só a figura do cartão — as vagas da Compartilhada — fica; montaria, outfit e XP Boost não entregam item.)
const SERVICOS_COM_FIGURA = new Set(['cofre-vagas']);
const entregaItem = (e) => e?.itemId != null && !SERVICOS_COM_FIGURA.has(e.id) && e.kind !== 'xpBoost' && e.mountId == null && e.look == null;
const FORA_DA_LOJA = (e) => /^exercise-/.test(e?.id ?? '') || e?.id === 'boost-55386' || /^pacote-treinador/.test(e?.id ?? '') || (itensPoeLigado() && /^buffpower-/.test(e?.id ?? '')) || (entregaItem(e) && !podeEntrar(e.itemId));
const ENTRADA_POR_ID = new Map(PRATELEIRAS.flatMap((k) => (STORE_REAL[k] ?? []).filter((e) => !FORA_DA_LOJA(e)).map((e) => [e.id, { ...e, prateleira: k }])));
// Os pacotes de quantidade de um produto ("5 Exp Potions", "10 Stamina Extension")
// vêm em `opcoes`, cada um com o próprio id e preço.
for (const k of PRATELEIRAS) for (const e of STORE_REAL[k] ?? []) {
  // O pacote de quantidade é do mesmo produto: fora da Store junto com ele (antes o pacote continuava à venda pelo id dele).
  if (FORA_DA_LOJA(e)) continue;
  for (const o of e.opcoes ?? []) if (o?.id) ENTRADA_POR_ID.set(o.id, { ...e, id: o.id, coins: o.coins, amount: o.quantos, prateleira: k });
}

const quantosTem = (estado, itemId) =>
  [...(estado.inventory ?? []), ...(estado.pouch ?? []), ...(estado.storeInbox ?? []), ...((estado.deposito ?? []).find((c) => c.chegadas)?.itens ?? [])].filter((p) => p.id === itemId).reduce((a, p) => a + (p.count ?? 1), 0);

/**
 * `send({t:'store'})` — a loja REAL inteira (`STORE_REAL`), com o que é deste
 * personagem por cima: as coins dele, o que já comprou (`owned`/`tem`), os
 * serviços que este servidor já sabe aplicar (premium, prey, passes) e o
 * "faltam" dos lotes de montarias/outfits.
 */
/*
 * ---- A aba Melhorias, com os números DESTE personagem/conta ----
 *
 * A captura real traz `bought/now/next` do personagem capturado, e eles iam
 * iguais para todo mundo — e `owned` era "já comprou uma vez", então a
 * auto-venda (que se compra 5 vezes) virava "no máximo" na primeira.
 */
const SLOTS_DE_PARTY_MAX = 3; // de 2 até 5 pessoas
function melhorias(estado, conta) {
  const b = {
    'party-slot': Math.min(SLOTS_DE_PARTY_MAX, conta?.slotsDeParty ?? 0),
    'venda-rapida': Math.min(5, estado.compras?.['venda-rapida'] ?? 0),
  };
  const tetoDaCaixa = estado.bauDaConta?.teto ?? 20;
  return (STORE_REAL.upgrades ?? []).map((e) => {
    if (e.id === 'party-slot') {
      const bought = b[e.id];
      const resta = SLOTS_DE_PARTY_MAX - bought;
      return { ...e, bought, now: 2 + bought, next: 3 + bought, owned: resta <= 0, opcoes: e.opcoes.filter((o) => o.quantos <= resta) };
    }
    if (e.id === 'venda-rapida') {
      const bought = b[e.id];
      return { ...e, bought, now: 120 - 20 * bought, next: 100 - 20 * bought, owned: bought >= e.max };
    }
    if (e.id === 'cofre-vagas') {
      const bought = Math.max(0, Math.round((tetoDaCaixa - 20) / 20));
      return { ...e, bought, now: tetoDaCaixa, next: tetoDaCaixa + 20, owned: bought >= e.max };
    }
    return { ...e, tem: e.itemId ? quantosTem(estado, e.itemId) : e.tem, owned: false };
  });
}

export function catalogoDaLoja(estado, conta = null) {
  const loja = structuredClone(STORE_REAL);
  loja.coins = estado.coins ?? 0;
  const compras = estado.compras ?? {};
  const locais = new Map(servicosLocais(estado).map((e) => [e.id, e]));
  loja.services = loja.services.map((e) => ({ ...e, ...(locais.has(e.id) ? { owned: locais.get(e.id).owned, ativoAte: locais.get(e.id).ativoAte } : {}) }));
  loja.exercises = [];
  for (const k of PRATELEIRAS) if (Array.isArray(loja[k])) loja[k] = loja[k].filter((e) => !FORA_DA_LOJA(e));
  for (const k of ['itens', 'pacotes', 'buffpower']) {
    loja[k] = loja[k].map((e) => ({ ...e, tem: e.itemId ? quantosTem(estado, e.itemId) : e.tem, owned: !!compras[e.id] }));
  }
  for (const k of ['boosts', 'extras']) loja[k] = loja[k].map((e) => ({ ...e, owned: !!compras[e.id] }));
  loja.upgrades = melhorias(estado, conta);
  const montarias = new Set(estado.lojaMontarias ?? []);
  const outfits = new Set(estado.lojaOutfits ?? []);
  loja.mounts = loja.mounts.map((e) => ({ ...e, owned: montarias.has(e.mountId) }));
  loja.outfits = loja.outfits.map((e) => ({ ...e, owned: outfits.has(e.look) }));
  if (loja.lotes?.mounts) loja.lotes.mounts.faltam = loja.mounts.filter((e) => !e.owned).length;
  if (loja.lotes?.outfits) loja.lotes.outfits.faltam = loja.outfits.filter((e) => !e.owned).length;
  return loja;
}

/** Os serviços que este servidor já aplica de verdade (premium, prey, passes...) — para o `owned` deles. */
function servicosLocais(estado) {
  return [
    ...[7, 15, 30, 90].map(cartaoDePremium),
    { id: 'prey-slot', owned: estado.preyThirdSlot === true },
    cartaoDePasseDePlataforma('autoBoss', 'auto-boss-passe', 7, estado),
    cartaoDePasseDePlataforma('autoBoss', 'auto-boss-passe', 14, estado),
    cartaoDePasseDePlataforma('autoTask', 'auto-task-passe', 7, estado),
    cartaoDePasseDePlataforma('autoTask', 'auto-task-passe', 14, estado),
  ];
}

function aplicarEfeito(estado, id) {
  if (id.startsWith('premium-')) {
    const dias = Number(id.slice('premium-'.length));
    Premium.adicionarDias(estado, dias); // (antes: Math.max(undefined, ...) dava NaN em quem nunca teve premium)
    return;
  }
  if (id === 'prey-slot') return void (estado.preyThirdSlot = true);
  if (id === 'wildcards-5') return void (estado.wildcards = (estado.wildcards ?? 0) + 5);
  if (id === 'wildcards-25') return void (estado.wildcards = (estado.wildcards ?? 0) + 25);
  if (id === 'bless-pack') return void (estado.blessings = [...IDS_DAS_BLESSINGS]);
  if (id === 'auto-boss-passe' || id === 'auto-boss-passe-14') {
    const dias = id.endsWith('-14') ? 14 : 7;
    estado.autoBoss.passe = true;
    estado.autoBoss.passeAte = Math.max(estado.autoBoss.passeAte ?? 0, Date.now()) + dias * DIA_MS;
    return;
  }
  if (id === 'auto-task-passe' || id === 'auto-task-passe-14') {
    const dias = id.endsWith('-14') ? 14 : 7;
    estado.autoTask.passe = true;
    estado.autoTask.passeAte = Math.max(estado.autoTask.passeAte ?? 0, Date.now()) + dias * DIA_MS;
    return;
  }
  if (id.startsWith('buffpower-') && id !== 'buffpower-trio') {
    const item = ITENS_DO_BUFF_POWER.find((entry) => `buffpower-${entry.id}` === id);
    if (!item) return;
    (estado.efeitosBuffPower ??= {})[item.item] = true;
    porNaInbox(estado, item.item, 1);
    return;
  }
  if (id === 'buffpower-trio') {
    for (const item of ITENS_DO_BUFF_POWER) {
      (estado.efeitosBuffPower ??= {})[item.item] = true;
      porNaInbox(estado, item.item, 1);
    }
    return;
  }
  // O resto da loja real: montaria e outfit ficam liberados; item vai para a
  // mochila (exercise com as cargas dele); o que ainda não tem efeito aqui
  // (boosts, upgrades, extras) fica registrado em `estado.compras`.
  const entrada = ENTRADA_POR_ID.get(id);
  if (!entrada) return;
  (estado.compras ??= {})[id] = (estado.compras[id] ?? 0) + 1;
  // XP Boost da loja: "+50% de experiência por uma hora de caçada. Liga na hora da compra."
  if (entrada.kind === 'xpBoost') return void Boosts.adicionar(estado, 'loja', 50, (entrada.hours ?? 1) * 3_600_000);
  // "Os três Buff Power": os três itens (antes cobrava 500 e não entregava nada).
  if (entrada.kind === 'buffTrio') {
    for (const it of entrada.itens ?? []) porNaInbox(estado, it.itemId, 1);
    return;
  }
  if (entrada.prateleira === 'mounts') return void (estado.lojaMontarias ??= []).push(entrada.mountId);
  if (entrada.prateleira === 'outfits') return void (estado.lojaOutfits ??= []).push(entrada.look);
  // Exercise chega com as cargas dele (`carga`, o campo que a mochila mostra).
  if (entrada.cargas) return void porNaInbox(estado, entrada.itemId, 1, { carga: entrada.cargas });
  if (entrada.itemId) porNaInbox(estado, entrada.itemId, entrada.amount ?? 1);
}

/** `send({t:'store', action:'buy', id})` */
export function comprar(estado, { id }, conta = null) {
  // Melhorias com teto: recusa ANTES de cobrar.
  if (id === 'venda-rapida' && (estado.compras?.['venda-rapida'] ?? 0) >= 5) return { ok: false, erro: 'A auto-venda já está no mínimo: 20s.' };
  if (id.startsWith('party-slot-')) {
    const quantos = Number(id.slice('party-slot-'.length));
    const tem = conta?.slotsDeParty ?? 0;
    if (!conta) return { ok: false, erro: 'Slot de party é da conta — entre num personagem.' };
    if (tem >= SLOTS_DE_PARTY_MAX) return { ok: false, erro: `Sua conta já está no máximo: party de ${2 + SLOTS_DE_PARTY_MAX} pessoas.` };
    if (tem + quantos > SLOTS_DE_PARTY_MAX) return { ok: false, erro: `Sua conta já tem ${tem} de ${SLOTS_DE_PARTY_MAX} slots — dá para levar só ${SLOTS_DE_PARTY_MAX - tem}.` };
  }
  const preco = precoDoId(id);
  if (preco == null) return { ok: false, erro: 'Este produto ainda não está disponível.' };
  if ((estado.coins ?? 0) < preco) return { ok: false, erro: 'Você não tem Draevor Coins suficientes.' };
  const entrada = ENTRADA_POR_ID.get(id);
  if (entrada?.prateleira === 'mounts' && (estado.lojaMontarias ?? []).includes(entrada.mountId)) return { ok: false, erro: 'Você já tem essa montaria.' };
  if (entrada?.prateleira === 'outfits' && (estado.lojaOutfits ?? []).includes(entrada.look)) return { ok: false, erro: 'Você já tem esse outfit.' };
  estado.coins -= preco;
  if (id.startsWith('party-slot-')) {
    conta.slotsDeParty = (conta.slotsDeParty ?? 0) + Number(id.slice('party-slot-'.length));
    (estado.compras ??= {})[id] = (estado.compras[id] ?? 0) + 1;
    return { ok: true, notice: `Party da conta: agora até ${2 + conta.slotsDeParty} pessoas.`, conta: true };
  }
  aplicarEfeito(estado, id);
  if (id === 'venda-rapida') return { ok: true, notice: `Auto-venda a cada ${120 - 20 * Math.min(5, estado.compras['venda-rapida'])}s.` };
  if (entrada?.itemId && ['summon-upgrade', 'tier-up'].some((p) => id.startsWith(p))) {
    return { ok: true, notice: `${entrada.amount ?? 1}x ${entrada.name} nas Chegadas do Depósito.` };
  }
  return { ok: true };
}

/**
 * O que a linha do Histórico da loja (`historicoDaLoja`, ver
 * `historico-da-loja.mjs`) mostra de uma compra: o nome do produto e a figura
 * — a mesma arte/sprite/aparência do cartão na prateleira (`imagemDoHistorico`
 * no client lê `imagem.art`, `imagem.itemId` ou `imagem.look`).
 */
export function descricaoDaCompra(id) {
  const e = ENTRADA_POR_ID.get(id);
  const nome = e?.name ?? (id === 'cofre-vagas' ? 'Vagas no Baú da Conta' : id);
  const titulo = e?.amount > 1 ? `${e.amount}x ${nome}` : nome;
  const imagem = e?.art ? { art: e.art } : e?.itemId ? { itemId: e.itemId } : e?.look ? { look: e.look } : null;
  return { titulo, imagem };
}

function precoDoId(id) {
  // Fora da Store (ex.: o Buff Power no jogo oficial) não tem preço: antes o pedido direto pelo id ainda comprava.
  if (FORA_DA_LOJA({ id })) return null;
  const real = ENTRADA_POR_ID.get(id)?.coins;
  if (real != null) return real;
  if (id === 'buffpower-trio') return PRECO_BUFF_POWER_TRIO;
  if (id.startsWith('buffpower-')) return PRECO_BUFF_POWER_UNIDADE;
  return CATALOGO.storePrices[id] ?? null;
}

/** `send({t:'storeInbox', mover:{id, count, pilha}})` — da Store Inbox para a mochila (se couber no peso). */
export function moverDaInbox(estado, { mover }, cabeNoPeso) {
  const inbox = (estado.storeInbox ??= []);
  const id = Number(mover?.id);
  const i = Number.isInteger(mover?.pilha) && inbox[mover.pilha]?.id === id ? mover.pilha : inbox.findIndex((p) => p.id === id);
  if (i < 0) return { ok: false, erro: 'Essa peça não está na Store Inbox.' };
  const peca = inbox[i];
  if (!podeEntrar(id, peca)) return { ok: false, erro: SO_ITENS_DO_POE };
  const n = Math.min(peca.count ?? 1, Math.max(1, Number(mover.count) || 1));
  if (!cabeNoPeso(estado, id, n)) return { ok: false, erro: 'Você não tem capacidade (ou vaga na mochila) para carregar isso.' };
  peca.count = (peca.count ?? 1) - n;
  if (peca.count <= 0) inbox.splice(i, 1);
  const { count, ...extras } = peca;
  (estado.inventory ??= []).push({ ...extras, id, count: n });
  return { ok: true };
}
