// A CAMADA DE OVERRIDES: o que o dono muda por cima do dado IMPORTADO (o bestiário vem do Canary, em `catalog-real.json`) SEM editar o arquivo
// original — os geradores o sobrescreveriam e se perderia o que veio do jogo de origem. `gamedata/overrides/monstros.json` guarda só as DIFERENÇAS;
// no boot elas são aplicadas por cima do bestiário (e dos poderes, `monstro-poderes.json`), depois de validadas. O original fica intacto e sempre
// recuperável: apagar a entrada (ou pôr `ativo: false`, no arquivo inteiro ou numa entrada) devolve o dado original no próximo boot.
//
//   { "ativo": true,
//     "monstros": {
//       "troll": { "ativo": true, "name": "...", "hp": 80, "exp": 25, "armor": 8, "speed": 70, "class": "...", "stars": 1,
//                  "look": 15, "colors": {…}, "elements": { "fire": 50 },       // elements: junta com os do original (uma chave por elemento)
//                  "loot": [{ "id": 3031, "chance": 1 }],                        // loot: SUBSTITUI a lista inteira
//                  "ataques": [{ "tipo": "melee", "min": 0, "max": 20, "intervalo": 2000, "chance": 100 }] },   // ataques: SUBSTITUI os ataques
//       "troll-guerreiro": { "base": "troll", "name": "Troll Guerreiro", "hp": 120 }   // variação: nasce de um monstro existente (duplicar)
//     } }
//
// Funções PURAS (testadas); o boot (`dados.mjs`, `poderes.mjs`) só chama `aplicarNoBestiario`/`aplicarNosPoderes`. Entrada inválida é IGNORADA com aviso
// no log — nunca derruba o servidor nem afeta os outros monstros.
import { requisitoDe } from './personagem/requisitos.mjs';
import { validarBaseDaArma } from '../engine/arma.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export const PASTA = process.env.DRAEVOR_OVERRIDES || join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'overrides');
export const ELEMENTOS = ['physical', 'energy', 'earth', 'fire', 'lifedrain', 'manadrain', 'drown', 'ice', 'holy', 'death', 'agony'];
export const ID_DE_MONSTRO = /^[a-z0-9][a-z0-9-]{1,59}$/;
/** O que um override de monstro pode ter (o resto é recusado: "só propriedades que têm suporte real no jogo"). */
export const CAMPOS_ESCALARES = ['name', 'hp', 'exp', 'armor', 'speed', 'class', 'stars'];
export const CAMPOS_PERMITIDOS = new Set([...CAMPOS_ESCALARES, 'look', 'colors', 'elements', 'loot', 'ataques', 'ativo', 'base']);
const CAMPOS_DO_ATAQUE = new Set(['tipo', 'min', 'max', 'intervalo', 'chance', 'elemento', 'forma', 'raio', 'comprimento', 'espalha', 'alcance', 'noAlvo', 'efeito', 'tiro', 'nome']);
const FORMAS = ['alvo', 'feixe', 'area'];

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/**
 * Valida UM override. `ctx`: `{ original: monstro do bestiário (ou null para variação nova), existeItem(id), existeOutfit(look), existeMonstro(key), nomesDeMonstro? }`.
 * Devolve `{ erros: [texto], avisos: [texto] }`.
 */
export function validarMonstro(key, ov, ctx) {
  const erros = [];
  const avisos = [];
  const onde = `monstro ${key}`;
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { erros: [`${onde}: o override precisa ser um objeto.`], avisos };
  if (!ID_DE_MONSTRO.test(key)) erros.push(`${onde}: a chave precisa ter 2 a 60 caracteres (minúsculas, números e hífen).`);
  for (const c of Object.keys(ov)) if (!CAMPOS_PERMITIDOS.has(c)) erros.push(`${onde}: o campo "${c}" não tem suporte (permitidos: ${[...CAMPOS_PERMITIDOS].join(', ')}).`);
  if (ov.base != null) {
    if (!ctx.existeMonstro(ov.base)) erros.push(`${onde}: a base "${ov.base}" não existe no bestiário.`);
    if (ctx.existeMonstro(key)) erros.push(`${onde}: já existe um monstro com essa chave (uma variação precisa de chave nova).`);
  } else if (!ctx.original) erros.push(`${onde}: não existe no bestiário (para criar uma variação use "base").`);
  const nova = ov.base != null;
  if (nova && ov.name == null) avisos.push(`${onde}: a variação não tem nome próprio (vai usar o do original).`);
  if (ov.name !== undefined && !(typeof ov.name === 'string' && ov.name.trim().length >= 1 && ov.name.length <= 60)) erros.push(`${onde}: nome de 1 a 60 caracteres.`);
  if (ov.hp !== undefined && !inteiro(ov.hp, 1, 999_999_999)) erros.push(`${onde}: vida precisa ser um inteiro de 1 a 999.999.999.`);
  if (ov.exp !== undefined && !inteiro(ov.exp, 0, 999_999_999)) erros.push(`${onde}: experiência precisa ser um inteiro de 0 a 999.999.999.`);
  if (ov.armor !== undefined && !inteiro(ov.armor, 0, 100_000)) erros.push(`${onde}: armadura precisa ser um inteiro de 0 a 100.000.`);
  if (ov.speed !== undefined && !inteiro(ov.speed, 1, 5000)) erros.push(`${onde}: velocidade precisa ser um inteiro de 1 a 5000.`);
  if (ov.stars !== undefined && !inteiro(ov.stars, 0, 5)) erros.push(`${onde}: estrelas de 0 a 5.`);
  if (ov.class !== undefined && !(typeof ov.class === 'string' && ov.class.length >= 1 && ov.class.length <= 40)) erros.push(`${onde}: classe de 1 a 40 caracteres.`);
  if (ov.look !== undefined && !(inteiro(ov.look, 1, 100_000) && ctx.existeOutfit(ov.look))) erros.push(`${onde}: o sprite (look ${ov.look}) não existe nos desenhos do jogo.`);
  if (ov.colors !== undefined) {
    const c = ov.colors;
    if (!c || typeof c !== 'object') erros.push(`${onde}: cores inválidas.`);
    else for (const p of ['head', 'body', 'legs', 'feet']) if (c[p] !== undefined && !inteiro(c[p], 0, 132)) erros.push(`${onde}: cor "${p}" de 0 a 132.`);
  }
  if (ov.elements !== undefined) {
    if (!ov.elements || typeof ov.elements !== 'object' || Array.isArray(ov.elements)) erros.push(`${onde}: resistências precisam ser um objeto elemento → %.`);
    else for (const [e, v] of Object.entries(ov.elements)) {
      if (!ELEMENTOS.includes(e)) erros.push(`${onde}: elemento "${e}" desconhecido (${ELEMENTOS.join(', ')}).`);
      else if (!Number.isInteger(v) || v < -1000 || v > 1000) erros.push(`${onde}: resistência a ${e} precisa ser um inteiro entre -1000 e 1000 (%).`);
    }
  }
  if (ov.loot !== undefined) {
    if (!Array.isArray(ov.loot)) erros.push(`${onde}: o loot precisa ser uma lista.`);
    else {
      const vistos = new Set();
      ov.loot.forEach((l, i) => {
        if (!l || !ctx.existeItem(l.id)) erros.push(`${onde}: loot ${i + 1}: o item ${l?.id} não existe no catálogo.`);
        if (!(Number(l?.chance) > 0 && Number(l.chance) <= 1)) erros.push(`${onde}: loot ${i + 1}: a chance é uma fração entre 0 (exclusive) e 1 (0,01 = 1%).`);
        if (vistos.has(l?.id)) avisos.push(`${onde}: o item ${l.id} aparece mais de uma vez no loot (cada linha sorteia à parte).`);
        vistos.add(l?.id);
      });
    }
  }
  if (ov.ataques !== undefined) {
    if (!Array.isArray(ov.ataques)) erros.push(`${onde}: os ataques precisam ser uma lista.`);
    else ov.ataques.forEach((a, i) => {
      const n = `${onde}: ataque ${i + 1}`;
      for (const c of Object.keys(a ?? {})) if (!CAMPOS_DO_ATAQUE.has(c)) erros.push(`${n}: o campo "${c}" não tem suporte.`);
      if (!['melee', 'magia'].includes(a?.tipo)) erros.push(`${n}: tipo "melee" ou "magia".`);
      if (!inteiro(a?.min, 0, 99_999_999) || !inteiro(a?.max, 0, 99_999_999)) erros.push(`${n}: dano mínimo e máximo precisam ser inteiros ≥ 0.`);
      else if (a.min > a.max) erros.push(`${n}: o dano mínimo (${a.min}) é maior que o máximo (${a.max}).`);
      if (!inteiro(a?.intervalo, 200, 600_000)) erros.push(`${n}: intervalo de 200 a 600000 ms.`);
      if (!inteiro(a?.chance, 1, 100)) erros.push(`${n}: chance de 1 a 100 (%).`);
      if (a?.tipo === 'magia' && !ELEMENTOS.includes(a.elemento)) erros.push(`${n}: a magia precisa de um elemento (${ELEMENTOS.join(', ')}).`);
      if (a?.forma !== undefined && !FORMAS.includes(a.forma)) erros.push(`${n}: forma "alvo", "feixe" ou "area".`);
    });
  }
  return { erros, avisos };
}

/** O monstro EFETIVO: o original com o override por cima (cópia; o original não muda). Pura. */
export function aplicarNoMonstro(original, ov) {
  const m = structuredClone(original);
  for (const c of CAMPOS_ESCALARES) if (ov[c] !== undefined) m[c] = ov[c];
  if (ov.look !== undefined) { m.look = ov.look; m.lookItem = 0; m.colors = { ...(m.colors ?? {}), type: ov.look }; }
  if (ov.colors !== undefined) m.colors = { ...(m.colors ?? {}), ...ov.colors };
  if (ov.elements !== undefined) m.elements = { ...(m.elements ?? {}), ...ov.elements };
  if (ov.loot !== undefined) m.loot = ov.loot.map((l) => ({ id: l.id, name: l.name ?? m.loot?.find((x) => x.id === l.id)?.name, chance: l.chance }));
  return m;
}

/** O contexto de validação do jogo real: itens do catálogo e desenhos (outfits) existentes. `outfits.json` só é lido quando há override a validar. */
export function contextoDoJogo(itemCatalog) {
  let outfits = null;
  return {
    existeItem: (id) => Number.isInteger(id) && !!itemCatalog[id],
    existeOutfit: (look) => (outfits ??= JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'outfits.json'), 'utf8')))[String(look)] != null,
  };
}

/** Lê o arquivo de overrides de monstros (ignora e avisa se estiver quebrado). `{ ativo, monstros }`. */
export function lerMonstros(pasta = PASTA, avisar = console.warn) {
  const arq = join(pasta, 'monstros.json');
  if (!existsSync(arq)) return { ativo: true, monstros: {} };
  try {
    const d = JSON.parse(readFileSync(arq, 'utf8'));
    return { ativo: d.ativo !== false, monstros: d.monstros && typeof d.monstros === 'object' ? d.monstros : {} };
  } catch (e) {
    avisar(`[overrides] monstros.json ignorado: ${e.message}`);
    return { ativo: false, monstros: {} };
  }
}

/**
 * Aplica os overrides ao bestiário (MUTA `bestiario`, o objeto compartilhado do jogo). `contexto`: `{ existeItem, existeOutfit }`. Entrada inválida
 * é ignorada com aviso. Devolve `{ aplicados: [keys], criados: [keys], ignorados: [{key, erros}] }`.
 */
export function aplicarNoBestiario(bestiario, dados, contexto, avisar = console.warn) {
  const saida = { aplicados: [], criados: [], ignorados: [] };
  if (!dados?.ativo || !Object.keys(dados.monstros ?? {}).length) return saida;
  const originais = structuredClone(bestiario); // os valores de ANTES, para validar sem efeito cascata
  const ctx = (key) => ({ ...contexto, original: originais[key] ?? null, existeMonstro: (k) => !!originais[k] || saida.criados.includes(k) });
  for (const [key, ov] of Object.entries(dados.monstros)) {
    if (ov?.ativo === false) continue;
    const { erros } = validarMonstro(key, ov, ctx(key));
    if (erros.length) {
      saida.ignorados.push({ key, erros });
      avisar(`[overrides] monstro "${key}" ignorado: ${erros.join(' | ')}`);
      continue;
    }
    const base = ov.base != null ? originais[ov.base] : originais[key];
    bestiario[key] = aplicarNoMonstro(ov.base != null ? base : bestiario[key], ov);
    (ov.base != null ? saida.criados : saida.aplicados).push(key);
  }
  return saida;
}

/**
 * Os ATAQUES: `poderes` (objeto key → `{ataques, curas}`) recebe os ataques do override (substituindo); para um monstro SEM poderes cadastrados o
 * override cria o registro. Variação (`base`): herda os poderes da base e depois aplica os dela.
 */
export function aplicarNosPoderes(poderes, dados) {
  if (!dados?.ativo) return [];
  const feitos = [];
  const originais = structuredClone(poderes); // a variação parte do ORIGINAL da base (como no bestiário), não de uma alteração dela
  for (const [key, ov] of Object.entries(dados.monstros)) {
    if (ov?.ativo === false) continue;
    if (ov.base != null && originais[ov.base] && !poderes[key]) poderes[key] = structuredClone(originais[ov.base]);
    if (ov.ataques === undefined) continue;
    poderes[key] = { ...(poderes[key] ?? { curas: [] }), ataques: structuredClone(ov.ataques) };
    feitos.push(key);
  }
  return feitos;
}

// =====================================================================================================================
// ITENS: o mesmo mecanismo para o catálogo importado (`item-catalog.json`) — `gamedata/overrides/itens.json`:
//   { "ativo": true, "itens": { "3268": { "ativo": true, "name": "...", "weight": 18, "buy": 8, "sell": 5, "attack": 10, "defense": 5, "armor": 0,
//                                          "minLevel": 1, "rarity": "incomum", "imbuementSlots": 0 } } }
// Só campos que o jogo já lê no item; só item que EXISTE (não cria item novo: o sprite e o resto vêm do catálogo). Preço de venda explícito vale
// acima do preço calculado (`itens/preco-de-venda.mjs`) e tira a marca `sellCalculado`.
// =====================================================================================================================
export const RARIDADES_DE_ITEM = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];
// Os campos de BASE DE ARMA (`attackMin/attackMax` = dano físico mín./máx., `aps`, `critChance` em centésimos de %, `range`, `reqStr/reqDex/reqInt`) seguem o catálogo/`engine/arma.mjs`: sem eles a arma
// usa `attack` único, o APS de hoje (0,5) e nenhum requisito — o combate de antes não muda.
export const CAMPOS_DE_ARMA = ['attackMin', 'attackMax', 'aps', 'critChance', 'range', 'reqStr', 'reqDex', 'reqInt'];
export const CAMPOS_DE_ITEM = ['name', 'weight', 'buy', 'sell', 'attack', 'defense', 'armor', 'minLevel', 'rarity', 'imbuementSlots', ...CAMPOS_DE_ARMA];
// ITEM NOVO (criado no editor): uma entrada com `base` = o id de um item existente nasce como CÓPIA dele (com todos os campos) sob um id novo (a partir de `ID_MINIMO_DE_ITEM_NOVO`, fora da faixa do
// Canary), e os campos do override ajustam a cópia. O sprite é o do item-base até alguém trocar (`gamedata/overrides/itens-sprites.json`). Apagar a entrada remove o item.
export const ID_MINIMO_DE_ITEM_NOVO = 900000;
const CAMPOS_PERMITIDOS_DE_ITEM = new Set([...CAMPOS_DE_ITEM, 'ativo', 'base']);
/** A cópia-base de um item novo: o original da base sob o id novo. */
export const copiaParaItemNovo = (baseOriginal, id) => ({ ...structuredClone(baseOriginal), id: Number(id) });

/** Valida UM override de item. `ctx`: `{ original: item do catálogo (ou null) }`. `{ erros, avisos }`. */
export function validarItem(id, ov, ctx) {
  const erros = [];
  const avisos = [];
  const onde = `item ${id}`;
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { erros: [`${onde}: o override precisa ser um objeto.`], avisos };
  if (ov.base !== undefined) {
    // item NOVO: precisa de um id novo e de uma base que exista
    if (!(Number.isInteger(Number(id)) && Number(id) >= ID_MINIMO_DE_ITEM_NOVO && Number(id) <= 2_000_000_000)) erros.push(`${onde}: o ID de um item novo precisa ser um inteiro de ${ID_MINIMO_DE_ITEM_NOVO} a 2.000.000.000.`);
    if (ctx.existe) erros.push(`${onde}: já existe um item com esse ID (um item novo precisa de ID livre).`);
    if (!ctx.original) erros.push(`${onde}: o item-base ${ov.base} não existe no catálogo.`);
    else if (!ctx.original.slot && !ctx.original.type) avisos.push(`${onde}: o item-base não tem slot nem tipo (a cópia herda isso).`);
  } else if (!ctx.original) erros.push(`${onde}: não existe no catálogo de itens (overrides só alteram itens existentes; para criar um item novo use "duplicar").`);
  for (const c of Object.keys(ov)) if (!CAMPOS_PERMITIDOS_DE_ITEM.has(c)) erros.push(`${onde}: o campo "${c}" não tem suporte (permitidos: ${CAMPOS_DE_ITEM.join(', ')}).`);
  if (ov.name !== undefined && !(typeof ov.name === 'string' && ov.name.trim().length >= 1 && ov.name.length <= 80)) erros.push(`${onde}: nome de 1 a 80 caracteres.`);
  if (ov.weight !== undefined && !(typeof ov.weight === 'number' && ov.weight >= 0 && ov.weight <= 100_000)) erros.push(`${onde}: peso de 0 a 100.000.`);
  for (const [c, max] of [['buy', 2_000_000_000], ['sell', 2_000_000_000], ['attack', 100_000], ['defense', 100_000], ['armor', 100_000], ['minLevel', 5000], ['imbuementSlots', 10]]) {
    if (ov[c] !== undefined && !inteiro(ov[c], 0, max)) erros.push(`${onde}: ${c} precisa ser um inteiro de 0 a ${max.toLocaleString('pt-BR')}.`);
  }
  for (const e of validarBaseDaArma(ov)) erros.push(`${onde}: ${e}`);
  if (ctx.original && CAMPOS_DE_ARMA.some((c) => ov[c] !== undefined) && ctx.original.slot !== 'weapon') erros.push(`${onde}: os campos de base de arma (${CAMPOS_DE_ARMA.join(', ')}) só valem para armas (este item é ${ctx.original.slot ?? 'sem slot'}).`);
  if (ov.rarity !== undefined && !RARIDADES_DE_ITEM.includes(ov.rarity)) erros.push(`${onde}: raridade "${ov.rarity}" desconhecida (${RARIDADES_DE_ITEM.join(', ')}).`);
  if (ctx.original) {
    for (const c of ['attack', 'defense', 'armor', 'minLevel', 'imbuementSlots']) if (ov[c] !== undefined && ctx.original[c] === undefined && ov[c] !== 0) avisos.push(`${onde}: o item original não tem ${c} (é ${ctx.original.slot ? `um ${ctx.original.slot}` : 'um item sem slot de equipamento'}): o valor só faz efeito onde o jogo lê esse campo.`);
    if (ov.sell !== undefined && ov.buy === undefined && ov.sell > (ov.buy ?? ctx.original.buy ?? Infinity)) avisos.push(`${onde}: o preço de venda (${ov.sell}) é maior que o de compra (${ctx.original.buy}): dá para comprar e vender com lucro.`);
    if (ov.buy !== undefined && ov.sell === undefined && (ctx.original.sell ?? 0) > ov.buy) avisos.push(`${onde}: o preço de compra (${ov.buy}) ficou menor que o de venda (${ctx.original.sell}): dá para comprar e vender com lucro.`);
    if (ov.sell !== undefined && ov.buy !== undefined && ov.sell > ov.buy) avisos.push(`${onde}: o preço de venda (${ov.sell}) é maior que o de compra (${ov.buy}).`);
  }
  return { erros, avisos };
}

/** O item EFETIVO (cópia; o original não muda). Pura. */
export function aplicarNoItem(original, ov) {
  const m = structuredClone(original);
  for (const c of CAMPOS_DE_ITEM) if (ov[c] !== undefined) m[c] = ov[c];
  if (ov.sell !== undefined) delete m.sellCalculado;
  // O requisito de atributo é DERIVADO do nível/classe (ou dos `req*` explícitos): muda junto com eles.
  if (['minLevel', 'reqStr', 'reqDex', 'reqInt'].some((c) => ov[c] !== undefined)) { const req = requisitoDe(m); if (req) m.requisito = req; else delete m.requisito; }
  return m;
}

export function lerItens(pasta = PASTA, avisar = console.warn) {
  const arq = join(pasta, 'itens.json');
  if (!existsSync(arq)) return { ativo: true, itens: {} };
  try {
    const d = JSON.parse(readFileSync(arq, 'utf8'));
    return { ativo: d.ativo !== false, itens: d.itens && typeof d.itens === 'object' ? d.itens : {} };
  } catch (e) {
    avisar(`[overrides] itens.json ignorado: ${e.message}`);
    return { ativo: false, itens: {} };
  }
}

/** Aplica os overrides ao catálogo de itens (MUTA `catalogo`). Entrada inválida é ignorada com aviso. `{ aplicados: [ids], ignorados: [{id, erros}] }`. */
export function aplicarNosItens(catalogo, dados, avisar = console.warn) {
  const saida = { aplicados: [], ignorados: [] };
  if (!dados?.ativo || !Object.keys(dados.itens ?? {}).length) return saida;
  // Os itens NOVOS primeiro (clonam o original da base antes de qualquer override dela), depois os ajustes dos existentes.
  const entradas = Object.entries(dados.itens);
  for (const [id, ov] of [...entradas.filter(([, o]) => o?.base !== undefined), ...entradas.filter(([, o]) => o?.base === undefined)]) {
    if (ov?.ativo === false) continue;
    const novo = ov?.base !== undefined;
    const { erros } = validarItem(id, ov, novo ? { original: catalogo[ov.base] ?? null, existe: catalogo[id] != null } : { original: catalogo[id] ?? null });
    if (erros.length) {
      saida.ignorados.push({ id, erros });
      avisar(`[overrides] item "${id}" ignorado: ${erros.join(' | ')}`);
      continue;
    }
    catalogo[id] = aplicarNoItem(novo ? copiaParaItemNovo(catalogo[ov.base], id) : catalogo[id], ov);
    saida.aplicados.push(id);
  }
  return saida;
}

// =====================================================================================================================
// RE-APLICAÇÃO (Hot Reload): aplicar os overrides DE NOVO num catálogo que já está no ar, sem reiniciar e sem perder o original.
// O invariante que torna isto seguro: o que NÃO está no conjunto aplicado agora é o original (nunca foi tocado). Antes de sobrescrever uma chave,
// guarda-se o original dela em `estado.originais`; re-aplicar = devolver os originais das chaves antigas e aplicar o arquivo novo. Em modo
// `estrito` (o Hot Reload) qualquer entrada inválida CANCELA tudo (nada é tocado: fica a última versão válida); no boot (`estrito: false`) a
// entrada inválida é só ignorada com aviso, como sempre foi.
// =====================================================================================================================
/** O estado de uma camada re-aplicável: originais das chaves alteradas, chaves alteradas e chaves criadas (variações). */
export const criarEstadoDeCamada = () => ({ originais: new Map(), aplicados: new Set(), criados: new Set() });

/** Lê `monstros.json`/`itens.json` e LANÇA se estiver quebrado (o Hot Reload não pode confundir "arquivo ruim" com "sem overrides"). */
function lerEstrito(arquivo, campo, pasta) {
  const arq = join(pasta, arquivo);
  if (!existsSync(arq)) return { ativo: true, [campo]: {} };
  let d;
  try { d = JSON.parse(readFileSync(arq, 'utf8')); } catch (e) { throw new Error(`${arquivo} não é um JSON válido: ${e.message}`); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error(`${arquivo}: o conteúdo precisa ser um objeto.`);
  return { ativo: d.ativo !== false, [campo]: d[campo] && typeof d[campo] === 'object' ? d[campo] : {} };
}
export const lerMonstrosEstrito = (pasta = PASTA) => lerEstrito('monstros.json', 'monstros', pasta);
export const lerItensEstrito = (pasta = PASTA) => lerEstrito('itens.json', 'itens', pasta);

/**
 * Re-aplica os overrides de monstros no `bestiario` (muta). Devolve `{ ok, aplicados, criados, ignorados, mudados }`; `mudados` = chaves cujo
 * monstro efetivo pode ter mudado (as de antes + as de agora). `ok: false` (só no estrito) = nada foi tocado.
 */
export function reaplicarNoBestiario(bestiario, estado, dados, contexto, { estrito = false, avisar = console.warn } = {}) {
  const saida = { ok: true, aplicados: [], criados: [], ignorados: [], mudados: [] };
  // O olhar "de antes de qualquer override": o original guardado (se a chave está alterada) ou o próprio catálogo (se nunca foi tocada).
  const original = (k) => (estado.criados.has(k) ? null : estado.originais.has(k) ? estado.originais.get(k) : bestiario[k] ?? null);
  const plano = [];
  const criadosNovos = new Set();
  const ativas = dados?.ativo ? Object.entries(dados.monstros ?? {}).filter(([, ov]) => ov?.ativo !== false) : [];
  for (const [key, ov] of ativas) {
    const ctx = { ...contexto, original: ov?.base != null ? null : original(key), existeMonstro: (k) => original(k) != null || criadosNovos.has(k) };
    const { erros } = validarMonstro(key, ov, ctx);
    if (erros.length) { saida.ignorados.push({ key, erros }); if (!estrito) avisar(`[overrides] monstro "${key}" ignorado: ${erros.join(' | ')}`); continue; }
    const base = ov.base != null ? original(ov.base) : original(key);
    plano.push({ key, ov, efetivo: aplicarNoMonstro(base, ov), variacao: ov.base != null, original: ov.base != null ? null : base });
    if (ov.base != null) criadosNovos.add(key);
  }
  if (estrito && saida.ignorados.length) return { ...saida, ok: false };
  // Compromete: devolve os originais das chaves de antes e aplica o plano.
  const antes = new Set([...estado.aplicados, ...estado.criados]);
  for (const k of estado.aplicados) bestiario[k] = estado.originais.get(k);
  for (const k of estado.criados) delete bestiario[k];
  const originaisAntigos = estado.originais;
  estado.originais = new Map();
  estado.aplicados.clear();
  estado.criados.clear();
  for (const p of plano) {
    if (p.variacao) { bestiario[p.key] = p.efetivo; estado.criados.add(p.key); saida.criados.push(p.key); }
    else { estado.originais.set(p.key, originaisAntigos.get(p.key) ?? p.original); bestiario[p.key] = p.efetivo; estado.aplicados.add(p.key); saida.aplicados.push(p.key); }
  }
  saida.mudados = [...new Set([...antes, ...saida.aplicados, ...saida.criados])];
  return saida;
}

/** O mesmo para o catálogo de itens. `{ ok, aplicados, ignorados, mudados }`. */
export function reaplicarNosItens(catalogo, estado, dados, { estrito = false, avisar = console.warn } = {}) {
  const saida = { ok: true, aplicados: [], criados: [], ignorados: [], mudados: [] };
  // O olhar "de antes de qualquer override": o original guardado (se alterado), o catálogo (se nunca tocado) — e um item CRIADO por override não conta como original.
  const original = (id) => { const k = String(id); return estado.criados.has(k) ? null : estado.originais.has(k) ? estado.originais.get(k) : catalogo[k] ?? null; };
  const plano = [];
  const ativas = dados?.ativo ? Object.entries(dados.itens ?? {}).filter(([, ov]) => ov?.ativo !== false) : [];
  for (const [id, ov] of ativas) {
    const novo = ov?.base !== undefined;
    const { erros } = validarItem(id, ov, novo ? { original: original(ov.base), existe: original(id) != null } : { original: original(id) });
    if (erros.length) { saida.ignorados.push({ id, erros }); if (!estrito) avisar(`[overrides] item "${id}" ignorado: ${erros.join(' | ')}`); continue; }
    plano.push(novo ? { id, efetivo: aplicarNoItem(copiaParaItemNovo(original(ov.base), id), ov), criado: true } : { id, efetivo: aplicarNoItem(original(id), ov), original: original(id) });
  }
  if (estrito && saida.ignorados.length) return { ...saida, ok: false };
  const antes = [...estado.aplicados, ...estado.criados];
  for (const id of estado.aplicados) catalogo[id] = estado.originais.get(id);
  for (const id of estado.criados) delete catalogo[id];
  estado.criados.clear();
  const originaisAntigos = estado.originais;
  estado.originais = new Map();
  estado.aplicados.clear();
  for (const p of plano) {
    if (p.criado) { catalogo[p.id] = p.efetivo; estado.criados.add(String(p.id)); saida.criados.push(String(p.id)); continue; }
    estado.originais.set(p.id, originaisAntigos.get(p.id) ?? p.original); catalogo[p.id] = p.efetivo; estado.aplicados.add(p.id); saida.aplicados.push(p.id);
  }
  saida.mudados = [...new Set([...antes, ...saida.aplicados, ...saida.criados])];
  return saida;
}

/** Os ataques: re-aplica em `poderes` (muta) só para as chaves de `validas`. Originais guardados em `estado` (a variação parte do original da base). */
export function reaplicarNosPoderes(poderes, estado, dados, validas) {
  const antes = [...estado.aplicados];
  for (const k of antes) { const o = estado.originais.get(k); if (o == null) delete poderes[k]; else poderes[k] = o; }
  const originaisAntigos = estado.originais;
  estado.originais = new Map();
  estado.aplicados.clear();
  const orig = (k) => (originaisAntigos.has(k) ? originaisAntigos.get(k) : poderes[k] ?? null);
  const feitos = [];
  if (dados?.ativo) {
    const permitido = new Set(validas);
    for (const [key, ov] of Object.entries(dados.monstros ?? {})) {
      if (ov?.ativo === false || !permitido.has(key)) continue;
      const guardar = () => { if (!estado.originais.has(key)) estado.originais.set(key, orig(key) == null ? null : structuredClone(orig(key))); };
      if (ov.base != null && orig(ov.base) && !poderes[key]) { guardar(); poderes[key] = structuredClone(orig(ov.base)); estado.aplicados.add(key); }
      if (ov.ataques === undefined) continue;
      guardar();
      poderes[key] = { ...(poderes[key] ?? { curas: [] }), ataques: structuredClone(ov.ataques) };
      estado.aplicados.add(key);
      feitos.push(key);
    }
  }
  return { feitos, mudados: [...new Set([...antes, ...estado.aplicados])] };
}
