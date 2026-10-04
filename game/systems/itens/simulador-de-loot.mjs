// O SIMULADOR DE LOOT: roda o gerador REAL (`gerarItem`, o único lugar com sorte de item do jogo) milhares de vezes, com uma SEMENTE (mesma semente = mesmo resultado), e mede o que a
// dificuldade muda: raridade, quantidade de modificadores, tier dos modificadores e a frequência de combinações melhores. Não reimplementa regra nenhuma: o que ele mede é o que o
// jogo gera. Também calcula as distribuições TEÓRICAS exatas (raridade e tiers) a partir das mesmas tabelas, para a comparação instantânea e para validar a amostra.
// `lootConfig` (opcional) simula uma configuração PROPOSTA sem mexer na que está em uso.
import { ITEM_CATALOG, CATALOGO } from '../dados.mjs';
import { gerarItem, aceitaAtributos } from './gerar.mjs';
import * as C from './config.mjs';
import * as P from '../progressao.mjs';

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo número → a mesma sequência. */
export function criarRng(semente = 1) {
  let a = (Number(semente) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ordem = () => C.ORDEM;
const soma = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const vazios = () => ({ raridade: Object.fromEntries(ordem().map((r) => [r, 0])), modificadores: {}, tiers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, tiersPorRaridade: Object.fromEntries(ordem().map((r) => [r, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }])) });

/** O nível de item (Item Level) representativo de um Ato: o meio da faixa (a faixa é da progressão, igual nas três dificuldades). */
export const itemLevelDoAto = (ato) => { const f = P.faixaDoAto(ato); return f ? Math.round((f.de + f.ate) / 2) : 1; };

/** A distribuição TEÓRICA de raridade (em fração, soma 1) de um drop: a tabela do Ato × dificuldade, inclinada pelo mob e pelos pesos de raridade da dificuldade. */
export function distribuicaoDeRaridade({ ato, dificuldade, raridadeDoMob = null, boss = false, lootConfig = null, config = null }) {
  // `ato` aqui é o Ato da PROGRESSÃO (1–10); a tabela de raridade é a do estágio mapeado a ele. `config` (opcional): uma configuração EFETIVA candidata `{ progressao, loot }` (a prévia de impacto).
  const estagio = config ? (config.progressao.estagioDeRaridade?.[String(ato)] ?? 1) : P.estagioDeRaridadeDoAto(ato);
  const dif = boss ? C.dificuldadeAcima(dificuldade, C.RARIDADES.boss?.dificuldadeAMais ?? 0) : dificuldade;
  const loot = lootConfig ?? (config ? P.lootComPadroes(config.loot[dificuldade]) : P.lootDa(dificuldade));
  const t = P.aplicarPesosDeRaridade(C.inclinarTabela(C.RARIDADES.chances[String(estagio)][dif], boss ? 'boss' : raridadeDoMob), loot.pesosDeRaridade);
  const total = soma(Object.fromEntries(ordem().map((r) => [r, t[r] ?? 0])));
  const d = Object.fromEntries(ordem().map((r) => [r, (t[r] ?? 0) / total]));
  return { ...d, raroOuMelhor: ordem().filter((r) => ordem().indexOf(r) >= 2).reduce((s, r) => s + d[r], 0) };
}

/** A distribuição TEÓRICA do tier de um modificador (fração por tier 1–5): os tiers que o Item Level libera × peso × viés da raridade × pesos/teto da dificuldade. */
export function distribuicaoDeTiers({ itemLevel, raridade, dificuldade, lootConfig = null, amuleto = false, config = null }) {
  const loot = lootConfig ?? (config ? P.lootComPadroes(config.loot[dificuldade]) : P.lootDa(dificuldade));
  const vies = (C.TIERS.viesDaRaridade[raridade] ?? 1) * (amuleto ? C.TIERS.viesDoAmuleto ?? 1 : 1);
  let tiers = C.tiersLiberados(itemLevel, config ? config.progressao.tiersDeModificador?.itemLevel ?? C.TIERS.itemLevel : null);
  if (loot.tierMaximo != null) { const l = tiers.filter((t) => t <= loot.tierMaximo); tiers = l.length ? l : [tiers[0]]; }
  const ps = tiers.map((t) => C.TIERS.peso[String(t)] * vies ** (t - 1) * (loot.pesosDeTier?.[String(t)] ?? 1));
  const total = ps.reduce((a, b) => a + b, 0);
  const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  tiers.forEach((t, i) => { d[t] = total > 0 ? ps[i] / total : 0; });
  return d;
}

/**
 * O resumo ANALÍTICO (exato, sem sorteio) de um Ato × dificuldade: raridade, modificadores esperados por item, distribuição do tier dos modificadores e o tier médio — das mesmas tabelas
 * que o gerador lê. É a base da comparação instantânea e da prévia de impacto (`config` candidata). Mais barato e sem ruído; o simulador confere que a amostra bate com isto.
 */
export function resumoAnalitico({ ato, dificuldade, config = null, raridadeDoMob = null, boss = false, itemLevel = null }) {
  const il = itemLevel ?? (config ? (() => { const a = config.progressao.atos.find((x) => x.ato === Number(ato)); return a ? Math.round((a.de + a.ate) / 2) : 1; })() : itemLevelDoAto(ato));
  const dist = distribuicaoDeRaridade({ ato, dificuldade, raridadeDoMob, boss, config });
  let modsEsperados = 0;
  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ordem()) {
    const def = C.RARIDADES.raridades[r].atributos;
    const total = soma(def);
    let modsDaRaridade = Object.entries(def).reduce((a, [k, p]) => a + Number(k) * (p / total), 0);
    const loot = config ? P.lootComPadroes(config.loot[dificuldade]) : P.lootDa(dificuldade);
    if (loot.chanceDeModificadorExtra > 0) modsDaRaridade += loot.chanceDeModificadorExtra; // aproximação: o teto do pool só reduz um pouco
    modsEsperados += dist[r] * modsDaRaridade;
    const t = distribuicaoDeTiers({ itemLevel: il, raridade: r, dificuldade, config });
    for (const k of [1, 2, 3, 4, 5]) tiers[k] += dist[r] * modsDaRaridade * t[k];
  }
  const totalTiers = soma(tiers);
  const tiersFracao = Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, totalTiers ? v / totalTiers : 0]));
  const lootAtual = config ? P.lootComPadroes(config.loot[dificuldade]) : P.lootDa(dificuldade);
  return { ato, dificuldade, itemLevel: il, chanceDeDrop: lootAtual.chanceDeDrop, raridade: Object.fromEntries(ordem().map((r) => [r, dist[r]])), raroOuMelhor: dist.raroOuMelhor, modificadoresPorItem: modsEsperados, tiersFracao, tierMedio: Object.entries(tiersFracao).reduce((a, [k, v]) => a + Number(k) * v, 0), tierAlto: tiersFracao[4] + tiersFracao[5] };
}

function medir(itens, { limiarDeTier = 4, minimoDeMods = 3 } = {}) {
  const m = vazios();
  let comMods = 0; let totalMods = 0; let melhores = 0;
  for (const it of itens) {
    const r = it.raridade ?? 'comum';
    m.raridade[r]++;
    const af = it.af ?? [];
    m.modificadores[af.length] = (m.modificadores[af.length] ?? 0) + 1;
    totalMods += af.length;
    if (af.length) comMods++;
    for (const a of af) { m.tiers[a.nivel]++; m.tiersPorRaridade[r][a.nivel]++; }
    if (af.length >= minimoDeMods && af.some((a) => a.nivel >= limiarDeTier)) melhores++;
  }
  const n = itens.length;
  const modsTotal = soma(m.tiers);
  const frac = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, n ? v / n : 0]));
  const raro = ordem().filter((r) => ordem().indexOf(r) >= 2).reduce((s, r) => s + m.raridade[r], 0);
  return {
    amostras: n, raridade: m.raridade, raridadeFracao: frac(m.raridade), raroOuMelhor: n ? raro / n : 0,
    modificadoresPorItem: m.modificadores, mediaDeModificadores: n ? totalMods / n : 0,
    tiers: m.tiers, tiersFracao: Object.fromEntries(Object.entries(m.tiers).map(([k, v]) => [k, modsTotal ? v / modsTotal : 0])),
    tiersPorRaridade: m.tiersPorRaridade, mediaDeTier: modsTotal ? Object.entries(m.tiers).reduce((s, [t, v]) => s + Number(t) * v, 0) / modsTotal : 0,
    combinacoesMelhores: { criterio: `≥ ${minimoDeMods} modificadores e pelo menos um de tier ≥ ${limiarDeTier}`, quantidade: melhores, fracao: n ? melhores / n : 0 },
  };
}

/** As bases elegíveis do Ato (e do `slot`) que rolam atributos — calculado UMA vez por simulação (varrer o catálogo a cada drop custaria segundos). */
function basesElegiveis(ato, slot) {
  const doAto = (a) => (P.basesDoAto(a, { slot, limite: 100000 })?.bases ?? []).filter((b) => aceitaAtributos(b.id));
  const diretas = doAto(ato);
  if (diretas.length) return { bases: diretas, atoDasBases: ato, fallback: false };
  // O catálogo importado (Tibia) quase não tem peça nos Atos altos: sem bases no Ato, usa as do Ato mais próximo ABAIXO (a distribuição de raridade e de tiers depende do Item Level e da dificuldade, não da base).
  for (let a = Number(ato) - 1; a >= 1; a--) { const l = doAto(a); if (l.length) return { bases: l, atoDasBases: a, fallback: true }; }
  return { bases: [], atoDasBases: null, fallback: false };
}

/**
 * Simula `n` DROPS de equipamento (um item por drop). `itemId` fixa a base; senão sorteia entre as bases do Ato (e do `slot`). `itemLevel` padrão = meio da faixa do Ato.
 * `raridadeDoMob`/`boss` seguem o gerador real. Devolve as medidas + o que foi simulado.
 */
export function simular({ ato = 1, dificuldade = 'facil', itemId = null, slot = null, itemLevel = null, raridadeDoMob = null, boss = false, n = 10000, semente = 1, lootConfig = null, limiarDeTier = 4, minimoDeMods = 3 } = {}) {
  const rng = criarRng(semente);
  const il = itemLevel ?? itemLevelDoAto(ato);
  const quantidade = Math.max(1, Math.min(200000, Math.floor(Number(n) || 0)));
  const itens = [];
  let semBase = 0;
  const escolha = itemId ? null : basesElegiveis(ato, slot);
  const bases = escolha?.bases ?? null;
  for (let i = 0; i < quantidade; i++) {
    const id = itemId ? Number(itemId) : bases.length ? bases[Math.floor(rng() * bases.length)].id : null;
    if (id == null) { semBase++; continue; }
    itens.push(gerarItem({ itemId: id, ato: P.estagioDeRaridadeDoAto(ato), dificuldade, itemLevel: il, raridadeDoMob: raridadeDoMob ?? undefined, boss, rng, ...(lootConfig ? { lootConfig } : {}) }));
  }
  return { entrada: { ato, dificuldade, itemId, slot, itemLevel: il, raridadeDoMob, boss, n: quantidade, semente, usouConfigProposta: !!lootConfig }, semBase, basesUsadas: escolha ? { atoDasBases: escolha.atoDasBases, bases: escolha.bases.length, fallback: escolha.fallback } : { fixa: Number(itemId) }, ...medir(itens, { limiarDeTier, minimoDeMods }),
    teorica: { raridade: distribuicaoDeRaridade({ ato, dificuldade, raridadeDoMob, boss, lootConfig }) } };
}

/** O mesmo cenário nas três dificuldades (mesma semente em cada uma). */
export function compararDificuldades(opcoes = {}) {
  const resultados = Object.fromEntries(P.DIFICULDADES.map((d) => [d, simular({ ...opcoes, dificuldade: d })]));
  return { opcoes, dificuldades: P.DIFICULDADES.map((d) => ({ id: d, nome: P.nomeDaDificuldade(d), ...resultados[d] })) };
}

/**
 * Simula ABATES de um monstro: cada entrada de loot do bestiário rola a chance real (× o fator de drop de equipamento da dificuldade); o que cai e rola atributos passa
 * pelo gerador. Devolve equipamentos por abate e as medidas dos equipamentos que caíram.
 */
export function simularMonstro({ monstro, ato = 1, dificuldade = 'facil', abates = 10000, semente = 1, itemLevel = null, lootConfig = null }) {
  const m = CATALOGO.bestiary[monstro];
  if (!m) return { ok: false, erro: `Monstro "${monstro}" não existe no bestiário.` };
  const rng = criarRng(semente);
  const il = itemLevel ?? itemLevelDoAto(ato);
  const abatesN = Math.max(1, Math.min(200000, Math.floor(Number(abates) || 0)));
  const equip = (m.loot ?? []).filter((l) => l.id != null && aceitaAtributos(l.id));
  const itens = [];
  for (let k = 0; k < abatesN; k++) {
    for (const l of equip) {
      const fator = lootConfig ? (lootConfig.chanceDeDrop ?? 1) : P.fatorDeDropDe(dificuldade, l.id);
      if (rng() >= l.chance * fator) continue;
      itens.push(gerarItem({ itemId: l.id, ato: P.estagioDeRaridadeDoAto(ato), dificuldade, itemLevel: il, rng, ...(lootConfig ? { lootConfig } : {}) }));
    }
  }
  return { ok: true, entrada: { monstro, nome: m.name, ato, dificuldade, abates: abatesN, semente, itemLevel: il }, basesDoLoot: equip.length, equipamentosPorAbate: itens.length / abatesN, ...medir(itens) };
}

/** Simula ABATES de uma hunt (criaturas dela sorteadas por igual). */
export function simularHunt({ huntId, ato = 1, dificuldade = 'facil', abates = 10000, semente = 1, itemLevel = null, lootConfig = null }) {
  const hunt = [...(CATALOGO.hunts ?? []), ...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])].find((h) => h.id === huntId);
  const criaturas = (hunt?.creatures ?? []).map((c) => c.key).filter((k) => CATALOGO.bestiary[k]);
  if (!criaturas.length) return { ok: false, erro: `Hunt "${huntId}" não existe ou não tem criaturas.` };
  const rng = criarRng(semente);
  const il = itemLevel ?? hunt.level ?? itemLevelDoAto(ato);
  const abatesN = Math.max(1, Math.min(200000, Math.floor(Number(abates) || 0)));
  const itens = [];
  for (let k = 0; k < abatesN; k++) {
    const key = criaturas[Math.floor(rng() * criaturas.length)];
    for (const l of (CATALOGO.bestiary[key].loot ?? []).filter((x) => x.id != null && aceitaAtributos(x.id))) {
      const fator = lootConfig ? (lootConfig.chanceDeDrop ?? 1) : P.fatorDeDropDe(dificuldade, l.id);
      if (rng() >= l.chance * fator) continue;
      itens.push(gerarItem({ itemId: l.id, ato: P.estagioDeRaridadeDoAto(ato), dificuldade, itemLevel: il, rng, ...(lootConfig ? { lootConfig } : {}) }));
    }
  }
  return { ok: true, entrada: { huntId, nome: hunt.name ?? huntId, ato, dificuldade, abates: abatesN, semente, itemLevel: il, criaturas: criaturas.length }, equipamentosPorAbate: itens.length / abatesN, ...medir(itens) };
}

export { ITEM_CATALOG };
