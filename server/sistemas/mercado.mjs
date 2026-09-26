// Mercado — o balcão de itens (`market`) e o de Ravox Coins (`coinMarket`),
// nos formatos que o client original lê (capturados ao vivo em
// api-mapeada/servidor/market-browse.json e coinMarket.json):
//
// - `market` browse → `{list, mine, gold}`; `list` são os itens com anúncio,
//   com `buy`/`sell` (quantos anúncios de cada lado) e `bestBuy`/`bestSell`;
// - `market` offers → `marketOffers {offers, total, pagina, paginas}` (8 por
//   página, com os filtros do balcão: lado, moeda, busca, slot, vocação...);
// - `market` offer/accept/cancel e historico → `marketHistorico`;
// - `coinMarket` → `{compra, venda, minhas, history, coins, gold}`, com
//   order/accept/cancel.
//
// O mercado é GLOBAL (todos os personagens do servidor) e fica no banco. O que
// é anunciado sai do personagem na hora (fica "em custódia" no anúncio) e volta
// se cancelar. Quem recebe algo estando fora do jogo recebe ao entrar: o ouro
// no bolso e os itens na caixa de Chegadas do depósito (ver `receberCreditos`).
import { banco } from '../../game/database/banco.mjs';
import { ITEM_CATALOG } from '../nucleo/dados.mjs';
import { darItem, cabeNoPeso } from './inventario.mjs';
import * as Deposito from './deposito.mjs';

const idAuto = banco.dialeto === 'postgres' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const inteiroGrande = banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
await banco.exec(`
  CREATE TABLE IF NOT EXISTS mercado_ofertas (
    id ${idAuto}, personagem TEXT NOT NULL, vendedor TEXT NOT NULL,
    kind TEXT NOT NULL, item INTEGER NOT NULL, count INTEGER NOT NULL, price INTEGER NOT NULL,
    moeda TEXT NOT NULL, peca TEXT, criada ${inteiroGrande} NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mercado_historico (
    id ${idAuto}, personagem TEXT NOT NULL, lado TEXT NOT NULL,
    item INTEGER NOT NULL, count INTEGER NOT NULL, price INTEGER NOT NULL, moeda TEXT NOT NULL,
    outro TEXT, at ${inteiroGrande} NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coin_ordens (
    id ${idAuto}, personagem TEXT NOT NULL, nome TEXT NOT NULL,
    kind TEXT NOT NULL, amount INTEGER NOT NULL, price INTEGER NOT NULL, criada ${inteiroGrande} NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coin_historico (
    id ${idAuto}, buyer TEXT, seller TEXT, amount INTEGER, price INTEGER, at ${inteiroGrande}
  );
  CREATE TABLE IF NOT EXISTS creditos (
    id ${idAuto}, personagem TEXT NOT NULL, gold INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0, itens TEXT DEFAULT '[]'
  );
`);

const POR_PAGINA = 8;
const moedaValida = (m) => (m === 'coin' ? 'coin' : 'gold');
const inteiro = (v, min = 1) => Math.max(min, Math.floor(Number(v) || 0));

// ------------------------------------------------------------- dinheiro

/** Tira `valor` do bolso (e do banco, se faltar). Devolve false sem mexer se não der. */
function pagar(estado, valor, moeda) {
  if (moeda === 'coin') {
    if ((estado.coins ?? 0) < valor) return false;
    estado.coins -= valor;
    return true;
  }
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  if (total < valor) return false;
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
  return true;
}

/**
 * Crédito para OUTRO personagem (quem vendeu, quem comprou pelo anúncio de
 * compra). `aoVivo(personagemId)` devolve o `estado` dele se estiver no jogo;
 * senão fica na tabela `creditos` e entra no próximo login.
 */
async function creditar(personagemId, { gold = 0, coins = 0, itens = [] }, aoVivo) {
  const estado = aoVivo?.(personagemId);
  if (estado) return entregar(estado, { gold, coins, itens });
  await banco.prepare('INSERT INTO creditos (personagem, gold, coins, itens) VALUES (?, ?, ?, ?)').run(personagemId, gold, coins, JSON.stringify(itens));
}

/** Entrega no personagem: ouro/coins no bolso; itens na mochila se couber, senão nas Chegadas. */
function entregar(estado, { gold = 0, coins = 0, itens = [] }) {
  estado.gold = (estado.gold ?? 0) + gold;
  estado.coins = (estado.coins ?? 0) + coins;
  const chegadas = Deposito.garantir(estado).find((c) => c.chegadas);
  for (const it of itens) {
    const especial = it.peca && (it.peca.af?.length || it.peca.tier || it.peca.imbu?.length);
    if (cabeNoPeso(estado, it.id, it.count)) {
      if (especial) (estado.inventory ??= []).push({ ...it.peca, id: it.id, count: it.count });
      else darItem(estado, it.id, it.count);
    }
    else if (chegadas) {
      chegadas.itens.push({ ...(it.peca ?? {}), id: it.id, count: it.count });
      chegadas.tipos = chegadas.itens.length;
    }
  }
}

/** No login: o que chegou enquanto estava fora. Devolve o aviso, ou null. */
export async function receberCreditos(estado, personagemId) {
  const linhas = await banco.prepare('SELECT * FROM creditos WHERE personagem = ?').all(personagemId);
  if (!linhas.length) return null;
  let gold = 0, coins = 0, itens = 0;
  for (const l of linhas) {
    const lista = JSON.parse(l.itens || '[]');
    entregar(estado, { gold: l.gold, coins: l.coins, itens: lista });
    gold += l.gold;
    coins += l.coins;
    itens += lista.length;
  }
  await banco.prepare('DELETE FROM creditos WHERE personagem = ?').run(personagemId);
  const partes = [gold && `${gold.toLocaleString('pt-BR')} gold`, coins && `${coins} Ravox Coins`, itens && `${itens} item(ns)`].filter(Boolean);
  return `Mercado: você recebeu ${partes.join(', ')} enquanto estava fora.`;
}

// --------------------------------------------------------- balcão de itens

const anuncio = (o, personagemId) => {
  const meta = ITEM_CATALOG[o.item] ?? {};
  const peca = o.peca ? JSON.parse(o.peca) : {};
  return {
    id: o.id, item: o.item, name: meta.name ?? `item ${o.item}`, count: o.count, price: o.price,
    total: o.price * o.count, moeda: o.moeda, kind: o.kind, seller: o.vendedor,
    minha: o.personagem === personagemId, slot: meta.slot ?? null, rarity: meta.rarity ?? null,
    minLevel: meta.minLevel ?? 0, ...(peca.af ? { af: peca.af } : {}), ...(peca.tier ? { tier: peca.tier } : {}),
  };
};

/** `market browse` → `{list, mine, gold}`. */
export async function balcao(estado, personagemId) {
  const ofertas = await banco.prepare('SELECT * FROM mercado_ofertas').all();
  const porItem = new Map();
  for (const o of ofertas) {
    const l = porItem.get(o.item) ?? { buy: 0, sell: 0, bestBuy: 0, bestSell: 0 };
    if (o.kind === 'buy') {
      l.buy += 1;
      l.bestBuy = Math.max(l.bestBuy, o.price);
    } else {
      l.sell += 1;
      l.bestSell = l.bestSell ? Math.min(l.bestSell, o.price) : o.price;
    }
    porItem.set(o.item, l);
  }
  const list = [...porItem].map(([id, l]) => {
    const m = ITEM_CATALOG[id] ?? {};
    return {
      id, name: m.name ?? `item ${id}`, slot: m.slot ?? null, type: m.type ?? null, npc: m.sell ?? 0, weight: m.weight ?? 0,
      ...(m.attack != null ? { attack: m.attack } : {}), ...(m.defense != null ? { defense: m.defense } : {}),
      ...(m.armor != null ? { armor: m.armor } : {}), ...l,
    };
  });
  const mine = ofertas.filter((o) => o.personagem === personagemId).map((o) => anuncio(o, personagemId));
  return { list, mine, gold: estado.gold ?? 0 };
}

/** `market offers {filtros}` → `{offers, total, pagina, paginas}`. */
export async function ofertas(personagemId, filtros = {}) {
  const kind = filtros.kind === 'buy' ? 'buy' : 'sell';
  const moeda = moedaValida(filtros.moeda);
  const busca = String(filtros.search ?? '').trim().toLowerCase();
  let lista = (await banco.prepare('SELECT * FROM mercado_ofertas WHERE kind = ? AND moeda = ?').all(kind, moeda)).map((o) => anuncio(o, personagemId));
  if (busca) lista = lista.filter((o) => o.name.toLowerCase().includes(busca));
  if (filtros.slot && filtros.slot !== 'all') lista = lista.filter((o) => o.slot === filtros.slot);
  if (filtros.rarity && filtros.rarity !== 'all') lista = lista.filter((o) => o.rarity === filtros.rarity);
  if (filtros.vocation && filtros.vocation !== 'all') {
    lista = lista.filter((o) => { const v = ITEM_CATALOG[o.item]?.vocations; return !v?.length || v.includes(filtros.vocation); });
  }
  const ordem = filtros.ordem ?? 'barato';
  lista.sort((a, b) => (ordem === 'caro' ? b.price - a.price : ordem === 'novo' ? b.id - a.id : a.price - b.price));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pagina = Math.min(paginas, inteiro(filtros.pagina ?? 1));
  return { offers: lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), total: lista.length, pagina, paginas };
}

function historico(personagemId, { personagem, lado, item, count, price, moeda, outro }) {
  return banco.prepare('INSERT INTO mercado_historico (personagem, lado, item, count, price, moeda, outro, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(personagem ?? personagemId, lado, item, count, price, moeda, outro ?? null, Date.now());
}

/** `market offer {kind, id, count, price, peca, moeda}` — anunciar. */
export async function anunciar(estado, personagem, { kind, id, count, price, peca, moeda }) {
  kind = kind === 'buy' ? 'buy' : 'sell';
  moeda = moedaValida(moeda);
  id = Number(id);
  const n = inteiro(count);
  const preco = inteiro(price);
  if (!ITEM_CATALOG[id]) return { ok: false, erro: 'Item desconhecido.' };
  let pecaGuardada = null;
  if (kind === 'sell') {
    // O item sai da mochila agora (fica no anúncio); a peça apontada primeiro.
    const inv = estado.inventory ?? [];
    let i = Number.isInteger(peca?.indice) && inv[peca.indice]?.id === id ? peca.indice : inv.findIndex((p) => p.id === id);
    const disponivel = inv.filter((p) => p.id === id).reduce((a, p) => a + (p.count ?? 1), 0);
    if (i < 0 || disponivel < n) return { ok: false, erro: 'Você não tem essa quantidade na mochila.' };
    let falta = n;
    const primeira = inv[i];
    if (primeira.af?.length || primeira.tier || primeira.imbu?.length) {
      const { count: _c, id: _i, ...extras } = primeira;
      pecaGuardada = extras;
    }
    const ordem = [i, ...[...inv.keys()].filter((k) => k !== i && inv[k].id === id)];
    for (const k of ordem) {
      const tirar = Math.min(inv[k].count ?? 1, falta);
      inv[k].count = (inv[k].count ?? 1) - tirar;
      falta -= tirar;
      if (!falta) break;
    }
    estado.inventory = inv.filter((p) => (p.count ?? 1) > 0);
  } else if (!pagar(estado, preco * n, moeda)) {
    return { ok: false, erro: moeda === 'coin' ? 'Ravox Coins insuficientes.' : 'Ouro insuficiente.' };
  }
  await banco.prepare('INSERT INTO mercado_ofertas (personagem, vendedor, kind, item, count, price, moeda, peca, criada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(personagem.id, personagem.nome, kind, id, n, preco, moeda, pecaGuardada ? JSON.stringify(pecaGuardada) : null, Date.now());
  return { ok: true, notice: `Anúncio criado: ${n}x ${ITEM_CATALOG[id].name}.`, anuncio: { kind, count: n, nome: ITEM_CATALOG[id].name, preco, moeda } };
}

/** `market accept {offerId, count}` — fechar negócio com um anúncio. */
export async function aceitar(estado, personagem, { offerId, count }, aoVivo) {
  const o = await banco.prepare('SELECT * FROM mercado_ofertas WHERE id = ?').get(Number(offerId));
  if (!o) return { ok: false, erro: 'Esse anúncio não existe mais.' };
  if (o.personagem === personagem.id) return { ok: false, erro: 'Esse anúncio é seu.' };
  const n = Math.min(o.count, inteiro(count));
  const valor = o.price * n;
  const nome = ITEM_CATALOG[o.item]?.name ?? `item ${o.item}`;
  const peca = o.peca ? JSON.parse(o.peca) : null;
  if (o.kind === 'sell') {
    // Eu compro: pago, recebo o item; o vendedor recebe o dinheiro.
    if (!pagar(estado, valor, o.moeda)) return { ok: false, erro: o.moeda === 'coin' ? 'Ravox Coins insuficientes.' : 'Ouro insuficiente.' };
    entregar(estado, { itens: [{ id: o.item, count: n, peca }] });
    await creditar(o.personagem, o.moeda === 'coin' ? { coins: valor } : { gold: valor }, aoVivo);
    await historico(personagem.id, { lado: 'compra', item: o.item, count: n, price: o.price, moeda: o.moeda, outro: o.vendedor });
    await historico(null, { personagem: o.personagem, lado: 'venda', item: o.item, count: n, price: o.price, moeda: o.moeda, outro: personagem.nome });
  } else {
    // Anúncio de COMPRA: eu entrego o item, recebo o dinheiro que estava reservado.
    const inv = estado.inventory ?? [];
    const tem = inv.filter((p) => p.id === o.item).reduce((a, p) => a + (p.count ?? 1), 0);
    if (tem < n) return { ok: false, erro: `Você não tem ${n}x ${nome} na mochila.` };
    let falta = n;
    for (const p of inv) {
      if (p.id !== o.item || !falta) continue;
      const tirar = Math.min(p.count ?? 1, falta);
      p.count = (p.count ?? 1) - tirar;
      falta -= tirar;
    }
    estado.inventory = inv.filter((p) => (p.count ?? 1) > 0);
    entregar(estado, o.moeda === 'coin' ? { coins: valor } : { gold: valor });
    await creditar(o.personagem, { itens: [{ id: o.item, count: n }] }, aoVivo);
    await historico(personagem.id, { lado: 'venda', item: o.item, count: n, price: o.price, moeda: o.moeda, outro: o.vendedor });
    await historico(null, { personagem: o.personagem, lado: 'compra', item: o.item, count: n, price: o.price, moeda: o.moeda, outro: personagem.nome });
  }
  if (n >= o.count) await banco.prepare('DELETE FROM mercado_ofertas WHERE id = ?').run(o.id);
  else await banco.prepare('UPDATE mercado_ofertas SET count = count - ? WHERE id = ?').run(n, o.id);
  return { ok: true, notice: `Negócio fechado: ${n}x ${nome} por ${valor.toLocaleString('pt-BR')} ${o.moeda === 'coin' ? 'Ravox Coins' : 'gold'}.` };
}

/** `market cancel {offerId}` — o que estava em custódia volta. */
export async function cancelar(estado, personagem, { offerId }) {
  const o = await banco.prepare('SELECT * FROM mercado_ofertas WHERE id = ? AND personagem = ?').get(Number(offerId), personagem.id);
  if (!o) return { ok: false, erro: 'Esse anúncio não existe mais.' };
  await banco.prepare('DELETE FROM mercado_ofertas WHERE id = ?').run(o.id);
  if (o.kind === 'sell') entregar(estado, { itens: [{ id: o.item, count: o.count, peca: o.peca ? JSON.parse(o.peca) : null }] });
  else entregar(estado, o.moeda === 'coin' ? { coins: o.price * o.count } : { gold: o.price * o.count });
  return { ok: true, notice: 'Anúncio cancelado.' };
}

/** `market historico` → `{linhas, gasto, ganho, gastoCoin, ganhoCoin}`. */
export async function extrato(personagemId) {
  const linhas = (await banco.prepare('SELECT * FROM mercado_historico WHERE personagem = ? ORDER BY at DESC LIMIT 100').all(personagemId)).map((h) => ({
    item: h.item, name: ITEM_CATALOG[h.item]?.name ?? `item ${h.item}`, count: h.count, price: h.price,
    total: h.price * h.count, moeda: h.moeda, lado: h.lado, outro: h.outro, at: h.at,
  }));
  const soma = (lado, moeda) => linhas.filter((l) => l.lado === lado && l.moeda === moeda).reduce((a, l) => a + l.total, 0);
  return { linhas, gasto: soma('compra', 'gold'), ganho: soma('venda', 'gold'), gastoCoin: soma('compra', 'coin'), ganhoCoin: soma('venda', 'coin') };
}

// ------------------------------------------------------ balcão de coins

/** `coinMarket {pagina}` → `{compra, venda, minhas, history, coins, gold}`. */
export async function balcaoDeCoins(estado, personagemId, pagina = 1) {
  const todas = await banco.prepare('SELECT * FROM coin_ordens').all();
  const linha = (o) => ({ id: o.id, amount: o.amount, price: o.price, total: o.amount * o.price, seller: o.nome, minha: o.personagem === personagemId });
  const lado = (kind, ordem) => {
    const lista = todas.filter((o) => o.kind === kind).sort(ordem).map(linha);
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const p = Math.min(paginas, inteiro(pagina));
    return { linhas: lista.slice((p - 1) * POR_PAGINA, p * POR_PAGINA), total: lista.length, pagina: p, paginas };
  };
  const history = await banco.prepare('SELECT * FROM coin_historico ORDER BY at DESC LIMIT 20').all();
  return {
    compra: lado('buy', (a, b) => b.price - a.price),
    venda: lado('sell', (a, b) => a.price - b.price),
    minhas: todas.filter((o) => o.personagem === personagemId).map((o) => ({ ...linha(o), kind: o.kind })),
    history,
    coins: estado.coins ?? 0,
    gold: estado.gold ?? 0,
  };
}

/** `coinMarket order {kind, amount, price}` — `buy`: compra coins pagando ouro; `sell`: vende coins. */
export async function ordemDeCoins(estado, personagem, { kind, amount, price }) {
  kind = kind === 'sell' ? 'sell' : 'buy';
  const n = inteiro(amount);
  const preco = inteiro(price);
  const ok = kind === 'sell' ? pagar(estado, n, 'coin') : pagar(estado, n * preco, 'gold');
  if (!ok) return { ok: false, erro: kind === 'sell' ? 'Ravox Coins insuficientes.' : 'Ouro insuficiente.' };
  await banco.prepare('INSERT INTO coin_ordens (personagem, nome, kind, amount, price, criada) VALUES (?, ?, ?, ?, ?, ?)').run(personagem.id, personagem.nome, kind, n, preco, Date.now());
  return { ok: true, notice: 'Ordem criada.' };
}

/** `coinMarket accept {orderId, amount}`. */
export async function aceitarCoins(estado, personagem, { orderId, amount }, aoVivo) {
  const o = await banco.prepare('SELECT * FROM coin_ordens WHERE id = ?').get(Number(orderId));
  if (!o) return { ok: false, erro: 'Essa ordem não existe mais.' };
  if (o.personagem === personagem.id) return { ok: false, erro: 'Essa ordem é sua.' };
  const n = Math.min(o.amount, inteiro(amount));
  const valor = n * o.price;
  if (o.kind === 'sell') {
    // Alguém vende coins: eu pago ouro, recebo as coins (que estavam reservadas).
    if (!pagar(estado, valor, 'gold')) return { ok: false, erro: 'Ouro insuficiente.' };
    estado.coins = (estado.coins ?? 0) + n;
    await creditar(o.personagem, { gold: valor }, aoVivo);
    await banco.prepare('INSERT INTO coin_historico (buyer, seller, amount, price, at) VALUES (?, ?, ?, ?, ?)').run(personagem.nome, o.nome, n, o.price, Date.now());
  } else {
    // Alguém compra coins: eu entrego as coins, recebo o ouro reservado.
    if (!pagar(estado, n, 'coin')) return { ok: false, erro: 'Ravox Coins insuficientes.' };
    estado.gold = (estado.gold ?? 0) + valor;
    await creditar(o.personagem, { coins: n }, aoVivo);
    await banco.prepare('INSERT INTO coin_historico (buyer, seller, amount, price, at) VALUES (?, ?, ?, ?, ?)').run(o.nome, personagem.nome, n, o.price, Date.now());
  }
  if (n >= o.amount) await banco.prepare('DELETE FROM coin_ordens WHERE id = ?').run(o.id);
  else await banco.prepare('UPDATE coin_ordens SET amount = amount - ? WHERE id = ?').run(n, o.id);
  return { ok: true, notice: `Negócio fechado: ${n} Ravox Coins.` };
}

/** `coinMarket cancel {orderId}` — devolve o reservado. */
export async function cancelarCoins(estado, personagem, { orderId }) {
  const o = await banco.prepare('SELECT * FROM coin_ordens WHERE id = ? AND personagem = ?').get(Number(orderId), personagem.id);
  if (!o) return { ok: false, erro: 'Essa ordem não existe mais.' };
  await banco.prepare('DELETE FROM coin_ordens WHERE id = ?').run(o.id);
  if (o.kind === 'sell') estado.coins = (estado.coins ?? 0) + o.amount;
  else estado.gold = (estado.gold ?? 0) + o.amount * o.price;
  return { ok: true, notice: 'Ordem cancelada.' };
}
