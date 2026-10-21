// O LOTE B3 das gemas ativas do PoE (dono, 21/10: as de ondas, sequências, formas e cadáveres — a Cascata Glacial, a Retribuição Divina, a Rajada Divina, a
// Chuva Cinética do Impacto, o Tiro Tornado da Nuvem Explosiva, a Conflagração, o Morto Volátil, as Cremações da Exumação e do Vulcão, a Troca de Corpos, a
// Chuva de Lâminas de Trarthus e a Invocar Tormenta Vaal). Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas
// puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o status) e `acoes.mjs` (o uso, os objetos e o tique).
//
// As decisões do dono (21/10 — as recomendações do plano do grupo área/nova/chuva/orbe, aceitas):
//   - D-B3.1: as ondas sem fonte de tempo nem de posição — a Retribuição Divina: as 4 ondas em anéis que crescem (o anel k a k casas do centro), as 6 explosões
//     sorteadas no anel; a Cascata Glacial: as rajadas em linha até o alvo (como a Ruptura do A4), a última — a Explosão Final — com o "mais" e o raio maior;
//   - D-B3.2: a Conflagração pelo PoB (act_dex.lua:4236): 3 flechas (os "+N projéteis" valem), a primeira no alvo e as outras sorteadas no raio de 3 m (o "6 m" do
//     relatório era o diâmetro do modo 7), o impacto de 1 m; as flechas ficam presas 6 s (até 20 não ativadas); a explosão de 2 m (a do nível) com +50% (+1,5 por
//     qualidade) e o Fogo degenerativo de 4 s; uma explosão detona as presas no raio dela;
//   - D-B3.3: a Troca de Corpos — sem cadáver perto do alvo, você explode no lugar e teleporta para o lado do alvo; com cadáver, consome-o (a explosão do cadáver
//     com os 300% mais Área) e teleporta para ele; o teleporte segue as regras do A1b (não conta como movimento);
//   - D-B3.4: a Chuva de Lâminas de Trarthus liga e desliga; o custo é o do PoB — `ManaPercentPerMinute` 300 = 5% da Mana máxima por segundo (o poedb: "Custo: 5%
//     Mana por segundo"); a rajada a cada 0,7 s ÷ (1 + 2% × ⌊Mana máxima ÷ 100⌋), em volta de você, 5 lâminas (cada uma num inimigo diferente da área, se der), as
//     5 Lâminas Persistentes do D8 do A3b;
//   - D-B3.5: a Cremação do Vulcão — o gêiser na casa do alvo (sem cadáver), até 8 (+1 a cada 10 de qualidade), por 2 s (× a Duração).
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));

// ---------------------------------------------------------------- a Cascata Glacial (a sequência `cascata`)

const LINHA_RAJADAS = /^Causa (\d+) rajadas$/i;
const LINHA_RAJADAS_Q = /^Causa \+([\d.]+) rajadas$/i;
const LINHA_FINAL = /^Explosão Final Causa \+ ?([\d.]+) % mais Dano$/i;
const LINHA_FINAL_Q = /^Explosão Final causa \+ ?([\d.]+) % de dano$/i;
const LINHA_EMPURRA = /^Empurra Inimigos ao Acertar$/i;
/**
 * A CASCATA GLACIAL (o PoB, act_int.lua:8765: radius 12, a Explosão Final com radiusExtra 12 — "Final Burst" —, upheaval_number_of_spikes 4,
 * glacial_cascade_final_spike_damage_+%_final 200 + 2,5 por qualidade): `{ forma: 'cascata', areas, raioM, final: { raioM, maisPct } | null }`; a da Fissura —
 * 6 rajadas + 0,1 por qualidade (⌊⌋), sem a final. Null fora delas.
 */
export const CASCATA = Object.freeze({ raioM: 1.2, finalExtraM: 1.2 });
export function cascataDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Glacial_Cascade(_of_the_Fissure)?$/.test(slug)) return null;
  const base = achar(linhas, LINHA_RAJADAS);
  if (!base) return null;
  const temFinal = tem(linhas, LINHA_FINAL);
  return {
    forma: 'cascata', areas: base + Math.floor(somar(daQualidade, LINHA_RAJADAS_Q) + 1e-9), raioM: CASCATA.raioM,
    final: temFinal ? { raioM: CASCATA.raioM + CASCATA.finalExtraM, maisPct: somar(linhas, LINHA_FINAL) + somar(daQualidade, LINHA_FINAL_Q) } : null,
  };
}

// ---------------------------------------------------------------- a Retribuição Divina (a sequência `ondas`)

const LINHA_ONDAS = /^Causa (\d+) Ondas$/i;
const LINHA_EXPLOSOES = /^Cada onda tem (\d+) Explosões$/i;
const LINHA_RAIO_DO_ESTOURO = /^Raio do Estouro é de ([\d.]+) metros?$/i;
/**
 * A RETRIBUIÇÃO DIVINA (o PoB, act_int.lua:4906: divine_retribution_num_waves 4, divine_retribution_blasts_per_wave 6, o raio 12 + o do nível — 1,6 m no 20;
 * "multiple waves of lightning bursts expand outward from a targeted location"): `{ forma: 'ondas', ondas, porOnda, raioM }`. O raio vem da coluna do poedb
 * (`raioM` do leitor — a célula "2, 1.6" tem o raio no segundo número). Null fora dela.
 */
export function retribuicaoDasLinhas(slug, linhas = [], raioM = null) {
  if (slug !== 'Divine_Retribution') return null;
  const ondas = achar(linhas, LINHA_ONDAS);
  const porOnda = achar(linhas, LINHA_EXPLOSOES);
  if (!ondas || !porOnda) return null;
  return { forma: 'ondas', ondas, porOnda, raioM: raioM ?? achar(linhas, LINHA_RAIO_DO_ESTOURO) ?? 1.2 };
}
/** As casas do anel `k` (Chebyshev) em volta de `c` (k = 0: o centro). */
export function anel(c, k) {
  if (k <= 0) return [{ x: c.x, y: c.y }];
  const r = [];
  for (let dx = -k; dx <= k; dx++) for (let dy = -k; dy <= k; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === k) r.push({ x: c.x + dx, y: c.y + dy });
  return r;
}
/** `n` casas sorteadas (sem repetir, se der) de `casas`. */
export function sortearCasas(casas, n, rng = Math.random) {
  const pool = [...casas];
  const r = [];
  for (let i = 0; i < n && casas.length; i++) {
    if (!pool.length) pool.push(...casas);
    r.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  }
  return r;
}

// ---------------------------------------------------------------- a Chuva Cinética do Impacto (a sequência `chuvaRetangular`)

const LINHA_COMPRIMENTO = /^A área alvejada base mede ([\d.]+) metros de comprimento$/i;
const LINHA_LARGURA = /^Circunferência base da área-alvo é de ([\d.]+) metros$/i;
/**
 * A CHUVA CINÉTICA DO IMPACTO (o PoB, act_int.lua:11577: radius 90 e secondary 45 no modo 8 — o retângulo à sua frente —, o tertiary 12 — a explosão; "a number of
 * projectiles rain down within a large area in front of you, directly targeting the locations of enemies in the area"): `{ forma: 'chuvaRetangular', comprimentoM,
 * larguraM }` (os projéteis e a explosão vêm do uso). Null fora dela.
 */
export function chuvaRetangularDasLinhas(slug, linhas = []) {
  if (slug !== 'Kinetic_Rain_of_Impact') return null;
  const comprimentoM = achar(linhas, LINHA_COMPRIMENTO);
  const larguraM = achar(linhas, LINHA_LARGURA);
  return comprimentoM && larguraM ? { forma: 'chuvaRetangular', comprimentoM, larguraM } : null;
}

/** A sequência do lote (`GemasPoe.sequenciaDaGema`), ou null. */
export function sequenciaDasLinhas(slug, linhas = [], daQualidade = [], { raioDoEstouroM = null } = {}) {
  return cascataDasLinhas(slug, linhas, daQualidade) ?? retribuicaoDasLinhas(slug, linhas, raioDoEstouroM) ?? chuvaRetangularDasLinhas(slug, linhas);
}

// ---------------------------------------------------------------- os objetos do uso

const LINHA_EXPLOSAO_DIVINA = /^Explosão causa ([\d.]+) % mais Dano com Acertos e Afecções$/i;
const LINHA_RAIO_EXPLOSAO = /^Raio Base da explos[aã]o igual a ([\d.]+) metros?$/i;
const LINHA_ORBE_POR_SEGUNDO = /^Taxa base de explosão do orbe é de uma vez por segundo$/i;
const LINHA_MAX_ORBES = /^Máximo de (\d+) orbes$/i;
const LINHA_CARREGAMENTO = /^Dispara um Carregamento de Flechas no ar Projéteis Disparam de onde a Flecha com o Carregamento cair$/i;
const LINHA_ATACA_A_CADA = /^Ataca um Inimigo a cada ([\d.]+) segundos$/i;
/**
 * A RAJADA DIVINA (o PoB, act_str.lua:2738: a implosão no raio secundário — 1,2 m — e, depois da duração (1,2 s), a explosão no raio 26 com
 * discus_slam_damage_+%_final_for_shockwave 100 — Hit e Ailment); a do ESPLENDOR (act_str.lua:2837): o orbe fica a duração (5 s) e explode a cada 1 s
 * (discus_slam_orb_activate_base_rate_ms 1000 — "Increases and reductions to attack speed affect the rate"), até 3 orbes, raio 22. O "+X metros de raio" da
 * qualidade (active_skill_base_radius_+) entra no raio da explosão (o primário, no PoB).
 * O TIRO TORNADO DA NUVEM EXPLOSIVA (act_dex.lua:16123: projectiles_rain + projectiles_nova): a flecha cai no local mirado e as flechas saem de lá em todas as
 * direções.
 * A INVOCAR TORMENTA VAAL (act_int.lua:18413: radius 16 — o raio de cada golpe —, radiusSecondary 40 — o raio final —, vaal_storm_call_base_delay_ms 200 —
 * "Modifiers to the skill's duration will also affect the delay between these strikes"): o marcador no local mirado, um golpe num inimigo sorteado em volta dele a
 * cada 0,2 s (× a Duração) pela duração, e o raio grande no fim.
 */
export const RAJADA_DIVINA = Object.freeze({ esplendorMs: 1000 });
export const TORMENTA_VAAL = Object.freeze({ raioFinalM: 4 });
export function objetoDaGema(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug === 'Divine_Blast') {
    const mais = achar(linhas, LINHA_EXPLOSAO_DIVINA);
    const raioM = achar(linhas, LINHA_RAIO_EXPLOSAO);
    return mais != null && raioM ? { tipo: 'explosaoDivina', semAcerto: false, atrasoMs: Math.round((stats.duracao ?? 1.2) * 1000), raioM: raioM + (stats.raioBonus ?? 0), maisPct: mais } : null;
  }
  if (slug === 'Divine_Blast_of_Radiance') {
    const raioM = achar(linhas, LINHA_RAIO_EXPLOSAO);
    return tem(linhas, LINHA_ORBE_POR_SEGUNDO) && raioM ? { tipo: 'orbeDivino', semAcerto: false, intervaloMs: RAJADA_DIVINA.esplendorMs, duracaoMs: Math.round((stats.duracao ?? 5) * 1000), raioM: raioM + (stats.raioBonus ?? 0), max: achar(linhas, LINHA_MAX_ORBES) ?? 3 } : null;
  }
  if (slug === 'Tornado_Shot_of_Cloudburst') return tem(linhas, LINHA_CARREGAMENTO) ? { tipo: 'carregamento', semAcerto: true } : null;
  if (slug === 'Vaal_Storm_Call') {
    const cada = achar(linhas, LINHA_ATACA_A_CADA);
    return cada ? { tipo: 'tormentaVaal', semAcerto: true, intervaloMs: Math.round(cada * 1000), duracaoMs: Math.round((stats.duracao ?? 6) * 1000), raioFinalM: TORMENTA_VAAL.raioFinalM } : null;
  }
  return null;
}
/** Os ângulos das N flechas do carregamento: em volta (360° ÷ N), a partir de `a0`. */
export const angulosEmVolta = (n, a0 = 0) => Array.from({ length: Math.max(0, n) }, (_, k) => a0 + (2 * Math.PI * k) / Math.max(1, n));

// ---------------------------------------------------------------- a Conflagração

const LINHA_EXPLOSAO_CONFLAGRACAO = /^Explosão causa \+ ?([\d.]+) % de dano com ataques e afecções$/i;
const LINHAS_CONFLAGRACAO = /^As flechas após a primeira caem em um raio base de [\d.]+ metros$|^Raio de alcance base do impacto é de [\d.]+ metros?$|^Explosão causa \+ ?[\d.]+ % de dano com ataques e afecções$|^Duração da penalidade base é de [\d.]+ segundos$/i;
/**
 * A CONFLAGRAÇÃO pelo PoB (act_dex.lua:4236 — D-B3.2; as faixas do poedb salvo estão corrompidas abaixo do nível 20: "11 — 181367 projéteis", "20 — 50 flechas"):
 * base_number_of_projectiles 3, o raio 30 (as flechas depois da primeira caem nele), o secundário 10 (o impacto), napalm_arrow_maximum_number_of_unprimed_arrows_allowed
 * 20, a duração de 6 s (as flechas presas), a secundária de 4 s (o Fogo degenerativo da explosão), napalm_arrow_detonation_hit_damage_+%_final 50 (+1,5 por qualidade —
 * Hit e Ailment). O raio da explosão (o terciário) é o do nível — a coluna do poedb (`raioExplosaoM`). `{ flechas, quedaM, impactoM, maxFlechas, presaMs, penalidadeMs,
 * explosaoMaisPct, explosaoM }` ou null.
 */
export const CONFLAGRACAO = Object.freeze({ flechas: 3, quedaM: 3, impactoM: 1, maxFlechas: 20, presaMs: 6000, penalidadeMs: 4000, explosaoMaisPct: 50, gatilhoCasas: 1 });
export function conflagracaoDasLinhas(slug, linhas = [], daQualidade = [], raioExplosaoM = null) {
  if (slug !== 'Conflagration') return null;
  return { ...CONFLAGRACAO, explosaoMaisPct: CONFLAGRACAO.explosaoMaisPct + somar(daQualidade, LINHA_EXPLOSAO_CONFLAGRACAO), explosaoM: raioExplosaoM ?? achar(linhas, LINHA_RAIO_EXPLOSAO) ?? 2 };
}

// ---------------------------------------------------------------- a Cremação da Exumação e a do Vulcão

const LINHA_EXPLODE_AO_DISPARAR = /^Explode um Cadáver próximo ao Disparar Projéteis$/i;
const LINHA_MAIS_RAPIDO = /^Dispara Projéteis ([\d.]+) % mais rápido$/i;
const LINHA_DISPARA_A_CADA = /^Dispara Projéteis a cada ([\d.]+) segundos?$/i;
const LINHA_MAX_GEISERES = /^Máximo de (\d+) gêiseres por vez$/i;
const LINHA_MAX_GEISERES_Q = /^Máximo de \+([\d.]+) gêiseres por vez$/i;
const LINHA_PROJETEIS = /^Dispara (\d+) projéteis$/i;
/** (a Exumação: cremation_chance_to_explode_nearby_corpse_when_firing_projectiles 100 — act_dex.lua:4520) o gêiser explode um cadáver perto a cada disparo. */
export const explodeAoDispararDasLinhas = (slug, linhas = []) => slug === 'Cremation_of_Exhuming' && tem(linhas, LINHA_EXPLODE_AO_DISPARAR);
/** O raio (casas) em que o gêiser da Exumação procura o cadáver ("nearby" — o PoE não publica: o raio em que o projétil do gêiser procura o inimigo). */
export const RAIO_DO_CADAVER_DO_GEISER = 3;
/**
 * (D-B3.5) A CREMAÇÃO DO VULCÃO (o PoB, act_dex.lua:4580: "Creates a volcanic geyser at a location" — sem cadáver; corpse_erruption_base_maximum_number_of_geyers 8
 * + 0,1 por qualidade, a cada 1 s, 4 projéteis, 2 s): `{ intervaloMs, duracaoMs, projeteis, max }` ou null.
 */
export function vulcaoDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug !== 'Cremation_of_the_Volcano') return null;
  const cada = achar(linhas, LINHA_DISPARA_A_CADA);
  const max = achar(linhas, LINHA_MAX_GEISERES);
  if (!cada || !max) return null;
  return { intervaloMs: Math.round(cada * 1000), duracaoMs: Math.round((stats.duracao ?? 2) * 1000), projeteis: achar(linhas, LINHA_PROJETEIS) ?? stats.projeteis ?? 4, max: max + Math.floor(somar(daQualidade, LINHA_MAX_GEISERES_Q) + 1e-9) };
}

// ---------------------------------------------------------------- a Troca de Corpos

const LINHA_TROCA_DANO = /^Esta Magia causa ([\d.]+) a ([\d.]+) , mais ([\d.]+) % da sua Vida Máxima, como Dano de Fogo base$/i;
const LINHA_TROCA_DANO_Q = /^Causa \+([\d.]+) % da sua Vida Máxima como Dano de Fogo base$/i;
const LINHA_TROCA_CADAVER = /^Explosão causa Dano de Fogo base igual a ([\d.]+) % da Vida Máxima do Cadáver$/i;
const LINHA_TROCA_AREA = /^([\d.]+) % mais Área de Efeito se Consumiu um cadáver$/i;
/**
 * A TROCA DE CORPOS (o PoB, act_int.lua:2276 — D-B3.3): a "Self Explosion" com o Fogo base da linha + X% da Vida máxima (spell_base_fire_damage_%_maximum_life 6 +
 * 0,3 por qualidade — FireBonusMin/Max, na base: × o baseMultiplier, sem a Eficácia), em área nos DOIS lugares (de onde você sai e onde chega), no raio 14 + o do
 * nível; a "Corpse Explosion" do cadáver consumido (corpse_explosion_monster_life_permillage_fire), com corpse_warp_area_of_effect_+%_final_when_consuming_corpse 300
 * só nela. `{ min, max, vidaPct, cadaverPct, areaCadaverMaisPct, raioM }` ou null.
 */
export const TROCA_DE_CORPOS = Object.freeze({ raioBaseM: 1.4, cadaverPertoCasas: 3 });
export function trocaDeCorposDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug !== 'Bodyswap') return null;
  for (const l of linhas) {
    const m = LINHA_TROCA_DANO.exec(norm(l));
    if (!m) continue;
    return {
      min: Number(m[1]), max: Number(m[2]), vidaPct: Number(m[3]) + somar(daQualidade, LINHA_TROCA_DANO_Q),
      cadaverPct: achar(linhas, LINHA_TROCA_CADAVER) ?? 0, areaCadaverMaisPct: achar(linhas, LINHA_TROCA_AREA) ?? 0,
      raioM: TROCA_DE_CORPOS.raioBaseM + (stats.raioBonus ?? 0),
    };
  }
  return null;
}
/** O Fogo base da Troca de Corpos com a Vida máxima de agora: [min, max] (a parte da Vida inteira — o PoB: output.Life × o multiplicador). */
export const fogoDaTroca = (t, vidaMax) => { const v = Math.floor(Math.max(0, vidaMax ?? 0) * (t.vidaPct / 100)); return [t.min + v, t.max + v]; };

// ---------------------------------------------------------------- a Chuva de Lâminas de Trarthus

const LINHA_RAJADA_A_CADA = /^Uma rajada de lâminas cai a cada ([\d.]+) segundos$/i;
const LINHA_FREQ_POR_MANA = /^([\d.]+) % maior frequência de rajadas por ([\d.]+) de mana máximo$/i;
const LINHA_RAIO_SARAIVADA = /^O raio base da Saraivada é de ([\d.]+) metros$/i;
const LINHA_RAIO_LAMINA = /^Raio base da lâmina é de ([\d.]+) metros?$/i;
const LINHA_LAMINAS_POR_RAJADA = /^Cada rajada dispara (\d+) lâminas, que permanecem no chão$/i;
const LINHA_MAX_LAMINAS = /^Máxim[n]?o de (\d+) Lâminas Persistentes podem ser deixadas no chão por vez$/i;
/**
 * (D-B3.4) A CHUVA DE LÂMINAS DE TRARTHUS (o PoB, act_dex.lua:2777): liga e desliga; ligada, gasta 5% da Mana máxima por segundo (cost ManaPercentPerMinute 300 — o
 * divisor de 60 do "per minute"; o poedb: "Custo: 5% Mana por segundo"); a rajada a cada bladefall_base_volley_frequency_ms 700 ÷ (1 + 2% × ⌊Mana máxima ÷ 100⌋ —
 * PerStat Mana div 100), no raio 25 (+ o "+X metros de raio" da qualidade, active_skill_base_area_of_effect_radius 0,15/ponto) em volta de você; cada uma das 5 lâminas
 * num inimigo diferente da área, se der (raio secundário 10), e cada inimigo leva um acerto por rajada; as lâminas ficam (maximum_number_of_blades_left_in_ground 40,
 * 6 s). `{ intervaloMs, porManaPct, porMana, raioM, laminaM, laminas, maxPersistentes, persistenteMs, custoPctPorS }` ou null.
 */
export const TRARTHUS = Object.freeze({ custoPctPorS: 5 });
export function trarthusDasLinhas(slug, linhas = [], stats = {}) {
  if (slug !== 'Bladefall_of_Trarthus') return null;
  const cada = achar(linhas, LINHA_RAJADA_A_CADA);
  if (!cada) return null;
  let porManaPct = 0;
  let porMana = 100;
  for (const l of linhas) { const m = LINHA_FREQ_POR_MANA.exec(norm(l)); if (m) { porManaPct = Number(m[1]); porMana = Number(m[2]); } }
  return {
    intervaloMs: Math.round(cada * 1000), porManaPct, porMana, raioM: (achar(linhas, LINHA_RAIO_SARAIVADA) ?? 2.5) + (stats.raioBonus ?? 0), laminaM: achar(linhas, LINHA_RAIO_LAMINA) ?? 1,
    laminas: achar(linhas, LINHA_LAMINAS_POR_RAJADA) ?? 5, maxPersistentes: achar(linhas, LINHA_MAX_LAMINAS) ?? 40, persistenteMs: Math.round((stats.duracao ?? 6) * 1000), custoPctPorS: TRARTHUS.custoPctPorS,
  };
}
/** O intervalo das rajadas (ms) com a Mana máxima: base ÷ (1 + X% × ⌊Mana ÷ N⌋). */
export const intervaloDaTrarthus = (t, manaMax) => t.intervaloMs / (1 + (t.porManaPct * Math.floor(Math.max(0, manaMax ?? 0) / Math.max(1, t.porMana) + 1e-9)) / 100);
/** A mana que a Chuva de Trarthus gasta em `dtMs` (5% da máxima por segundo, × o multiplicador de custo do uso). */
export const custoDaTrarthus = (t, manaMax, dtMs, fatorDeCusto = 1) => ((t.custoPctPorS / 100) * Math.max(0, manaMax ?? 0) * Math.max(0, dtMs)) / 1000 * Math.max(0, fatorDeCusto);

// ---------------------------------------------------------------- as linhas que não se aplicam

/**
 * "Velocidade de Movimento do Orbe aumentada em X%" (a qualidade do Morto Volátil — volatile_dead_core_movement_speed_+%): só a trajetória do orbe até o inimigo; o
 * PoB não a usa na conta, e o orbe do jogo acerta no uso (como as linhas de trajetória do lote A3 — `LINHAS_QUE_NAO_SE_APLICAM`).
 */
export const LINHA_VELOCIDADE_DO_ORBE = /^Velocidade de Movimento do Orbe aumentada em [\d.]+ ?%$/i;

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaB3(slug, l) {
  const t = norm(l);
  if (/^Glacial_Cascade(_of_the_Fissure)?$/.test(slug) && (LINHA_RAJADAS.test(t) || LINHA_RAJADAS_Q.test(t) || LINHA_FINAL.test(t) || LINHA_FINAL_Q.test(t) || LINHA_EMPURRA.test(t))) return true;
  if (slug === 'Divine_Retribution' && (LINHA_ONDAS.test(t) || LINHA_EXPLOSOES.test(t))) return true;
  if (slug === 'Kinetic_Rain_of_Impact' && (LINHA_COMPRIMENTO.test(t) || LINHA_LARGURA.test(t))) return true;
  if (slug === 'Divine_Blast' && LINHA_EXPLOSAO_DIVINA.test(t)) return true;
  if (slug === 'Divine_Blast_of_Radiance' && LINHA_ORBE_POR_SEGUNDO.test(t)) return true;
  if (slug === 'Tornado_Shot_of_Cloudburst' && LINHA_CARREGAMENTO.test(t)) return true;
  if (slug === 'Vaal_Storm_Call' && LINHA_ATACA_A_CADA.test(t)) return true;
  if (slug === 'Conflagration' && LINHAS_CONFLAGRACAO.test(t)) return true;
  if (slug === 'Cremation_of_Exhuming' && (LINHA_EXPLODE_AO_DISPARAR.test(t) || LINHA_MAIS_RAPIDO.test(t))) return true;
  if (slug === 'Cremation_of_the_Volcano' && (LINHA_DISPARA_A_CADA.test(t) || LINHA_MAX_GEISERES_Q.test(t))) return true;
  if (slug === 'Bodyswap' && (LINHA_TROCA_DANO.test(t) || LINHA_TROCA_DANO_Q.test(t) || LINHA_TROCA_AREA.test(t) || LINHA_TROCA_CADAVER.test(t))) return true;
  if (slug === 'Bladefall_of_Trarthus' && (LINHA_RAJADA_A_CADA.test(t) || LINHA_FREQ_POR_MANA.test(t) || LINHA_RAIO_SARAIVADA.test(t) || LINHA_RAIO_LAMINA.test(t) || LINHA_LAMINAS_POR_RAJADA.test(t) || LINHA_MAX_LAMINAS.test(t))) return true;
  return false;
}
/** A gema tem o uso de cadáver dela neste lote (o status não diz "o uso de cadáveres não existe"): a Troca de Corpos. */
export const usaCadaver = (slug) => slug === 'Bodyswap';
/** A gema tem o dano próprio que o compilador não lê (o status não diz "sem dano direto"): a Troca de Corpos (o Fogo base + a Vida). */
export const temDanoProprio = (slug) => slug === 'Bodyswap';
