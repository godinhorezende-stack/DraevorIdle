// O LOTE B2 das gemas ativas do PoE (dono, 20/10: as de contadores próprios, chão e espalhar — as Cargas Sangrentas do Ceifar, o debuff com cargas do Golpe
// Infernal, a Febre Corrompedora, a Explosão Voltáxica, a Ruína da Barganha de Trarthus, o Contágio, a Chuva Tóxica, a Chama Purificadora, a Tormenta
// Flamejante Vaal e o Chicote Ardente). Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada);
// quem usa é `gemas-poe.mjs` (os leitores no nível, o raio do PoB e o status) e `acoes.mjs` (o uso, o acerto, a morte e o tique).
//
// As decisões do dono (20/10 — as recomendações do plano do grupo área/nova/chuva/orbe, aceitas):
//   - D-B2.1: o lento dos esporos da Chuva Tóxica — 5% por esporo que toca, somados até 30% (o PoB: rain_of_spores_vines_movement_speed_+%_final −5,
//     minimum_rain_of_spores_movement_speed_+%_final_cap −30). O lento POR FONTE (a gema): a mesma fonte não multiplica com ela mesma (os esporos dela somam,
//     até o teto); fontes diferentes multiplicam, como os "menos" do PoE. Só a Velocidade de Movimento (não a de ação);
//   - D-B2.2: as Cargas Sangrentas começam em 0, vão até 5 (Misc.lua: maximum_blood_scythe_charges; até 9 com o Ceifar Vaal: +4 pela duração secundária), não
//     se perdem pelo tempo e zeram na troca de instância (a caçada nova); o custo de Vida 20% mais por carga (o PoB: LifeCost MORE × BloodCharge);
//   - D-B2.3: o Golpe Infernal — com 6 cargas o debuff explode na hora com 66% × 6 = 396% do acerto (o PoB: Damage MORE de (−100 + X) + X × (cargas − 1), act_str.lua
//     :7052); ao expirar ou na morte, com as cargas que tiver; o morto com um dos dois debuffs também explode com 6% da Vida (o cadáver);
//   - D-B2.4: a "Vida gasta" da Febre Corrompedora é o custo de Vida das gemas (o inteiro, a parte em Vida e a Vida a mais) e o Sacrifício (a Barganha de
//     Trarthus) — "life spent", não o dano sofrido;
//   - D-B2.5: o Contágio espalha o debuff com a duração que resta (e o dano que falta) para os vizinhos no raio da gema em volta do morto (ou do acertado, na da
//     Transferência), um espalhar por morte; um dano degenerativo só da gema por inimigo (o mais forte fica), como no PoE;
//   - D-B2.6: a Barganha de Trarthus sacrifica 50% da Vida MÁXIMA (o PoB: `output.Life`).
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));

// ---------------------------------------------------------------- o raio-base do PoB (o poedb não publica)

/**
 * O raio-base (m) das gemas do lote que o poedb não publica (só o "+X metros de raio"): o `radius` dos baseMods do PoB — a Explosão Voltáxica (22, act_int.lua
 * :20470), a Chama Purificadora e a das Revelações (o acerto inicial, 18 — act_int.lua:14382/14485), o Ceifar Vaal (23, act_str.lua:11252) e a Barganha de Trarthus
 * (26, act_int.lua:4043).
 */
export const RAIO_DO_POB_B2 = Object.freeze({ Voltaxic_Burst: 2.2, Purifying_Flame: 1.8, Purifying_Flame_of_Revelations: 1.8, Vaal_Reap: 2.3, Dark_Bargain_of_Trarthus: 2.6 });

// ---------------------------------------------------------------- o Ceifar (as Cargas Sangrentas)

/** O máximo de Cargas Sangrentas (Misc.lua: maximum_blood_scythe_charges 5). */
export const CARGAS_SANGRENTAS = Object.freeze({ maximo: 5 });
const LINHA_GANHA_SANGRENTA = /^Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem Perca uma Carga Sangrenta quando um Inimigo Morrer enquanto afetado pelo Debuff desta Habilidade$/i;
const LINHA_CUSTO_POR_SANGRENTA = /^Custa \+?([\d.]+) % mais Vida por Carga Sangrenta$/i;
const LINHA_DANO_POR_SANGRENTA = /^Causa \+?([\d.]+) % mais Dano por Carga Sangrenta$/i;
const LINHA_SANGUE_PERDURA = /^Efeitos do Sangue Fervendo Perduram por ([\d.]+) segundos?$/i;
const LINHA_MAX_SANGUE = /^Concede \+(\d+) ao máximo de Cargas de Sangue$/i;
const LINHA_DA_MAX_SANGUE = /^Concede até o máximo de Cargas de Sangue$/i;
/**
 * O CEIFAR e o da Carnificina: `{ ganha, perde, danoPorCargaPct, custoPorCargaPct }`; o VAAL: `{ danoPorCargaPct, vaal: { maxExtra, daMax, perduraMs, secundariaMs } }`.
 * Null fora da família. O "mais Dano por Carga" é um "mais" só (o PoB: Damage MORE × BloodCharge — o acerto e o degenerativo); o do nível e o da qualidade somam.
 */
export function ceifarDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^(Vaal_)?Reap(_of_Butchery)?$/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  const danoPorCargaPct = somar(todas, LINHA_DANO_POR_SANGRENTA);
  if (slug === 'Vaal_Reap') {
    return { danoPorCargaPct, vaal: { maxExtra: achar(linhas, LINHA_MAX_SANGUE) ?? 0, daMax: tem(linhas, LINHA_DA_MAX_SANGUE), perduraMs: Math.round((achar(linhas, LINHA_SANGUE_PERDURA) ?? 0) * 1000), secundariaMs: Math.round((stats.duracao2 ?? 8) * 1000), chaoMs: Math.round((stats.duracao ?? 5) * 1000) } };
  }
  const ganha = tem(linhas, LINHA_GANHA_SANGRENTA);
  return { ganha, perde: ganha, danoPorCargaPct, custoPorCargaPct: somar(todas, LINHA_CUSTO_POR_SANGRENTA) };
}
/** As Cargas Sangrentas agora (`hunt.poeSangue = { n, extra, extraAte }`): `{ n, max }` — o máximo com o "+N" do Ceifar Vaal enquanto dura (o n acima dele cai). */
export function cargasSangrentas(hunt, agora = hunt?.clock ?? 0) {
  const s = hunt?.poeSangue;
  const max = CARGAS_SANGRENTAS.maximo + (s?.extraAte > agora ? s.extra ?? 0 : 0);
  if (s && s.n > max) s.n = max;
  return { n: Math.max(0, Math.min(max, s?.n ?? 0)), max };
}
/** Soma `k` Cargas Sangrentas (negativo: perde), no teto. Devolve o número novo. */
export function mudarSangrentas(hunt, k, agora = hunt?.clock ?? 0) {
  const { n, max } = cargasSangrentas(hunt, agora);
  const s = (hunt.poeSangue ??= { n: 0 });
  s.n = Math.max(0, Math.min(max, n + k));
  return s.n;
}
/** O Ceifar Vaal: "+N ao máximo" pela duração secundária (× a Duração) e "Concede até o máximo". */
export function sangueDoVaal(hunt, vaal, fatorDur = 1, agora = hunt?.clock ?? 0) {
  const s = (hunt.poeSangue ??= { n: 0 });
  if (vaal.maxExtra > 0) { s.extra = vaal.maxExtra; s.extraAte = agora + Math.round(vaal.secundariaMs * fatorDur); }
  if (vaal.daMax) s.n = cargasSangrentas(hunt, agora).max;
  return cargasSangrentas(hunt, agora);
}
/** O "mais" do uso pelas cargas (um "mais" só, X × n) e o do custo de Vida. */
export const maisPelasSangrentas = (pctPorCarga, n) => (pctPorCarga || 0) * Math.max(0, n);

// ---------------------------------------------------------------- o Golpe Infernal

const LINHA_DEBUFF_POR_CARGA = /^Debuffs causam \+?([\d.]+) % de Dano por Carga$/i;
const LINHA_RAIO_DA_EXPLOSAO = /^Raio Base da explosao igual a ([\d.]+) metros?$/i;
const LINHA_EXPLOSAO_DO_CADAVER = /^Explosão causa Dano de Fogo base igual a ([\d.]+) % da Vida máxima do cadáver$/i;
/** O máximo de cargas do debuff ("Upon reaching 6 charges" — a descrição do PoB). */
export const GOLPE_INFERNAL = Object.freeze({ maxCargas: 6 });
/** `{ porCargaPct, maxCargas, raioM, cadaverPct, duracaoMs }` ou null. */
export function golpeInfernalDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug !== 'Infernal_Blow') return null;
  return {
    porCargaPct: somar([...linhas, ...daQualidade], LINHA_DEBUFF_POR_CARGA), maxCargas: GOLPE_INFERNAL.maxCargas,
    raioM: achar(linhas, LINHA_RAIO_DA_EXPLOSAO) ?? 1.8, cadaverPct: achar(linhas, LINHA_EXPLOSAO_DO_CADAVER) ?? 0, duracaoMs: Math.round((stats.duracao ?? 0.8) * 1000),
  };
}
/** O % do acerto na explosão com `n` cargas: X × n (66% × 6 = 396%). */
export const pctDaExplosaoInfernal = (porCargaPct, n) => (porCargaPct || 0) * Math.max(0, n);

// ---------------------------------------------------------------- a Febre Corrompedora

const LINHA_FEBRE_RENOVA = /^Duração do Buff é atualizada após você gastar um total de ([\d.]+) de Vida$/i;
const LINHA_FEBRE_PENALIDADE = /^Duração da penalidade base é de ([\d.]+) segundos?$/i;
/** O Sangue Corrompido (o PoB: CorruptingFeverMaxStages 10; Damage MORE 100 × os estágios depois do primeiro, ModFlag.Dot). */
export const FEBRE = Object.freeze({ maxEstagios: 10, maisPorEstagioPct: 100 });
/** `{ renovaVida, penalidadeMs, duracaoMs }` ou null. */
export function febreDasLinhas(slug, linhas = [], stats = {}) {
  if (slug !== 'Corrupting_Fever') return null;
  const renovaVida = achar(linhas, LINHA_FEBRE_RENOVA);
  const pen = achar(linhas, LINHA_FEBRE_PENALIDADE);
  return renovaVida == null || pen == null ? null : { renovaVida, penalidadeMs: Math.round(pen * 1000), duracaoMs: Math.round((stats.duracao ?? 6) * 1000) };
}
/** O fator do Sangue Corrompido com `n` estágios: 1 + 100% × (n − 1) — n × o dano de um. */
export const fatorDaFebre = (n) => 1 + (FEBRE.maisPorEstagioPct / 100) * Math.max(0, Math.min(FEBRE.maxEstagios, n) - 1);

// ---------------------------------------------------------------- a Explosão Voltáxica

const LINHA_CONVERTE_RAIO_EM_CAOS = /^([\d.]+) % do Dano de Raio Convertido em Dano de Caos$/i;
const LINHA_POR_AGUARDANDO = /^\+?([\d.]+) % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento$/i;
/**
 * A EXPLOSÃO VOLTÁXICA (o PoB, act_int.lua:20441: "Each cast of this spell waits for a short duration, releasing a burst … in an area around you when that duration
 * ends"): o objeto do uso — espera a duração (× os modificadores) e solta a explosão em volta de VOCÊ (onde você estiver); "X% mais Dano com Acertos e Afecções por
 * cada Conjuração desta Magia aguardando" (o PoB: Multiplier VoltaxicWaitingStages) — as OUTRAS que ainda aguardam quando esta solta. `{ tipo, semAcerto,
 * atrasoMs, porAguardandoPct }` ou null.
 */
export function voltaxicaDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug !== 'Voltaxic_Burst') return null;
  return { tipo: 'voltaxica', semAcerto: true, atrasoMs: Math.round((stats.duracao ?? 2.5) * 1000), porAguardandoPct: somar([...linhas, ...daQualidade], LINHA_POR_AGUARDANDO) };
}
/** "60% do Dano de Raio Convertido em Dano de Caos" (a conversão da habilidade — `af:conv_hab_energy_chaos` no uso, `ModsPoe.transformarPartes`). */
export const conversaoRaioEmCaosDasLinhas = (linhas = []) => achar(linhas, LINHA_CONVERTE_RAIO_EM_CAOS) ?? 0;

// ---------------------------------------------------------------- a Barganha Sombria de Trarthus (a Ruína)

const LINHA_RUINA = /^Ganha uma Ruína por uso Ao chegar a (sete|\d+), sacrifica ([\d.]+) % da sua vida e causa ([\d.]+) % da vida sacrificada como dano de caos$/i;
const LINHA_RUINA_EXTRA = /^([\d.]+) % de chance de ganhar uma Ruína adicional ao usar$/i;
/** `{ max, sacrificioPct, caosPct, extraPct }` (o PoB: dark_pact_sacrifice_%_life_from_max_ruin 50, …_chaos_damage_added_from_sacrifice_+% 600) ou null. */
export function ruinaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Dark_Bargain_of_Trarthus') return null;
  for (const l of linhas) {
    const m = LINHA_RUINA.exec(norm(l));
    if (m) return { max: m[1].toLowerCase() === 'sete' ? 7 : Number(m[1]), sacrificioPct: Number(m[2]), caosPct: Number(m[3]), extraPct: somar(daQualidade, LINHA_RUINA_EXTRA) };
  }
  return null;
}
/**
 * O uso com a Ruína (`hunt.poeRuina = n`): +1 (+1 na chance da qualidade, `sorte` 0–1); chegando ao máximo, sacrifica X% da Vida MÁXIMA (D-B2.6) e o dano de Caos
 * BASE da gema ganha Y% do sacrificado (o PoB: ChaosMin/ChaosMax + floor(Vida × X% × Y%)) — as Ruínas zeram. `{ n, sacrificio, caosBase }`.
 */
export function usarRuina(antes, r, vidaMax, sorte = 1) {
  const n = Math.max(0, antes | 0) + 1 + (sorte * 100 < (r.extraPct ?? 0) ? 1 : 0);
  if (n < r.max) return { n, sacrificio: 0, caosBase: 0 };
  const sacrificio = Math.floor(Math.max(0, vidaMax) * (r.sacrificioPct / 100));
  return { n: 0, sacrificio, caosBase: Math.floor(Math.max(0, vidaMax) * (r.sacrificioPct / 100) * (r.caosPct / 100)) };
}

// ---------------------------------------------------------------- o Vínculo de Mana

const LINHA_MANA_QUE_FALTA = /^Causa Dano de Raio base igual a \+?([\d.]+) % da Mana Não Reservada que falta$/i;
/** "Causa Dano de Raio base igual a X% da Mana Não Reservada que falta" (o nível + a qualidade — o PoB: mana_void_gain_%_missing_unreserved_mana_as_base_lightning_damage). */
export const manaQueFaltaDasLinhas = (slug, linhas = [], daQualidade = []) => (slug === 'Manabond' ? somar([...linhas, ...daQualidade], LINHA_MANA_QUE_FALTA) : 0);
/**
 * O Raio do Vínculo de Mana (o PoB, act_int.lua:13526: LightningMin/Max BASE = floor(X% × a Mana Não Reservada que falta) — o "adicionado" do uso, × a Eficácia do
 * Dano Adicionado): a mana livre (a máxima menos a reservada) menos a de agora.
 */
export const raioDaManaQueFalta = (pct, manaMax, reservada, manaAgora) => Math.floor(((pct || 0) / 100) * Math.max(0, Math.max(0, (manaMax ?? 0) - (reservada ?? 0)) - Math.max(0, manaAgora ?? 0)));

// ---------------------------------------------------------------- o Contágio

const LINHA_ESPALHA_AO_MORRER = /^Espalha quando o Inimigo afetado morrer$/i;
const LINHA_ESPALHA_AO_ACERTAR = /^Espalha quando o Inimigo afetado for Acertado$/i;
/** `{ aoMorrer, aoAcertar }` ou null (D-B2.5). */
export function contagioDasLinhas(slug, linhas = []) {
  if (!/^Contagion/.test(slug)) return null;
  const aoMorrer = tem(linhas, LINHA_ESPALHA_AO_MORRER);
  const aoAcertar = tem(linhas, LINHA_ESPALHA_AO_ACERTAR);
  return aoMorrer || aoAcertar ? { aoMorrer, aoAcertar } : null;
}

// ---------------------------------------------------------------- a Chuva Tóxica (os esporos)

const LINHA_ESPORO_LENTO = /^Cada Esporo aplica ([\d.]+) % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de ([\d.]+) %$/i;
/** `{ porEsporoPct, maxPct }` (D-B2.1) ou null. */
export function esporosLentosDasLinhas(slug, linhas = []) {
  if (!/^Toxic_Rain/.test(slug)) return null;
  for (const l of linhas) { const m = LINHA_ESPORO_LENTO.exec(norm(l)); if (m) return { porEsporoPct: Number(m[1]), maxPct: Number(m[2]) }; }
  return null;
}
/**
 * (D-B2.1) O lento POR FONTE no bicho (`m.estados.poeLentoPorFonte = { [fonte]: { esporos: [{ n, ate }], porEsporoPct, maxPct } }`): os esporos de cada uso, pela
 * duração deles. O % de uma fonte agora: min(teto, X × os esporos vivos). O fator do passo: Π 1 ÷ (1 − % de cada fonte).
 */
export function porEsporos(m, fonte, n, ate, porEsporoPct, maxPct, agora) {
  const t = ((m.estados ??= {}).poeLentoPorFonte ??= {});
  const f = (t[fonte] ??= { esporos: [] });
  f.esporos = [...f.esporos.filter((e) => e.ate > agora), { n: Math.max(0, n | 0), ate }];
  f.porEsporoPct = porEsporoPct;
  f.maxPct = maxPct;
  return lentoDaFonte(f, agora);
}
export const lentoDaFonte = (f, agora) => Math.min(f?.maxPct ?? 0, (f?.porEsporoPct ?? 0) * (f?.esporos ?? []).filter((e) => e.ate > agora).reduce((s, e) => s + e.n, 0));
export function fatorDosLentosPorFonte(m, agora) {
  let f = 1;
  for (const x of Object.values(m?.estados?.poeLentoPorFonte ?? {})) { const p = lentoDaFonte(x, agora); if (p > 0) f /= Math.max(0.1, 1 - p / 100); }
  return f;
}

// ---------------------------------------------------------------- a Chama Purificadora

const LINHA_RAIO_DO_SAGRADO = /^\+?([\d.]+) metros ao raio do Solo Sagrado$/i;
const LINHA_ONDA_MENOS = /^Onda de Choque causa \+?([\d.]+) % menos Dano$/i;
const LINHA_ONDA_MAIS = /^Onda de Choque causa \+?([\d.]+) % mais Dano$/i;
/**
 * A CHAMA PURIFICADORA (o PoB, act_int.lua:14349: "creates Consecrated Ground and deals damage in an area around the targeted location. A larger shockwave then
 * expands outwards, damaging enemies standing on Consecrated Ground that were not already hit"): `{ sagradoExtraM, ondaRaioM, ondaMaisPct, duracaoMs }` — o Solo
 * Sagrado no raio do acerto inicial + o "+X metros" (active_skill_ground_consecration_radius_+), a onda de 5 m (radiusSecondary 50) com o "mais/menos" dela
 * (sanctify_wave_damage_+%_final). Null fora dela.
 */
export const CHAMA_PURIFICADORA = Object.freeze({ ondaRaioM: 5 });
export function chamaPurificadoraDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Purifying_Flame/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  return { sagradoExtraM: somar(todas, LINHA_RAIO_DO_SAGRADO), ondaRaioM: CHAMA_PURIFICADORA.ondaRaioM, ondaMaisPct: somar(todas, LINHA_ONDA_MAIS) - somar(todas, LINHA_ONDA_MENOS), duracaoMs: Math.round((stats.duracao ?? 4) * 1000) };
}

// ---------------------------------------------------------------- a Tormenta Flamejante Vaal

const LINHA_TIROS = /^(\d+) Tiros$/i;
const LINHA_SOLO_ARDENTE_DURA = /^Solo Ardente dura ([\d.]+) segundos?$/i;
const LINHA_IMPACTOS_AREA = /^Impactos têm ([\d.]+) % mais Efeito em Área$/i;
/**
 * A TORMENTA FLAMEJANTE VAAL (o PoB, act_int.lua:6218: "A fixed number of flaming bolts rain down … They explode when landing, dealing damage to nearby enemies and
 * leaving burning ground"): a tempestade do A3b-2 com N impactos ("16 Tiros" — vaal_firestorm_number_of_meteors), um a cada 0,5 s (fire_storm_fireball_delay_ms
 * 500, como a comum lê os 150 dela), caindo na área de 2 m (radiusSecondary 20); cada impacto no raio da gema × √(1 + 20%) ("Impactos têm 20% mais Efeito em
 * Área" — vaal_firestorm_gem_explosion_area_of_effect_+%_final) e deixa o Solo Ardente no raio dele por 6 s (× a Duração), com o dano degenerativo da gema (o
 * PoB: dotIsBurningGround). `{ tipo: 'tempestade', … }` ou null.
 */
export const TORMENTA_VAAL = Object.freeze({ intervaloMs: 500, areaM: 2 });
export function tormentaVaalDasLinhas(slug, linhas = []) {
  if (slug !== 'Vaal_Firestorm') return null;
  const n = achar(linhas, LINHA_TIROS);
  if (!n) return null;
  return {
    tipo: 'tempestade', semAcerto: true, intervaloMs: TORMENTA_VAAL.intervaloMs, areaM: TORMENTA_VAAL.areaM, total: n, primeiroMaisPct: 0, primeiroAreaPct: 0, max: 1,
    impactoAreaMaisPct: achar(linhas, LINHA_IMPACTOS_AREA) ?? 0, soloMs: Math.round((achar(linhas, LINHA_SOLO_ARDENTE_DURA) ?? 0) * 1000),
  };
}

// ---------------------------------------------------------------- o Chicote Ardente

const LINHA_CONTRA_INCENDIADOS = /^\+?([\d.]+) % mais Dano com Acertos contra Inimigos Incendiados$/i;
const LINHA_NAO_INCENDEIA = /^Não pode Incendiar$/i;
const LINHA_LARGURA = /^\+?([\d.]+) de largura do Efeito em Área$/i;
/**
 * O CHICOTE ARDENTE (o PoB, act_int.lua:6603): "X% mais Dano com Acertos contra Inimigos Incendiados" (flame_whip_damage_+%_final_vs_burning_enemies, ModFlag.Hit — o
 * nível + a qualidade), "Não pode Incendiar" (never_ignite) e "+N de largura do Efeito em Área" (active_skill_base_area_length_+ → AreaOfEffect BASE: o PoB soma N
 * unidades ao raio-base — CalcOffence.lua:360 —, 10 unidades = 1 m). `{ contraIncendiadoPct, naoIncendeia, raioExtraM }` ou null.
 */
export function chicoteDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Flame_Surge/.test(slug)) return null;
  return { contraIncendiadoPct: somar([...linhas, ...daQualidade], LINHA_CONTRA_INCENDIADOS), naoIncendeia: tem(linhas, LINHA_NAO_INCENDEIA), raioExtraM: (achar(linhas, LINHA_LARGURA) ?? 0) / 10 };
}

// ---------------------------------------------------------------- o objeto do uso

/** O objeto do uso das gemas do lote (a Explosão Voltáxica, a Tormenta Flamejante Vaal), ou null. */
export function objetoDaGema(slug, linhas = [], daQualidade = [], stats = {}) {
  return voltaxicaDasLinhas(slug, linhas, daQualidade, stats) ?? tormentaVaalDasLinhas(slug, linhas);
}

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaB2(slug, l) {
  const t = norm(l);
  if (/^Reap(_of_Butchery)?$/.test(slug) && (LINHA_GANHA_SANGRENTA.test(t) || LINHA_CUSTO_POR_SANGRENTA.test(t) || LINHA_DANO_POR_SANGRENTA.test(t))) return true;
  if (slug === 'Vaal_Reap' && (LINHA_SANGUE_PERDURA.test(t) || LINHA_MAX_SANGUE.test(t) || LINHA_DA_MAX_SANGUE.test(t) || LINHA_DANO_POR_SANGRENTA.test(t))) return true;
  if (slug === 'Infernal_Blow' && (LINHA_DEBUFF_POR_CARGA.test(t) || LINHA_EXPLOSAO_DO_CADAVER.test(t) || LINHA_RAIO_DA_EXPLOSAO.test(t))) return true;
  if (slug === 'Corrupting_Fever' && (LINHA_FEBRE_RENOVA.test(t) || LINHA_FEBRE_PENALIDADE.test(t))) return true;
  if (slug === 'Voltaxic_Burst' && (LINHA_CONVERTE_RAIO_EM_CAOS.test(t) || LINHA_POR_AGUARDANDO.test(t))) return true;
  if (slug === 'Dark_Bargain_of_Trarthus' && (LINHA_RUINA.test(t) || LINHA_RUINA_EXTRA.test(t))) return true;
  if (slug === 'Manabond' && LINHA_MANA_QUE_FALTA.test(t)) return true;
  if (/^Contagion/.test(slug) && (LINHA_ESPALHA_AO_MORRER.test(t) || LINHA_ESPALHA_AO_ACERTAR.test(t))) return true;
  if (/^Toxic_Rain/.test(slug) && LINHA_ESPORO_LENTO.test(t)) return true;
  if (/^Purifying_Flame/.test(slug) && (LINHA_RAIO_DO_SAGRADO.test(t) || LINHA_ONDA_MENOS.test(t) || LINHA_ONDA_MAIS.test(t))) return true;
  if (slug === 'Vaal_Firestorm' && (LINHA_TIROS.test(t) || LINHA_SOLO_ARDENTE_DURA.test(t) || LINHA_IMPACTOS_AREA.test(t))) return true;
  if (slug === 'Flame_Surge' && (LINHA_CONTRA_INCENDIADOS.test(t) || LINHA_NAO_INCENDEIA.test(t) || LINHA_LARGURA.test(t))) return true;
  if (slug === 'Flame_Surge_of_Combusting' && LINHA_LARGURA.test(t)) return true;
  return false;
}
/** (o Golpe Infernal) o morto com o debuff explode como cadáver — a gema tem o efeito de cadáver dela (o status não diz "o uso de cadáveres não existe"). */
export const explodeAoMorrer = (slug) => slug === 'Infernal_Blow';
/** O dano degenerativo da gema é o do CHÃO (não vem no acerto): o Sangue Fervendo do Ceifar Vaal e o Solo Ardente da Tormenta Flamejante Vaal (o PoB: dotIsArea). */
export const degenNoChao = (slug) => slug === 'Vaal_Reap' || slug === 'Vaal_Firestorm';
