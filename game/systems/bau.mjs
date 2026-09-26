// Baú de Boss e Boss Pouch — no formato que o client original lê
// (`character.rewards`, `character.bossPouch`/`bossPouchSlots`) e com os
// comandos dele (`reward`, `venderSacolas`, `bossPouch`):
//
// - cada boss derrotado vira uma SACOLA no baú (`{indice, boss, item, itens}`);
//   o loot de boss não vai para a bolsa de loot, que se vende sozinha;
// - do baú, `take`/`takeItem`/`takeAll` levam para a Boss Pouch (1000 vagas,
//   respeitando a capacidade); `clear`/`clearAll` descartam, guardando os ids
//   marcados (`keep`);
// - `venderSacolas` vende direto das sacolas; `bossPouch` vende, limpa e move
//   para a mochila. Ambos com prévia (`linhas`) e o mesmo `aviso`/`mesmoAssim`
//   da venda da mochila para peça com estrela, tier ou imbuement.
import { ITEM_CATALOG, CATALOGO } from './dados.mjs';
import { cabeNoPeso, guardarMoeda } from './inventario.mjs';

export const VAGAS_DA_BOSS_POUCH = 1000;
const SACOLA_DO_BOSS = 2853; // o desenho da sacola no baú (um "bag")
const TAXA = CATALOGO.quickSellRate ?? 1;
const preco = (id) => Math.floor((ITEM_CATALOG[id]?.sell ?? 0) * TAXA);
const valiosa = (p) => !!(p.af?.length || p.tier || p.imbu?.length);

export function garantir(estado) {
  estado.rewards ??= [];
  estado.bossPouch ??= [];
  estado.bossCooldownsAte ??= {};
  return estado;
}

/** Uma sacola nova no baú com o loot do boss (moeda vai direto para o bolso). */
export function novaSacola(estado, boss, itens) {
  garantir(estado);
  const soItens = [];
  for (const it of itens) if (!guardarMoeda(estado, it.id, it.count)) soItens.push(it);
  if (!soItens.length) return null;
  const indice = estado.rewards.reduce((m, s) => Math.max(m, s.indice), -1) + 1;
  const sacola = { indice, boss, item: SACOLA_DO_BOSS, itens: soItens, criadaEm: Date.now() };
  estado.rewards.push(sacola);
  return sacola;
}

/** Põe na Boss Pouch (empilhando). Devolve quantos couberam — vagas e capacidade. */
function porNaBossPouch(estado, peca, count) {
  const pouch = estado.bossPouch;
  const cabe = (n) => cabeNoPeso(estado, peca.id, n);
  let n = count;
  while (n > 0 && !cabe(n)) n--;
  if (!n) return 0;
  if (ITEM_CATALOG[peca.id]?.stackable && !valiosa(peca)) {
    const igual = pouch.find((p) => p.id === peca.id && !valiosa(p));
    if (igual) {
      igual.count += n;
      return n;
    }
  }
  if (pouch.length >= VAGAS_DA_BOSS_POUCH) return 0;
  pouch.push({ ...peca, count: n });
  return n;
}

/** Leva itens de uma sacola para a Boss Pouch; tira a sacola se esvaziou. */
function levarDaSacola(estado, sacola, filtro = () => true) {
  let levou = 0;
  sacola.itens = sacola.itens.filter((p) => {
    if (!filtro(p)) return true;
    const n = porNaBossPouch(estado, p, p.count ?? 1);
    levou += n;
    p.count = (p.count ?? 1) - n;
    return p.count > 0;
  });
  if (!sacola.itens.length) estado.rewards = estado.rewards.filter((s) => s !== sacola);
  return levou;
}

/** `send({t:'reward', action, sacola?, id?, keep?})`. */
export function comandoDoBau(estado, { action, sacola, id, keep }) {
  garantir(estado);
  const alvo = estado.rewards.find((s) => s.indice === sacola);
  const guardar = new Set((keep ?? []).map(Number));
  if (action === 'take' || action === 'takeItem') {
    if (!alvo) return { ok: false, erro: 'Essa sacola não existe mais.' };
    const levou = levarDaSacola(estado, alvo, action === 'takeItem' ? (p) => p.id === Number(id) : undefined);
    return levou ? { ok: true } : { ok: false, erro: 'Sem capacidade ou sem vaga na Boss Pouch.' };
  }
  if (action === 'takeAll') {
    let levou = 0;
    for (const s of [...estado.rewards]) levou += levarDaSacola(estado, s);
    return levou ? { ok: true } : { ok: false, erro: 'Sem capacidade ou sem vaga na Boss Pouch.' };
  }
  if (action === 'clear' || action === 'clearAll') {
    const sacolas = action === 'clear' ? (alvo ? [alvo] : []) : [...estado.rewards];
    if (!sacolas.length) return { ok: false, erro: 'Essa sacola não existe mais.' };
    for (const s of sacolas) s.itens = s.itens.filter((p) => guardar.has(p.id));
    estado.rewards = estado.rewards.filter((s) => s.itens.length);
    return { ok: true };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

const linha = (p, extra) => {
  const unidade = preco(p.id);
  return {
    ...p, ...extra, unidade, total: unidade * (p.count ?? 1),
    ...(unidade ? {} : { motivo: 'o NPC não compra' }),
    ...(valiosa(p) ? { aviso: 'estrela, tier ou imbuement' } : {}),
  };
};

/** `send({t:'venderSacolas', vender?})` — prévia (`linhas`, `total`, `sacolas`) e venda direto do baú. */
export function venderSacolas(estado, { vender } = {}) {
  garantir(estado);
  let ouro = 0;
  if (Array.isArray(vender)) {
    for (const v of vender) {
      const s = estado.rewards.find((x) => x.indice === v.sacola);
      const p = s?.itens[v.i];
      if (!p || p.id !== v.id || !preco(p.id) || (valiosa(p) && !v.mesmoAssim)) continue;
      ouro += preco(p.id) * (p.count ?? 1);
      p.vendido = true;
    }
    for (const s of estado.rewards) s.itens = s.itens.filter((p) => !p.vendido);
    estado.rewards = estado.rewards.filter((s) => s.itens.length);
    estado.gold = (estado.gold ?? 0) + ouro;
  }
  const linhas = estado.rewards.flatMap((s) => s.itens.map((p, i) => linha(p, { sacola: s.indice, i })));
  return {
    ok: true,
    previa: { t: 'venderSacolas', linhas, total: linhas.filter((l) => !l.motivo).reduce((a, l) => a + l.total, 0), sacolas: estado.rewards.length },
    ...(ouro ? { notice: `Vendido por ${ouro.toLocaleString('pt-BR')} gold.` } : {}),
  };
}

/** `send({t:'bossPouch', vender?|limpar?|mover?})` — prévia (`linhas, total, slots, usados`) e as três ações. */
export function comandoDaBossPouch(estado, { vender, limpar, mover } = {}) {
  garantir(estado);
  const pouch = estado.bossPouch;
  let ouro = 0;
  let erro = null;
  const escolhidos = (lista) => new Set((lista ?? []).filter((v) => pouch[v.i]?.id === v.id && (!valiosa(pouch[v.i]) || v.mesmoAssim)).map((v) => v.i));
  if (Array.isArray(vender)) {
    const is = escolhidos(vender);
    for (const i of is) if (preco(pouch[i].id)) ouro += preco(pouch[i].id) * (pouch[i].count ?? 1);
    estado.bossPouch = pouch.filter((p, i) => !(is.has(i) && preco(p.id)));
    estado.gold = (estado.gold ?? 0) + ouro;
  } else if (Array.isArray(limpar)) {
    const is = escolhidos(limpar);
    estado.bossPouch = pouch.filter((_, i) => !is.has(i));
  } else if (mover) {
    // Arrastar da Boss Pouch para a mochila (o peso não muda: as duas pesam).
    const id = Number(mover.id);
    const i = Number.isInteger(mover.pilha) && pouch[mover.pilha]?.id === id ? mover.pilha : pouch.findIndex((p) => p.id === id);
    if (i < 0) erro = 'Essa peça não está na Boss Pouch.';
    else {
      const p = pouch[i];
      const n = Math.min(p.count ?? 1, Math.max(1, Number(mover.count) || 1));
      p.count -= n;
      if (p.count <= 0) pouch.splice(i, 1);
      const { count, ...extras } = p;
      (estado.inventory ??= []).push({ ...extras, id, count: n });
    }
  }
  if (erro) return { ok: false, erro };
  const linhas = estado.bossPouch.map((p, i) => linha(p, { i }));
  return {
    ok: true,
    previa: { t: 'bossPouch', linhas, total: linhas.filter((l) => !l.motivo).reduce((a, l) => a + l.total, 0), slots: VAGAS_DA_BOSS_POUCH, usados: estado.bossPouch.length },
    ...(ouro ? { notice: `Vendido por ${ouro.toLocaleString('pt-BR')} gold.` } : {}),
  };
}

/** Os campos do baú que vão no personagem. */
export function paraCliente(estado) {
  garantir(estado);
  return { rewards: estado.rewards, bossPouch: estado.bossPouch, bossPouchSlots: VAGAS_DA_BOSS_POUCH };
}
