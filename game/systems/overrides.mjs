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
