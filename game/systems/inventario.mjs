import * as Boosts from './boosts.mjs';
import * as Stamina from './stamina.mjs';
import * as Premium from './premium.mjs';
import * as BuffPower from './buffpower.mjs';
import * as Summon from './summon.mjs';
import * as Afixos from './afixos.mjs';
import { camposDaPeca, pecaEspecial } from './itens/item.mjs';
import * as Atributos from './personagem/atributos.mjs';
import * as Requisitos from './personagem/requisitos.mjs';
import * as Equipamento from './itens/equipamento.mjs';
import * as ItensPoeCatalogo from './itens-poe/catalogo.mjs';
import * as R from './regras.mjs';
import * as Acoes from './acoes.mjs';
// Inventário e o chão da praça: equipar de início, peso carregado, destruir,
// largar e pegar item do chão. Funções puras sobre `estado` — quem manda a
// resposta pro cliente é `sessao.mjs`; este arquivo não conhece WebSocket.
import { ITEM_CATALOG, EQUIPAMENTO_POR_VOCACAO, ACTION_CATALOG } from './dados.mjs';
import { podeEntrar, MENSAGEM as SO_ITENS_DO_POE } from './itens-poe/so-itens-do-poe.mjs';

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

/**
 * As VAGAS da mochila no modo PoE (dono, 07/10: "no inventário o máximo de itens não empilháveis são 20 e está podendo colocar mais"): o
 * PoE não tem peso, então o limite é de vagas — o `container` da mochila (20). Só as peças NÃO empilháveis ocupam vaga; as pilhas (moedas,
 * orbes) não contam. Fora do modo PoE vale o peso, como antes.
 */
export const vagasDaMochila = (estado) => ITEM_CATALOG[estado?.equipment?.backpack?.id]?.container ?? 20;
export const pecasNaMochila = (estado) => (estado?.inventory ?? []).filter((p) => !ITEM_CATALOG[p.id]?.stackable).length;
export function cabeNaMochila(estado, id, count = 1) {
  if (!ItensPoeCatalogo.ligado() || ITEM_CATALOG[id]?.stackable) return true;
  return pecasNaMochila(estado) + Math.max(1, count) <= vagasDaMochila(estado);
}

/** Cabe `count` de `id` na capacidade do level (equipamento + mochila + bolsa)? (No modo PoE, nas vagas da mochila.) */
export function cabeNoPeso(estado, id, count = 1) {
  if (!cabeNaMochila(estado, id, count)) return false;
  const peso = (ITEM_CATALOG[id]?.weight ?? 0) * count;
  return pesoDoInventario(estado) + peso <= Afixos.capacidade(estado);
}
/** O erro de quando não cabe: no modo PoE é a mochila cheia (vagas); fora dele, o peso. */
export const erroDeEspaco = (estado, id, count = 1) => (cabeNaMochila(estado, id, count) ? 'Você não tem capacidade para carregar isso.' : `A mochila está cheia (${vagasDaMochila(estado)} vagas para peças não empilháveis).`);

/** A peça tem dados de INSTÂNCIA (raridade, afixos, tier, imbuements, sockets, gema...)? — `camposDaPeca`. */
export const temInstancia = (p) => Object.keys(camposDaPeca(p)).length > 0;

/**
 * Dá a PEÇA inteira (com raridade, afixos, tier... — `camposDaPeca`) e não só o
 * id do item-base. Peça limpa vai pelo `darItem` de sempre (empilha); peça com
 * instância entra como está, numa pilha só dela.
 */
export function darPeca(estado, peca) {
  if (!peca) return;
  if (!temInstancia(peca)) return darItem(estado, peca.id, peca.count ?? 1);
  if (guardarMoeda(estado, peca.id, peca.count ?? 1)) return;
  (estado.inventory ??= []).push({ id: peca.id, count: peca.count ?? 1, ...structuredClone(camposDaPeca(peca)) });
}

/**
 * A pilha da mochila que o cliente apontou (`alvo`: índice, tier e afixos — o
 * `alvoDaPeca` da tela). Se o índice já não bate (a mochila mudou no caminho), a
 * primeira com o mesmo id, tier e afixos; sem alvo, a primeira LIMPA do id, e só
 * então qualquer uma — nunca pega a mítica no lugar da comum sem que peçam.
 */
export function pilhaDoAlvo(mochila, id, alvo) {
  const confere = (p) =>
    p?.id === id &&
    Math.floor(Number(p.tier) || 0) === Math.floor(Number(alvo?.tier) || 0) &&
    JSON.stringify(p.af?.length ? p.af : null) === JSON.stringify(alvo?.af?.length ? alvo.af : null);
  if (alvo && typeof alvo === 'object') {
    if (Number.isInteger(alvo.indice) && confere(mochila[alvo.indice])) return alvo.indice;
    const i = mochila.findIndex(confere);
    if (i >= 0) return i;
  }
  const limpa = mochila.findIndex((p) => p?.id === id && !temInstancia(p));
  return limpa >= 0 ? limpa : mochila.findIndex((p) => p?.id === id);
}

export function darItem(estado, id, count = 1) {
  if (guardarMoeda(estado, id, count)) return;
  const inventory = (estado.inventory ??= []);
  let falta = count;
  if (ITEM_CATALOG[id]?.stackable) {
    for (const pilha of inventory) {
      if (falta <= 0) break;
      if (pilha.id !== id || pecaEspecial(pilha)) continue;
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
// A peça é ÚNICA (não vira item comum empilhado): tier, adds, imbuements, poder, a base sorteada no drop,
// os sockets (com gemas) e a instância de uma gema. Sem a base/sockets aqui, tirar a peça do corpo a
// devolvia como item de catálogo e perdia o sorteio (e as gemas encaixadas).
export const temExtras = (p) => pecaEspecial(p);

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

/*
 * ---- A limpeza do chão (`limpeza-do-chao.mjs`) ----
 * O chão é só este Map (memória do processo, não vai para o banco): inventário,
 * equipamento, bolsa, depósito e banco são outras listas e nunca passam por aqui.
 * A limpeza tira uma FOTO das pilhas e apaga em lotes; antes de apagar cada uma,
 * confere que ela ainda é a mesma (se alguém pegou tudo, ou mexeu, o que sobrou
 * é contado pelo tamanho de AGORA — nada é apagado duas vezes nem fora do chão).
 */
export const contarPecasNoChao = () => {
  let n = 0;
  for (const pilha of CHAO.values()) n += pilha.length;
  return n;
};

/** A foto das pilhas do chão agora: `[chave, pilha][]`. */
export const fotoDoChao = () => [...CHAO.entries()].filter(([, pilha]) => pilha.length);

/** Apaga as pilhas da foto (um lote). Devolve `{ pilhas, pecas }` realmente removidas. */
export function limparPilhasDoChao(lote) {
  let pilhas = 0;
  let pecas = 0;
  for (const [chave, pilha] of lote) {
    if (CHAO.get(chave) !== pilha) continue; // a casa mudou (pegaram tudo / outra pilha): não é mais a da foto
    pecas += pilha.length;
    pilhas++;
    CHAO.delete(chave);
  }
  return { pilhas, pecas };
}

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
      // A peça como ela é no chão (raridade, afixos...): a tela mostra a mítica como mítica.
      pilha: pilha.map((p) => ({ item: p.id, count: p.count, nome: ITEM_CATALOG[p.id]?.name ?? '', ...camposDaPeca(p) })),
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
export function largar(estado, { id, count = 1, x, y, de, deIndice, alvo }) {
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
  /*
   * ---- A PEÇA vai para o chão inteira ----
   *
   * Antes: `removerItem(id)` (a última pilha do id, qualquer uma) e no chão só
   * `{ id, count }` — a raridade, os afixos, o tier e os imbuements ficavam para
   * trás, e quem pegava ganhava o item-base: a Assassin Star Mítica virava comum.
   * Agora sai a cópia que o jogador apontou (`alvo`), e o chão guarda ela inteira.
   */
  const mochila = estado.inventory ?? [];
  count = Math.max(1, Math.floor(Number(count) || 1));
  const i = pilhaDoAlvo(mochila, id, alvo);
  if (i < 0) return { ok: false, erro: 'Você não tem essa peça.' };
  const origem = mochila[i];
  let peca;
  if (temInstancia(origem)) {
    // Com instância: só desta pilha (nunca mistura com outra cópia).
    if ((origem.count ?? 1) < count) return { ok: false, erro: 'Você não tem tudo isso.' };
    peca = { id, count, ...structuredClone(camposDaPeca(origem)) };
    origem.count = (origem.count ?? 1) - count;
    if (origem.count <= 0) mochila.splice(i, 1);
  } else {
    // Limpa: das pilhas LIMPAS do id (nunca come uma pilha com raridade/afixos no meio).
    const limpas = mochila.filter((p) => p.id === id && !temInstancia(p)).reduce((s, p) => s + (p.count ?? 1), 0);
    if (limpas < count) return { ok: false, erro: 'Você não tem essa peça.' };
    let falta = count;
    for (let k = mochila.length - 1; k >= 0 && falta > 0; k--) {
      if (mochila[k].id !== id || temInstancia(mochila[k])) continue;
      const tira = Math.min(mochila[k].count ?? 1, falta);
      mochila[k].count = (mochila[k].count ?? 1) - tira;
      falta -= tira;
      if (mochila[k].count <= 0) mochila.splice(k, 1);
    }
    peca = { id, count };
  }
  const chave = chaveDoTile(x, y);
  const pilha = CHAO.get(chave) ?? [];
  pilha.push(peca);
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
  // No jogo oficial só se pega do chão o item do PoE (o do Draevor fica no chão até a limpeza).
  if (!podeEntrar(peca.id, peca)) return { ok: false, erro: SO_ITENS_DO_POE };
  if (!VALOR_DA_MOEDA[peca.id] && !cabeNoPeso(estado, peca.id, peca.count)) return { ok: false, erro: erroDeEspaco(estado, peca.id, peca.count) };

  pilha.splice(i, 1);
  if (!pilha.length) CHAO.delete(chave);
  // A peça INTEIRA (raridade, afixos...), e não um item-base novo pelo id.
  darPeca(estado, peca);
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
  if (temExtras(peca)) (estado.inventory ??= []).push({ ...peca, count: peca.count ?? 1 });
  else darItem(estado, peca.id, peca.count ?? 1);
}

/*
 * ---- Duas mãos ----
 * O dono: "armas de 2 mãos têm que tirar o shield". Arma de duas mãos não
 * divide o corpo com escudo (nem spellbook): vestir uma tira o outro, que
 * volta para a mochila — nos dois sentidos. A aljava fica: ela vai no slot do
 * escudo, mas é o que o arco/besta (de duas mãos) usa.
 */
export const ocupaAMaoDoEscudo = (meta) => !!meta && meta.slot === 'shield' && !meta.quiver;
export const deDuasMaos = (meta) => !!meta?.twoHanded;

/**
 * Personagem que ficou com arma de duas mãos E escudo (antes desta regra): o
 * escudo volta para a mochila. Roda na entrada. `true` se mexeu.
 */
export function corrigirDuasMaos(estado) {
  const eq = estado.equipment ?? {};
  if (!deDuasMaos(ITEM_CATALOG[eq.weapon?.id]) || !ocupaAMaoDoEscudo(ITEM_CATALOG[eq.shield?.id])) return false;
  devolverPeca(estado, eq.shield);
  eq.shield = null;
  Afixos.sincronizarMaximos(estado);
  return true;
}

/**
 * Peça vestida no slot ERRADO (de antes de o servidor validar o slot: ele aceitava o que o cliente mandava): volta para a mochila, sem perda. Roda na
 * entrada; devolve os nomes das peças que saíram. Ver `itens/equipamento.mjs`.
 */
export function recolherPecasNoSlotErrado(estado) {
  const saiu = Equipamento.recolherPecasNoSlotErrado(estado, devolverPeca);
  if (saiu.length) Afixos.sincronizarMaximos(estado);
  return saiu;
}

/**
 * Peça vestida com `minLevel` ACIMA do level do personagem (de antes de a arma virar a fonte do dano, ou de um requisito que subiu): volta
 * para a mochila, sem perda nenhuma. Roda na entrada; devolve os nomes das peças que saíram.
 */
/** O level que a peça pede: o da base, menos o "Requisito de Nível reduzido em X%" da própria peça (PoE). */
export function nivelExigido(meta, peca = null) {
  const base = meta?.minLevel ?? 0;
  const red = Number(peca?.poe?.af?.req_level_reduced) || 0;
  return red > 0 ? Math.floor(base * Math.max(0, 1 - red / 100)) : base;
}

export function devolverPecasAcimaDoLevel(estado) {
  const eq = estado.equipment ?? {};
  const saiu = [];
  for (const [slot, peca] of Object.entries(eq)) {
    if (!peca || slot === 'backpack') continue;
    const meta = ITEM_CATALOG[peca.id];
    if (!meta || nivelExigido(meta, peca) <= (estado.level ?? 0)) continue;
    eq[slot] = null;
    devolverPeca(estado, peca);
    saiu.push(meta.name);
  }
  if (saiu.length) Afixos.sincronizarMaximos(estado);
  return saiu;
}

export function equipar(estado, { id, pilha, slot }) {
  id = Number(id);
  const meta = ITEM_CATALOG[id];
  // O slot de destino: o que o cliente pediu (arrastar para um slot) ou o do próprio item (clique). A REGRA é do servidor e é uma só: o item só entra no
  // slot a que pertence (`itens/equipamento.mjs`) — antes `slot ?? meta.slot` aceitava qualquer slot que o cliente mandasse.
  const destino = slot ?? Equipamento.slotDaArmaNoClique(estado, meta) ?? Equipamento.slotDoClique(estado, meta) ?? meta?.slot;
  // Modelo Path of Exile (decisão do dono): nenhuma peça é "só de uma classe" — ela pede STR/DEX/INT
  // (ver `personagem/requisitos.mjs`); a vocação da peça é só a classe recomendada.
  // (A peça do PoE com "Requisito de Nível reduzido em X%" pede menos level — `nivelExigido`.)
  const naMochila = lista(estado, 'bag')[acharPilha(lista(estado, 'bag'), id, Number(pilha))] ?? null;
  const valida = Equipamento.validarEquipar(estado, meta, destino, (m) => {
    const somaAgora = Afixos.soma(estado);
    const faltaAtributo = Requisitos.falta(m, Atributos.principais(estado, somaAgora), naMochila, somaAgora);
    if (faltaAtributo) return faltaAtributo;
    const nivel = nivelExigido(m, naMochila);
    return nivel > (estado.level ?? 0) ? `Precisa do level ${nivel}.` : null;
  });
  if (!valida.ok) return valida;
  const itens = lista(estado, 'bag');
  const i = acharPilha(itens, id, Number(pilha));
  if (i < 0) return { ok: false, erro: 'Essa peça não está na mochila.' };
  const pilhaAtual = itens[i];
  // Pilha (item que empilha) equipa inteira; peça, uma unidade (munição não empilha mais).
  const leva = meta.stackable ? pilhaAtual.count : 1;
  pilhaAtual.count -= leva;
  if (pilhaAtual.count <= 0) itens.splice(i, 1);
  const eq = (estado.equipment ??= {});
  const antes = eq[destino];
  eq[destino] = { ...pilhaAtual, id, count: leva };
  if (antes) devolverPeca(estado, antes);
  // Duas mãos: a arma de duas mãos tira o escudo; o escudo tira a arma de duas mãos.
  let saiu = null;
  // PoE: a regra das duas mãos do PoE (arma de uma mão nas duas, arco só com aljava, aljava só com arco).
  if (ItensPoeCatalogo.ligado()) saiu = Equipamento.outraMaoQueSai(estado, meta, destino);
  else if (destino === 'weapon' && deDuasMaos(meta) && ocupaAMaoDoEscudo(ITEM_CATALOG[eq.shield?.id])) saiu = 'shield';
  else if (destino === 'shield' && ocupaAMaoDoEscudo(meta) && deDuasMaos(ITEM_CATALOG[eq.weapon?.id])) saiu = 'weapon';
  if (saiu) {
    const nome = ITEM_CATALOG[eq[saiu].id]?.name ?? 'a peça';
    devolverPeca(estado, eq[saiu]);
    eq[saiu] = null;
    Afixos.sincronizarMaximos(estado);
    return { ok: true, notice: `Duas mãos: ${nome} voltou para a mochila.` };
  }
  Afixos.sincronizarMaximos(estado);
  return { ok: true };
}

/** `send({t:'unequip', slot})`. */
export function desequipar(estado, { slot }) {
  const eq = estado.equipment ?? {};
  const peca = eq[slot];
  if (!peca) return { ok: false, erro: 'Não há nada aí.' };
  if (slot === 'backpack') return { ok: false, erro: 'A mochila não sai.' };
  if (!cabeNaMochila(estado, peca.id, 1)) return { ok: false, erro: erroDeEspaco(estado, peca.id, 1) };
  eq[slot] = null;
  devolverPeca(estado, peca);
  Afixos.sincronizarMaximos(estado);
  return { ok: true };
}

/** `send({t:'usar', id, onde})` — por enquanto, poções (fora da barra de ações). */
export function usar(estado, { id, onde }) {
  id = Number(id);
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
  const itens = lista(estado, onde);
  const i = acharPilha(itens, id, null);
  if (i < 0) return { ok: false, erro: 'Você não tem isso.' };
  // As mesmas regras da barra: level e vocação, recarga e "não jogar fora" (ver `Acoes.podeBeberPocao`).
  const pode = Acoes.podeBeberPocao(estado, pocao);
  if (!pode.ok) return pode;
  if (--itens[i].count <= 0) itens.splice(i, 1);
  const sorteio = (faixa) => faixa[0] + Math.floor(Math.random() * (faixa[1] - faixa[0] + 1));
  if (pocao.heal) estado.hp = Math.min(estado.maxHp, (estado.hp ?? 0) + sorteio(pocao.heal));
  if (pocao.mana) estado.mana = Math.min(estado.maxMana, (estado.mana ?? 0) + sorteio(pocao.mana));
  Acoes.marcarRecargaDaPocao(estado, pocao);
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
  // Peça com dados próprios (gema com nível/raridade, equipamento com atributos...) NUNCA se funde: a contagem somaria e a instância sumiria.
  if (!ITEM_CATALOG[a.id]?.stackable || pecaEspecial(a) || pecaEspecial(b)) return { ok: false, erro: 'Essa peça não empilha.' };
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
    if (!ITEM_CATALOG[p.id]?.stackable || pecaEspecial(p)) soltos.push(p);
    else pilhas.set(p.id, (pilhas.get(p.id) ?? 0) + p.count);
  }
  const novos = [...soltos];
  for (const [id, total] of pilhas) for (let resto = total; resto > 0; resto -= 100) novos.push({ id, count: Math.min(100, resto) });
  const chave = (p) => `${ITEM_CATALOG[p.id]?.type ?? 'z'}|${ITEM_CATALOG[p.id]?.name ?? ''}`;
  novos.sort((a, b) => chave(a).localeCompare(chave(b)));
  itens.splice(0, itens.length, ...novos);
  return { ok: true };
}
