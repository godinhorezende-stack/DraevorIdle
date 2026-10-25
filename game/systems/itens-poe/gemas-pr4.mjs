// O LOTE PR4 das gemas do PoE (dono, 25/10: as gemas ATIVAS de projétil e de ricochete que GRUDAM ou PULSAM no alvo e os feixes periódicos — a Flecha
// Explosiva, a Flecha Relampejante da Eletrocussão, o Golpe Estático e o de Relâmpagos Concentrados, o Ensanguentar, a Concha Somática e a Flecha
// Aprisionadora). Aqui ficam os DADOS das linhas e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (o status e os leitores no nível) e
// `acoes.mjs` (o uso, o acerto e o tique — `tiqueDasGemasPR4`) e `hunt/monstros.mjs` (o passo do Aprisionado).
//
// O que o lote faz, pelo PoE 1 (o PoB e o poedb), com as decisões do dono (25/10, as recomendações do plano aceitas):
//   - a FLECHA EXPLOSIVA (o PoB, act_dex.lua ExplosiveArrow): "Fires an arrow which will stick into an enemy … and then explode, dealing area damage around it,
//     either after a duration or when the maximum number of arrows stuck to that target is reached. If an enemy has multiple Explosive Arrows stuck in them, the
//     first one to explode will consume the others, adding their damage to its explosion". A explosão (as partes 1 e 2 do PoB): o dano base da arma × 50%
//     (explosive_arrow_explosion_base_damage_+permyriad −5000 → baseMultiplier 0,5), + 522–783 de Fogo (no nível 20), "100% mais Dano por flecha depois da
//     primeira" (os baseMods: Damage MORE 100 × ExplosiveArrowStageAfterFirst), 6% mais com Acertos e 3% mais com Afecções por flecha (MORE × ExplosiveArrowStage),
//     o raio 1,5 m (radius 15) + 0,2 m por flecha até +1,2 m (radiusExtra, limitVar 12), × √ da Área; máximo de 20 flechas (+0,1 por qualidade). D1 do dono: a
//     explosão sai a 1 s × a Duração da PRIMEIRA flecha grudada, ou no máximo, e o monstro que morre com flechas explode na hora. A flecha em si acerta como
//     a parte "Arrow" do PoB ("That works like a normal skill");
//   - a FLECHA RELAMPEJANTE DA ELETROCUSSÃO (LightningArrowAltX): "It sticks into the final target, causing them to be struck and damaged multiple times" —
//     lightning_arrow_alt_additional_strikes 4 (+0,05 por qualidade) a cada lightning_arrow_alt_strike_frequency_ms 500; máximo de 10 flechas por inimigo
//     (lightning_arrow_stack_limit — a 11ª tira a mais velha). Cada golpe é o acerto da habilidade só no alvo;
//   - o GOLPE ESTÁTICO (StaticStrike): "gaining static energy for a duration if you hit an enemy. While you have static energy, you'll frequently hit a number of
//     nearby enemies with beams" — 4 s × a Duração (o acerto renova), um pulso a cada static_strike_base_zap_frequency_ms (0,32 s no nível 20) ÷ (1 + a
//     Frequência aumentada — static_strike_zap_speed_+%, 1 por qualidade), em até static_strike_number_of_beam_targets (6) inimigos, "Raios causam 30% menos
//     Dano" (static_strike_beam_damage_+%_final, a parte "Beams"), cada feixe com os ricochetes da gema (number_of_chains 1). A parte "Melee hit" não ricocheteia
//     (chaining = false). D2 do dono: os N mais perto num raio de 2 m (radius 20 → 1 casa) × √ da Área, e a velocidade de ataque fora (só a frequência);
//   - o GOLPE ESTÁTICO DE RELÂMPAGOS CONCENTRADOS (StaticStrikeAltX): +1 Relâmpago Concentrado por acerto (static_strike_number_gathering_lightning_to_gain_on_hit),
//     máximo 10 (+0,1 por qualidade), "8% mais Dano com Acertos e Afecções por Relâmpago Concentrado" (hit_and_ailment_damage_+%_final_per_gathering_lightning —
//     MORE × o número, Hit e Ailment), 4 s × a Duração. O FEIXE ("While you have Gathering Lightning, attacks with this skill will cause chaining beams of lightning,
//     which chain additional times the more Gathering Lightning you have" — sem número no PoB nem no poedb): decisão do dono (25/10) — +1 ricochete a cada 2
//     Relâmpagos (5 no máximo de 10; 6 com os 12 da qualidade 20), 1 alvo por feixe (static_strike_number_of_beam_targets 1), sem o "30% menos" (a variante não
//     tem o static_strike_beam_damage_+%_final);
//   - o ENSANGUENTAR (Exsanguinate): "Releases several tendrils of blood from your character, targeting enemies in a narrow angle in front of you … Effects which
//     allow skills to chain can apply to these tendrils" — até blood_tendrils_beam_count (9) alvos, cada tentáculo com os ricochetes;
//   - a CONCHA SOMÁTICA (SomaticShell): "applies a shell to the first enemy struck. Damage from hits against that target is taken from the shell first. If fully
//     depleted, the shell will explode, dealing area damage and firing a projectile at another target to apply a new shell to it" — absorve 100% até 6214 (o
//     nível 20), 5 s × a Duração, a explosão com "750% mais Dano em Área" (active_skill_area_damage_+%_final, só a parte "Explosion") no raio 1,8 m (18 + 0,15
//     unidade por qualidade) × √ da Área, a imunidade de 200 ms (kinetic_shell_immunity_after_explosion_ms) antes de uma concha nova no mesmo alvo, a passagem a
//     1 outro alvo (kinetic_shell_transfer_to_X_targets_on_projectile_hit), no máximo 6 conchas (kinetic_shell_number_of_active_buffs_allowed). D3 do dono: os
//     números do PoB e a imunidade de 200 ms;
//   - a FLECHA APRISIONADORA (EnsnaringArrow): "tethering that enemy to it. Ensnared enemies have less movement speed while trying to break the snare. The snare
//     will break if they leave the area of effect" — "+20% de Dano de Projétil dos Acertos de Ataques sofrido" (ProjectileAttackDamageTaken INC, o debuff
//     Ensnared, effectStackLimit 1: não soma por corda), 40% / 30% / 25% menos Velocidade de Movimento por corda (Normal ou Mágico / Raro / Único —
//     tethered_movement_speed_+%_final_per_rope), até 3 cordas; a qualidade: o Efeito do Debuff (skill_buff_effect_+%). D4 do dono: a % de cada fonte guardada
//     (cada corda com a sua), o "menos" multiplicativo por corda, e o Aprisionamento quebra quando o bicho se afasta mais de 2 casas.
//
// EXCEÇÕES DO DONO (as escolhas sem fonte do lote — aprovadas pelo dono em 25/10): (1) as flechas grudam só no inimigo que acertam (a que erra ou acaba no chão some, sem explodir
// nem prender); (2) o "alvo final" de cada flecha é o último inimigo que ela acertou (com perfuração, ricochete ou retorno, o último da sequência dela); (3) as
// flechas, as conchas e as cordas são só do seu uso — o totem, a armadilha, a mina e o mercenário acertam como antes; (4) a explosão da Flecha Explosiva, a da
// Concha e o golpe das flechas grudadas saem no tique da caçada seguinte ao que as fez (o PoE: na hora); (5) o feixe do Golpe Estático sai de você e o
// ricochete dele salta como o das cadeias (os 2 casas do PoE 2, `DISTANCIA_DA_CADEIA_POE`); (6) os tentáculos do Ensanguentar: o alvo e os vivos mais perto
// de você num cone de 60° (±30°) na direção dele, ao alcance da gema — o "narrow angle" não tem número; (7) a Concha absorve os acertos das suas gemas (o
// golpe da habilidade, `acertar`): o golpe básico, o dano contínuo e o dos aliados passam direto; os acertos da própria Concha não a gastam ("damage_cannot_
// break_kinetic_shells"); a concha que passa vai para o vivo mais perto do estourado, a até o alcance da gema, sem concha e fora da imunidade; a 7ª concha
// tira a mais velha; (8) a âncora do Aprisionamento é a casa do bicho no primeiro acerto; o Efeito do Debuff vale no dano sofrido e no "menos Velocidade"; o
// dano sofrido multiplica com as outras vulnerabilidades, como o resto do motor (`Reforcos.vulnerabilidade`); só os acertos de projétil de ataque (a área e a
// explosão, não); (9) os Relâmpagos Concentrados: +1 por ataque que acerta (o uso e cada repetição), a duração renova a cada ganho e todos somem juntos; o
// "mais" do uso é o de antes do ganho.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const inteiro = (x) => Math.floor(x + 1e-9);
const xm = (a, b) => ((1 + (a ?? 0) / 100) * (1 + (b ?? 0) / 100) - 1) * 100;

// ---------------------------------------------------------------- a Flecha Explosiva

const LINHA_EA_BASE = /^Explosão causa ([\d.]+) % menos Dano Base$/i;
const LINHA_EA_FOGO = /^Explosões terão ([\d.]+) a ([\d.]+) de Dano de Fogo adicional$/i;
const LINHA_EA_RAIO = /^\+([\d.]+) metros ao Raio da Explosão por Flecha Explosiva no Alvo, máximo de \+([\d.]+) metros$/i;
const LINHA_EA_ACERTO = /^Explosão causa ([\d.]+) % mais Dano com Acertos por Flecha Explosiva no Alvo$/i;
const LINHA_EA_AFECCAO = /^Explosão causa ([\d.]+) % mais Dano com Afecções por Flecha Explosiva no Alvo$/i;
const LINHA_EA_MAXIMO = /^Máximo de \+?([\d.]+) Flechas Explosivas grudadas em cada Inimigo$/i;
/** (o PoB: radius 15 — 1,5 m — e a duração-base de 1 s, se a gema não publicar) */
export const FLECHA_EXPLOSIVA = Object.freeze({ raioM: 1.5, duracaoS: 1 });
/**
 * A Flecha Explosiva: `{ basePct, fogo: [min, max], raioPorFlechaM, raioMaxM, acertoPorFlechaPct, afeccaoPorFlechaPct, maximo }` — o % do dano base da arma
 * na explosão, o Fogo adicional dela, o raio por flecha e o teto, os "mais" por flecha e o máximo (com o da qualidade, para baixo) —, ou null.
 */
export function flechaExplosivaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Explosive_Arrow') return null;
  const menos = achar(linhas, LINHA_EA_BASE);
  if (menos == null) return null;
  return {
    basePct: Math.max(0, 100 - menos),
    fogo: [achar(linhas, LINHA_EA_FOGO, 1) ?? 0, achar(linhas, LINHA_EA_FOGO, 2) ?? 0],
    raioPorFlechaM: achar(linhas, LINHA_EA_RAIO, 1) ?? 0,
    raioMaxM: achar(linhas, LINHA_EA_RAIO, 2) ?? 0,
    acertoPorFlechaPct: achar(linhas, LINHA_EA_ACERTO) ?? 0,
    afeccaoPorFlechaPct: achar(linhas, LINHA_EA_AFECCAO) ?? 0,
    maximo: (achar(linhas, LINHA_EA_MAXIMO) ?? 20) + inteiro(somar(daQualidade, LINHA_EA_MAXIMO)),
  };
}
/** O raio-base (m) da explosão com `n` flechas: o da gema + o por flecha, até o teto (radiusExtra com limitTotal). */
export const raioDaExplosaoM = (d, n, raioBaseM = FLECHA_EXPLOSIVA.raioM) => raioBaseM + Math.min(d?.raioMaxM ?? 0, (d?.raioPorFlechaM ?? 0) * Math.max(0, n));
/**
 * Os "mais" da explosão com `n` flechas (o PoB): `{ todosPct, acertoPct, afeccaoPct }` — o "100% mais por flecha depois da primeira" (Damage MORE: o acerto
 * e as afecções), o "6% mais com Acertos por flecha" e o "3% mais com Afecções por flecha" (um MORE só, o valor × o número de flechas).
 */
export function maisDaExplosao(d, n) {
  const k = Math.max(1, Math.round(n));
  return { todosPct: 100 * (k - 1), acertoPct: (d?.acertoPorFlechaPct ?? 0) * k, afeccaoPct: (d?.afeccaoPorFlechaPct ?? 0) * k };
}

// ---------------------------------------------------------------- a Flecha Relampejante da Eletrocussão

const LINHA_LA_VEZES = /^Flechas causam Dano ao alvo final (\d+(?:\.\d+)?) vezes adicionais após grudar$/i;
const LINHA_LA_INTERVALO = /^Raios acertam a cada ([\d.]+) segundos$/i;
const LINHA_LA_MAXIMO = /^Máximo de (\d+) Flechas Relampejantes grudadas em um Inimigo$/i;
/** A Eletrocussão: `{ vezes, intervaloMs, maximo }` (as vezes com as da qualidade, para baixo), ou null. */
export function eletrocussaoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Lightning_Arrow_of_Electrocution') return null;
  const vezes = achar(linhas, LINHA_LA_VEZES);
  if (vezes == null) return null;
  return { vezes: vezes + inteiro(somar(daQualidade, LINHA_LA_VEZES)), intervaloMs: Math.round((achar(linhas, LINHA_LA_INTERVALO) ?? 0.5) * 1000), maximo: achar(linhas, LINHA_LA_MAXIMO) ?? 10 };
}

// ---------------------------------------------------------------- o Golpe Estático (e o de Relâmpagos Concentrados)

const LINHA_GE_INTERVALO = /^Raios Acertam Inimigos a cada ([\d.]+) segundos$/i;
const LINHA_GE_MENOS = /^Raios causam ([\d.]+) % menos Dano$/i;
const LINHA_GE_FREQ = /^Frequência do Raio aumentada em ([\d.]+) %$/i;
const LINHA_GE_ALVOS = /^Máximo de (\d+) alvos do feixe$/i;
/** (D2 do dono) o raio (m) em que os feixes procuram: o do PoB (radius 20 — 2 m), × √ da Área. */
export const GOLPE_ESTATICO = Object.freeze({ raioM: 2, duracaoS: 4 });
/** O Golpe Estático: `{ intervaloMs, menosPct, freqIncPct, alvos }`, ou null (a de Relâmpagos Concentrados não tem os feixes periódicos). */
export function estaticoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Static_Strike') return null;
  const s = achar(linhas, LINHA_GE_INTERVALO);
  if (s == null) return null;
  return { intervaloMs: Math.round(s * 1000), menosPct: achar(linhas, LINHA_GE_MENOS) ?? 0, freqIncPct: somar([...linhas, ...daQualidade], LINHA_GE_FREQ), alvos: achar(linhas, LINHA_GE_ALVOS) ?? 1 };
}
/** O intervalo (ms) dos feixes com a Frequência aumentada (o hitTimeOverride do PoB: repeatFrequency ÷ (1 + INC)). */
export const intervaloDoEstatico = (d) => Math.max(20, (d?.intervaloMs ?? 320) / Math.max(0.05, 1 + (d?.freqIncPct ?? 0) / 100));

const LINHA_RC_GANHA = /^Ganha (\d+) de Relâmpagos Concentrados ao atingir corpo a corpo$/i;
const LINHA_RC_MAXIMO = /^Máximo de (\d+) Relâmpagos Concentrados$/i;
const LINHA_RC_MAIS = /^\+ ?([\d.]+) % de dano com ataques e afecções por Relâmpagos Concentrados$/i;
const LINHA_RC_QUALIDADE = /^\+([\d.]+) de Relâmpagos Concentrados máximos$/i;
/** Os Relâmpagos Concentrados: `{ ganha, maximo, maisPct }` (o máximo com o da qualidade, para baixo), ou null. */
export function concentradosDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Static_Strike_of_Gathering_Lightning') return null;
  const ganha = achar(linhas, LINHA_RC_GANHA);
  if (ganha == null) return null;
  return { ganha, maximo: (achar(linhas, LINHA_RC_MAXIMO) ?? 10) + inteiro(somar(daQualidade, LINHA_RC_QUALIDADE)), maisPct: achar(linhas, LINHA_RC_MAIS) ?? 0 };
}

// ---------------------------------------------------------------- o Ensanguentar

const LINHA_TENTACULOS = /^Dispara tentáculos em até (\d+) Alvos?$/i;
/** (a exceção 6) o cone dos tentáculos: 60° (±30°) na direção do alvo. */
export const TENTACULOS = Object.freeze({ meioAnguloGraus: 30 });
/** Os tentáculos do Ensanguentar: o número de alvos, ou 0. (O da Transmissão — 1 alvo e os ricochetes — é o do lote PR1.) */
export const tentaculosDasLinhas = (slug, linhas = []) => (slug === 'Exsanguinate' ? achar(linhas, LINHA_TENTACULOS) ?? 0 : 0);
/**
 * Os alvos dos `n` tentáculos (a exceção 6): o alvo e os vivos mais perto de `origem` a até `alcance` casas (Chebyshev) num cone de ±30° em volta do rumo
 * de `origem` ao alvo (a casa de você, também). Sem alvo: [].
 */
export function alvosDosTentaculos(origem, alvo, vivos, n, alcance, meioGraus = TENTACULOS.meioAnguloGraus) {
  if (!alvo || !(n > 0)) return [];
  const rumo = Math.atan2(alvo.y - origem.y, alvo.x - origem.x);
  const meio = (meioGraus * Math.PI) / 180;
  const d = (b) => Math.max(Math.abs(b.x - origem.x), Math.abs(b.y - origem.y));
  const noCone = (b) => {
    if (b.x === origem.x && b.y === origem.y) return true;
    let a = Math.atan2(b.y - origem.y, b.x - origem.x) - rumo;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return Math.abs(a) <= meio + 1e-9;
  };
  const outros = vivos.filter((b) => b !== alvo && b.hp > 0 && d(b) <= alcance && noCone(b)).sort((a, b) => d(a) - d(b));
  return [alvo, ...outros].slice(0, Math.max(1, Math.round(n)));
}

// ---------------------------------------------------------------- a Concha Somática

const LINHA_CONCHA = /^Dano de ataques é absorvido pela concha antes de afetar a vida ou o escudo de Energia do alvo Concha pode sofrer até (\d+) de dano antes de explodir$/i;
const LINHA_CONCHA_MAXIMO = /^Máximo de (\d+) Conchas Somáticas$/i;
/** (o PoB — constantStats) a duração, o raio da explosão (em unidades de 1/10 m, + o da qualidade), o "mais Dano em Área", a imunidade e a passagem. */
export const CONCHA = Object.freeze({ duracaoS: 5, raioUnidades: 18, raioPorQualidade: 0.15, maisAreaPct: 750, imunidadeMs: 200, passa: 1, absorvePct: 100 });
/** A Concha Somática: `{ absorve, maximo, duracaoS, raioM, maisAreaPct, imunidadeMs, passa, absorvePct }`, ou null. */
export function conchaDasLinhas(slug, linhas = [], qualidade = 0) {
  if (slug !== 'Somatic_Shell') return null;
  const absorve = achar(linhas, LINHA_CONCHA);
  if (absorve == null) return null;
  return { absorve, maximo: achar(linhas, LINHA_CONCHA_MAXIMO) ?? 6, duracaoS: CONCHA.duracaoS, raioM: (CONCHA.raioUnidades + CONCHA.raioPorQualidade * Math.max(0, qualidade)) / 10, maisAreaPct: CONCHA.maisAreaPct, imunidadeMs: CONCHA.imunidadeMs, passa: CONCHA.passa, absorvePct: CONCHA.absorvePct };
}
/** O acerto `dano` num bicho com a concha `c` (`c.hp` o que ela ainda aguenta): `{ naVida, absorvido, estourou }` — muda `c.hp` no lugar. */
export function absorverNaConcha(c, dano, absorvePct = 100) {
  if (!c || !(c.hp > 0) || !(dano > 0)) return { naVida: dano, absorvido: 0, estourou: false };
  const absorvido = Math.min(c.hp, (dano * absorvePct) / 100);
  c.hp -= absorvido;
  return { naVida: Math.max(0, dano - absorvido), absorvido, estourou: c.hp <= 1e-9 };
}

// ---------------------------------------------------------------- a Flecha Aprisionadora

const LINHA_AP_DANO = /^Inimigos Aprisionados sofrem Dano de Projétil dos Acertos de Ataques aumentado em ([\d.]+) %$/i;
const LINHA_AP_NORMAL = /^Cada Aprisionamento aplica ([\d.]+) % menos Velocidade de Movimento aos Inimigos Normais ou Mágicos$/i;
const LINHA_AP_RARO = /^Cada Aprisionamento aplica ([\d.]+) % menos Velocidade de Movimento aos Inimigos Raros$/i;
const LINHA_AP_UNICO = /^Cada Aprisionamento aplica ([\d.]+) % menos Velocidade de Movimento aos Inimigos Únicos$/i;
const LINHA_AP_MAXIMO = /^Máximo de (\d+) Aprisionamentos por Inimigo$/i;
const LINHA_AP_EFEITO = /^Efeito do Debuff aumentado em ([\d.]+) %$/i;
/** (D4 do dono) o Aprisionamento quebra quando o bicho se afasta mais de 2 casas da âncora. */
export const APRISIONAMENTO = Object.freeze({ quebraCasas: 2 });
/** A Flecha Aprisionadora: `{ danoSofridoPct, menosPct: { normal, raro, unico }, maximo, efeitoPct }`, ou null. */
export function aprisionadoraDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Ensnaring_Arrow') return null;
  const danoSofridoPct = achar(linhas, LINHA_AP_DANO);
  if (danoSofridoPct == null) return null;
  return {
    danoSofridoPct,
    menosPct: { normal: achar(linhas, LINHA_AP_NORMAL) ?? 0, raro: achar(linhas, LINHA_AP_RARO) ?? 0, unico: achar(linhas, LINHA_AP_UNICO) ?? 0 },
    maximo: achar(linhas, LINHA_AP_MAXIMO) ?? 3,
    efeitoPct: somar(daQualidade, LINHA_AP_EFEITO),
  };
}
/** A raridade do bicho para o "menos Velocidade" (o chefe conta como Único, como o resto do motor). */
export const raridadeDoBicho = (b) => (/unico/.test(b?.raridade ?? b?.raridadePoe ?? '') || b?.boss || b?.chefe ? 'unico' : /raro/.test(b?.raridade ?? b?.raridadePoe ?? '') ? 'raro' : 'normal');
/**
 * Uma corda nova no bicho (`ap` o estado de agora, ou null): `{ x, y, cordas: [{ pct }], danoSofridoPct }` — a âncora fica a do primeiro acerto; a corda leva a
 * sua % (a da raridade × o Efeito do Debuff); acima do máximo sai a mais velha; o dano sofrido é o maior de quem pôs (effectStackLimit 1).
 */
export function novaCorda(ap, d, bicho) {
  const f = 1 + (d.efeitoPct ?? 0) / 100;
  const pct = Math.min(100, (d.menosPct[raridadeDoBicho(bicho)] ?? 0) * f);
  const cordas = [...(ap?.cordas ?? []), { pct }].slice(-Math.max(1, d.maximo));
  return { x: ap?.x ?? bicho.x, y: ap?.y ?? bicho.y, cordas, danoSofridoPct: Math.max(ap?.danoSofridoPct ?? 0, d.danoSofridoPct * f) };
}
/** O passo do Aprisionado (1 = normal): 1 ÷ Π (1 − % de cada corda) — o "menos" multiplicativo (D4), até 90%. */
export function fatorDoPassoAprisionado(ap) {
  if (!ap?.cordas?.length) return 1;
  const vel = ap.cordas.reduce((v, c) => v * Math.max(0, 1 - (c.pct ?? 0) / 100), 1);
  return 1 / Math.max(0.1, vel);
}
/** O Aprisionamento quebra (D4): o bicho a mais de 2 casas (Chebyshev) da âncora. */
export const quebrouOAprisionamento = (ap, bicho) => !!ap && Math.max(Math.abs(bicho.x - ap.x), Math.abs(bicho.y - ap.y)) > APRISIONAMENTO.quebraCasas;

// ---------------------------------------------------------------- o golpe que sai do que grudou ou pulsou

/**
 * O efeito da gema no golpe do lote (`pr4` — o que o tique passa ao `golpeDoObjeto`): a EXPLOSÃO da Flecha Explosiva (`{ tipo: 'explosao', n, d }`: o dano base da
 * arma × o %, o Fogo adicional, os "mais" pelas flechas), o FEIXE do Golpe Estático (`{ tipo: 'feixe', menosPct }`: o "menos Dano" do feixe, no acerto e nas
 * afecções) e a EXPLOSÃO da Concha (`{ tipo: 'concha', maisAreaPct }`: o "mais Dano em Área"). Devolve o efeito novo.
 */
export function efeitoDoGolpePR4(e, pr4) {
  if (!e || !pr4) return e;
  if (pr4.tipo === 'explosao' && pr4.d) {
    const m = maisDaExplosao(pr4.d, pr4.n);
    const todos = 1 + m.todosPct / 100;
    return {
      ...e,
      basePctDoAtaque: ((e.basePctDoAtaque ?? 100) * pr4.d.basePct) / 100,
      'somadoMin:fire': (e['somadoMin:fire'] ?? 0) + pr4.d.fogo[0],
      'somadoMax:fire': (e['somadoMax:fire'] ?? 0) + pr4.d.fogo[1],
      fatorDeDano: (e.fatorDeDano ?? 1) * todos * (1 + m.acertoPct / 100),
      maisDanoAcertoPct: xm(e.maisDanoAcertoPct, m.acertoPct),
      maisAfeccaoPct: xm(e.maisAfeccaoPct, m.afeccaoPct),
    };
  }
  if (pr4.tipo === 'feixe') return { ...e, fatorDeDano: (e.fatorDeDano ?? 1) * Math.max(0, 1 - (pr4.menosPct ?? 0) / 100) };
  if (pr4.tipo === 'feixeConcentrado') return comOsConcentrados(e, pr4.maisPct, pr4.n);
  if (pr4.tipo === 'concha') return { ...e, fatorDeDano: (e.fatorDeDano ?? 1) * (1 + (pr4.maisAreaPct ?? 0) / 100) };
  return e;
}
/** (decisão do dono, 25/10) os ricochetes a mais do feixe dos Relâmpagos Concentrados: +1 a cada 2. */
export const RICOCHETES_POR_CONCENTRADOS = 2;
export const ricochetesDoConcentrado = (n) => Math.floor(Math.max(0, n) / RICOCHETES_POR_CONCENTRADOS);
/** O "mais" dos Relâmpagos Concentrados no uso (`n` os de agora): o MORE de Hit e Ailment — o do acerto sai da afecção, e o da afecção entra só nela. */
export function comOsConcentrados(e, maisPct, n) {
  const p = (maisPct ?? 0) * Math.max(0, n);
  if (!e || !(p > 0)) return e;
  return { ...e, fatorDeDano: (e.fatorDeDano ?? 1) * (1 + p / 100), maisDanoAcertoPct: xm(e.maisDanoAcertoPct, p), maisAfeccaoPct: xm(e.maisAfeccaoPct, p) };
}
/**
 * Os ALVOS FINAIS de cada flecha do uso (a exceção 2): `diretos` os acertados pela flecha principal e `golpes` os do `Secundarios.resolver`, na ordem — cada
 * projétil novo (`projetil`, `secundario`, `estilha`) começa uma sequência; a perfuração, a difusão, o ricochete e o retorno a continuam; o último de cada uma é o
 * alvo final (um por flecha: o mesmo bicho pode repetir). `acertou(b)`: o golpe acertou (o erro não gruda).
 */
export function alvosFinais(diretos = [], golpes = [], acertou = () => true) {
  const seqs = diretos.length ? [[...diretos]] : [];
  for (const g of golpes) {
    if (!g?.bicho) continue;
    if (['projetil', 'secundario', 'estilha'].includes(g.tipo)) seqs.push([g.bicho]);
    else if (['perfuracao', 'bifurcacao', 'encadeamento', 'retorno'].includes(g.tipo) && seqs.length) seqs.at(-1).push(g.bicho);
  }
  // (revisão B4/PR4/C3: um por flecha — o mesmo bicho pode vir várias vezes, a Barragem e os projéteis extras no mesmo alvo: cada projétil gruda a sua; o PoB,
  // act_dex.lua — ExplosiveArrow: `fuseApplicationRate × barrageProjectiles`)
  const r = [];
  for (const s of seqs) {
    const f = s.filter(acertou).at(-1);
    if (f) r.push(f);
  }
  return r;
}
/** Os PRIMEIROS acertados de cada projétil do uso (a Concha: "applies a shell to the first enemy struck"). */
export function primeirosAcertados(diretos = [], golpes = [], acertou = () => true) {
  const r = [];
  const d = diretos.find(acertou);
  if (d) r.push(d);
  for (const g of golpes) if (g?.bicho && ['projetil', 'secundario', 'estilha'].includes(g.tipo) && acertou(g.bicho) && !r.includes(g.bicho)) r.push(g.bicho);
  return r;
}

// ---------------------------------------------------------------- o status

const LINHAS_PR4 = [
  [LINHA_EA_BASE, /^Explosive_Arrow$/], [LINHA_EA_FOGO, /^Explosive_Arrow$/], [LINHA_EA_RAIO, /^Explosive_Arrow$/], [LINHA_EA_ACERTO, /^Explosive_Arrow$/], [LINHA_EA_AFECCAO, /^Explosive_Arrow$/], [LINHA_EA_MAXIMO, /^Explosive_Arrow$/],
  [LINHA_LA_VEZES, /^Lightning_Arrow_of_Electrocution$/], [LINHA_LA_INTERVALO, /^Lightning_Arrow_of_Electrocution$/], [LINHA_LA_MAXIMO, /^Lightning_Arrow_of_Electrocution$/],
  [LINHA_GE_INTERVALO, /^Static_Strike$/], [LINHA_GE_MENOS, /^Static_Strike$/], [LINHA_GE_FREQ, /^Static_Strike$/],
  [LINHA_RC_GANHA, /^Static_Strike_of_Gathering_Lightning$/], [LINHA_RC_MAXIMO, /^Static_Strike_of_Gathering_Lightning$/], [LINHA_RC_MAIS, /^Static_Strike_of_Gathering_Lightning$/], [LINHA_RC_QUALIDADE, /^Static_Strike_of_Gathering_Lightning$/],
  [LINHA_TENTACULOS, /^Exsanguinate$/],
  [LINHA_CONCHA, /^Somatic_Shell$/], [LINHA_CONCHA_MAXIMO, /^Somatic_Shell$/],
  [LINHA_AP_DANO, /^Ensnaring_Arrow$/], [LINHA_AP_NORMAL, /^Ensnaring_Arrow$/], [LINHA_AP_RARO, /^Ensnaring_Arrow$/], [LINHA_AP_UNICO, /^Ensnaring_Arrow$/], [LINHA_AP_MAXIMO, /^Ensnaring_Arrow$/], [LINHA_AP_EFEITO, /^Ensnaring_Arrow$/],
];
/** A linha da gema é uma das que este lote faz (sai de "efeito não simulado"). */
export const ehLinhaPR4 = (slug, l) => LINHAS_PR4.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
