// Monta `gamedata/itens-poe/modificadores-monstro.json`: os MODIFICADORES DE MONSTRO do PoE (pedido do dono, 05/10) no formato do jogo, a partir da
// referência local extraída do poedb (`tools/extrair-poedb-modificadores-monstro.mjs`).
//   mods     — os 205 (87 Archnemesis + 118 MonsterMod): nome e linhas em português, o nível mínimo (o efetivo do PoE), o PESO em monstro Mágico e
//              em Raro (as spawn tags do PoE: `magic` para Mágico, `default`/`rare` para Raro) e os STATS traduzidos para os campos dos mobs do Draevor
//              (`mobs/raridade.statsDos`: vida, dano, velocidade, precisão, evasão, bloqueio, resistências, regeneração, crítico). O que não tem campo
//              no Draevor fica registrado (`estado`: 'efeito' = todos os stats valem; 'parcial'; 'registrado' = nenhum vale ainda).
//   ocultos  — o que cada RARIDADE de monstro ganha escondido (a seção "Hidden innate modifiers based on rarity"): vida, dano, velocidade de
//              ataque/conjuração (com a redução de dano que compensa), movimento e experiência.
// Uso: node tools/montar-modificadores-monstro-poe.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ORIGEM = '/home/deploy/referencias-poe/poedb/modificadores-monstro.json';
const DESTINO = new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url);

/** Stat do PoE → o que soma nos campos do mob do Draevor (`t`). `aprox` = aproximado (o Draevor não tem a mesma conta). */
const MAPA = {
  'damage +%': { f: (t, v) => (t.danoPct += v) },
  'physical damage +%': { f: (t, v) => (t.danoPct += v), aprox: true },
  'fire damage +%': { f: (t, v) => (t.danoPct += v / 2), aprox: true },
  'cold damage +%': { f: (t, v) => (t.danoPct += v / 2), aprox: true },
  'lightning damage +%': { f: (t, v) => (t.danoPct += v / 2), aprox: true },
  'chaos damage +%': { f: (t, v) => (t.danoPct += v / 2), aprox: true },
  'projectile damage +%': { f: (t, v) => (t.danoPct += v / 2), aprox: true },
  'physical damage % to add as fire': { f: (t, v) => (t.danoPct += v), aprox: true },
  'physical damage % to add as cold': { f: (t, v) => (t.danoPct += v), aprox: true },
  'physical damage % to add as lightning': { f: (t, v) => (t.danoPct += v), aprox: true },
  'physical damage % to add as random element': { f: (t, v) => (t.danoPct += v), aprox: true },
  'non chaos damage to add as chaos damage %': { f: (t, v) => (t.danoPct += v), aprox: true },
  'attack speed +%': { f: (t, v) => (t.velocidadeDeAtaquePct += v) },
  'base cast speed +%': { f: (t, v) => (t.velocidadeDeAtaquePct += v), aprox: true },
  'attack and cast speed +%': { f: (t, v) => (t.velocidadeDeAtaquePct += v) },
  'base movement velocity +%': { f: (t, v) => (t.velocidadePct += v) },
  'accuracy rating +%': { f: (t, v) => (t.precisaoPct += v) },
  'evasion rating +%': { f: (t, v) => (t.evasaoPct += v) },
  'maximum life +%': { f: (t, v) => (t.vidaPct += v) },
  'maximum life % to add as maximum energy shield': { f: (t, v) => (t.vidaPct += v), aprox: true },
  'life regeneration rate per minute %': { f: (t, v) => (t.regenPct += v / 60) },
  'monster base block %': { f: (t, v) => (t.bloqueio += v) },
  'base additional physical damage reduction %': { f: (t, v) => (t.resist.physical = (t.resist.physical ?? 0) + v), aprox: true },
  'base resist all elements %': { f: (t, v) => { for (const e of ['fire', 'ice', 'energy']) t.resist[e] = (t.resist[e] ?? 0) + v; } },
  'base fire damage resistance %': { f: (t, v) => (t.resist.fire = (t.resist.fire ?? 0) + v) },
  'base cold damage resistance %': { f: (t, v) => (t.resist.ice = (t.resist.ice ?? 0) + v) },
  'base lightning damage resistance %': { f: (t, v) => (t.resist.energy = (t.resist.energy ?? 0) + v) },
  'base chaos damage resistance %': { f: (t, v) => (t.resist.chaos = (t.resist.chaos ?? 0) + v) },
  'critical strike chance +%': { f: (t, v) => (t.critChance += Math.round((5 * v) / 100)), aprox: true }, // "aumentada" sobre os 5% de base
  'always crit': { f: (t) => (t.critChance += 100), aprox: true },
  'base damage taken +%': { f: (t, v) => (t.reducaoDeDano -= v) },
  // As doenças (ailments) que dão dano ao longo do tempo: viram o debuff no golpe dos mobs do Draevor (`mobs/mecanicas.aoAtacar`, `combate/dot.mjs`).
  'always ignite': { f: (t) => dot(t, 'fire') },
  'global poison on hit': { f: (t) => dot(t, 'earth') },
  'global bleed on hit': { f: (t) => dot(t, 'physical') },
  'ignite damage +%': { f: (t, v) => (dot(t, 'fire').mais += v) },
  'base poison damage +%': { f: (t, v) => (dot(t, 'earth').mais += v) },
  'bleeding damage +%': { f: (t, v) => (dot(t, 'physical').mais += v) },
  'ignite duration +%': { f: (t, v) => (dot(t, 'fire').duracao += v) },
  'base poison duration +%': { f: (t, v) => (dot(t, 'earth').duracao += v) },
  'base bleed duration +%': { f: (t, v) => (dot(t, 'physical').duracao += v) },
  'all damage can ignite': { f: () => {}, aprox: true },
  'all damage can poison': { f: () => {}, aprox: true },
};

/** O debuff de dano ao longo do tempo de um elemento (a base do PoE: queimadura 90% do golpe em 4 s; veneno 30% em 2 s; sangramento 70% em 5 s, em 25% dos golpes). */
const BASE_DO_DOT = { fire: { chance: 100, pct: 90, ms: 4000 }, earth: { chance: 100, pct: 30, ms: 2000 }, physical: { chance: 25, pct: 70, ms: 5000 } };
const dot = (t, el) => (t._dots[el] ??= { mais: 0, duracao: 0 });
function mecanicasDosDots(dots) {
  return Object.entries(dots)
    .filter(([el]) => BASE_DO_DOT[el])
    .map(([el, d]) => ({ gatilho: 'aoAtacar', efeito: 'debuff', elemento: el, chance: BASE_DO_DOT[el].chance, danoPctDoGolpe: Math.round(BASE_DO_DOT[el].pct * (1 + d.mais / 100)), duracaoMs: Math.round((BASE_DO_DOT[el].ms * (1 + d.duracao / 100)) / 1000) * 1000 }));
}

const vazio = () => ({ vidaPct: 0, danoPct: 0, velocidadePct: 0, velocidadeDeAtaquePct: 0, regenPct: 0, precisaoPct: 0, evasaoPct: 0, armaduraPct: 0, bloqueio: 0, reducaoDeDano: 0, critChance: 0, critMultiplicador: 0, resist: {}, _dots: {} });
const limpar = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== '_dots').filter(([k, v]) => (k === 'resist' ? Object.keys(v).length : v)).map(([k, v]) => [k, k === 'resist' ? v : Math.round(v * 100) / 100]));

/** Os stats do PoE → os do Draevor e o estado. */
export function traduzir(statsPoe) {
  const t = vazio();
  let valem = 0;
  let aprox = false;
  for (const s of statsPoe ?? []) {
    const m = MAPA[s.stat];
    if (!m) continue;
    m.f(t, (s.min + s.max) / 2);
    valem++;
    aprox ||= !!m.aprox;
  }
  const n = (statsPoe ?? []).length;
  // Só vira debuff a doença que o mod de fato causa (o "+% de dano de queimadura" sozinho não põe fogo em ninguém).
  const causa = new Set((statsPoe ?? []).map((s) => ({ 'always ignite': 'fire', 'global poison on hit': 'earth', 'global bleed on hit': 'physical' })[s.stat]).filter(Boolean));
  const mecanicas = mecanicasDosDots(Object.fromEntries(Object.entries(t._dots).filter(([el]) => causa.has(el))));
  return { stats: limpar(t), ...(mecanicas.length ? { mecanicas } : {}), estado: !n || !valem ? 'registrado' : valem === n ? (aprox ? 'aproximado' : 'efeito') : 'parcial', valem, total: n };
}

/** Os ocultos de uma raridade → `{ vidaMais, danoMais, velocidadeDeAtaquePct, velocidadePct, expMais }` (frações "a mais", multiplicativas). */
export function ocultosDe(lista) {
  const v = (stat) => lista.flatMap((x) => x.stats).find((s) => s.stat === stat)?.max ?? 0;
  const rapidez = v('monster rarity attack cast speed +% and damage -% final');
  return {
    vidaMais: v('monster life +% final from rarity') / 100,
    // O dano "a mais" da raridade, já com a compensação da velocidade (o PoE acelera o golpe e tira o mesmo do dano: o DPS sobe só pelo dano).
    danoMais: (1 + v('monster rarity damage +% final') / 100) / (1 + rapidez / 100) - 1,
    velocidadeDeAtaquePct: rapidez,
    velocidadePct: v('base movement velocity +%'),
    expMais: v('monster slain experience +%') / 100,
    quantidadeDoPoe: v('monster dropped item quantity +%'),
    raridadeDoPoe: v('monster dropped item rarity +%'),
  };
}

function principal() {
  if (!existsSync(ORIGEM)) throw new Error(`Sem a referência: rode antes node tools/extrair-poedb-modificadores-monstro.mjs (${ORIGEM}).`);
  const d = JSON.parse(readFileSync(ORIGEM, 'utf8'));
  // O que o dono editou no arquivo (chances do sorteio) sobrevive a montar de novo.
  const anterior = existsSync(DESTINO) ? JSON.parse(readFileSync(DESTINO, 'utf8')) : {};
  // Fora o que o poedb lista sem nome nem stat nenhum (1: um modificador de escaravelho vazio).
  const mods = d.mods.filter((m) => m.nome || m.nomeEn || m.stats?.length).map((m) => {
    const tr = traduzir(m.stats);
    const pesoRaro = m.pesos?.rare ?? m.pesos?.default ?? 0;
    const pesoMagico = m.pesos?.magic ?? m.pesos?.default ?? 0;
    // Sem id no poedb (3: Frostweaver, Hexer, Farrul's Wild Presence): o do nome em inglês. Sem linha visível (o efeito é só uma habilidade
    // do monstro, como o Ecoante): as ocultas, senão os stats do PoE.
    const id = m.id ?? `Sem_${String(m.nomeEn ?? m.nome).replace(/[^A-Za-z0-9]+/g, '_')}`;
    const linhas = m.linhas?.length ? m.linhas : m.ocultas?.length ? m.ocultas : m.stats?.length ? m.stats.map((x) => `${x.stat} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}`) : [m.nomeEn ?? m.nome];
    return { id, nome: m.nome, nomeEn: m.nomeEn, tipo: m.tipo, familia: m.familia ?? null, linhas, nivel: m.nivelEfetivo ?? m.nivel ?? 1, pesoMagico, pesoRaro, ...tr, statsPoe: m.stats };
  });
  const ocultos = Object.fromEntries(Object.entries(d.ocultos).map(([r, l]) => [r, ocultosDe(l)]));
  const saida = {
    _nota: 'Modificadores de monstro do PoE (poedb Monster_Modifiers; tools/montar-modificadores-monstro-poe.mjs). Só com ITENS_POE=1. Mágico: 1 sorteado; Raro: 2 a 4 (pelo peso, entre os de nível até o do monstro). Ocultos: o que cada raridade ganha sem aparecer (vida, dano, velocidade, experiência). A quantidade de itens do drop segue a regra do dono (regras.json), não a do PoE.',
    quantos: { magico: [1, 1], raro: [2, 4] },
    _sorteioDaRaridade: 'Chance de um monstro COMUM do PoE, nascido de spawn sem raridade, virar Mágico (modificado) ou Raro. Editável.',
    sorteioDaRaridade: anterior.sorteioDaRaridade ?? { modificado: 0.1, raro: 0.02 },
    _soComEfeito: 'true: só sorteia os modificadores que já valem algo no Draevor (estado diferente de registrado).',
    soComEfeito: anterior.soComEfeito ?? true,
    ocultos,
    mods,
  };
  writeFileSync(DESTINO, `${JSON.stringify(saida, null, 1)}\n`);
  const est = mods.reduce((o, m) => ({ ...o, [m.estado]: (o[m.estado] ?? 0) + 1 }), {});
  console.log(`${mods.length} modificadores (${mods.filter((m) => m.pesoMagico > 0).length} em Mágico, ${mods.filter((m) => m.pesoRaro > 0).length} em Raro) — ${Object.entries(est).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('ocultos:', JSON.stringify(ocultos));
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
