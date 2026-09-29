// A PEÇA — o que é da instância (e não do item-base do catálogo): o tier da
// forja (o futuro refino), os imbuements, os atributos (`af`), a raridade do
// drop e o efeito especial. Quem copia uma peça campo a campo (craft, mercado,
// vista da guilda) usa `camposDaPeca`, para nenhum campo novo se perder no
// caminho.
//
// E a CONVERSÃO das peças de antes do sistema de itens (decisão do dono:
// "converter e reescalar"): cada atributo antigo (`tier` 1–3, valor na régua
// antiga) ganha o `nivel` pela posição do valor na régua antiga — 0–20% N1,
// 20–40% N2, 40–60% N3, 60–85% N4, 85–100% N5, acima do topo (a essência
// vermelha) N5 acima do teto — e o valor vai para a MESMA posição dentro da
// faixa nova do nível. A peça sem raridade ganha a da quantidade de atributos
// (0 Comum, 1 Incomum, 2 Raro, 3 Épico). Nada é apagado; é idempotente.
import { REGUA_ANTIGA, NIVEL_MAXIMO, ATRIBUTOS } from './config.mjs';
import { valorNaFaixa, arredondar } from './gerar.mjs';

const ID_DA_ESSENCIA = 900001;
const FAIXAS_ANTIGAS = [[0, 20], [20, 40], [40, 60], [60, 85], [85, 100]];
const RARIDADE_PELA_QUANTIDADE = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico', 'mítico'];

/** Os campos de instância de uma peça, para copiar (sem `id`/`count`). */
export function camposDaPeca(p) {
  if (!p) return {};
  return {
    ...(p.tier ? { tier: p.tier } : {}),
    ...(p.imbu?.length ? { imbu: p.imbu } : {}),
    ...(p.af?.length ? { af: p.af } : {}),
    ...(p.raridade ? { raridade: p.raridade } : {}),
    ...(p.efeito ? { efeito: p.efeito } : {}),
  };
}

/** Converte UM atributo antigo (sem `nivel`); devolve `true` se mudou. */
export function converterAtributo(a) {
  if (!a || a.nivel != null || !ATRIBUTOS[a.id]) return false;
  const r = REGUA_ANTIGA[a.id];
  const pct = r && r.max > r.min ? ((Number(a.value) - r.min) / (r.max - r.min)) * 100 : 0;
  if (pct > 100) {
    // A essência vermelha: acima do topo — segue acima do topo na régua nova.
    const [, hi] = ATRIBUTOS[a.id].niveis[String(NIVEL_MAXIMO)];
    const [n1] = ATRIBUTOS[a.id].niveis['1'];
    a.value = arredondar(a.id, n1 + (pct / 100) * (hi - n1));
    a.nivel = NIVEL_MAXIMO;
  } else {
    // A borda de cima é do nível de baixo: 0–20% N1, (20–40%] N2, ... (85–100%] N5.
    const nivel = FAIXAS_ANTIGAS.findIndex(([, hi]) => pct <= hi + 1e-9) + 1 || FAIXAS_ANTIGAS.length;
    const [lo, hi] = FAIXAS_ANTIGAS[nivel - 1];
    a.nivel = nivel;
    a.value = valorNaFaixa(a.id, nivel, (Math.max(0, pct) - lo) / (hi - lo));
  }
  delete a.tier;
  return true;
}

/** Converte UMA peça (atributos + raridade); devolve `true` se mudou. */
export function converterPeca(p) {
  if (!p?.af?.length) return false;
  let mudou = false;
  for (const a of p.af) mudou = converterAtributo(a) || mudou;
  if (!p.raridade && p.id !== ID_DA_ESSENCIA) {
    p.raridade = RARIDADE_PELA_QUANTIDADE[p.af.length] ?? 'mítico';
    mudou = true;
  }
  return mudou;
}

/**
 * Converte toda peça dentro de `raiz` (o estado do personagem, o baú da conta,
 * uma oferta do mercado...), onde quer que ela esteja: equipamento, mochila,
 * bolsa de loot, depósito, sacolas do boss. Anda pelo objeto procurando o
 * formato de peça (`id` numérico + `af` em lista). Devolve quantas mudaram.
 */
export function converterTudo(raiz) {
  let n = 0;
  const visitar = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (const x of o) visitar(x);
      return;
    }
    if (typeof o.id === 'number' && Array.isArray(o.af)) {
      if (converterPeca(o)) n++;
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      // Os bichos da caçada não carregam peça (e são a maior parte do estado).
      if (k === 'monstros' || k === 'outrosAndares') continue;
      visitar(v);
    }
  };
  visitar(raiz);
  return n;
}

/** A versão do formato de item do personagem: quem já está nela não precisa ser varrido de novo. */
export const VERSAO_DOS_ITENS = 1;

/** Converte o personagem (uma vez — marca `versaoDosItens`). Devolve quantas peças mudaram. */
export function converterPersonagem(estado) {
  if (!estado || estado.versaoDosItens === VERSAO_DOS_ITENS) return 0;
  const n = converterTudo(estado);
  estado.versaoDosItens = VERSAO_DOS_ITENS;
  return n;
}
