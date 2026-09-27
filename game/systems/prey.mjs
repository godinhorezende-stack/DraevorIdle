// Prey: três slots, cada um com uma criatura escolhida e um bônus contra ela.
// Funções puras sobre `estado` — quem manda a resposta é `sessao.mjs`.
//
// Tudo aqui foi calibrado contra os `character.prey` REAIS capturados (o
// personagem de teste level 8 e o level 400 do treino online, em
// `api-mapeada/`), não chutado:
//  - o percentual é o do Tibia por estrela — defesa 10★ = 30%, exp 7★ = 31%,
//    loot 3★ = 19% e 10★ = 40% batem exatamente com as fórmulas abaixo;
//  - `preyRerollCost` é 200 × level (1.600 no level 8, 80.000 no level 400);
//  - o reroll grátis volta 20h depois (o personagem criado às 15:51 tinha
//    `freeRerollAte` às 11:51 do dia seguinte), com um relógio POR slot;
//  - a lista tem 9 criaturas sorteadas do bestiário inteiro (um level 8 recebe
//    Cyclursus e Duke Bloodthorne) — só não entra quem não dá exp nem boss;
//  - `total` é 2h (7.200.000ms) e `catalog.preyPrices` diz o preço em
//    wildcards: 1 para trocar o bônus, 5 para escolher da lista completa.
import { CATALOGO } from './dados.mjs';

export const DURACAO_MS = 2 * 60 * 60 * 1000;
export const INTERVALO_DO_REROLL_GRATIS_MS = 20 * 60 * 60 * 1000;
const OPCOES_POR_LISTA = 9;
const SLOTS = 3;
const BONUS = ['damage', 'defense', 'exp', 'loot'];

/** O percentual REAL de cada bônus por estrela (1 a 10) — ver o cabeçalho. */
export function percentual(bonus, estrelas) {
  const r = Math.max(1, Math.min(10, estrelas)) - 1;
  if (bonus === 'damage') return 7 + 2 * r; // 7% a 25%
  if (bonus === 'defense') return 12 + 2 * r; // 12% a 30%
  return 13 + 3 * r; // exp e loot: 13% a 40%
}

export const custoDaNovaLista = (estado) => 200 * (estado.level ?? 1);

const precos = () => CATALOGO.preyPrices ?? { bonus: 1, select: 5 };

const CANDIDATAS = Object.entries(CATALOGO.bestiary)
  .filter(([, b]) => b.exp > 0 && !b.boss)
  .map(([key]) => key);

const sortearInteiro = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function sortearBonus(slot, piso = 1) {
  slot.bonus = BONUS[sortearInteiro(0, BONUS.length - 1)];
  slot.rarity = sortearInteiro(piso, 10);
  slot.percent = percentual(slot.bonus, slot.rarity);
}

/** 9 criaturas distintas, fora as que já são presa ativa em outro slot. */
function sortearLista(estado, indice) {
  const tomadas = new Set(estado.prey.filter((s, i) => i !== indice && s.key && s.left > 0).map((s) => s.key));
  const escolhidas = new Set();
  while (escolhidas.size < OPCOES_POR_LISTA && escolhidas.size < CANDIDATAS.length - tomadas.size) {
    const key = CANDIDATAS[sortearInteiro(0, CANDIDATAS.length - 1)];
    if (!tomadas.has(key)) escolhidas.add(key);
  }
  return [...escolhidas];
}

function slotTravado(index) {
  return {
    index, state: 'locked', key: null, bonus: null, rarity: 1, percent: 0, left: 0, total: DURACAO_MS,
    locked: false, autoReroll: false, freeRerollAte: 0, options: [],
  };
}

function abrirSlot(estado, slot, agora) {
  slot.state = 'selection';
  slot.key = null;
  slot.left = 0;
  slot.freeRerollAte = agora + INTERVALO_DO_REROLL_GRATIS_MS;
  sortearBonus(slot);
  slot.options = sortearLista(estado, slot.index);
}

/*
 * Cria os slots de quem ainda não tem (todo personagem de antes deste sistema,
 * e todo personagem novo na primeira leitura) e abre o terceiro quando a
 * Ravox Store liberou (`preyThirdSlot`, ver `loja.mjs`). Os dois primeiros são
 * livres de nascença, como no personagem real capturado.
 */
export function garantir(estado, agora = Date.now()) {
  if (!Array.isArray(estado.prey) || estado.prey.length !== SLOTS) {
    estado.prey = Array.from({ length: SLOTS }, (_, i) => slotTravado(i));
    for (const slot of estado.prey.slice(0, 2)) abrirSlot(estado, slot, agora);
  }
  const terceiro = estado.prey[2];
  if (estado.preyThirdSlot && terceiro.state === 'locked') abrirSlot(estado, terceiro, agora);
  return estado.prey;
}

export function paraCliente(estado) {
  return {
    prey: garantir(estado).map((slot) => ({ ...slot, options: [...slot.options] })),
    preyRerollCost: custoDaNovaLista(estado),
  };
}

// ---- Os comandos do painel (`{t:'prey', action, slot, ...}`) ----

function slotAberto(estado, indice) {
  const slot = garantir(estado)[Number(indice)];
  if (!slot) return { erro: 'Slot de prey inexistente.' };
  if (slot.state === 'locked') return { erro: 'Esse slot está bloqueado — ele é liberado na Ravox Store.' };
  return { slot };
}

function gastarWildcards(estado, n) {
  if ((estado.wildcards ?? 0) < n) return false;
  estado.wildcards -= n;
  return true;
}

function ativar(slot, key) {
  slot.key = key;
  slot.state = 'active';
  slot.left = DURACAO_MS;
  slot.total = DURACAO_MS;
  slot.options = [];
}

const presaEmOutroSlot = (estado, indice, key) =>
  estado.prey.some((s, i) => i !== indice && s.key === key && s.left > 0);

/** Escolhe uma das 9 criaturas da lista do slot (de graça). */
export function escolher(estado, { slot: indice, key }) {
  const { slot, erro } = slotAberto(estado, indice);
  if (erro) return { ok: false, erro };
  if (slot.key && slot.left > 0) return { ok: false, erro: 'Esse slot já tem uma presa.' };
  if (!slot.options.includes(key)) return { ok: false, erro: 'Essa criatura não está na lista.' };
  if (presaEmOutroSlot(estado, slot.index, key)) return { ok: false, erro: 'Essa criatura já é presa em outro slot.' };
  ativar(slot, key);
  return { ok: true };
}

/** "Escolher da lista": qualquer criatura do bestiário, por 5 wildcards. */
export function escolherQualquer(estado, { slot: indice, key }) {
  const { slot, erro } = slotAberto(estado, indice);
  if (erro) return { ok: false, erro };
  if (!CANDIDATAS.includes(key)) return { ok: false, erro: 'Essa criatura não pode ser presa.' };
  if (presaEmOutroSlot(estado, slot.index, key)) return { ok: false, erro: 'Essa criatura já é presa em outro slot.' };
  if (!gastarWildcards(estado, precos().select)) return { ok: false, erro: `Precisa de ${precos().select} wildcards.` };
  ativar(slot, key);
  return { ok: true };
}

/*
 * "Trocar bônus" (1 wildcard): tipo novo, com PELO MENOS as estrelas que já
 * tinha — como no Tibia, trocar nunca piora a raridade. Com presa ativa o
 * relógio volta às 2h cheias.
 */
export function trocarBonus(estado, { slot: indice }) {
  const { slot, erro } = slotAberto(estado, indice);
  if (erro) return { ok: false, erro };
  if (!gastarWildcards(estado, precos().bonus)) return { ok: false, erro: `Precisa de ${precos().bonus} wildcard.` };
  sortearBonus(slot, slot.rarity);
  if (slot.key) slot.left = DURACAO_MS;
  return { ok: true };
}

/*
 * "Nova lista": grátis quando o relógio do slot (`freeRerollAte`) passou — e
 * aí ele volta a contar 20h —, senão custa `preyRerollCost` em ouro. Descarta
 * a presa ativa, igual ao original: a lista nova é para escolher de novo.
 */
export function novaLista(estado, { slot: indice }, agora = Date.now()) {
  const { slot, erro } = slotAberto(estado, indice);
  if (erro) return { ok: false, erro };
  if (agora >= (slot.freeRerollAte ?? 0)) {
    slot.freeRerollAte = agora + INTERVALO_DO_REROLL_GRATIS_MS;
  } else {
    const custo = custoDaNovaLista(estado);
    if ((estado.gold ?? 0) < custo) return { ok: false, erro: `Precisa de ${custo.toLocaleString('pt-BR')} de ouro.` };
    estado.gold -= custo;
  }
  slot.key = null;
  slot.state = 'selection';
  slot.left = 0;
  slot.options = sortearLista(estado, slot.index);
  return { ok: true };
}

/*
 * "Renovar sozinho" e "Travar bônus": só ligam/desligam — o custo (1 e 5
 * wildcards) sai na hora da renovação, quando as 2h acabam (ver `renovar`).
 * Os dois são excludentes: travar já renova, com o MESMO bônus.
 */
export function opcao(estado, { slot: indice, option, value }) {
  const { slot, erro } = slotAberto(estado, indice);
  if (erro) return { ok: false, erro };
  if (option !== 'autoReroll' && option !== 'lock') return { ok: false, erro: 'Opção de prey inválida.' };
  const campo = option === 'lock' ? 'locked' : 'autoReroll';
  slot[campo] = !!value;
  if (value) slot[campo === 'locked' ? 'autoReroll' : 'locked'] = false;
  return { ok: true };
}

export function comando(estado, m) {
  if (m.action === 'choose') return escolher(estado, m);
  if (m.action === 'selectAll') return escolherQualquer(estado, m);
  if (m.action === 'rerollBonus') return trocarBonus(estado, m);
  if (m.action === 'rerollList') return novaLista(estado, m);
  if (m.action === 'option') return opcao(estado, m);
  return { ok: false, erro: 'Ação de prey desconhecida.' };
}

// ---- O relógio: só corre dentro da hunt ----

function renovar(estado, slot) {
  if (slot.locked && gastarWildcards(estado, precos().select)) return void (slot.left = DURACAO_MS);
  if (slot.autoReroll && gastarWildcards(estado, precos().bonus)) {
    sortearBonus(slot);
    slot.left = DURACAO_MS;
    return;
  }
  // Sem renovação (ou sem wildcard para ela): o slot volta para a escolha, com lista nova.
  slot.key = null;
  slot.state = 'selection';
  slot.left = 0;
  slot.options = sortearLista(estado, slot.index);
}

/** Desconta `ms` de caçada de toda presa ativa ("Pausado fora da hunt — só conta caçando"). */
export function consumir(estado, ms, agora = Date.now()) {
  if (!(ms > 0)) return;
  for (const slot of garantir(estado, agora)) {
    if (!slot.key || slot.left <= 0) continue;
    slot.left = Math.max(0, slot.left - ms);
    if (slot.left === 0) renovar(estado, slot);
  }
}

// ---- O bônus, que só vale contra a criatura do slot ----

/*
 * `slot.key` contra o bicho (`monstro.key`, a chave do bestiário) — e só UM
 * slot por criatura, já que a escolha recusa repetida. "40% numa Spider é 40%
 * em spiders e zero no resto da hunt" (comentário do dono, `sheet.mjs`).
 */
function percentualContra(estado, bonus, key) {
  if (!key || !Array.isArray(estado.prey)) return 0;
  const slot = estado.prey.find((s) => s.key === key && s.left > 0 && s.bonus === bonus);
  return slot ? slot.percent : 0;
}

export const fatorDeDano = (estado, key) => 1 + percentualContra(estado, 'damage', key) / 100;
export const fatorDeDefesa = (estado, key) => 1 - percentualContra(estado, 'defense', key) / 100;
export const fatorDeExp = (estado, key) => 1 + percentualContra(estado, 'exp', key) / 100;
export const fatorDeLoot = (estado, key) => 1 + percentualContra(estado, 'loot', key) / 100;
