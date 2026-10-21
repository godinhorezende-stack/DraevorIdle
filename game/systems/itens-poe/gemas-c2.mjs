// O LOTE C2 das gemas ativas do PoE (dono, 20/10: as de corpo a corpo, impacto e canalização — os contadores próprios e as cargas consumidas). Aqui ficam
// os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no
// nível e o status) e `acoes.mjs` (o uso e o tique).
//
// As decisões do dono (20/10 — as recomendações do plano do grupo corpo a corpo/impacto/canalização, aceitas):
//   - D2.1: o Traumatismo — +1 por ataque que acerta ("a primeira vez que este Ataque Acertar"), cada ponto com os seus 6 s (× a Duração da Habilidade), e o dano
//     em você a cada ganho (o dano por Traumatismo × os Traumatismos que você tem depois do ganho); no Traumatismo Complexo, ao chegar em 10, zera;
//   - D2.2: o pulso do Esmagar Ossos sai só quando o golpe atordoa, em volta do atordoado; a área cresce "X% por 0,1 s" do atordoamento que saiu, até +400%;
//   - D2.3: as cargas — os Martelos Sagrados gastam 1 de Poder, os das Espirais e o Golpe Tectônico do Cataclismo gastam todas, o Golpe Tectônico comum lê as de
//     Tolerância e gasta 1 a cada 3 usos (dono, 20/10: a descrição do PoB); gastas no uso, antes do golpe (como o D-a do A1b);
//   - D2.4: a ramificação do Golpe Tectônico — cada casa da fissura com a chance de abrir uma fissura lateral de metade do comprimento, a 45°, no máximo 1 ramo
//     por fissura;
//   - D2.5: a cascata dos Martelos Sagrados — cada cascata é um anel de martelos em volta do anterior (como a forma `concentrica` do A4), com o "+100%" só no
//     primeiro martelo;
//   - D2.7: a Corrente com Gancho de Trarthus — os presos ficam até a corrente arrebentar, e cada acerto seu num preso dá 1 de Fúria.
// O resto pela regra do PoE (o PoB):
//   - o Esmagar Ossos: trauma_strike_damage_+%_final_per_trauma (o "mais" por Traumatismo; a qualidade 0,05 por ponto), boneshatter_trauma_base_duration_ms 6000,
//     o pulso com radius 14 (1,4 m) e "Pulse" area = true; o golpe é de ALVO ÚNICO (MeleeSingleTarget, a parte "Attack" area = false — act_str.lua:1298);
//     o Complexo: trauma_strike_damage_+%_final_per_trauma_capped (limitVar TraumaStacksMax) e lose_all_trauma_at_X_trauma 10 (act_str.lua:1408); o da Carnificina:
//     o pulso com 20% por 0,1 s e o "mais Dano contra atordoados" da qualidade (active_skill_damage_+%_final_vs_stunned_enemies — `linhas-das-gemas`);
//   - o Golpe Infernal da Imolação: o debuff carregado em VOCÊ no primeiro acerto de cada uso ("the first time you hit an enemy with this skill"), 3 s (× a
//     Duração, renovada a cada carga); com 6 cargas, ou quando acaba, explode em volta de você (o raio da gema): o dano do golpe × 80% (+0,5 por qualidade) por
//     carga (infernal_blow_explosion_damage_%_of_total_per_stack; o preDamageFunc do PoB: Damage MORE = −100 + efeito × cargas — act_str.lua:7158); o golpe é de
//     alvo único (a parte "Melee Hit" area = false);
//   - os Martelos Sagrados: holy_hammers_maximum_number_of_hammerslam_cascades 2, holy_hammers_num_additional_hammerslams_if_consuming_power_charge 2,
//     holy_hammers_damage_+%_final_for_initial_hammer_in_cascade 100, holy_hammers_damage_+%_final_if_consuming_power_charge (1 por qualidade — act_str.lua:6026);
//     os das Espirais: 6 cascatas, holy_hammers_damage_+%_final_per_power_charge_consumed 15 (+0,25 por qualidade), +1 martelo (cascata) por carga
//     (act_str.lua:6123); "On hitting an enemy, another Hammer will cascade … repeating if further enemies are hit, up to a cap" (a descrição);
//   - o Golpe Tectônico: tectonic_slam_side_crack_additional_chance_% 30 (+1,5 por qualidade), +5% por Carga de Tolerância; o do Cataclismo: por Carga de
//     Tolerância consumida, 15% mais Dano (+0,25 por qualidade), 10% mais Área de Efeito e 10% de chance de ramificar (act_str.lua:12140-12290);
//   - as Gavinhas Relampejantes: lightning_tendrils_channelled_larger_pulse_interval 3 e o crítico garantido no Pulso Mais Forte (CritChance OVERRIDE 100); a da
//     Excentricidade: intervalo 5, +150% de Área e +500% de Dano com Acertos e Afecções no Pulso Mais Forte (act_int.lua:12529-12760) — o pulso é o uso da
//     canalização; a contagem é a dos usos SEGUIDOS da gema (`hunt.poeSeguidos`, o mesmo do "terceiro golpe sucessivo" do Martelo Glacial);
//   - a Corrente com Gancho de Trarthus: chain_hook_attaches_to_X_targets 8 (+0,15 por qualidade), chain_hook_attachment_range 60 (6 m), chain_hook_max_attached_
//     targets 16, chain_hook_attachment_rage_to_gain_per_hit 1; "When chains are broken, they snap and deal attack damage in an area around the target" — a
//     corrente arrebenta quando o preso fica a mais que o comprimento de você, com o golpe da gema na área dela (2,4 m + o raio pela Fúria) em volta dele
//     (act_str.lua:1696).
//
// (Sem dependência da caçada: só as linhas e a geometria da grade.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/ㅤ/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- o Esmagar Ossos e o Traumatismo

const LINHA_TRAUMA = /^Ganha \d+ Traumatismo a primeira vez que este Ataque Acertar um Inimigo Sofre ([\d.]+) de Dano Físico por Traumatismo quando você ganhar Traumatistmo Traumatismo dura ([\d.]+) segundos?$/i;
const LINHA_POR_TRAUMA = /^\+?([\d.]+) % mais Dano por Traumatismo$/i;
const LINHA_POR_TRAUMA_TETO = /^\+?([\d.]+) % mais Dano por Trauma, até ([\d.]+) %$/i;
const LINHA_PERDE_TRAUMA = /^Perca todo o Traumatismo ao atingir (\d+) Traumatismos$/i;
const LINHA_PULSO = /^Pulso tem Efeito em Área aumentado em ([\d.]+) % por cada 0\.1s de Duração do Atordoamento, máximo de ([\d.]+) %$/i;
/** O raio do pulso do Esmagar Ossos (o PoB: `skill("radius", 14, { SkillPart = 2 })` — 1,4 m). */
export const PULSO = Object.freeze({ raioM: 1.4 });
/**
 * O Traumatismo da gema (`{ ganho: 1, danoProprio, duracaoS, maisPorPct, tetoPct, perdeEm }`), ou null. O "mais" por Traumatismo soma o do nível e o da
 * qualidade (o mesmo stat no PoB); o teto (o Complexo, "até 200%") é o "mais" total.
 */
export function traumatismoDasLinhas(linhas = [], daQualidade = []) {
  let danoProprio = null;
  let duracaoS = null;
  for (const l of linhas) { const m = LINHA_TRAUMA.exec(norm(l)); if (m) { danoProprio = Number(m[1]); duracaoS = Number(m[2]); } }
  if (danoProprio == null) return null;
  const todas = [...linhas, ...daQualidade];
  const comTeto = todas.map((l) => LINHA_POR_TRAUMA_TETO.exec(norm(l))).filter(Boolean);
  return {
    ganho: 1, danoProprio, duracaoS,
    maisPorPct: somar(todas, LINHA_POR_TRAUMA) + comTeto.reduce((t, m) => t + Number(m[1]), 0),
    tetoPct: comTeto.length ? Math.max(...comTeto.map((m) => Number(m[2]))) : Infinity,
    perdeEm: achar(linhas, LINHA_PERDE_TRAUMA),
  };
}
/** O pulso (`{ porDecimoPct, maxPct, raioM }`), ou null. */
export function pulsoDasLinhas(linhas = []) {
  for (const l of linhas) { const m = LINHA_PULSO.exec(norm(l)); if (m) return { porDecimoPct: Number(m[1]), maxPct: Number(m[2]), raioM: PULSO.raioM }; }
  return null;
}
/** Os Traumatismos de agora (cada ponto com o seu fim — `hunt.poeTrauma`, a lista dos fins). */
export const traumasAgora = (hunt, agora) => (hunt?.poeTrauma ?? []).filter((t) => t > agora).length;
/** O "mais" do dano com `n` Traumatismos (o teto do Complexo): o fator. */
export const fatorDoTrauma = (t, n) => (t ? 1 + Math.min(t.tetoPct, t.maisPorPct * Math.max(0, n)) / 100 : 1);
/**
 * (D2.1) Ganha os Traumatismos de um ataque que acertou: `{ n, dano }` — `n`, os de agora depois do ganho (0 se zerou no Complexo); `dano`, o Físico em você
 * (o dano por Traumatismo × os que você tinha logo depois do ganho). Mexe em `hunt.poeTrauma`.
 */
export function ganharTrauma(hunt, t, agora, duracaoMs) {
  const lista = (hunt.poeTrauma ?? []).filter((x) => x > agora);
  for (let k = 0; k < (t.ganho ?? 1); k++) lista.push(agora + Math.max(1, Math.round(duracaoMs)));
  const dano = t.danoProprio * lista.length;
  if (t.perdeEm && lista.length >= t.perdeEm) lista.length = 0;
  if (lista.length) hunt.poeTrauma = lista;
  else delete hunt.poeTrauma;
  return { n: lista.length, dano };
}
/** (D2.2) O "aumentado" da área do pulso pela duração do atordoamento (`ms`): X% por 0,1 s inteiro, até o máximo. */
export const areaDoPulsoPct = (p, ms) => (p ? Math.min(p.maxPct, p.porDecimoPct * Math.floor(Math.max(0, Number(ms) || 0) / 100)) : 0);

// ---------------------------------------------------------------- o Golpe Infernal da Imolação

const LINHA_DEBUFF_POR_CARGA = /^Debuffs causam \+?([\d.]+) % de Dano por Carga$/i;
/** O máximo de cargas do debuff (o PoB: "Upon reaching 6 charges" — a parte "Debuff Explosion - 6 Stacks"). */
export const IMOLACAO = Object.freeze({ maxCargas: 6 });
/** O debuff da Imolação (`{ porCargaPct, max }`: o do nível + o da qualidade), ou null. */
export function imolacaoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Infernal_Blow_of_Immolation') return null;
  const porCargaPct = somar([...linhas, ...daQualidade], LINHA_DEBUFF_POR_CARGA);
  return porCargaPct > 0 ? { porCargaPct, max: IMOLACAO.maxCargas } : null;
}
/** O "% do golpe" da explosão com `n` cargas (o PoB: Damage MORE = −100 + efeito × cargas → o golpe × efeito% × cargas). */
export const pctDaExplosao = (im, n) => (im ? im.porCargaPct * Math.max(0, n) : 0);

// ---------------------------------------------------------------- os Martelos Sagrados

const LINHA_PRIMEIRO_MARTELO = /^O primeiro martelo de cada cascata causa \+ ?([\d.]+) % de dano$/i;
const LINHA_CASCATAS = /^Martelos Sagrados se acumulam em cascata até (\d+) vezes$/i;
const LINHA_LADOS = /^Convoca (\d+) Martelos Sagrados adicionais ao gastar uma carga de poder$/i;
const LINHA_MAIS_AO_GASTAR = /^\+ ?([\d.]+) % de dano ao gastar uma carga de poder$/i;
const LINHA_POR_CARGA_REMOVIDA = /^\+ ?([\d.]+) % (?:mais )?(?:de )?dano por carga de poder removida$/i;
const LINHA_CASCATA_POR_CARGA = /^\+(\d+) cascatas por carga de poder removida$/i;
/**
 * Os Martelos (`{ primeiroMaisPct, cascatas, lados, maisAoGastarPct, consome, maisPorCargaPct, cascataPorCarga }`), ou null. `consome`: 1 (os Martelos
 * Sagrados) ou Infinity (os das Espirais — "consuming all Power Charges").
 */
export function martelosDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Holy_Hammers(_of_Spirals)?$/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  const cascatas = achar(linhas, LINHA_CASCATAS);
  if (cascatas == null) return null;
  const espirais = slug === 'Holy_Hammers_of_Spirals';
  return {
    primeiroMaisPct: achar(linhas, LINHA_PRIMEIRO_MARTELO) ?? 0, cascatas, lados: achar(linhas, LINHA_LADOS) ?? 0, maisAoGastarPct: somar(todas, LINHA_MAIS_AO_GASTAR),
    consome: espirais ? Infinity : 1, maisPorCargaPct: somar(todas, LINHA_POR_CARGA_REMOVIDA), cascataPorCarga: achar(linhas, LINHA_CASCATA_POR_CARGA) ?? 0,
  };
}
/** O "mais" do dano dos Martelos com `gastas` Cargas de Poder: o fator (o "ao gastar" uma vez; o "por carga removida" × as cargas). */
export const fatorDosMartelos = (m, gastas) => (m && gastas > 0 ? (1 + m.maisAoGastarPct / 100) * (1 + (m.maisPorCargaPct * gastas) / 100) : 1);
/** Quantas cascatas (anéis) o uso pode ter: o máximo + as da carga (as Espirais). */
export const cascatasDoUso = (m, gastas) => (m ? m.cascatas + m.cascataPorCarga * Math.max(0, gastas) : 0);
/**
 * (D2.5) O ANEL `k` (1, 2, …) da cascata em volta de `centro`: as casas a distância (Chebyshev) entre `raio + (k − 1) × largura + 1` e `raio + k × largura`.
 */
export function anelDaCascata(centro, raio, largura, k) {
  const de = raio + (k - 1) * largura + 1;
  const ate = raio + k * largura;
  const cs = [];
  for (let dy = -ate; dy <= ate; dy++) for (let dx = -ate; dx <= ate; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d >= de && d <= ate) cs.push({ x: centro.x + dx, y: centro.y + dy });
  }
  return cs;
}
/** O centro e o raio (Chebyshev) das `casas` (o meio delas, arredondado). */
export function centroDasCasas(casas) {
  if (!casas?.length) return null;
  const c = { x: Math.round(casas.reduce((t, q) => t + q.x, 0) / casas.length), y: Math.round(casas.reduce((t, q) => t + q.y, 0) / casas.length) };
  return { ...c, raio: casas.reduce((r, q) => Math.max(r, Math.abs(q.x - c.x), Math.abs(q.y - c.y)), 0) };
}

// ---------------------------------------------------------------- o Golpe Tectônico

const LINHA_RAMIFICAR = /^\+?([\d.]+) % de Chance de ramificação da Fissura$/i;
const LINHA_RAMIFICAR_POR_TOLERANCIA = /^\+([\d.]+) % de chance de ramificar fissuras por Carga de Tolerância$/i;
const LINHA_DANO_POR_REMOVIDA = /^\+?([\d.]+) % mais Dano por Carga de Tolerância removida$/i;
const LINHA_AREA_POR_REMOVIDA = /^([\d.]+) % mais Área de Efeito por Carga de Tolerância removida$/i;
const LINHA_RAMIFICAR_POR_REMOVIDA = /^([\d.]+) % de chance de ramificação de fissuras por Carga de Tolerância removida$/i;
/** (dono, 20/10) o Golpe Tectônico comum: "Consume an Endurance Charge every third time you slam the ground with this skill" (a descrição do PoB, act_str.lua:12144). */
export const TECTONICO = Object.freeze({ consomeACada: 3 });
/**
 * A fissura (`{ chancePct, porToleranciaPct, consome, maisDanoPorCargaPct, maisAreaPorCargaPct, chancePorCargaPct }`), ou null. `consome`: 0 (o Golpe
 * Tectônico — só lê as cargas) ou Infinity (o do Cataclismo — consome todas).
 */
export function fissuraDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Tectonic_Slam(_of_Cataclysm)?$/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  const cataclismo = slug === 'Tectonic_Slam_of_Cataclysm';
  return {
    chancePct: somar(todas, LINHA_RAMIFICAR), porToleranciaPct: somar(todas, LINHA_RAMIFICAR_POR_TOLERANCIA), consome: cataclismo ? Infinity : 0, consomeACada: cataclismo ? 0 : TECTONICO.consomeACada,
    maisDanoPorCargaPct: somar(todas, LINHA_DANO_POR_REMOVIDA), maisAreaPorCargaPct: somar(todas, LINHA_AREA_POR_REMOVIDA), chancePorCargaPct: somar(todas, LINHA_RAMIFICAR_POR_REMOVIDA),
  };
}
/** A chance de ramificar (por casa) com `tem` Cargas de Tolerância (o Golpe Tectônico) e `gastas` consumidas (o do Cataclismo), até 100%. */
export const chanceDeRamificar = (f, tem, gastas) => (f ? Math.min(100, f.chancePct + f.porToleranciaPct * Math.max(0, tem) + f.chancePorCargaPct * Math.max(0, gastas)) : 0);
/**
 * (D2.4) A FISSURA LATERAL: a primeira casa do eixo (`eixo`, da origem para fora) que sorteia a chance abre um ramo a 45° (o lado sorteado), com metade do
 * comprimento (ao menos 1 casa). Devolve as casas do ramo (`[]` sem ramo). `dir`: o passo do eixo (`{ ux, uy }`).
 */
export function ramoDaFissura(eixo, { ux, uy }, chancePct, rng = Math.random) {
  if (!eixo?.length || !(chancePct > 0)) return [];
  for (const c of eixo) {
    if (rng() * 100 >= chancePct) continue;
    const lado = rng() < 0.5 ? 1 : -1;
    // (o passo a 45° do eixo, para o lado: a soma do eixo com a perpendicular)
    const px = -uy * lado;
    const py = ux * lado;
    const dx = Math.sign(ux + px);
    const dy = Math.sign(uy + py);
    const n = Math.max(1, Math.round(eixo.length / 2));
    return Array.from({ length: n }, (_, i) => ({ x: c.x + dx * (i + 1), y: c.y + dy * (i + 1) }));
  }
  return [];
}

// ---------------------------------------------------------------- as Gavinhas Relampejantes

const LINHA_PULSO_FORTE = /^Libera um Pulso Mais Forte a cada (\d+) Pulsos Pulsos Mais Fortes sempre são Golpes Críticos$/i;
const LINHA_PULSO_AREA = /^Pulsos Mais Fortes têm ([\d.]+) % mais Área de Efeito$/i;
const LINHA_PULSO_DANO = /^Pulsos Fortalecidos causam ([\d.]+) % mais Dano com Acertos e Afecções$/i;
/** O Pulso Mais Forte (`{ cada, sempreCritico: true, maisAreaPct, maisDanoPct }`), ou null. */
export function pulsoForteDasLinhas(linhas = []) {
  const cada = achar(linhas, LINHA_PULSO_FORTE);
  return cada ? { cada, sempreCritico: true, maisAreaPct: achar(linhas, LINHA_PULSO_AREA) ?? 0, maisDanoPct: achar(linhas, LINHA_PULSO_DANO) ?? 0 } : null;
}
/** O uso `seguidos` (1, 2, …) é o Pulso Mais Forte? */
export const ehPulsoForte = (p, seguidos) => !!p && p.cada > 0 && seguidos > 0 && seguidos % p.cada === 0;

// ---------------------------------------------------------------- a Corrente com Gancho de Trarthus

const LINHA_CORRENTES = /^Lança correntes em até (\d+) alvos ao alcance$/i;
const LINHA_COMPRIMENTO = /^Comprimento máximo da corrente: ([\d.]+) metros?$/i;
const LINHA_MAX_PRESOS = /^Máximo de (\d+) acorrentamentos$/i;
const LINHA_FURIA_DO_PRESO = /^Alvos acorrentados concedem (\d+) Fúria quando atingidos$/i;
/** As correntes (`{ alvos, comprimentoM, max, furia }` — os alvos do nível + os da qualidade), ou null. */
export function correntesDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Chain_Hook_of_Trarthus') return null;
  const alvos = somar([...linhas, ...daQualidade], LINHA_CORRENTES);
  return alvos > 0 ? { alvos, comprimentoM: achar(linhas, LINHA_COMPRIMENTO) ?? 6, max: achar(linhas, LINHA_MAX_PRESOS) ?? 16, furia: achar(linhas, LINHA_FURIA_DO_PRESO) ?? 1 } : null;
}
/** (D2.7) Prende os `novos` (os acertados do uso, na ordem — até `alvos` por uso), sem repetir quem já está preso, até o máximo (sai o mais antigo). */
export function prender(hunt, c, novos, agora, acao) {
  const lista = (hunt.poeCorrentes ?? []).slice();
  let n = 0;
  for (const b of novos) {
    if (n >= c.alvos) break;
    if (!b?.uid || lista.some((x) => x.uid === b.uid)) continue;
    lista.push({ uid: b.uid, desde: agora, acao, furia: c.furia, comprimentoM: c.comprimentoM });
    n++;
  }
  while (lista.length > c.max) lista.shift();
  if (lista.length) hunt.poeCorrentes = lista;
  return n;
}
/** A Fúria que o acerto em `alvo` dá pelas correntes (0 se ele não está preso). */
export const furiaDoPreso = (hunt, alvo) => (hunt?.poeCorrentes ?? []).find((x) => x.uid === alvo?.uid)?.furia ?? 0;

// ---------------------------------------------------------------- a Vinculação da Tempestade e a Explosão de Runas

/**
 * (dono, 20/10: "criar a Explosão de Runas, como no PoE") as RUNAS da Vinculação da Tempestade e a EXPLOSÃO DE RUNAS que a gema concede ("The gem grants a
 * sub-skill, Rune Blast" — a wiki no poedb salvo; o poedb mostra a Explosão Rúnica dentro da página da Vinculação, sem gema própria). Os números do PoB
 * (act_int.lua:17649-17954) e do poedb:
 *   - a runa: base_skill_effect_duration 12000; rune_paint_max_rune_level 3; rune_paint_damage_+%_final_per_rune_level 100 (acertos e afecções);
 *     rune_paint_area_of_effect_+%_final_per_rune_level 30 (+0,5 por qualidade); radius 16 (1,6 m); base_movement_velocity_+% −50 (o Tolhimento de quem está nela);
 *     rune_paint_mana_spend_per_rune_upgrade (5 a 24 — a linha "Uma Runa é Melhorada para cada X de Mana Gasta");
 *   - a Explosão de Runas: castTime 0.16; o custo é a coluna "Mana" da tabela do poedb da Vinculação (6 a 26 — "Explosão Rúnica, Custo: (6 — 18) Mana"); "Channel to
 *     improve runes … based on the mana you spend channelling this skill. Release to detonate the targeted rune, which will cause other runes to detonate in a
 *     chain reaction"; a wiki: "Each rune can only be improved once per cast", "a maximum of 9 runes improved per cast, because each rune is only connected to 8";
 *   - a do Teletransporte: "Teletransporta para a runa detonada, se você não detonou runas há 0,5 segundo" (rune_blast_teleports_to_detonated_rune_with_100_ms_cooldown).
 */
export const RUNAS_DA_TEMPESTADE = Object.freeze({
  duracaoMs: 12000, nivelMax: 3, maisDanoPorNivelPct: 100, maisAreaPorNivelPct: 30, areaPorNivelPorQualidade: 0.5, raioM: 1.6, tolhePct: 50,
  explosaoMs: 160, maxMelhoriasPorUso: 9, teleporteMs: 500,
  // (revisão C2, 21/10 — o PoB, RuneBlast: qualityStats base_cast_speed_+% 0,5 por qualidade; skillTypes Spell, Channel, Arcane — as tags da conjuração e do custo)
  velConjuracaoPorQualidade: 0.5, tagsDaExplosao: Object.freeze(['Magia', 'Canalização', 'Arcano']),
});
const LINHA_MANA_POR_MELHORIA = /^Uma Runa é Melhorada para cada (\d+) de Mana Gasta$/i;
/** As runas da Vinculação (`{ manaPorMelhoria, maisAreaPorNivelPct, teleporta, …RUNAS_DA_TEMPESTADE }`), ou null. */
export function runasDasLinhas(slug, linhas = [], qualidade = 0) {
  if (!/^Stormbind(_of_Teleportation)?$/.test(slug)) return null;
  const manaPorMelhoria = achar(linhas, LINHA_MANA_POR_MELHORIA);
  if (!manaPorMelhoria) return null;
  const R = RUNAS_DA_TEMPESTADE;
  return { ...R, manaPorMelhoria, maisAreaPorNivelPct: R.maisAreaPorNivelPct + R.areaPorNivelPorQualidade * Math.max(0, Number(qualidade) || 0), teleporta: slug === 'Stormbind_of_Teleportation' };
}
/**
 * O custo da Explosão de Runas por nível da Vinculação (Mana — o PoB, RuneBlast levels 1–40, act_int.lua:17772; o mesmo da tabela "Explosão Rúnica" do poedb, que o
 * gemas-poe.json guardou como a coluna "Mana" da Vinculação antes da troca pela tabela própria dela).
 */
export const CUSTO_DA_EXPLOSAO = Object.freeze([6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 13, 13, 14, 14, 15, 15, 16, 16, 18, 18, 18, 19, 19, 20, 20, 21, 21, 23, 23, 24, 24, 24, 25, 25, 25, 25, 26, 26, 26, 26]);
/** O custo da Explosão de Runas no nível `nivel` da Vinculação. */
export const custoDaExplosao = (nivel = 1) => CUSTO_DA_EXPLOSAO[Math.max(1, Math.min(CUSTO_DA_EXPLOSAO.length, Math.round(Number(nivel) || 1))) - 1];
/**
 * (escolha do lote — o PoE diz "spread runes on the ground in a growing pattern", sem a geometria) a casa da próxima runa: a do alvo e, ocupada, a mais perto
 * dele na espiral (os anéis em volta, de dentro para fora), sem repetir a casa de outra runa.
 */
// (revisão C2, 21/10: `livre(casa)` — a casa ANDÁVEL do jogo (a grade do combate): a runa não fica em parede nem fora da grade)
export function casaDaProximaRuna(centro, ocupadas, raioMax = 8, livre = null) {
  const tem = new Set(ocupadas.map((c) => `${c.x},${c.y}`));
  for (let r = 0; r <= raioMax; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const c = { x: centro.x + dx, y: centro.y + dy };
      if (!tem.has(`${c.x},${c.y}`) && (!livre || livre(c))) return c;
    }
  }
  return null;
}
/** (D2.6) Melhora `n` runas: as mais antigas que ainda não estão no máximo, uma vez cada, até o teto por uso. Devolve as melhoradas. */
export function melhorarRunas(runas, n, R = RUNAS_DA_TEMPESTADE) {
  const fila = runas.filter((r) => (r.nivel ?? 0) < R.nivelMax).sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0)).slice(0, Math.min(Math.max(0, n), R.maxMelhoriasPorUso));
  for (const r of fila) r.nivel = (r.nivel ?? 0) + 1;
  return fila;
}
/** A REAÇÃO EM CADEIA: a runa `primeira` e todas as ligadas a ela (vizinhas, a 1 casa, uma da outra). */
export function cadeiaDeRunas(runas, primeira) {
  const fora = new Set(runas);
  fora.delete(primeira);
  const cadeia = [primeira];
  for (let i = 0; i < cadeia.length; i++) {
    for (const r of [...fora]) if (Math.max(Math.abs(r.x - cadeia[i].x), Math.abs(r.y - cadeia[i].y)) <= 1) { fora.delete(r); cadeia.push(r); }
  }
  return cadeia;
}
/** O raio da explosão da runa no nível dela, em metros, antes da Área de Efeito do uso: 1,6 m × √(1 + X% × nível). */
export const raioDaRunaM = (R, nivel) => R.raioM * Math.sqrt(1 + (R.maisAreaPorNivelPct * Math.max(0, nivel)) / 100);

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaC2(slug, l) {
  const t = norm(l);
  if (/^Boneshatter/.test(slug) && (LINHA_TRAUMA.test(t) || LINHA_POR_TRAUMA.test(t) || LINHA_POR_TRAUMA_TETO.test(t) || LINHA_PERDE_TRAUMA.test(t) || LINHA_PULSO.test(t))) return true;
  if (slug === 'Infernal_Blow_of_Immolation' && LINHA_DEBUFF_POR_CARGA.test(t)) return true;
  if (/^Holy_Hammers(_of_Spirals)?$/.test(slug) && [LINHA_PRIMEIRO_MARTELO, LINHA_CASCATAS, LINHA_LADOS, LINHA_MAIS_AO_GASTAR, LINHA_POR_CARGA_REMOVIDA, LINHA_CASCATA_POR_CARGA].some((re) => re.test(t))) return true;
  if (/^Tectonic_Slam(_of_Cataclysm)?$/.test(slug) && [LINHA_RAMIFICAR, LINHA_RAMIFICAR_POR_TOLERANCIA, LINHA_DANO_POR_REMOVIDA, LINHA_AREA_POR_REMOVIDA, LINHA_RAMIFICAR_POR_REMOVIDA].some((re) => re.test(t))) return true;
  if (/^Lightning_Tendrils(_of_Eccentricity)?$/.test(slug) && [LINHA_PULSO_FORTE, LINHA_PULSO_AREA, LINHA_PULSO_DANO].some((re) => re.test(t))) return true;
  if (/^Stormbind(_of_Teleportation)?$/.test(slug) && LINHA_MANA_POR_MELHORIA.test(t)) return true;
  if (slug === 'Chain_Hook_of_Trarthus' && (LINHA_CORRENTES.test(t) || LINHA_COMPRIMENTO.test(t) || LINHA_FURIA_DO_PRESO.test(t) || /^\+[\d.]+ metros? ao Raio por \d+ de Fúria$/i.test(t))) return true;
  return false;
}

/** Os slugs cujo golpe é de ALVO ÚNICO no PoE (MeleeSingleTarget; a área é a do pulso / da explosão): o uso deles não tem a forma do molde. */
export const ALVO_UNICO = Object.freeze(new Set(['Boneshatter', 'Boneshatter_of_Complex_Trauma', 'Boneshatter_of_Carnage', 'Infernal_Blow_of_Immolation']));

/**
 * O que a mecânica do lote ainda não faz — sem linha (o status não a vê) e sem fonte para o número. Uma gema sem nada aqui segue o PoE pelas linhas.
 */
export const MOTIVOS_C2 = Object.freeze({});
