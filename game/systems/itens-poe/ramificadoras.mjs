// As RAMIFICADORAS (Cluster Jewels) do PoE — dono, 16/10: "Fazer completo" e "Seguir nessa ordem" (1 os dados, 2 o servidor, 3 a tela, 4 as 12
// únicas). Lote 61: a PEÇA, como o PoE a gera (os dados: `gamedata/itens-poe/ramificadoras.json`, `tools/importar-ramificadoras.mjs` — o Path of
// Building, Data/ClusterJewels.lua e Data/ModJewelCluster.lua, que são os dados do jogo, e o poedb pelo Scrapling):
//   - o ENCANTAMENTO: um dos do tamanho, todos com a mesma chance (o poedb não dá peso a ele), troca a marcação "Habilidades Passivas
//     Adicionadas concedem #" da base pelas linhas dele — é ele que diz o que as Pequenas Habilidades Passivas da joia concedem e quais
//     notáveis ela pode ter;
//   - o NÚMERO de passivas ("Adiciona (8—12) Habilidades Passivas") e os encaixes são os implícitos da base, sorteados na faixa;
//   - os MODS: pelo PESO do PoE — a 1ª chave da tabela do mod que a peça tem (o tamanho `expansion_jewel_large`…, a tag do encantamento ou
//     `default`) × o MULTIPLICADOR (a 1ª chave da tabela de multiplicadores que a peça tem, entre as tags que os mods dela já puseram e o
//     tamanho) ÷ 100, com o nível do mod ≤ o Item Level. O notável põe a tag `has_affliction_notable` (e o notável Sufixo, também a
//     `has_affliction_notable2`): é assim que a Pequena só tem 1 notável e a Grande só 1 notável Sufixo;
//   - joia: no máximo 2 Prefixos e 2 Sufixos (o `affixLimit` do PoB para joia).
// A peça guarda `ramificadora: { tamanho, encantamento, tag }` (o id do encantamento no PoB — a tag se repete: o Bloqueio de Ataques e o
// Mágico da Pequena); cada mod, o `id` do mod do PoE (e o notável, `notavel`). Sem os dados, nada muda.
import { porPeso, rolarTexto } from './gerar.mjs';

/** As bases → o tamanho (o nome do PoB). */
export const TAMANHOS = Object.freeze({ 'Jewels/Large_Cluster_Jewel': 'Large', 'Jewels/Medium_Cluster_Jewel': 'Medium', 'Jewels/Small_Cluster_Jewel': 'Small' });
const TAG_DO_TAMANHO = { Large: 'expansion_jewel_large', Medium: 'expansion_jewel_medium', Small: 'expansion_jewel_small' };
/** (PoE) a joia: no máximo 2 Prefixos e 2 Sufixos (o PoB: `affixLimit` 4 para "Jewel"). */
export const MAXIMO_POR_LADO = 2;
/** A marcação do encantamento na base (o catálogo do poedb). */
const MARCACAO = 'Habilidades Passivas Adicionadas concedem #';

export const tamanhoDaBase = (base) => TAMANHOS[base] ?? null;
const cacheDosMods = new WeakMap();
const modsPorId = (dados) => {
  let m = cacheDosMods.get(dados);
  if (!m) cacheDosMods.set(dados, (m = new Map((dados?.mods ?? []).map((x) => [x.id, x]))));
  return m;
};
/** O mod do PoE de um mod da peça (pelo `id`), ou null. */
export const modDoPoe = (dados, mod) => (mod?.id ? modsPorId(dados).get(mod.id) ?? null : null);

/** As TAGS da peça, como no PoE: `default`, o tamanho, o encantamento e as que os mods dela põem. */
export function tagsDa(dados, poe) {
  const t = new Set(['default']);
  const tamanho = poe?.ramificadora?.tamanho ?? tamanhoDaBase(poe?.base);
  if (TAG_DO_TAMANHO[tamanho]) t.add(TAG_DO_TAMANHO[tamanho]);
  if (poe?.ramificadora?.tag) t.add(poe.ramificadora.tag);
  for (const m of [...(poe?.prefixos ?? []), ...(poe?.sufixos ?? [])]) for (const x of modDoPoe(dados, m)?.adiciona ?? []) t.add(x);
  return t;
}
/** O valor da 1ª chave da tabela (na ordem dela) que a peça tem, ou null. */
const primeira = (tabela, tags) => {
  for (const [k, v] of Object.entries(tabela ?? {})) if (tags.has(k)) return v;
  return null;
};
/** O PESO do mod numa peça com estas tags: o peso × o multiplicador ÷ 100. */
export const pesoDoMod = (m, tags) => ((primeira(m.pesos, tags) ?? 0) * (primeira(m.multiplicadores, tags) ?? 100)) / 100;

/** Quantos mods cabem de cada lado na raridade (`R`: a regra da raridade), com o teto da joia. */
const vagasDa = (R) => ({ prefixo: Math.min(MAXIMO_POR_LADO, R?.maxPrefixos ?? 0), sufixo: Math.min(MAXIMO_POR_LADO, R?.maxSufixos ?? 0) });

/**
 * UM mod novo para a Ramificadora `poe` (`{ base, ramificadora, raridade, ilvl, prefixos, sufixos }`): de um grupo ainda não usado, de um
 * lado com vaga, pelo peso do PoE. Devolve `{ lado, mod }` (o mod no formato da peça) ou null.
 */
export function sortearUmMod({ dados, poe, R, rng = Math.random, lados = ['prefixo', 'sufixo'] }) {
  if (!dados || !poe?.ramificadora) return null;
  const max = vagasDa(R);
  const tags = tagsDa(dados, poe);
  const usados = new Set([...(poe.prefixos ?? []), ...(poe.sufixos ?? [])].map((m) => modDoPoe(dados, m)?.grupo ?? m.familia));
  const ilvl = Math.max(1, Number(poe.ilvl) || 1);
  const vagas = lados.filter((l) => (poe[`${l}s`] ?? []).length < max[l]);
  const candidatos = [];
  for (const m of dados.mods ?? []) {
    if (!m.modelo || !vagas.includes(m.lado) || (m.nivel ?? 1) > ilvl || usados.has(m.grupo)) continue;
    const peso = pesoDoMod(m, tags);
    if (peso > 0) candidatos.push([m, peso]);
  }
  const m = porPeso(candidatos, rng);
  if (!m) return null;
  const { modelo, valores, texto } = rolarTexto(m, rng);
  return { lado: m.lado, mod: { id: m.id, familia: m.grupo, tier: null, nome: m.nome ?? null, ilvl: m.nivel ?? 1, modelo, texto, valores, ...(m.notavel ? { notavel: m.notavel } : {}) } };
}

/** O "tier" de um mod da Ramificadora (as faixas dele, para o Orbe Divino): `{ tier, tiers }` ou null. */
export function tierDoMod(dados, mod) {
  const m = modDoPoe(dados, mod);
  if (!m?.modelo) return null;
  const tier = { tier: null, nome: m.nome ?? null, ilvl: m.nivel ?? 1, modelo: m.modelo, faixas: m.faixas ?? [] };
  return { tier, tiers: [tier] };
}

/** O encantamento da peça (o do tamanho dela, pela tag), ou null. */
export const encantamentoDa = (dados, poe) => dados?.tamanhos?.[poe?.ramificadora?.tamanho]?.encantamentos?.find((e) => e.id === poe.ramificadora.encantamento) ?? null;

/**
 * A PEÇA (`peca`, a que `gerar.gerarPeca` montou: a base, os implícitos sorteados, sem mods): sorteia o encantamento, troca a marcação dele
 * pelas linhas e sorteia `quantos` mods. `R`: a regra da raridade. Muta e devolve a peça.
 */
export function gerarRamificadora({ dados, peca, R, quantos, rng = Math.random }) {
  const tamanho = tamanhoDaBase(peca.base);
  const lista = dados?.tamanhos?.[tamanho]?.encantamentos ?? [];
  if (!lista.length) return { ...peca, aviso: 'sem os dados das Ramificadoras: saiu sem encantamento' };
  const enc = lista[Math.floor(rng() * lista.length)];
  peca.ramificadora = { tamanho, encantamento: enc.id, tag: enc.tag };
  peca.implicitos = [
    ...(peca.implicitos ?? []).filter((im) => im.modelo !== MARCACAO),
    ...enc.linhas.map((l) => ({ modelo: `Habilidades Passivas Adicionadas concedem ${l}`, valores: [], texto: `Habilidades Passivas Adicionadas concedem ${l}`, encantamento: true })),
  ];
  for (let i = 0; i < quantos; i++) {
    const novo = sortearUmMod({ dados, poe: peca, R, rng });
    if (!novo) break;
    peca[`${novo.lado}s`].push(novo.mod);
  }
  if (peca.raridade === 'magico') peca.nome = [peca.prefixos[0]?.nome, peca.nome, peca.sufixos[0]?.nome].filter(Boolean).join(' ');
  if (peca.raridade === 'raro') peca.nomeAleatorio = null;
  return peca;
}
