// Bolsa de loot, filtro de loot e auto-venda — no formato REAL do personagem
// capturado ao vivo (`character-template.json`): `pouch` (1000 vagas),
// `settings.autoSellPouch`, `vendaEmSegundos: 120`/`vendaFaltaSegundos`,
// `pouchValue {gold, sold, lines, kept}` e `itemRules {noLoot, noSell, soAfixo}`.
// Mesmo contrato `{ok, erro?}` dos outros sistemas; nunca fala com a rede.
//
// Como no original: o loot da caçada cai na BOLSA (não na mochila); o que
// está em `noLoot` fica no chão ("Ignorado" no relatório); bolsa cheia também
// fica ("Ficou no chão"); e a cada `vendaEmSegundos` a caçada vende a bolsa
// pelo preço de NPC (`sell` do catálogo x `quickSellRate`), menos o que está em
// `noSell` — isso fica guardado. Na cidade não há venda sozinha: botão Vender.
import * as Afixos from './afixos.mjs';
import * as Gemas from './gemas.mjs';
import { ITEM_CATALOG, CATALOGO } from './dados.mjs';
import { darItem, guardarMoeda } from './inventario.mjs';

export const VAGAS_DA_BOLSA = 1000;
export const VENDA_A_CADA_S = 120;
/** "Diminuir o tempo da auto-venda" (Store): -20s por compra, até 5 (120s -> 20s). */
export const VENDA_RAPIDA_MAX = 5;
export const vendasRapidas = (estado) => Math.min(VENDA_RAPIDA_MAX, estado.compras?.['venda-rapida'] ?? 0);
export const esperaDaVenda = (estado) => VENDA_A_CADA_S - 20 * vendasRapidas(estado);
const TAXA_DA_VENDA = CATALOGO.quickSellRate ?? 1;

export function garantir(estado) {
  estado.pouch ??= [];
  estado.itemRules ??= { noLoot: [], noSell: [], soAfixo: [] };
  for (const k of ['noLoot', 'noSell', 'soAfixo']) estado.itemRules[k] ??= [];
  estado.lootFiltro ??= { sempreSalvar: true, paraTodos: false };
  estado.settings ??= {};
}

const precoDeVenda = (id) => Math.floor((ITEM_CATALOG[id]?.sell ?? 0) * TAXA_DA_VENDA);
/*
 * ---- Munição e arremessável deixaram de empilhar (29/09) ----
 * O dono: flecha, bolt, spear, throwing star... não empilham e vêm com
 * raridade. A pilha de antes (200 arrows) viraria 200 peças soltas — e a
 * munição não é gasta no tiro, então as unidades a mais não servem para nada.
 * Na entrada, cada pilha dessas vira UMA peça e o resto é vendido pelo preço
 * da venda automática. Devolve `{ pecas, ouro }` (o que foi vendido).
 */
export function desempilharMunicao(estado) {
  let pecas = 0;
  let ouro = 0;
  const caixas = [estado.inventory, estado.pouch, ...(estado.deposito ?? []).map((c) => c.itens), Object.values(estado.equipment ?? {})];
  for (const lista of caixas) {
    for (const p of lista ?? []) {
      const meta = ITEM_CATALOG[p?.id];
      if (!meta || meta.stackable || (p.count ?? 1) <= 1) continue;
      if (meta.slot !== 'ammo' && !(meta.slot === 'weapon' && meta.skill === 'distance')) continue;
      const sobra = p.count - 1;
      p.count = 1;
      pecas += sobra;
      ouro += sobra * precoDeVenda(p.id);
    }
  }
  if (ouro) estado.gold = (estado.gold ?? 0) + ouro;
  return { pecas, ouro };
}

// Gema do Gem Atelier nunca vai na venda automática ("é gema do Gem Atelier", no original).
const vende = (estado, id) => precoDeVenda(id) > 0 && !estado.itemRules.noSell.includes(id) && !Gemas.ehGema(id);

/**
 * Põe `count` de `id` na bolsa (empilhando). Devolve quantos couberam.
 * `peca`: a lista de atributos (`af`, o formato de antes) ou a peça inteira que
 * o gerador de itens devolve (`{ af, raridade, efeito }`).
 */
export function porNaBolsa(estado, id, count = 1, peca = null) {
  garantir(estado);
  if (guardarMoeda(estado, id, count)) return count;
  const af = Array.isArray(peca) ? peca : peca?.af;
  const efeito = Array.isArray(peca) ? null : peca?.efeito;
  // Peça que caiu com atributo (ou efeito): um quadrado só dela.
  if (af?.length || efeito) {
    if (estado.pouch.length >= VAGAS_DA_BOLSA) return 0;
    estado.pouch.push({ id, count: 1, af: af ?? [], ...(peca?.raridade ? { raridade: peca.raridade } : {}), ...(efeito ? { efeito } : {}) });
    return 1;
  }
  const bolsa = estado.pouch;
  let falta = count;
  if (ITEM_CATALOG[id]?.stackable) {
    for (const pilha of bolsa) {
      if (falta <= 0) break;
      if (pilha.id !== id) continue;
      const cabe = Math.min(100 - pilha.count, falta);
      if (cabe > 0) {
        pilha.count += cabe;
        falta -= cabe;
      }
    }
  }
  while (falta > 0 && bolsa.length < VAGAS_DA_BOLSA) {
    const n = ITEM_CATALOG[id]?.stackable ? Math.min(100, falta) : 1;
    bolsa.push({ id, count: n });
    falta -= n;
  }
  return count - falta;
}

/** O filtro de loot recusa este item? (`noLoot`) */
export function ignora(estado, id) {
  garantir(estado);
  return estado.itemRules.noLoot.includes(id);
}

/** `pouchValue` real: quanto a bolsa vale na próxima venda, linha a linha. */
export function valorDaBolsa(estado) {
  garantir(estado);
  const porId = new Map();
  for (const p of estado.pouch) porId.set(p.id, (porId.get(p.id) ?? 0) + p.count);
  const lines = [];
  const kept = [];
  let gold = 0;
  for (const [id, count] of porId) {
    if (!vende(estado, id)) {
      kept.push(id);
      continue;
    }
    const unit = precoDeVenda(id);
    lines.push({ id, count, unit, total: unit * count });
    gold += unit * count;
  }
  return { gold, sold: lines.reduce((a, l) => a + l.count, 0), lines, kept };
}

/**
 * Vende tudo o que dá na bolsa. Devolve `{gold, itens:{id:count}}` — quem
 * chama soma na sessão da caçada (grupo "Vendido" do relatório).
 */
export function venderBolsa(estado) {
  garantir(estado);
  const itens = {};
  let gold = 0;
  estado.pouch = estado.pouch.filter((p) => {
    if (!vende(estado, p.id)) return true;
    // Estrela, raridade, tier e imbuement que a pessoa mandou guardar (filtro de loot).
    if (Afixos.guarda(estado, p)) return true;
    gold += precoDeVenda(p.id) * p.count;
    itens[p.id] = (itens[p.id] ?? 0) + p.count;
    return false;
  });
  estado.gold = (estado.gold ?? 0) + gold;
  return { gold, itens };
}

// ------------------------------------------------------------- comandos

/**
 * `send({t:'settings', chave: valor})` — as preferências que várias telas
 * gravam (auto-venda, guardar afixo/estrelas/raridade, seguir líder, ...).
 * Só valores simples; o resto é recusado.
 */
export function definirSettings(estado, m) {
  garantir(estado);
  for (const [k, v] of Object.entries(m)) {
    if (k === 't') continue;
    if (['boolean', 'number', 'string'].includes(typeof v) || v === null) estado.settings[k] = v;
  }
  return { ok: true };
}

/** `send({t:'lootFiltro', sempreSalvar|paraTodos: bool})`. */
export function definirLootFiltro(estado, m) {
  garantir(estado);
  for (const k of ['sempreSalvar', 'paraTodos']) if (typeof m[k] === 'boolean') estado.lootFiltro[k] = m[k];
  return { ok: true };
}

/**
 * `send({t:'itemRule', rule, id, only?})` — liga/desliga a regra do item.
 * `only`: marca SÓ esta regra (tira o item das outras).
 */
export function regraDeItem(estado, { rule, id, only }) {
  garantir(estado);
  const lista = estado.itemRules[rule];
  if (!lista) return { ok: false, erro: 'Regra desconhecida.' };
  id = Number(id);
  if (only) for (const outra of Object.values(estado.itemRules)) {
    const i = outra.indexOf(id);
    if (i >= 0 && outra !== lista) outra.splice(i, 1);
  }
  const i = lista.indexOf(id);
  if (i >= 0 && !only) lista.splice(i, 1);
  else if (i < 0) lista.push(id);
  return { ok: true };
}

/** `send({t:'lootPreset', preset:'npc', ids})` — "Apenas o que NPC compra": o resto fica no chão. */
export function presetDeLoot(estado, { preset, ids }) {
  garantir(estado);
  if (preset !== 'npc' || !Array.isArray(ids)) return { ok: false, erro: 'Preset desconhecido.' };
  const noLoot = new Set(estado.itemRules.noLoot);
  for (const id of ids.map(Number)) {
    if (precoDeVenda(id) > 0) noLoot.delete(id);
    else noLoot.add(id);
  }
  estado.itemRules.noLoot = [...noLoot];
  return { ok: true };
}

/** `send({t:'pouch', id, count, to:'bag'|'pouch', pilha})` — mover entre a bolsa e a mochila. */
export function moverBolsa(estado, { id, count = 1, to, pilha, alvo }) {
  garantir(estado);
  id = Number(id);
  const de = to === 'bag' ? estado.pouch : (estado.inventory ??= []);
  if (!Number.isInteger(pilha) && Number.isInteger(alvo?.indice)) pilha = alvo.indice;
  const especial = (p) => !!(p?.af?.length || p?.tier || p?.imbu?.length);
  /*
   * ---- Sem dizer QUAL peça, a especial não pode virar cópia limpa ----
   *
   * "no mobile se eu ir na bolsa de loot e marcar para jogar para mochila ele
   *  duplica e não vai com as estrelas do atributo extra".
   *
   * O menu do celular (e o arrasto) mandava só o `id`, sem `pilha`. Aí o
   * `disponivel` contava a peça estrelada, a `ordem` (só peças simples) não
   * tirava nada dela, e o `darItem` criava uma cópia LIMPA na mochila: a
   * estrelada ficava na bolsa e aparecia outra sem estrela. Agora, sem peça
   * simples desse id, a especial vai INTEIRA; e só se entrega o que saiu.
   */
  const temSimples = de.some((p) => p.id === id && !especial(p));
  if (!(Number.isInteger(pilha) && de[pilha]?.id === id) && !temSimples) {
    const i = de.findIndex((p) => p.id === id && especial(p));
    if (i >= 0) pilha = i;
  }
  // Peça com estrela/tier/imbuement passa INTEIRA (o quadrado dela), sem
  // virar uma cópia limpa pelo empilhamento.
  const alvoEspecial = Number.isInteger(pilha) && de[pilha]?.id === id && especial(de[pilha]);
  if (alvoEspecial) {
    const [peca] = de.splice(pilha, 1);
    if (to === 'bag') (estado.inventory ??= []).push(peca);
    else if (estado.pouch.length < VAGAS_DA_BOLSA) estado.pouch.push(peca);
    else {
      de.splice(pilha, 0, peca);
      return { ok: false, erro: 'A bolsa de loot está cheia.' };
    }
    return { ok: true };
  }
  // Só as peças SIMPLES entram na conta: é só delas que o laço abaixo tira, e
  // contar a especial aqui entregava na mochila uma cópia que não saiu da bolsa.
  const disponivel = de.filter((p) => p.id === id && !especial(p)).reduce((a, p) => a + p.count, 0);
  let falta = Math.min(Math.max(1, Number(count) || 1), disponivel);
  if (!falta) return { ok: false, erro: 'Esse item não está aí.' };
  const total = falta;
  // A pilha apontada primeiro, depois as outras do mesmo item.
  const ordem = [...de.keys()].filter((i) => de[i].id === id && !especial(de[i]));
  if (Number.isInteger(pilha) && de[pilha]?.id === id) ordem.unshift(...ordem.splice(ordem.indexOf(pilha), 1));
  for (const i of ordem) {
    const tirar = Math.min(de[i].count, falta);
    de[i].count -= tirar;
    falta -= tirar;
    if (!falta) break;
  }
  if (to === 'bag') {
    estado.pouch = estado.pouch.filter((p) => p.count > 0);
    darItem(estado, id, total);
  } else {
    estado.inventory = estado.inventory.filter((p) => p.count > 0);
    porNaBolsa(estado, id, total);
  }
  return { ok: true };
}

/** `send({t:'clearPouch', fora:[{i, id}]})` — o "Jogar fora" da tela Limpar Bolsa. */
export function limparBolsa(estado, { fora }) {
  garantir(estado);
  if (!Array.isArray(fora) || !fora.length) return { ok: false, erro: 'Nada marcado para jogar fora.' };
  const indices = [...new Set(fora.filter((f) => Number.isInteger(f?.i) && estado.pouch[f.i]?.id === f.id).map((f) => f.i))];
  if (!indices.length) return { ok: false, erro: 'A bolsa mudou — abra a tela de novo.' };
  for (const i of indices.sort((a, b) => b - a)) estado.pouch.splice(i, 1);
  return { ok: true };
}

/** `send({t:'venderSacolas'})` — o botão Vender da bolsa (na cidade não há venda sozinha). */
export function venderAgora(estado) {
  const { gold } = venderBolsa(estado);
  if (!gold) return { ok: false, erro: 'Nada na bolsa que o NPC compre.' };
  return { ok: true, notice: `Vendido por ${gold.toLocaleString('pt-BR')} gold.` };
}

/** Os campos da bolsa que vão no personagem (`characterParaCliente`). */
export function paraCliente(estado, faltaParaVender = null) {
  garantir(estado);
  return {
    pouch: estado.pouch,
    pouchSlots: VAGAS_DA_BOLSA,
    vendaEmSegundos: esperaDaVenda(estado),
    vendaFaltaSegundos: faltaParaVender,
    pouchValue: valorDaBolsa(estado),
    itemRules: estado.itemRules,
    lootFiltro: estado.lootFiltro,
  };
}

/*
 * `send({t:'venderMochila', lugar?})` devolve a PRÉVIA (`{lugar, linhas,
 * total}`, o que `openVenderMochila` desenha); com `vender:[{i, id,
 * mesmoAssim?}]` vende essas pilhas pelo preço de NPC. Peça com estrela, tier
 * ou imbuement vem com `aviso` e só é vendida com `mesmoAssim` — a tela
 * pergunta antes. Sem preço de NPC, vem com `motivo` e não sai.
 */
export function vendaDaMochila(estado, { lugar = 'bag', vender } = {}) {
  garantir(estado);
  const itens = lugar === 'pouch' ? estado.pouch : (estado.inventory ??= []);
  let ouro = 0;
  if (Array.isArray(vender)) {
    const indices = new Set();
    for (const v of vender) {
      const p = itens[v?.i];
      if (!p || p.id !== v.id || !precoDeVenda(p.id)) continue;
      const valiosa = p.af?.length || p.tier || p.imbu?.length;
      if (valiosa && !v.mesmoAssim) continue;
      ouro += precoDeVenda(p.id) * p.count;
      indices.add(v.i);
    }
    for (const i of [...indices].sort((a, b) => b - a)) itens.splice(i, 1);
    estado.gold = (estado.gold ?? 0) + ouro;
  }
  const linhas = itens.map((p, i) => {
    const unidade = precoDeVenda(p.id);
    const valiosa = p.af?.length || p.tier || p.imbu?.length;
    return {
      ...p, i, unidade, total: unidade * p.count,
      ...(unidade ? {} : { motivo: 'o NPC não compra' }),
      ...(valiosa ? { aviso: 'estrela, tier ou imbuement' } : {}),
    };
  });
  return {
    ok: true,
    previa: { t: 'venderMochila', lugar, linhas, total: linhas.filter((l) => !l.motivo).reduce((a, l) => a + l.total, 0) },
    ...(ouro ? { notice: `Vendido por ${ouro.toLocaleString('pt-BR')} gold.` } : {}),
  };
}
