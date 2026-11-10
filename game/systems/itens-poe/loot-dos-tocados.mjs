// (09/11, lote 5 dos modificadores de monstro — o dono: "resolver os aproximados e parciais") o LOOT dos monstros "Tocados" (Archnemesis do PoE): os itens que o
// monstro solta mudam. As linhas do PoE e o que vira cada uma:
//   - "itens soltos viram moeda pela raridade" (Tocado por Lunaris/Solaris/Shakari): cada peça vira orbes do drop do jogo, pelos mesmos pesos (`chancePorAto`) —
//     Comum 1, Mágica 2, Rara 3, Única 5 (decisão do dono, 09/11: o poedb não dá a tabela)
//   - "… viram Cartas de Adivinhação" (Arakaali, Rei da Salmoura): uma carta pelo sorteio das cartas (`cartas.sortear`, o nível do monstro)
//   - "… viram Mapas" (Tukohama, Abberath) e "… viram Escaravelhos" (Innocence — o jogo não tem Escaravelhos; o dono, 09/11: "virar Mapas"): um Mapa do tier da área
//   - "… viram Joias / Anéis / Amuletos / Frascos Utilitários / Gemas": uma peça daquela classe na mesma raridade (a gema, uma do drop de gemas)
//   - "Itens soltos são Corrompidos" (Corrompedor), "… uma raridade acima" (Tocado por Kitava), "… têm o máximo de Encaixes" (Barreira de Magma)
//   - "Itens com Qualidade viram moeda de qualidade" (Necromante): a moeda de qualidade da classe, a que dá 20% (4 unidades)
import { readFileSync } from 'node:fs';
import * as Jogo from './jogo.mjs';
import * as Cartas from './cartas.mjs';
import * as Mapas from './mapas.mjs';
import * as SocketsPoe from './sockets.mjs';

const MOEDAS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/moedas-poe.json', import.meta.url), 'utf8')).moedas ?? [];
const idDaMoeda = (slug) => MOEDAS.find((m) => m.slug === slug)?.itemId ?? null;
const ORBES = Object.values(SocketsPoe.orbes() ?? {}).filter((o) => o?.itemId);
/** Quantas moedas a peça vira, pela raridade dela (decisão do dono). */
export const MOEDAS_POR_RARIDADE = Object.freeze({ normal: 1, magico: 2, raro: 3, unico: 5 });
/** A moeda de qualidade de cada classe e quantas dão os 20% ("converted to 20 quality currency"). */
const QUALIDADE = { arma: 'Blacksmiths_Whetstone', armadura: 'Armourers_Scrap', frasco: 'Glassblowers_Bauble', mapa: 'Cartographers_Chisel', gema: 'Gemcutters_Prism' };
export const MOEDAS_DE_QUALIDADE = 4;
const CLASSE_DA_CONVERSAO = { joia: 'Jewels', anel: 'Rings', amuleto: 'Amulets', frascoUtilitario: 'Utility_Flasks' };
const PROXIMA = { normal: 'magico', magico: 'raro', raro: 'unico' };

/** Um orbe sorteado pelos pesos do drop do jogo no `ato` (o `chancePorAto`). */
export function orbeSorteado(ato = 1, rng = Math.random) {
  const pesos = ORBES.map((o) => [o.itemId, Number(o.chancePorAto?.[String(ato)] ?? o.chancePorAto?.['1'] ?? 0)]).filter(([, p]) => p > 0);
  const total = pesos.reduce((t, [, p]) => t + p, 0);
  if (!(total > 0)) return null;
  let s = rng() * total;
  return pesos.find(([, p]) => (s -= p) < 0)?.[0] ?? pesos.at(-1)[0];
}
/** O tier do mapa que cai pelo nível do monstro: o da área no mapa; na campanha, o T1 (o nível 68). */
export function tierDoNivel(nivel, tierDaArea = null) {
  if (tierDaArea) return tierDaArea;
  let tier = 1;
  for (const t of Mapas.TIERS) if ((t.nivel ?? Infinity) <= nivel) tier = Math.max(tier, t.tier);
  return tier;
}
const classeDaPeca = (p) => p?.poe?.classe ?? String(p?.poe?.base ?? '').split('/')[0];
const tipoDeQualidade = (p) => {
  const c = classeDaPeca(p);
  if (c === Mapas.CLASSE) return 'mapa';
  if (Jogo.FRASCOS.includes(c)) return 'frasco';
  if (/Weapon|Swords|Axes|Maces|Bows|Claws|Daggers|Staves|Wands|Sceptres|Quivers/i.test(c)) return 'arma';
  if (/Armour|Helmets|Gloves|Boots|Body|Shields/i.test(c)) return 'armadura';
  return null;
};

/**
 * O que a peça `peca` vira pelo monstro `alvo` (os campos `loot*` que `mobs/raridade.aplicar` pôs nele). Devolve `{ pecas, moedas }` — `pecas`: as peças do PoE
 * que entram no lugar (a mesma, mudada, ou outra); `moedas`: `[{ id, count }]` para a bolsa. `ctx`: `{ nivel, tierDaArea, ato, rng, gema }` (`gema()`: uma gema
 * do drop de gemas, ou null).
 */
export function converter(peca, alvo, { nivel = 1, tierDaArea = null, ato = 1, rng = Math.random, gema = null } = {}) {
  const raridade = peca?.poe?.raridade ?? 'normal';
  const vira = alvo?.lootVira;
  if (vira === 'moeda') {
    const n = MOEDAS_POR_RARIDADE[raridade] ?? 1;
    const moedas = Array.from({ length: n }, () => orbeSorteado(ato, rng)).filter(Boolean).map((id) => ({ id, count: 1 }));
    return { pecas: [], moedas };
  }
  if (vira === 'carta') {
    const c = Cartas.sortear(nivel, rng);
    return { pecas: [], moedas: c ? [{ id: c.id, count: 1 }] : [] };
  }
  if (vira === 'mapa' || vira === 'escaravelho') {
    const m = Jogo.mapaSorteado(tierDoNivel(nivel, tierDaArea), { rng });
    return { pecas: m ? [m] : [], moedas: [] };
  }
  if (vira === 'gema') {
    const g = gema?.();
    return { pecas: [], moedas: g ? [{ ...g, count: 1 }] : [] };
  }
  let p = peca;
  if (CLASSE_DA_CONVERSAO[vira]) {
    const nova = Jogo.pecaDaClasse(CLASSE_DA_CONVERSAO[vira], nivel, { raridade: raridade === 'unico' ? 'raro' : raridade, rng });
    if (nova) p = Jogo.naoIdentificada(peca) ? Jogo.semIdentificar(nova) : nova;
  }
  const moedas = [];
  // "uma raridade acima": a mesma base, na raridade seguinte (o Raro sem Único naquela base fica Raro)
  if (alvo?.lootRaridadeAcima && PROXIMA[p?.poe?.raridade ?? 'normal']) {
    const nova = Jogo.pecaNaRaridade(p.poe.base, PROXIMA[p.poe.raridade ?? 'normal'], p.poe.ilvl ?? nivel, rng);
    if (nova) p = Jogo.naoIdentificada(p) ? Jogo.semIdentificar(nova) : nova;
  }
  // "o máximo de Encaixes": os encaixes que faltam, abertos (sem ligar — a regra do PoE), com as cores da base
  if (alvo?.lootSoquetesMax && p?.soquetes) {
    const max = SocketsPoe.maximo(classeDaPeca(p), p.poe?.ilvl ?? nivel);
    const s = p.soquetes;
    const falta = max - (s.abertos ?? 0);
    if (falta > 0) {
      const cores = SocketsPoe.sortearCores(falta, Jogo.registro()?.catalogo?.[p.id]?.poe?.requisitos, rng);
      p.soquetes = { ...s, abertos: max, links: [...(s.links ?? []), ...Array(falta).fill(false)].slice(0, max - 1), gemas: [...(s.gemas ?? []), ...Array(falta).fill(null)], cores: [...(s.cores ?? []), ...cores] };
    }
  }
  // "Itens com Qualidade viram moeda de qualidade": a peça com qualidade sai como a moeda da classe dela
  if (alvo?.lootQualidadeViraMoeda && Number(p?.poe?.qualidade) > 0) {
    const id = idDaMoeda(QUALIDADE[tipoDeQualidade(p)] ?? '');
    if (id) return { pecas: [], moedas: [{ id, count: MOEDAS_DE_QUALIDADE }] };
  }
  if (alvo?.lootCorrompido && p?.poe) p.poe.corrompido = true;
  return { pecas: p ? [p] : [], moedas };
}

/** O monstro muda o loot? */
export const mudaOLoot = (alvo) => !!(alvo?.lootVira || alvo?.lootRaridadeAcima || alvo?.lootSoquetesMax || alvo?.lootQualidadeViraMoeda || alvo?.lootCorrompido);
