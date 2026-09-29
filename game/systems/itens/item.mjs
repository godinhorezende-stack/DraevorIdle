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
import { ITEM_CATALOG } from '../dados.mjs';
import { valorNaFaixa, arredondar, CAMPOS_DA_BASE } from './gerar.mjs';

const ID_DA_ESSENCIA = 900001;
const FAIXAS_ANTIGAS = [[0, 20], [20, 40], [40, 60], [60, 85], [85, 100]];
const RARIDADE_PELA_QUANTIDADE = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico', 'mítico'];

/** Os campos de instância de uma peça, para copiar (sem `id`/`count`). */
export function camposDaPeca(p) {
  if (!p) return {};
  return {
    ...(p.base ? { base: p.base } : {}),
    ...(p.tier ? { tier: p.tier } : {}),
    ...(p.imbu?.length ? { imbu: p.imbu } : {}),
    ...(p.af?.length ? { af: p.af } : {}),
    ...(p.raridade ? { raridade: p.raridade } : {}),
    ...(p.efeito ? { efeito: p.efeito } : {}),
  };
}

/** Um campo do `base` como `[piso, teto]` (aceita o número solto das peças de antes da faixa); `null` se inválido. */
function faixaValida(v) {
  const [a, b] = Array.isArray(v) ? v : [v, v];
  const piso = Math.floor(Number(a));
  const teto = Math.floor(Number(b));
  return piso > 0 && teto > 0 ? [piso, Math.max(piso, teto)] : null;
}

/** O `base` de uma peça só com os campos e faixas válidos (vem do cliente em `comparar`, e do save). */
export function baseValida(base) {
  const saida = {};
  for (const campo of CAMPOS_DA_BASE) {
    const faixa = faixaValida(base?.[campo]);
    if (faixa) saida[campo] = faixa;
  }
  return saida;
}

/** `[piso, teto]` de um campo da peça: o sorteado no drop, ou o valor cheio do catálogo (faixa de largura zero). */
export function faixaDoCampo(p, campo) {
  const sorteada = faixaValida(p?.base?.[campo]);
  if (sorteada) return sorteada;
  const v = Math.floor(Number(ITEM_CATALOG[p?.id]?.[campo]));
  return v > 0 ? [v, v] : [0, 0];
}

/**
 * O item do catálogo COM os números desta peça: em cada campo sorteado no drop,
 * a MÉDIA da faixa (é o que a ficha mostra e o que defesa e armadura usam; o
 * ataque de cada golpe sorteia a faixa inteira). Peça sem `base` (kit inicial,
 * loja, drop de antes) segue com o valor cheio do catálogo.
 */
export function metaDaPeca(p) {
  const meta = ITEM_CATALOG[p?.id];
  if (!meta || !p?.base) return meta;
  const medias = {};
  for (const campo of Object.keys(baseValida(p.base))) {
    const [piso, teto] = faixaDoCampo(p, campo);
    medias[campo] = Math.round((piso + teto) / 2);
  }
  return { ...meta, ...medias };
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

/** Equipável que não empilha: é a peça que ganha raridade (e atributos) no drop. */
export const ehEquipavel = (meta) => !!meta?.slot && !meta.stackable;

/**
 * A raridade de uma peça. Equipável: SÓ a do drop (`p.raridade`); sem ela
 * (kit inicial, loja, peça antiga) é comum — o dono: "dos itens equipáveis
 * tire a raridade dos itens, o que define é o drop". O resto (comida,
 * material) segue a do catálogo.
 */
export function raridadeDaPeca(p) {
  if (p?.raridade) return p.raridade;
  const meta = ITEM_CATALOG[p?.id];
  return ehEquipavel(meta) ? 'comum' : meta?.rarity ?? 'comum';
}
