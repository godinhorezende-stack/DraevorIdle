// O LOTE R3D das gemas do PoE (27/10: as parciais mais difíceis que sobraram — os totens, as armadilhas e o resto das ativas). Aqui ficam os DADOS (o que as linhas
// dizem no nível e na qualidade, os números do PoB) e as contas PURAS (sem a caçada); quem usa é gemas-poe.mjs (o status), suportes-poe.mjs (as linhas do Chuva Ardente),
// lacaios-poe.mjs (as habilidades com recarga dos lacaios), acoes.mjs (o uso, a invocação, as plantadas), cacadas.mjs (o tique dos lacaios), hunt/monstros.mjs e
// hunt/combate.mjs (a provocação do Chamariz) e armas-plantadas.mjs (a Mina de Fumaça na Sequência de Detonação).
//
// O que o lote faz (o PoB, /home/deploy/referencias-poe/pob; na falta, o poedb salvo):
//   - o TOTEM CHAMARIZ (act_str.lua DecoyTotem — "Summons a totem that taunts nearby monsters to attack it"; radius 60): enquanto vive, os monstros a até 6 m dele
//     (× √ da Área — "Now works with Area of Effect support gems", o wiki) ficam PROVOCADOS por ele: andam até ele e batem nele, não em você (o golpe deles no ritmo de
//     sempre, não o "um golpe a cada ~2 s" dos colados num lacaio). A provocação renova a cada tique e dura `CHAMARIZ.provocacaoMs` depois que o monstro sai do raio (ou o
//     totem morre) — o PoE não publica o pulso da provocação do totem (escolha registrada). As magias do monstro provocado não saem em você (ele mira o totem);
//     o chefe único segue com os comportamentos próprios dele;
//   - a BALISTA DE ARTILHARIA e as alternativas (act_dex.lua ArtilleryBallista/AltX/AltY — "The arrows impact the ground in a line, each dealing area damage";
//     `OneShotProj`: cada inimigo leva um acerto só): as flechas caem em LINHA, centrada no alvo, na direção do totem ao alvo (a do Fogo Cruzado: em duas linhas
//     perpendiculares que se cruzam no alvo — metade em cada, a primeira com a sobra; a do Fogo Concentrado: até N flechas, cada uma num inimigo diferente ao alcance do
//     totem, os mais perto do alvo primeiro). O PoE não publica o raio do impacto nem o espaço entre as flechas (escolha registrada): cada flecha pega a casa onde cai
//     (2 m — "1 casa por flecha"), espaçadas de 1 casa; a Área de Efeito cresce o impacto (`raioDoImpacto`: 2 m × (√ da Área − 1) a mais, em casas, a fração como chance);
//   - a ARMADILHA CONVERSORA (act_int.lua ConversionTrap; o wiki): o inimigo que a ativa (Normal, Mágico ou Raro — não o Único nem o chefe) vira seu ALIADO pela duração
//     da habilidade (a Duração da Habilidade vale): sai dos inimigos e luta por você com o golpe corpo a corpo dele, a vida dele e as afecções que já tinha; não é lacaio
//     (os modificadores de lacaio não valem nele — "not counted as minions"); no fim volta a ser inimigo com a vida que sobrou, onde estiver;
//   - o CHUVA ARDENTE (Flamewood — não está no PoB; o poedb): o totem suportado ganha a Vingança Flamejante — quando um inimigo o acerta (golpe ou magia), ela cai no
//     atacante: Fogo base igual a X% da Vida Máxima do totem, numa área de "O raio Base é de X metros" (× √ da Área), recarga 1 s, 5% de crítico; é magia de área do
//     totem (os seus modificadores de Dano Mágico, de Fogo e de Área valem, e os suportes da habilidade que a suportariam — a magia ativada do jogo, `magiaAtivadaS2B`);
//   - o GOLEM CAÓTICO (Minions.lua SummonedChaosGolem; minion.lua): a Cascata (magia de área, 6 espinhos, Físico convertido em Caos, recarga 3 s, 5% de crítico) e a
//     Aura Caótica (Caos por segundo em área por 5 s, raio +20%, recarga 8 s); o do TURBILHÃO usa a Aura Caótica POTENCIALIZADA (8 s, raio +50%, os inimigos nela sofrem
//     6% mais Dano de Caos e são Definhados — o Definhamento não expira enquanto a aura dura) e não a Cascata ("can cast a powerful damage over time Chaos aura that
//     Withers enemies in addition to its melee attack"); o "Lacaios têm efeito de definhamento aumentado em X%" vale nesse Definhamento. O PoB não publica o raio-base
//     da aura (escolha registrada: o raio da aura de lacaio do jogo, 2 casas, × √ do "+X% final");
//   - o RASTEJADOR do Arauto da Agonia (Minions.lua HeraldOfAgonySpiderPlated; minion.lua): o MORTEIRO (6 projéteis distribuídos pelos inimigos ao alcance, cada um com
//     dano em área — × 0,4, raio +20% —, recarga 7,5 s) e o ESPINHO DA CAUDA (o ataque de longe: 1 + 4 projéteis em inimigos diferentes, no tempo do ataque dele, 1,3 s);
//     colado num inimigo, o golpe de perto de sempre;
//   - a MINA DE FUMAÇA (act_dex.lua SmokeMine): detonada, teleporta você para ela; a nuvem de fumaça (radius 18 = 1,8 m) nas duas pontas Cega os inimigos dentro dela
//     enquanto ela dura (`base_secondary_skill_effect_duration` 1 s; a Cegueira, a duração de sempre do jogo — 4 s); o buff de "Velocidade de Movimento aumentada" pela
//     duração da habilidade (os aumentos da Duração de Minas também valem nele); "Somente uma Mina deste tipo pode ser Detonada em cada Sequência" (disable_mine_detonation
//     _cascade) e "Detonação da Mina é Instantânea" (mine_detonates_instantly).

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re, g = 1) => (linhas ?? []).reduce((n, l) => { const m = re.exec(norm(l)); return n + (m ? Number(m[g]) : 0); }, 0);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Metros em casas (1 casa = 2 m): a parte inteira e a fração como chance de uma casa a mais. */
export const casasDosMetros = (m, rng = Math.random) => { const c = Math.max(0, Number(m) || 0) / 2; return Math.floor(c) + (rng() < c % 1 ? 1 : 0); };

// ---------------------------------------------------------------- as LINHAS que o lote faz (o status)

const LINHAS_R3D = {
  Smoke_Mine: [/^Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação$/i, /^Detonação da Mina é Instantânea$/i, /^Buff concede Velocidade de Movimento aumentada em [\d.]+ ?%$/i, /^Duração Base Secundária é de [\d.]+ segundos?$/i, /^Aumentos e Reduções a Duração de Minas também são aplicados à Duração do Buff desta Habilidade$/i],
  'Summon_Chaos_Golem_of_the_Maelstr%C3%B6m': [/^Lacaios têm efeito de definhamento aumentado em [\d.]+ ?%$/i],
  Artillery_Ballista_of_Cross_Strafe: [/^Flechas caem em duas linhas perpendiculares$/i],
  Artillery_Ballista_of_Focus_Fire: [/^Dispara até \d+ Flechas em alvos diferentes$/i],
};
/** A linha `l` da gema `slug` é feita pelo lote R3D? */
export const ehLinhaR3D = (slug, l) => !!LINHAS_R3D[slug]?.some((re) => re.test(norm(l)));
/** As gemas sem dano direto cujo efeito é o do lote (o status não as marca "sem dano direto"). */
export const EFEITO_SEM_DANO_R3D = new Set(['Conversion_Trap', 'Smoke_Mine']);

// ---------------------------------------------------------------- o Totem Chamariz

export const CHAMARIZ = Object.freeze({ re: /^Decoy_Totem$/, raioM: 6, provocacaoMs: 1000 });
export const ehChamariz = (slug) => CHAMARIZ.re.test(String(slug ?? ''));
/** O raio da provocação em casas (os 6 m × √ da Área de Efeito, ÷ 2; a fração é a chance de uma casa a mais — sorteada ao pôr o totem). */
export const raioDoChamariz = (fatorDaArea = 1, rng = Math.random) => casasDosMetros(CHAMARIZ.raioM * Math.sqrt(Math.max(0, fatorDaArea)), rng);
/**
 * O PULSO da provocação do Chamariz `l` (vivo, com `l.provocaR3D.raio`): os monstros vivos do mesmo andar a até o raio ficam provocados por ele (`estados.provocado` com
 * `alvoUid` — o totem —, `deLacaio`: não é "por você"), por `provocacaoMs` a partir de agora. Devolve os que ficaram provocados agora (para o evento).
 */
export function provocarEmVolta(monstros, l, z, agora) {
  const novos = [];
  if (!l?.provocaR3D || !(l.hp > 0)) return novos;
  for (const m of monstros ?? []) {
    if (!(m.hp > 0) || m.dummy || (m.z ?? z ?? 0) !== (l.z ?? z ?? 0) || cheb(m, l) > l.provocaR3D.raio) continue;
    const e = (m.estados ??= {});
    const ja = e.provocado?.alvoUid === l.uid && e.provocado.ate > agora;
    e.provocado = { ate: agora + CHAMARIZ.provocacaoMs, por: l.nome ?? 'Totem Chamariz', deLacaio: true, alvoUid: l.uid };
    if (!ja) novos.push(m);
  }
  return novos;
}
/** O totem que provoca o monstro `m` agora (vivo, no mesmo andar), ou null. */
export function iscaDoMonstro(hunt, m, agora = hunt?.clock ?? 0) {
  const p = m?.estados?.provocado;
  if (!p?.alvoUid || !(p.ate > agora)) return null;
  const l = (hunt?.lacaios ?? []).find((x) => x.uid === p.alvoUid);
  return l && l.hp > 0 && (l.z ?? hunt.z ?? 0) === (m.z ?? hunt.z ?? 0) ? l : null;
}
/** O passo do monstro até a isca: a casa vizinha (das `vizinhas`, já filtradas por andável e livre) que mais o aproxima dela; null se nenhuma aproxima. */
export function passoAteAIsca(m, isca, vizinhas) {
  let melhor = null;
  let d = cheb(m, isca);
  for (const v of vizinhas ?? []) { const dv = cheb(v, isca); if (dv < d) { d = dv; melhor = v; } }
  return melhor;
}

// ---------------------------------------------------------------- a Balista de Artilharia

export const ARTILHARIA = /^Artillery_Ballista(?:_of_(Cross_Strafe|Focus_Fire))?$/;
/** A forma da queda das flechas: 'linha', 'cruz' (o Fogo Cruzado) ou 'foco' (o Fogo Concentrado); null se não é a Balista de Artilharia. */
export function formaDaArtilharia(slug) {
  const m = ARTILHARIA.exec(String(slug ?? ''));
  if (!m) return null;
  return m[1] === 'Cross_Strafe' ? 'cruz' : m[1] === 'Focus_Fire' ? 'foco' : 'linha';
}
const LINHA_FLECHAS = /^Dispara (?:até )?(\d+) Flechas?(?: em alvos diferentes)?$/i;
/** As flechas-base da gema pelas linhas do nível (6; o Fogo Concentrado, "até 5") — os adicionais (a qualidade, os suportes, as peças) somam por fora. */
export const flechasDaArtilharia = (linhas = []) => achar(linhas, LINHA_FLECHAS) ?? 0;
/** O raio do impacto de uma flecha em casas: 0 (a casa onde cai) + 2 m × (√ da Área − 1) a mais, em casas (a fração como chance). */
export function raioDoImpacto(fatorDaArea = 1, rng = Math.random) {
  const extra = (2 * (Math.sqrt(Math.max(0, fatorDaArea)) - 1)) / 2;
  if (!(extra > 0)) return 0;
  return Math.floor(extra) + (rng() < extra % 1 ? 1 : 0);
}
const passoDe = (de, para) => { const dx = Math.sign(para.x - de.x); const dy = Math.sign(para.y - de.y); return dx || dy ? [dx, dy] : [1, 0]; };
/** As casas de `n` flechas numa linha centrada em `c` com o passo `[dx, dy]` (1 casa entre elas; a sobra vai para a frente). */
const linhaCentrada = (c, [dx, dy], n) => Array.from({ length: Math.max(0, n) }, (_, k) => { const i = k - Math.floor((n - 1) / 2); return { x: c.x + dx * i, y: c.y + dy * i }; });
/**
 * Onde as `n` flechas caem: na 'linha', centradas no alvo na direção do totem (`origem`) ao alvo; na 'cruz', metade em cada uma das duas linhas perpendiculares que se
 * cruzam no alvo; no 'foco', uma em cada inimigo vivo diferente a até `alcance` casas do totem (os mais perto do alvo primeiro — o alvo é o primeiro), até `n`.
 */
export function impactosDaArtilharia(forma, origem, alvo, n, { vivos = [], alcance = 4 } = {}) {
  if (!alvo || !(n > 0)) return [];
  if (forma === 'foco') {
    const cands = vivos.filter((b) => b.hp > 0 && !b.dummy && cheb(origem, b) <= alcance && (b.z ?? alvo.z ?? 0) === (alvo.z ?? 0));
    const ord = [...new Set([alvo, ...cands.sort((a, b) => cheb(alvo, a) - cheb(alvo, b))])].filter((b) => b.hp > 0);
    return ord.slice(0, n).map((b) => ({ x: b.x, y: b.y }));
  }
  const p = passoDe(origem, alvo);
  if (forma === 'cruz') {
    const a = Math.ceil(n / 2);
    return [...linhaCentrada(alvo, p, a), ...linhaCentrada(alvo, [-p[1], p[0]], n - a)];
  }
  return linhaCentrada(alvo, p, n);
}
/** Os atingidos das flechas (cada inimigo UMA vez — `OneShotProj`) e as casas de todos os impactos (para a tela). */
export function atingidosDaArtilharia(impactos, raio, vivos) {
  const casas = new Map();
  const unicos = new Set();
  for (const c of impactos) {
    for (let dx = -raio; dx <= raio; dx++) for (let dy = -raio; dy <= raio; dy++) casas.set(`${c.x + dx},${c.y + dy}`, { x: c.x + dx, y: c.y + dy });
    for (const b of vivos) if (b.hp > 0 && !b.dummy && cheb(b, c) <= raio) unicos.add(b);
  }
  return { atingidos: [...unicos], casas: [...casas.values()] };
}

// ---------------------------------------------------------------- a Armadilha Conversora

export const CONVERSORA = /^Conversion_Trap$/;
export const ehConversora = (slug) => CONVERSORA.test(String(slug ?? ''));
/** O monstro pode ser convertido (Normal, Mágico ou Raro: não o Único, o chefe, o boneco nem o morto)? */
export function podeConverter(m) {
  if (!m || !(m.hp > 0) || m.dummy || m.boss || m.chefe || m.isBoss || m.chefeDoMapa) return false;
  return !/unico|boss/.test(String(m.raridade ?? m.raridadePoe ?? ''));
}
/**
 * O ALIADO da conversão: o lacaio do jogo (a IA do familiar) com o desenho, a vida e o golpe corpo a corpo do monstro (`golpe`: `{ min, max }`; `intervaloMs`: o do golpe
 * dele), pela `duracaoMs`; `convertido.monstro` guarda o monstro para voltar (`devolverConvertido`). Sem `poe`: os modificadores de lacaio não valem nele.
 */
export function aliadoDaConversao(m, { uid, acao, agora, duracaoMs, golpe, intervaloMs }) {
  return {
    uid, gema: 'Conversion_Trap', acao, tipo: 'convertido', nome: m.nome ?? m.name ?? 'Convertido', nivel: m.level ?? m.nivel ?? 1, desde: agora,
    x: m.x, y: m.y, z: m.z, dir: m.dir ?? 2, look: m.look, lookItem: m.lookItem ?? 0, colors: m.colors ?? null,
    hp: m.hp, maxHp: m.maxHp ?? m.hp, dano: { min: Math.max(0, golpe?.min ?? 1), max: Math.max(golpe?.min ?? 1, golpe?.max ?? 1) }, elemento: 'physical', intervaloMs: Math.max(250, intervaloMs ?? 2000),
    ate: agora + Math.max(0, duracaoMs), duracaoMs, perto: 2, alcance: 0, alcanceDeAtaque: 1, proximoGolpe: agora + 400, proximoPassoEm: 0,
    estilo: null, velAtaquePct: 0, critChance: 5, critMult: 1.5, somado: [0, 0], sangrar: 0, afDono: null, porLacaioFisico: null, golem: false, acertos: 0, poe: null,
    convertido: { monstro: m },
  };
}
/** O monstro de volta do aliado `l` (a vida que sobrou e a casa onde está), ou null (morreu como aliado). */
export function devolverConvertido(l) {
  const m = l?.convertido?.monstro;
  if (!m || !(l.hp > 0)) return null;
  Object.assign(m, { hp: Math.min(l.hp, m.maxHp ?? l.hp), x: l.x, y: l.y, perseguindo: true });
  return m;
}

// ---------------------------------------------------------------- o Chuva Ardente (Flamewood)

export const VINGANCA = Object.freeze({ recargaMs: 1000, critBase: 5, eficacia: 1, tags: ['magia', 'area', 'fogo', 'projetil', 'totem'] });
/** As linhas próprias do Chuva Ardente (o efeito do suporte: `vingancaR3D`, `vingancaPct`, `vingancaRaioM`). */
export const PROPRIAS_R3D = {
  Flamewood_Support: [
    [/^Totens das Habilidades Suportadas ganham a Habilidade(?:\\n|\s)+Vingança Flamejante e a Ativa quando Acertado por um Inimigo$/i, (m, e) => { e.vingancaR3D = 1; }],
    [/^Totens com esta Habilidade a Ativam quando Acertados por um Inimigo$/i, (m, e) => { e.vingancaR3D = 1; }],
    [/^Causa Dano de Fogo base igual a ([\d.]+) ?% da Vida Máxima dos Totens$/i, (m, e) => { e.vingancaPct = Number(m[1]); }],
    [/^O raio Base é de ([\d.]+) metros?$/i, (m, e) => { e.vingancaRaioM = Number(m[1]); }],
  ],
};
/** A Vingança Flamejante que o efeito dos suportes dá ao totem (`{ pct, raioM }`), ou null. */
export const vingancaDoEfeito = (efeito) => (efeito?.vingancaR3D && efeito.vingancaPct > 0 ? { pct: efeito.vingancaPct, raioM: efeito.vingancaRaioM ?? 1.3 } : null);
/** A Vingança do totem `l` está pronta (fora da recarga)? Se estiver, marca a recarga e devolve o dano de Fogo base (X% da Vida máxima dele); senão, 0. */
export function dispararVinganca(l, agora) {
  const v = l?.vingancaR3D;
  if (!v || !(v.pct > 0) || (v.prontaEm ?? -Infinity) > agora) return 0;
  v.prontaEm = agora + VINGANCA.recargaMs;
  return ((l.maxHp ?? 0) * v.pct) / 100;
}

// ---------------------------------------------------------------- o Golem Caótico e o Rastejador (as habilidades com recarga)

/** O raio-base das auras caóticas do golem (o PoB não publica — o raio da aura de lacaio do jogo, 2 casas). */
export const RAIO_DA_AURA_CAOTICA = 2;
const GOLEM_CAOTICO = {
  cascata: { id: 'ChaosElementalCascadeSummoned', nome: 'Cascata', tipo: 'cascataCaotica', recargaMs: 3000, usos: 1, crit: 5, base: [0.8, 1.2], baseEf: 1.3650000095367, incEf: 0.040600001811981, alcance: 4, espinhos: 6 },
  aura: { id: 'SandstormChaosElementalSummoned', nome: 'Aura Caótica', tipo: 'auraCaotica', recargaMs: 8000, usos: 1, porMinuto: 16.666667039196, baseEf: 6.1421999931335, incEf: 0.052099999040365, duracaoMs: 5000, raioMaisPct: 20, alcance: 2 },
  potencializada: { id: 'SandstormChaosElementalSummonedEmpowered', nome: 'Aura Caótica Potencializada', tipo: 'auraCaotica', recargaMs: 8000, usos: 1, porMinuto: 16.666667039196, baseEf: 19.89999961853, incEf: 0.052099999040365, duracaoMs: 8000, raioMaisPct: 50, caosSofridoPct: 6, definha: true, alcance: 2 },
};
const RASTEJADOR = [
  { id: 'HeraldOfAgonyMinionMortar', nome: 'Morteiro', tipo: 'morteiro', recargaMs: 7500, usos: 1, mult: 0.4, projeteis: 6, raioMaisPct: 20, alcance: 3 },
  // (correções R3, achado 21 — o PoB, minion.lua HeraldOfAgonyMinionTailSpike: sem cooldown, castTime 1,3 s) o Espinho é um ATAQUE: os 1,3 s ÷ a Velocidade de Ataque do lacaio
  // (`porVelocidade` — `cacadas.habilidadesComRecarga`), não a Recuperação de Recarga
  { id: 'HeraldOfAgonyMinionTailSpike', nome: 'Espinho da Cauda', tipo: 'espinho', recargaMs: 1300, usos: 1, mult: 1, projeteis: 5, alcance: 5, deLonge: true, porVelocidade: true },
];
/** A eficácia de uma magia de lacaio do PoB no nível `n` (statInterpolation 3 — a mesma de `LacaiosPoe.eficaciaDaMagiaDoPob`). */
const eficacia = (n, baseEf, incEf) => (3.885209 + 0.360246 * (Math.max(1, n) - 1)) * baseEf * (1 + incEf) ** (Math.max(1, n) - 1);
/**
 * As habilidades com recarga do lote para o lacaio (`slug` da gema, `pobId` do lacaio no PoB, `n` o nível dele), com os números prontos — ou null. O golem caótico comum e o
 * das Hordas: a Cascata e a Aura Caótica; o do Turbilhão: só a Potencializada (com o `definhaPct` da qualidade). O Rastejador: o Morteiro e o Espinho da Cauda.
 */
export function recargasDoLacaio(slug, pobId, n, { definhaPct = 0 } = {}) {
  if (pobId === 'SummonedChaosGolem') {
    const lista = /Maelstr/.test(String(slug ?? '')) ? [GOLEM_CAOTICO.potencializada] : [GOLEM_CAOTICO.cascata, GOLEM_CAOTICO.aura];
    return lista.map((h) => {
      const ef = eficacia(n, h.baseEf, h.incEf);
      return { ...h, ...(h.base ? { dano: [Math.round(h.base[0] * ef), Math.round(h.base[1] * ef)] } : {}), ...(h.porMinuto ? { porSegundo: (h.porMinuto * ef) / 60 } : {}), ...(h.definha ? { definhaPct } : {}) };
    });
  }
  if (pobId === 'HeraldOfAgonySpiderPlated') return RASTEJADOR.map((h) => ({ ...h }));
  return null;
}
/** O raio de uma aura caótica em casas (o raio-base × √ do "+X% final" e da Área do lacaio). */
export const raioDaAuraCaotica = (h, fatorDaArea = 1) => RAIO_DA_AURA_CAOTICA * Math.sqrt(Math.max(0, (1 + (h?.raioMaisPct ?? 0) / 100) * fatorDaArea));
/** Os `n` projéteis distribuídos pelos inimigos `alvos` (em rodízio, a começar pelo primeiro): a lista de alvos de cada projétil. */
export const distribuir = (alvos, n) => (alvos.length ? Array.from({ length: Math.max(0, n) }, (_, i) => alvos[i % alvos.length]) : []);
/**
 * O Definhamento da aura caótica potencializada no monstro: +1 acúmulo (até 15) a cada `cadaMs`, sem expirar enquanto a aura dura (até `ate` + 2 s); `extraPct`: o
 * "efeito de definhamento aumentado" dos lacaios (o maior vale). Devolve true se acumulou.
 */
export function definharNaAura(m, { ate, agora, extraPct = 0, cadaMs = 1000 }) {
  const e = (m.estados ??= {});
  const d = e.definhado?.ate > agora ? e.definhado : null;
  const vence = Math.max(d?.ate ?? 0, ate + 2000);
  if (d && (d.r3dEm ?? -Infinity) + cadaMs > agora) { d.ate = vence; d.efeitoExtraPct = Math.max(d.efeitoExtraPct ?? 0, extraPct); return false; }
  e.definhado = { ate: vence, n: Math.min(15, (d?.n ?? 0) + 1), r3dEm: agora, efeitoExtraPct: Math.max(d?.efeitoExtraPct ?? 0, extraPct) };
  return true;
}

// ---------------------------------------------------------------- a Mina de Fumaça

export const FUMACA = Object.freeze({ re: /^Smoke_Mine$/, raioM: 1.8, cegueiraMs: 4000 });
export const ehFumaca = (slug) => FUMACA.re.test(String(slug ?? ''));
const LINHA_MOV = /^Buff concede Velocidade de Movimento aumentada em ([\d.]+) ?%$/i;
const LINHA_DURACAO = /^Duração base é de ([\d.]+) segundos?$/i;
const LINHA_SECUNDARIA = /^Duração Base Secundária é de ([\d.]+) segundos?$/i;
/** A Mina de Fumaça no nível e na qualidade: `{ movPct, buffMs, nuvemMs }` — a velocidade do buff soma a do nível e a da qualidade (a mesma frase). */
export function fumacaDasLinhas(linhas = [], daQualidade = []) {
  return {
    movPct: somar(linhas, LINHA_MOV) + somar(daQualidade, LINHA_MOV),
    buffMs: Math.round((achar(linhas, LINHA_DURACAO) ?? 4) * 1000),
    nuvemMs: Math.round((achar(linhas, LINHA_SECUNDARIA) ?? 1) * 1000),
  };
}
/** Cega os monstros vivos do andar dentro das nuvens vivas (`hunt.poeNuvensR3D`) e tira as vencidas. Devolve os que ficaram Cegos agora. */
export function cegarNasNuvens(hunt, agora = hunt?.clock ?? 0) {
  const novos = [];
  if (!hunt?.poeNuvensR3D?.length) return novos;
  hunt.poeNuvensR3D = hunt.poeNuvensR3D.filter((n) => n.ate > agora);
  if (!hunt.poeNuvensR3D.length) { delete hunt.poeNuvensR3D; return novos; }
  for (const m of hunt.monstros ?? []) {
    if (!(m.hp > 0) || m.dummy) continue;
    if (!hunt.poeNuvensR3D.some((n) => (n.z ?? 0) === (m.z ?? hunt.z ?? 0) && cheb(m, n) <= n.raio)) continue;
    const e = (m.estados ??= {});
    if (!(e.cego?.ate > agora)) novos.push(m);
    e.cego = { ate: Math.max(e.cego?.ate ?? 0, agora + FUMACA.cegueiraMs) };
  }
  return novos;
}
