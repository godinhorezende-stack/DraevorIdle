import * as Boosts from './boosts.mjs';
import * as Stamina from './stamina.mjs';
import * as Exercicio from './exercicio.mjs';
import * as Premium from './premium.mjs';
import * as BuffPower from './buffpower.mjs';
import * as Summon from './summon.mjs';
import * as Afixos from './afixos.mjs';
import * as R from '../nucleo/regras.mjs';
// Inventário e o chão da praça: equipar de início, peso carregado, destruir,
// largar e pegar item do chão. Funções puras sobre `estado` — quem manda a
// resposta pro cliente é `sessao.mjs`; este arquivo não conhece WebSocket.
import { ITEM_CATALOG, EQUIPAMENTO_POR_VOCACAO, ACTION_CATALOG } from '../nucleo/dados.mjs';

export function equipamentoInicial(vocacao) {
  const modelo = EQUIPAMENTO_POR_VOCACAO[vocacao].equipment;
  const equipment = {};
  for (const [slot, id] of Object.entries(modelo)) equipment[slot] = id == null ? null : { id, count: 1 };
  return equipment;
}

export const inventarioInicial = (vocacao) =>
  EQUIPAMENTO_POR_VOCACAO[vocacao].inventory.map((id) => ({ id, count: 1 }));

/**
 * Peso carregado (equipado + mochila), pelo peso real de `ITEM_CATALOG` —
 * validado contra o personagem de teste capturado ao vivo: soma exata dá 367,
 * o `weight` que o `welcome` real mandou para aquele knight.
 */
export function pesoDoInventario(estado) {
  let total = 0;
  for (const peca of Object.values(estado.equipment ?? {})) {
    if (peca) total += (ITEM_CATALOG[peca.id]?.weight ?? 0) * peca.count;
  }
  // A bolsa de loot pesa também, como no original: é o peso que faz o loot
  // "ficar no chão" quando a capacidade acaba (o aviso "Sem capacidade" da
  // bolsa, e o `perdido` da sessão real do Zotod, que caçava sem cap).
  for (const peca of [...(estado.inventory ?? []), ...(estado.pouch ?? []), ...(estado.bossPouch ?? [])]) {
    total += (ITEM_CATALOG[peca.id]?.weight ?? 0) * peca.count;
  }
  return total;
}

/**
 * Dá um item ao personagem. Só empilha em cima do inventário solto — não
 * sabe de mochila/pilha real ainda (isso é `juntar`/`organizar`, que ainda
 * não existe); o item aparece "largado" no inventário mesmo assim.
 */
/** Tamanho máximo de uma pilha (o mesmo 100 do Tibia/OTServ). */
const PILHA_MAX = 100;

/**
 * Põe `count` de `id` na mochila. Item empilhável (`stackable` no catálogo
 * real) completa as pilhas que já existem antes de abrir quadradinho novo —
 * antes cada drop virava uma pilha própria e a mochila enchia de "1 spear,
 * 1 spear, 1 spear".
 */
/**
 * Dinheiro (gold, platinum e crystal coin) nunca vai para a mochila nem para a
 * bolsa: vira ouro no bolso na hora, pelo valor de cada uma — venha de onde
 * vier (loot, chão, loja, caçada offline). O resto das "coins" do catálogo
 * (scarab, ancient, pirate...) é loot vendável, não dinheiro.
 */
export const VALOR_DA_MOEDA = { 3031: 1, 3035: 100, 3043: 10000 };

/** Se `id` é dinheiro, põe no bolso e devolve true. */
export function guardarMoeda(estado, id, count = 1) {
  const valor = VALOR_DA_MOEDA[id];
  if (!valor) return false;
  estado.gold = (estado.gold ?? 0) + valor * count;
  return true;
}

/** Migração: moedas soltas na mochila/bolsa (de antes desta regra) viram ouro. */
export function moedasParaOBolso(estado) {
  for (const k of ['inventory', 'pouch']) {
    if (!Array.isArray(estado[k])) continue;
    estado[k] = estado[k].filter((p) => !guardarMoeda(estado, p.id, p.count ?? 1));
  }
}

/** Cabe `count` de `id` na capacidade do level (equipamento + mochila + bolsa)? */
export function cabeNoPeso(estado, id, count = 1) {
  const peso = (ITEM_CATALOG[id]?.weight ?? 0) * count;
  return pesoDoInventario(estado) + peso <= Afixos.capacidade(estado);
}

export function darItem(estado, id, count = 1) {
  if (guardarMoeda(estado, id, count)) return;
  const inventory = (estado.inventory ??= []);
  let falta = count;
  if (ITEM_CATALOG[id]?.stackable) {
    for (const pilha of inventory) {
      if (falta <= 0) break;
      if (pilha.id !== id || pilha.af?.length || pilha.tier || pilha.imbu?.length) continue;
      const cabe = Math.min(PILHA_MAX - (pilha.count ?? 1), falta);
      if (cabe <= 0) continue;
      pilha.count = (pilha.count ?? 1) + cabe;
      falta -= cabe;
    }
    while (falta > 0) {
      const n = Math.min(PILHA_MAX, falta);
      inventory.push({ id, count: n });
      falta -= n;
    }
    return;
  }
  for (let i = 0; i < falta; i++) inventory.push({ id, count: 1 });
}



/**
 * Tira `count` de `id` do inventário solto — de uma pilha só ou espalhado por
 * várias, na ordem em que aparecem. Devolve `false` sem mudar nada se não
 * houver o suficiente (a chamada inteira falha, não tira uma parte).
 */
export function removerItem(estado, id, count) {
  const inventory = estado.inventory ?? [];
  const disponivel = inventory.filter((p) => p.id === id).reduce((soma, p) => soma + p.count, 0);
  if (disponivel < count) return false;

  let falta = count;
  for (let i = inventory.length - 1; i >= 0 && falta > 0; i--) {
    if (inventory[i].id !== id) continue;
    const tirar = Math.min(inventory[i].count, falta);
    inventory[i].count -= tirar;
    falta -= tirar;
    if (inventory[i].count <= 0) inventory.splice(i, 1);
  }
  return true;
}

// ---- Material de craft/desmanche: mochila E bolsa de loot ----

/** A peça carrega algo que se perderia (tier, afixo, imbuement)? */
export const temExtras = (p) => !!(p?.tier || p?.af?.length || p?.imbu?.length);

const GUARDADAS = ['inventory', 'pouch'];

/** Quantas de `id` há na mochila e na bolsa: `{ limpas, comExtras }`. */
export function contarGuardadas(estado, id) {
  let limpas = 0;
  let comExtras = 0;
  for (const k of GUARDADAS) {
    for (const p of estado[k] ?? []) {
      if (p.id !== id) continue;
      if (temExtras(p)) comExtras += p.count ?? 1;
      else limpas += p.count ?? 1;
    }
  }
  return { limpas, comExtras };
}

/**
 * Tira `count` de `id` da mochila e da bolsa — as peças LIMPAS primeiro (quem
 * tem tier/afixo/imbuement só sai se faltar, e nunca com `soLimpas`). Tudo ou
 * nada: devolve `false` sem mexer em nada se não houver o suficiente.
 */
export function tirarGuardadas(estado, id, count, { soLimpas = false } = {}) {
  const { limpas, comExtras } = contarGuardadas(estado, id);
  if (limpas + (soLimpas ? 0 : comExtras) < count) return false;
  let falta = count;
  for (const limpa of [true, false]) {
    for (const k of GUARDADAS) {
      const lista = estado[k] ?? [];
      for (let i = lista.length - 1; i >= 0 && falta > 0; i--) {
        const p = lista[i];
        if (p.id !== id || temExtras(p) === limpa) continue;
        const tirar = Math.min(p.count ?? 1, falta);
        p.count = (p.count ?? 1) - tirar;
        falta -= tirar;
        if (p.count <= 0) lista.splice(i, 1);
      }
    }
  }
  return true;
}

/** `send({t:'destroy', id, count, from})` — só `from:'bag'` existe nesta restauração. */
export function destruir(estado, { id, count = 1, from }) {
  if (from !== 'bag') return { ok: false, erro: 'Ainda não dá para destruir daí.' };
  if (!removerItem(estado, id, count)) return { ok: false, erro: 'Você não tem essa peça.' };
  return { ok: true };
}

/**
 * `send({t:'clearBackpack', fora:[{i, id}, ...]})` — o "Jogar fora" da tela
 * Limpar Mochila (`openLimparMochila`, em panels.mjs). Cada entrada é o ÍNDICE
 * do quadradinho em `character.inventory` mais o id que o client viu ali: se o
 * id não bate mais (a mochila mudou entre abrir a tela e confirmar), aquele
 * quadradinho fica — nunca destrói a peça errada. Tira do maior índice para o
 * menor, senão cada `splice` deslocaria os índices seguintes.
 */
export function limparMochila(estado, { fora }) {
  if (!Array.isArray(fora) || !fora.length) return { ok: false, erro: 'Nada marcado para jogar fora.' };
  const inventory = estado.inventory ?? [];
  const indices = [...new Set(fora.filter((f) => Number.isInteger(f?.i) && inventory[f.i]?.id === f.id).map((f) => f.i))];
  if (!indices.length) return { ok: false, erro: 'A mochila mudou — abra a tela de novo.' };
  for (const i of indices.sort((a, b) => b - a)) inventory.splice(i, 1);
  return { ok: true };
}

// -------------------------------------------------------------------- chão

/**
 * O chão da praça é UM só, compartilhado por quem estiver lá — não por
 * personagem. Semeado uma vez, no boot, com os itens REAIS que estavam
 * largados no spawn quando a cidade foi capturada (`CITY_META.chao`); a
 * partir daí, largar e pegar mudam este Map, e `CITY_META.chao` original
 * nunca mais é lido direto — ele já cumpriu o papel de semente.
 */
const CHAO = new Map();

export function semearChao(chaoCapturado) {
  for (const pilha of chaoCapturado ?? []) {
    const chave = `${pilha.x},${pilha.y}`;
    CHAO.set(chave, (pilha.pilha ?? []).map((p) => ({ id: p.item, count: p.count })));
  }
}

const chaveDoTile = (x, y) => `${x},${y}`;

/**
 * "para pegar eu tenho que estar no lado do item ou encima" — a resposta é
 * sim: alcance é a casa em que se está OU qualquer uma das 8 vizinhas
 * (distância de Chebyshev ≤ 1), como o alcance de mão em qualquer Tibia-like.
 * Faltava de propósito até aqui — o comentário do `onTileDrop` em `main.mjs`
 * já dizia "quem confere alcance... é o servidor", mas nenhum `pegar`/`largar`
 * fazia essa conta.
 */
const noAlcance = (pos, x, y) => Math.max(Math.abs(pos.x - x), Math.abs(pos.y - y)) <= 1;

/** O `chao` do snapshot da cidade — mesmo formato que o `welcome` real mandava. */
export function chaoParaCliente() {
  const lista = [];
  for (const [chave, pilha] of CHAO) {
    if (!pilha.length) continue;
    const [x, y] = chave.split(',').map(Number);
    const topo = pilha[pilha.length - 1];
    lista.push({
      x,
      y,
      item: topo.id,
      count: topo.count,
      sob: pilha.length - 1,
      nome: ITEM_CATALOG[topo.id]?.name ?? '',
      pilha: pilha.map((p) => ({ item: p.id, count: p.count, nome: ITEM_CATALOG[p.id]?.name ?? '' })),
    });
  }
  return lista;
}

/**
 * `send({t:'largar', id, count, x, y})` — joga uma peça do inventário no chão.
 *
 * `send({t:'largar', de:{x,y}, x, y, deIndice})` — peça que JÁ estava no chão,
 * mudando de casa (arrastar do mapa para o mapa). Não passa pela mochila: nem
 * peso nem espaço entram na conta, só sai de uma pilha do `CHAO` e entra na
 * outra. Ver o comentário do `mapView.onTileDrop` em `main.mjs` — o cliente
 * manda esse formato sem `id` nenhum, e sem este ramo a peça nunca ia (dava
 * "Você não tem essa peça" sempre, porque `id` vinha `undefined`).
 */
export function largar(estado, { id, count = 1, x, y, de, deIndice }) {
  if (de) {
    if (!noAlcance(estado.pos, de.x, de.y)) return { ok: false, erro: 'Está muito longe.' };
    const chaveDe = chaveDoTile(de.x, de.y);
    const pilhaDe = CHAO.get(chaveDe);
    if (!pilhaDe?.length) return { ok: false, erro: 'Não há nada aí.' };
    const i = deIndice == null ? pilhaDe.length - 1 : deIndice;
    const peca = pilhaDe[i];
    if (!peca) return { ok: false, erro: 'Não há nada aí.' };
    pilhaDe.splice(i, 1);
    if (!pilhaDe.length) CHAO.delete(chaveDe);
    const chave = chaveDoTile(x, y);
    const pilha = CHAO.get(chave) ?? [];
    pilha.push(peca);
    CHAO.set(chave, pilha);
    return { ok: true };
  }
  if (!removerItem(estado, id, count)) return { ok: false, erro: 'Você não tem essa peça.' };
  const chave = chaveDoTile(x, y);
  const pilha = CHAO.get(chave) ?? [];
  pilha.push({ id, count });
  CHAO.set(chave, pilha);
  return { ok: true };
}

/** `send({t:'pegar', x, y, indice})` — `indice: null` é sempre o topo da pilha. */
export function pegar(estado, { x, y, indice }) {
  if (!noAlcance(estado.pos, x, y)) return { ok: false, erro: 'Está muito longe.' };
  const chave = chaveDoTile(x, y);
  const pilha = CHAO.get(chave);
  if (!pilha?.length) return { ok: false, erro: 'Não há nada aí.' };

  const i = indice == null ? pilha.length - 1 : indice;
  const peca = pilha[i];
  if (!peca) return { ok: false, erro: 'Não há nada aí.' };
  if (!VALOR_DA_MOEDA[peca.id] && !cabeNoPeso(estado, peca.id, peca.count)) return { ok: false, erro: 'Você não tem capacidade para carregar isso.' };

  pilha.splice(i, 1);
  if (!pilha.length) CHAO.delete(chave);
  darItem(estado, peca.id, peca.count);
  return { ok: true };
}

// ------------------------------------------------- mochila e equipamento
//
// Os comandos que o client manda da mochila e da ficha (`inventory.mjs`):
// equipar, tirar, usar, dividir, juntar, trocar e organizar. `pilha` é o
// ÍNDICE do quadradinho em `character.inventory` (ou em `pouch`, com
// `from:'pouch'`); `id` confere que a peça ainda é a mesma.

/*
 * De onde a operação vem: a mochila, a bolsa (`pouch`), ou uma caixa do
 * depósito (`depot:<indice>` — é o `from` que a caixa manda para trocar de
 * lugar, organizar, juntar e separar; antes caía na mochila e mexia nela).
 */
const lista = (estado, onde) => {
  if (onde === 'pouch') return (estado.pouch ??= []);
  if (onde === 'storeInbox') return (estado.storeInbox ??= []);
  const caixa = /^depot:(\d+)$/.exec(String(onde ?? ''));
  if (caixa) {
    const i = Number(caixa[1]);
    const alvo = (estado.deposito ?? []).find((c) => c.indice === i) ?? (estado.bauDaConta?.indice === i ? estado.bauDaConta : null);
    return (alvo ? (alvo.itens ??= []) : []);
  }
  return (estado.inventory ??= []);
};

/** Acha a pilha: a apontada, se ainda for do `id`; senão a primeira do `id`. */
function acharPilha(itens, id, pilha) {
  if (Number.isInteger(pilha) && itens[pilha]?.id === id) return pilha;
  return itens.findIndex((p) => p.id === id);
}

/** `send({t:'equip', id, pilha, slot?})` — o que estava no slot volta para a mochila. */
/** Devolve uma peça do corpo para a mochila SEM perder o que é dela (tier, imbuement, afixo). */
function devolverPeca(estado, peca) {
  if (peca.tier || peca.imbu?.length || peca.af?.length) (estado.inventory ??= []).push({ ...peca, count: peca.count ?? 1 });
  else darItem(estado, peca.id, peca.count ?? 1);
}

export function equipar(estado, { id, pilha, slot }) {
  id = Number(id);
  const meta = ITEM_CATALOG[id];
  const destino = slot ?? meta?.slot;
  if (!meta || !destino) return { ok: false, erro: 'Isso não se equipa.' };
  if (meta.vocations?.length && !meta.vocations.includes(estado.vocation)) return { ok: false, erro: 'Sua vocação não usa isso.' };
  if ((meta.minLevel ?? 0) > (estado.level ?? 0)) return { ok: false, erro: `Precisa do level ${meta.minLevel}.` };
  const itens = lista(estado, 'bag');
  const i = acharPilha(itens, id, Number(pilha));
  if (i < 0) return { ok: false, erro: 'Essa peça não está na mochila.' };
  const pilhaAtual = itens[i];
  // Munição equipa a pilha inteira; o resto, uma unidade.
  const leva = destino === 'ammo' ? pilhaAtual.count : 1;
  pilhaAtual.count -= leva;
  if (pilhaAtual.count <= 0) itens.splice(i, 1);
  const eq = (estado.equipment ??= {});
  const antes = eq[destino];
  eq[destino] = { ...pilhaAtual, id, count: leva };
  if (antes) devolverPeca(estado, antes);
  Afixos.sincronizarMaximos(estado);
  return { ok: true };
}

/** `send({t:'unequip', slot})`. */
export function desequipar(estado, { slot }) {
  const eq = estado.equipment ?? {};
  const peca = eq[slot];
  if (!peca) return { ok: false, erro: 'Não há nada aí.' };
  if (slot === 'backpack') return { ok: false, erro: 'A mochila não sai.' };
  eq[slot] = null;
  devolverPeca(estado, peca);
  Afixos.sincronizarMaximos(estado);
  return { ok: true };
}

/** `send({t:'usar', id, onde})` — por enquanto, poções (fora da barra de ações). */
export function usar(estado, { id, onde }) {
  id = Number(id);
  // Scroll Speed Exercise: treino em dobro por 3 horas de treino.
  if (id === Exercicio.SCROLL_SPEED) {
    const itens = lista(estado, onde);
    const i = acharPilha(itens, id, null);
    if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
    if (--itens[i].count <= 0) itens.splice(i, 1);
    return Exercicio.usarScroll(estado);
  }
  // Summon Upgrade (loja: 1 por nível até 100; dropado: 100 por nível até 20).
  if (id === Summon.ITEM_DA_LOJA || id === Summon.ITEM_DROPADO) {
    const tem = (estado.inventory ?? []).filter((p) => p.id === id).reduce((a, p) => a + (p.count ?? 1), 0);
    if (!tem) return { ok: false, erro: 'Você não tem isso.' };
    return Summon.usarUpgrade(estado, id, tem, (n) => removerItem(estado, id, n));
  }
  // Buff Power: cobra a hora e liga (+1h, até 10). O item NUNCA some.
  if (BuffPower.ehBuffPower(id)) {
    if (acharPilha(lista(estado, onde), id, null) < 0) return { ok: false, erro: 'Você não tem isso.' };
    return BuffPower.ligar(estado, id);
  }
  // Pergaminho de acesso (Instance / Divine Hunts): +24h, se tiver premium e level.
  if (Premium.ehItemDeAcesso(id)) {
    const itens = lista(estado, onde);
    const i = acharPilha(itens, id, null);
    if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
    const r = Premium.ligarAcesso(estado, id);
    if (!r.ok) return r;
    if (--itens[i].count <= 0) itens.splice(i, 1);
    return r;
  }
  // Stamina Extension: +20h de stamina, até o teto de 42h.
  if (id === Stamina.STAMINA_EXTENSION) {
    const itens = lista(estado, onde);
    const i = acharPilha(itens, id, null);
    if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
    const r = Stamina.usarExtension(estado);
    if (!r.ok) return r;
    if (--itens[i].count <= 0) itens.splice(i, 1);
    return r;
  }
  // Exp Potion: liga (ou estende) o boost dela por 1 hora de caçada.
  const boost = Boosts.POCOES_DE_EXP[id];
  if (boost) {
    const itens = lista(estado, onde);
    const i = acharPilha(itens, id, null);
    if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
    if (--itens[i].count <= 0) itens.splice(i, 1);
    Boosts.adicionar(estado, boost.fonte, boost.percent);
    return { ok: true, notice: `+${boost.percent}% de experiência por 1 hora de caçada.` };
  }
  const pocao = ACTION_CATALOG.items.find((e) => e.itemId === id);
  if (!pocao) return { ok: false, erro: 'Não dá para usar isso.' };
  if (pocao.vocations?.length && !pocao.vocations.includes(estado.vocation)) return { ok: false, erro: 'Sua vocação não usa isso.' };
  const itens = lista(estado, onde);
  const i = acharPilha(itens, id, null);
  if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
  if (--itens[i].count <= 0) itens.splice(i, 1);
  const sorteio = (faixa) => faixa[0] + Math.floor(Math.random() * (faixa[1] - faixa[0] + 1));
  if (pocao.heal) estado.hp = Math.min(estado.maxHp, (estado.hp ?? 0) + sorteio(pocao.heal));
  if (pocao.mana) estado.mana = Math.min(estado.maxMana, (estado.mana ?? 0) + sorteio(pocao.mana));
  return { ok: true };
}

/** `send({t:'split', id, count, from})` — tira `count` de uma pilha para um quadradinho novo. */
export function dividir(estado, { id, count, from, pilha }) {
  id = Number(id);
  const itens = lista(estado, from);
  const i = acharPilha(itens, id, Number(pilha));
  const n = Math.floor(Number(count));
  if (i < 0 || !(n > 0) || n >= itens[i].count) return { ok: false, erro: 'Não dá para dividir assim.' };
  itens[i].count -= n;
  itens.splice(i + 1, 0, { id, count: n });
  return { ok: true };
}

/** `send({t:'juntar', de, para, from})` — junta a pilha `de` na `para` (mesmo item, até 100). */
export function juntar(estado, { de, para, from }) {
  const itens = lista(estado, from);
  const a = itens[de];
  const b = itens[para];
  if (!a || !b || a === b || a.id !== b.id) return { ok: false, erro: 'Só junta pilhas do mesmo item.' };
  const passa = Math.min(a.count, 100 - b.count);
  b.count += passa;
  a.count -= passa;
  if (a.count <= 0) itens.splice(de, 1);
  return { ok: true };
}

/** `send({t:'trocar', de, para, from})` — troca dois quadradinhos de lugar. */
export function trocar(estado, { de, para, from }) {
  const itens = lista(estado, from);
  if (!itens[de] || para < 0 || para >= Math.max(itens.length, 1)) return { ok: false, erro: 'Lugar inválido.' };
  if (!itens[para]) itens[para] = itens[de], itens.splice(de, 1);
  else [itens[de], itens[para]] = [itens[para], itens[de]];
  return { ok: true };
}

/** `send({t:'organizar', from})` — junta as pilhas iguais e ordena por tipo e nome. */
export function organizar(estado, { from }) {
  const itens = lista(estado, from);
  const soltos = [];
  const pilhas = new Map();
  for (const p of itens) {
    const valioso = p.af?.length || p.tier || p.imbu?.length;
    if (!ITEM_CATALOG[p.id]?.stackable || valioso) soltos.push(p);
    else pilhas.set(p.id, (pilhas.get(p.id) ?? 0) + p.count);
  }
  const novos = [...soltos];
  for (const [id, total] of pilhas) for (let resto = total; resto > 0; resto -= 100) novos.push({ id, count: Math.min(100, resto) });
  const chave = (p) => `${ITEM_CATALOG[p.id]?.type ?? 'z'}|${ITEM_CATALOG[p.id]?.name ?? ''}`;
  novos.sort((a, b) => chave(a).localeCompare(chave(b)));
  itens.splice(0, itens.length, ...novos);
  return { ok: true };
}
