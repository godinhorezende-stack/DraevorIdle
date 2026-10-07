// Depósito — as 8 caixas reais ("Caixa I".."VIII", até 100 tipos cada, o
// formato de `character-template.json`) — e a regra de que o peso NUNCA passa
// da capacidade: o que não cabe vai para o depósito, como o original faz com a
// recompensa que não coube ("O que não coube foi para o DEPÓSITO... Nada se
// perdeu", `marcoNoDeposito` no client).
import * as Afixos from './afixos.mjs';
import { converterTudo, pecaEspecial } from './itens/item.mjs';
import * as R from './regras.mjs';
import { ITEM_CATALOG, CHARACTER_TEMPLATE } from './dados.mjs';
import { pesoDoInventario, cabeNoPeso, guardarMoeda, erroDeEspaco, pecasNaMochila, vagasDaMochila } from './inventario.mjs';
import * as ItensPoeCatalogo from './itens-poe/catalogo.mjs';

/*
 * As caixas, como o client as separa (`openLocker`, panels.mjs):
 * - as NUMERADAS (Caixa I..VIII) — o depósito do personagem;
 * - a de CHEGADAS (`chegadas: true`), aba própria;
 * - o BAÚ DA CONTA (`compartilhada: true`), a mesma caixa para todos os
 *   personagens da conta — guardada no banco por conta (`bau_da_conta`).
 * `tipos`/`teto` são o "1/100" de cada uma.
 */
// Os índices REAIS do molde: 16 numeradas (0..15), Chegadas 16, Compartilhada 17.
export const INDICE_DAS_CHEGADAS = 16;
export const INDICE_DA_CONTA = 17;
const TETO = 100;
const MOLDE_DA_CONTA = (CHARACTER_TEMPLATE.deposito ?? []).find((c) => c.compartilhada) ?? {
  indice: INDICE_DA_CONTA, nome: 'Compartilhada', teto: 20, podeComprarVagas: true, vagasPorCompra: 20, vagasNoMaximo: 100, coinsPorCompra: 25,
};

export function garantir(estado) {
  estado.deposito ??= structuredClone(CHARACTER_TEMPLATE.deposito ?? []);
  // A Compartilhada é da CONTA (tabela própria), não fica no personagem.
  estado.deposito = estado.deposito.filter((c) => !c.compartilhada);
  for (const c of estado.deposito) {
    c.itens ??= [];
    c.teto ??= TETO;
    // Correção: `chegadas` marca a caixa de Chegadas, não "chegou item aqui".
    if (c.indice !== INDICE_DAS_CHEGADAS) c.chegadas = false;
    c.tipos = c.itens.length;
  }
  if (!estado.deposito.some((c) => c.indice === INDICE_DAS_CHEGADAS)) {
    estado.deposito.push({ indice: INDICE_DAS_CHEGADAS, nome: 'Chegadas', tipos: 0, teto: TETO, itens: [], chegadas: true });
  }
  // As Chegadas NÃO TÊM TETO (dono, 06/10): recebem tudo o que chega (a Store, o Mercado) e só se tira de lá — nada se põe à mão.
  const chegadas = estado.deposito.find((c) => c.indice === INDICE_DAS_CHEGADAS);
  chegadas.semTeto = true;
  chegadas.teto = Math.max(TETO, chegadas.itens.length);
  /*
   * ---- A Store Inbox e a Boss Pouch saíram (dono, 06/10: "tire boss pouch e store inbox, tudo comprado pela store vai para
   * chegadas") ----
   * O que ainda estiver guardado nelas vai, uma vez, para as Chegadas — inteiro (com a carga, o tier, os afixos), nada se perde.
   */
  for (const lista of ['storeInbox', 'bossPouch']) {
    if (!estado[lista]?.length) continue;
    for (const p of estado[lista]) porNasChegadas(estado, p);
    estado[lista] = [];
  }
  chegadas.tipos = chegadas.itens.length;
  chegadas.teto = Math.max(TETO, chegadas.itens.length);
  return estado.deposito;
}

/** Põe a peça (inteira, com `count`) nas Chegadas: empilha o que empilha (sem carga nem nada especial); sem teto. */
export function porNasChegadas(estado, peca) {
  const chegadas = (estado.deposito ?? []).find((c) => c.indice === INDICE_DAS_CHEGADAS) ?? garantir(estado).find((c) => c.indice === INDICE_DAS_CHEGADAS);
  const empilha = ITEM_CATALOG[peca.id]?.stackable && !pecaEspecial(peca) && !peca.carga;
  const igual = empilha ? chegadas.itens.find((p) => p.id === peca.id && !pecaEspecial(p) && !p.carga) : null;
  if (igual) igual.count = (igual.count ?? 1) + (peca.count ?? 1);
  else chegadas.itens.push({ ...peca, count: peca.count ?? 1 });
  chegadas.tipos = chegadas.itens.length;
  chegadas.teto = Math.max(TETO, chegadas.itens.length);
  return chegadas;
}

/** A caixa do Baú da Conta, a partir do que o banco guardou (ou vazia). */
export function caixaDaConta(guardada) {
  const caixa = guardada ?? structuredClone(MOLDE_DA_CONTA);
  caixa.indice = INDICE_DA_CONTA;
  caixa.compartilhada = true;
  caixa.semConta = false;
  caixa.teto ??= MOLDE_DA_CONTA.teto;
  caixa.podeComprarVagas = caixa.teto < (MOLDE_DA_CONTA.vagasNoMaximo ?? 100);
  caixa.itens ??= [];
  // As peças de antes do sistema de itens, convertidas ao ler (ver `systems/itens/item.mjs`).
  converterTudo(caixa.itens);
  caixa.tipos = caixa.itens.length;
  return caixa;
}

/** O nome de fábrica da caixa (o do molde real: "Caixa I".."XVI", "Chegadas", "Compartilhada"). */
function nomeDeFabrica(caixa) {
  return (CHARACTER_TEMPLATE.deposito ?? []).find((c) => c.indice === caixa.indice)?.nome ?? `Caixa ${caixa.indice + 1}`;
}

const capacidade = (estado) => Afixos.capacidade(estado);

/** Põe `count` de `id` numa caixa (a pedida, ou a primeira com lugar). Devolve a caixa ou null. */
function porNaCaixa(estado, id, count, peca = {}, indice = null, caixas = garantir(estado)) {
  if (guardarMoeda(estado, id, count)) return true;
  // Com caixa pedida: só ela. Sem (o excesso de peso): a primeira NUMERADA com lugar.
  const ordem = indice != null ? caixas.filter((c) => c.indice === indice) : caixas.filter((c) => !c.chegadas && !c.compartilhada);
  const empilha = ITEM_CATALOG[id]?.stackable && !pecaEspecial(peca);
  for (const caixa of ordem) {
    const igual = empilha ? caixa.itens.find((p) => p.id === id) : null;
    if (igual) {
      igual.count += count;
      return caixa;
    }
    if (caixa.itens.length < (caixa.teto ?? 100)) {
      caixa.itens.push({ ...peca, id, count });
      caixa.tipos = caixa.itens.length;
      return caixa;
    }
  }
  return null;
}

/**
 * Tira o excesso de peso para o depósito, do item mais pesado da mochila para
 * o mais leve (depois a bolsa). Devolve o que foi, para o aviso.
 */
export function excessoParaODeposito(estado) {
  const foi = [];
  // Modo PoE (dono, 07/10: "ainda está acontecendo quando adiciono mais de 20 itens na mochila"): a mochila tem VAGAS — além das 20
  // peças não empilháveis, as mais RECENTES vão para o Depósito (compra, recompensa, forja, engine… todo caminho passa por `aplicar`).
  if (ItensPoeCatalogo.ligado()) {
    const inv = estado.inventory ?? [];
    for (let i = inv.length - 1; i >= 0 && pecasNaMochila(estado) > vagasDaMochila(estado); i--) {
      if (ITEM_CATALOG[inv[i].id]?.stackable) continue;
      const [peca] = inv.splice(i, 1);
      if (!porNaCaixa(estado, peca.id, peca.count ?? 1, peca)) {
        inv.splice(i, 0, peca); // depósito cheio: fica na mochila (nada se perde)
        break;
      }
      foi.push({ id: peca.id, count: peca.count ?? 1, name: peca.poe?.nome ?? ITEM_CATALOG[peca.id]?.name });
    }
  }
  for (const onde of ['inventory', 'pouch']) {
    const lista = estado[onde] ?? [];
    while (pesoDoInventario(estado) > capacidade(estado) && lista.length) {
      let i = 0;
      for (let k = 1; k < lista.length; k++) {
        const peso = (p) => (ITEM_CATALOG[p.id]?.weight ?? 0) * (p.count ?? 1);
        if (peso(lista[k]) > peso(lista[i])) i = k;
      }
      const [peca] = lista.splice(i, 1);
      if (!porNaCaixa(estado, peca.id, peca.count ?? 1, peca)) {
        lista.splice(i, 0, peca); // depósito cheio: não há para onde ir
        return foi;
      }
      foi.push({ id: peca.id, count: peca.count ?? 1, name: ITEM_CATALOG[peca.id]?.name });
    }
  }
  return foi;
}

/** O aviso de quando o excesso foi para o depósito. */
export function avisoDoExcesso(foi) {
  if (!foi.length) return null;
  const n = foi.reduce((a, p) => a + p.count, 0);
  if (ItensPoeCatalogo.ligado()) return `Mochila cheia: ${n} item(ns) foram para o Depósito. Nada se perdeu.`;
  return `Sem capacidade: ${n} item(ns) foram para o Depósito. Nada se perdeu.`;
}

/**
 * `send({t:'depot', action, ...})`:
 * - `store {id, count, caixa, alvo:{indice, onde}}` guarda da mochila/bolsa;
 * - `storeAll {caixa}` guarda a mochila inteira;
 * - `take {id, count, caixa, pos}` tira para a mochila (se couber no peso);
 * - `rename {caixa, nome}`.
 */
export function comando(estado, m, contaCaixa = null) {
  const caixas = [...garantir(estado), ...(contaCaixa ? [contaCaixa] : [])];
  const caixa = caixas.find((c) => c.indice === m.caixa);
  if (!caixa) return { ok: false, erro: 'Caixa inválida.' };
  if (m.action === 'rename') {
    // "Deixe em branco para voltar ao nome de fábrica" (a caixinha do client).
    const nome = String(m.nome ?? '').trim().slice(0, 24);
    caixa.nome = nome || nomeDeFabrica(caixa);
    return { ok: true, renomeou: true };
  }
  // As Chegadas só recebem o que chega (Store, Mercado): nada se guarda nelas à mão.
  if ((m.action === 'storeAll' || m.action === 'store') && caixa.chegadas) return { ok: false, erro: 'As Chegadas só recebem o que chega (compras da Store e do Mercado). Guarde numa caixa numerada.' };
  if (m.action === 'storeAll') {
    const mochila = estado.inventory ?? [];
    const ficam = [];
    for (const p of mochila) if (!porNaCaixa(estado, p.id, p.count ?? 1, p, caixa.indice, caixas)) ficam.push(p);
    estado.inventory = ficam;
    return { ok: true };
  }
  if (m.action === 'store') {
    const onde = m.alvo?.onde === 'pouch' ? 'pouch' : 'inventory';
    const lista = estado[onde] ?? [];
    const id = Number(m.id);
    let i = Number.isInteger(m.alvo?.indice) && lista[m.alvo.indice]?.id === id ? m.alvo.indice : lista.findIndex((p) => p.id === id);
    if (i < 0) return { ok: false, erro: 'Essa peça não está aí.' };
    const peca = lista[i];
    const n = Math.min(peca.count ?? 1, Math.max(1, Number(m.count) || 1));
    if (!porNaCaixa(estado, id, n, peca, caixa.indice, caixas)) return { ok: false, erro: `A ${caixa.nome} está cheia (${caixa.tipos}/${caixa.teto}).` };
    peca.count = (peca.count ?? 1) - n;
    if (peca.count <= 0) lista.splice(i, 1);
    return { ok: true };
  }
  if (m.action === 'take') {
    const id = Number(m.id);
    const i = Number.isInteger(m.pos) && caixa.itens[m.pos]?.id === id ? m.pos : caixa.itens.findIndex((p) => p.id === id);
    if (i < 0) return { ok: false, erro: 'Essa peça não está na caixa.' };
    const peca = caixa.itens[i];
    const n = Math.min(peca.count ?? 1, Math.max(1, Number(m.count) || 1));
    if (!cabeNoPeso(estado, id, n)) return { ok: false, erro: erroDeEspaco(estado, id, n) };
    peca.count -= n;
    if (peca.count <= 0) caixa.itens.splice(i, 1);
    caixa.tipos = caixa.itens.length;
    const { count, ...extras } = peca;
    (estado.inventory ??= []).push({ ...extras, id, count: n });
    return { ok: true };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

/**
 * `store buy 'cofre-vagas'` — mais vagas na Compartilhada: +`vagasPorCompra`
 * por `coinsPorCompra` Draevor Coins, até `vagasNoMaximo` (os números do molde real).
 */
export function comprarVagas(estado, caixaConta) {
  const max = MOLDE_DA_CONTA.vagasNoMaximo ?? 100;
  const preco = MOLDE_DA_CONTA.coinsPorCompra ?? 25;
  if (caixaConta.teto >= max) return { ok: false, erro: 'O baú da conta já está no máximo de vagas.' };
  if ((estado.coins ?? 0) < preco) return { ok: false, erro: 'Você não tem Draevor Coins suficientes.' };
  estado.coins -= preco;
  caixaConta.teto = Math.min(max, caixaConta.teto + (MOLDE_DA_CONTA.vagasPorCompra ?? 20));
  caixaConta.podeComprarVagas = caixaConta.teto < max;
  return { ok: true };
}
