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
  // O escudo de energia do monstro: por cima da vida, com a recarga do PoE (`mobs/raridade.aplicar` → `esPoe`; `skills/estados.tique`).
  'maximum life % to add as maximum energy shield': { f: (t, v) => (t.esPct += v) },
  'energy shield delay -%': { f: (t, v) => (t.esAtrasoMenosPct += v) },
  // "Anti-Maldições" (Hexproof): os Feitiços (as maldições Hex) não pegam — a Marca, sim (`skills/reforcos.marcar`).
  hexproof: { f: (t) => (t.aProvaDeMaldicoes = 1) },
  // "100% de chance de Refletir Feitiços": o Feitiço posto nele volta para você (`skills/reforcos.marcar` → `condicoes-poe.amaldicoarJogador`).
  'reflect hexes chance %': { f: (t, v) => (t.refleteFeiticos += v) },
  // (11/10, a árvore: "X% mais Dano com Acertos contra Inimigos que não podem ter Vida Drenada deles") — o dreno de vida não pega nele
  // (`Ficha.aplicarLeech`, a tag `alvoSemDreno`).
  'cannot have life leeched from': { f: (t) => (t.semDreno = 1) },
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
  // (12/10 — dono: "ligar os modificadores" que a árvore combate) O que o monstro faz ao ACERTAR você — o golpe e a magia
  // (`mobs/mecanicas.aoAcertarJogador`, gatilho `aoAtacar`): Cegar, a Exposição, o Sangue Corrompido, o dreno de vida e as cargas.
  'global chance to blind on hit %': { f: (t, v) => (acerto(t).cegar.chance += v) },
  'blind effect +%': { f: (t, v) => (acerto(t).cegar.efeitoPct += v) },
  'base inflict fire exposure on hit % chance': { f: (t, v) => (acerto(t).exposicao.fire.chance += v) },
  'base inflict cold exposure on hit % chance': { f: (t, v) => (acerto(t).exposicao.ice.chance += v) },
  'base inflict lightning exposure on hit % chance': { f: (t, v) => (acerto(t).exposicao.energy.chance += v) },
  // ("Inflige Exposição a Fogo ao Acertar, aplicando −25% de Resistência a Fogo": em todo acerto, com o valor do texto.)
  'fire exposure on hit magnitude': { f: (t, v) => Object.assign(acerto(t).exposicao.fire, { chance: 100, pct: Math.abs(v) }) },
  'cold exposure on hit magnitude': { f: (t, v) => Object.assign(acerto(t).exposicao.ice, { chance: 100, pct: Math.abs(v) }) },
  'lightning exposure on hit magnitude': { f: (t, v) => Object.assign(acerto(t).exposicao.energy, { chance: 100, pct: Math.abs(v) }) },
  // (O Sangue Corrompido: o PoE renova a duração de todos os acúmulos a cada acerto; no jogo cada acúmulo tem a sua — aproximado.)
  'corrupted blood on hit duration': { f: (t, v) => (acerto(t).sangue.duracaoMs = v), aprox: true },
  'corrupted blood on hit num stacks': { f: (t, v) => (acerto(t).sangue.pilhas = v), aprox: true },
  'corrupted blood on hit % average damage to deal per minute per stack': { f: (t, v) => (acerto(t).sangue.pctPorMinuto = v), aprox: true },
  'life leech from any damage permyriad': { f: (t, v) => (acerto(t).dreno.pct = v / 100) },
  'life leech speed +%': { f: (t, v) => (acerto(t).dreno.velocidadePct += v) },
  'life leech does not stop at full life': { f: (t) => (acerto(t).dreno.naoParaNaVidaCheia = true) },
  // (o Vampírico — dono, 12/10: "igual no PoE") "Dano enquanto Drenando Vida aumentado em X%"; "Inimigos Não Podem Drenar Escudo de Energia
  // De Você" (o seu dreno de Escudo de Energia não pega nele — `mobs/mecanicas.semDrenoDeEs`).
  'damage +% while life leeching': { f: (t, v) => (acerto(t).dreno.danoPct += v) },
  'cannot have energy shield leeched from': { f: (t) => (acerto(t).semDrenoDeEs = true) },
  // (As cargas do monstro: o efeito por carga é o do personagem — o PoE não mostra o dos monstros; aproximado.)
  'add frenzy charge on skill hit %': { f: (t, v) => (acerto(t).frenesi += v), aprox: true },
  'gain endurance charge per second if have been hit recently': { f: (t, v) => (acerto(t).toleranciaPorSegundo += v), aprox: true },
};

/** O debuff de dano ao longo do tempo de um elemento (a base do PoE: queimadura 90% do golpe em 4 s; veneno 30% em 2 s; sangramento 70% em 5 s, em 25% dos golpes). */
const BASE_DO_DOT = { fire: { chance: 100, pct: 90, ms: 4000 }, earth: { chance: 100, pct: 30, ms: 2000 }, physical: { chance: 25, pct: 70, ms: 5000 } };
const dot = (t, el) => (t._dots[el] ??= { mais: 0, duracao: 0 });
function mecanicasDosDots(dots) {
  return Object.entries(dots)
    .filter(([el]) => BASE_DO_DOT[el])
    .map(([el, d]) => ({ gatilho: 'aoAtacar', efeito: 'debuff', elemento: el, chance: BASE_DO_DOT[el].chance, danoPctDoGolpe: Math.round(BASE_DO_DOT[el].pct * (1 + d.mais / 100)), duracaoMs: Math.round((BASE_DO_DOT[el].ms * (1 + d.duracao / 100)) / 1000) * 1000 }));
}

const vazio = () => ({ vidaPct: 0, danoPct: 0, velocidadePct: 0, velocidadeDeAtaquePct: 0, regenPct: 0, precisaoPct: 0, evasaoPct: 0, armaduraPct: 0, bloqueio: 0, reducaoDeDano: 0, critChance: 0, critMultiplicador: 0, esPct: 0, esAtrasoMenosPct: 0, aProvaDeMaldicoes: 0, refleteFeiticos: 0, semDreno: 0, resist: {}, _dots: {} });
const limpar = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== '_dots' && k !== '_acerto').filter(([k, v]) => (k === 'resist' ? Object.keys(v).length : v)).map(([k, v]) => [k, k === 'resist' ? v : Math.round(v * 100) / 100]));

/** O que o monstro faz ao acertar (12/10): os acumuladores dos stats do PoE, que viram as mecânicas `aoAtacar` (e a Tolerância por segundo, `aoReceberDano`). */
const acerto = (t) => (t._acerto ??= {
  cegar: { chance: 0, efeitoPct: 0 }, exposicao: { fire: { chance: 0, pct: 10 }, ice: { chance: 0, pct: 10 }, energy: { chance: 0, pct: 10 } },
  sangue: { duracaoMs: 4000, pilhas: 1, pctPorMinuto: 0 }, dreno: { pct: 0, velocidadePct: 0, naoParaNaVidaCheia: false, danoPct: 0 }, frenesi: 0, toleranciaPorSegundo: 0, semDrenoDeEs: false,
});
function mecanicasDoAcerto(a) {
  if (!a) return [];
  const m = [];
  if (a.cegar.chance > 0) m.push({ gatilho: 'aoAtacar', efeito: 'cegar', chance: Math.min(100, a.cegar.chance), ...(a.cegar.efeitoPct ? { efeitoPct: a.cegar.efeitoPct } : {}) });
  for (const [elemento, x] of Object.entries(a.exposicao)) if (x.chance > 0) m.push({ gatilho: 'aoAtacar', efeito: 'exposicao', elemento, chance: Math.min(100, x.chance), pct: x.pct });
  if (a.sangue.pctPorMinuto > 0) m.push({ gatilho: 'aoAtacar', efeito: 'sangueCorrompido', chance: 100, pctPorMinuto: a.sangue.pctPorMinuto, duracaoMs: a.sangue.duracaoMs, pilhas: a.sangue.pilhas });
  if (a.dreno.pct > 0) m.push({ gatilho: 'aoAtacar', efeito: 'drenar', chance: 100, pct: a.dreno.pct, ...(a.dreno.velocidadePct ? { velocidadePct: a.dreno.velocidadePct } : {}), ...(a.dreno.naoParaNaVidaCheia ? { naoParaNaVidaCheia: true } : {}), ...(a.dreno.danoPct ? { danoDrenandoPct: a.dreno.danoPct } : {}) });
  if (a.frenesi > 0) m.push({ gatilho: 'aoAtacar', efeito: 'carga', carga: 'frenesi', chance: Math.min(100, a.frenesi) });
  if (a.toleranciaPorSegundo > 0) m.push({ gatilho: 'aoReceberDano', efeito: 'carga', carga: 'tolerancia', porSegundo: a.toleranciaPorSegundo });
  if (a.semDrenoDeEs) m.push({ gatilho: 'aoReceberDano', efeito: 'semDrenoDeEs' });
  return m;
}

/**
 * Os modificadores SEM stat no poedb cujo efeito é uma habilidade do monstro: o "Amaldiçoa" (Cursing — o monstro amaldiçoa quem ele acerta:
 * Fraqueza Elemental, Vulnerabilidade ou Enfraquecer, sempre a mesma por monstro — `mobs/mecanicas.aoAtacar`). Aproximado: o PoE não diz a
 * maldição nem o nível; vale a gema no nível mais baixo (`condicoes-poe.MALDICOES_DOS_MONSTROS`).
 */
const HABILIDADES = {
  // (lote 70 — dono, 17/10: "Implementar os 2 solos") os SOLOS ao morrer (`mobs/mecanicas.criarSolo`): o poedb ("Burns Ground on Death": 6000 ms,
  // raio 16 = 1,6 m, 3750% do dano máximo por minuto = 62,5%/s) e, no Eletrizado, os 20% fixos do Solo Eletrizado (a wiki do PoE)
  MonsterModBurningGroundOnDeath: { mecanicas: [{ gatilho: 'aoMorrer', efeito: 'solo', solo: 'ardente', duracaoMs: 6000, raioMetros: 1.6, dpsPctDoGolpe: 62.5 }], linhas: ['Deixa Solo Ardente ao Morrer'] },
  MonsterModBurningGroundOnDeathSanctum: { mecanicas: [{ gatilho: 'aoMorrer', efeito: 'solo', solo: 'ardente', duracaoMs: 6000, raioMetros: 1.6, dpsPctDoGolpe: 62.5 }], linhas: ['Deixa Solo Ardente ao Morrer'] },
  MonsterModShockedGroundOnDeath: { mecanicas: [{ gatilho: 'aoMorrer', efeito: 'solo', solo: 'eletrizado', duracaoMs: 6000, raioMetros: 1.6, danoRecebidoPct: 20 }], linhas: ['Deixa Solo Eletrizado ao Morrer'] },
  MonsterModHexingEffigy: { mecanicas: [{ gatilho: 'aoAtacar', efeito: 'maldicao', chance: 100, maldicoes: ['fraquezaElemental', 'vulnerabilidade', 'enfraquecer'], duracaoMs: 6000 }], linhas: ['Amaldiçoa com Fraqueza Elemental, Vulnerabilidade ou Enfraquecer ao Acertar'] },
};

/**
 * (11/10) Os modificadores cuja IDENTIDADE ainda não existe no jogo: um stat menor que já vale não liga o modificador (ele apareceria com o
 * nome e quase sem efeito). (12/10 — dono: "igual no PoE": o Vampírico, o monstro que DRENA vida, saiu daqui — o dreno dos monstros, o dano
 * a mais enquanto drena e o "não pode ter Escudo de Energia drenado" existem agora, `mobs/mecanicas`.)
 */
const SEM_A_IDENTIDADE = new Set();
/** O poedb escreve "Seus Acertos empre Incendeiam/Eletrizam" (sem o s): a linha sai certa. */
const corrigirTexto = (l) => String(l).replace(/\bempre\b/g, 'sempre');

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
  const mecanicas = [...mecanicasDosDots(Object.fromEntries(Object.entries(t._dots).filter(([el]) => causa.has(el)))), ...mecanicasDoAcerto(t._acerto)];
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
    const hab = HABILIDADES[m.id];
    const tr = hab ? { stats: {}, mecanicas: hab.mecanicas, estado: 'aproximado', valem: 1, total: 1 } : SEM_A_IDENTIDADE.has(m.id) ? { stats: {}, estado: 'registrado', valem: 0, total: (m.stats ?? []).length } : traduzir(m.stats);
    const pesoRaro = m.pesos?.rare ?? m.pesos?.default ?? 0;
    const pesoMagico = m.pesos?.magic ?? m.pesos?.default ?? 0;
    // Sem id no poedb (3: Frostweaver, Hexer, Farrul's Wild Presence): o do nome em inglês. Sem linha visível (o efeito é só uma habilidade
    // do monstro, como o Ecoante): as ocultas, senão os stats do PoE.
    const id = m.id ?? `Sem_${String(m.nomeEn ?? m.nome).replace(/[^A-Za-z0-9]+/g, '_')}`;
    const linhas = (hab?.linhas ?? (m.linhas?.length ? m.linhas : m.ocultas?.length ? m.ocultas : m.stats?.length ? m.stats.map((x) => `${x.stat} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}`) : [m.nomeEn ?? m.nome])).map(corrigirTexto);
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
    _expPorRaridade: 'A EXPERIÊNCIA do monstro pela raridade (regra do dono, 06/10): multiplica a exp base — Mágico ×3, Raro ×5, Único ×5 (o Elite conta como Raro; o Chefe como Único). Manda no lugar do "exp" dos ocultos do PoE. Os únicos do PoE (Hillock, Brutus...) já trazem a exp própria nos dados e não passam por aqui.',
    expPorRaridade: anterior.expPorRaridade ?? { magico: 3, raro: 5, unico: 5 },
    ocultos,
    mods,
  };
  writeFileSync(DESTINO, `${JSON.stringify(saida, null, 1)}\n`);
  const est = mods.reduce((o, m) => ({ ...o, [m.estado]: (o[m.estado] ?? 0) + 1 }), {});
  console.log(`${mods.length} modificadores (${mods.filter((m) => m.pesoMagico > 0).length} em Mágico, ${mods.filter((m) => m.pesoRaro > 0).length} em Raro) — ${Object.entries(est).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log('ocultos:', JSON.stringify(ocultos));
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
