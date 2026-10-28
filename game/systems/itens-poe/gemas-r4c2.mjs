// O LOTE C2 da rodada 4 das gemas do PoE (dono, 28/10: "quero resolver" — as regras do PoE e a Artilharia). Aqui ficam os DADOS (os números do PoB) e as contas
// puras (sem a caçada); quem usa: suportes-poe.mjs (as regras dos suportes), skills/gemas.mjs (o "mais" de um tipo multiplica entre os suportes), gemas-poe.mjs (o
// status, os alvos, o objeto e a sequência) e acoes.mjs (a conta do golpe por tipo, a área, o Pacto, o cone, a bomba e a linha de flechas). Este arquivo não importa nada.
//
// As decisões do dono (28/10), como o PoE 1 / PoB:
//   1. o "X% mais (ou menos) Dano de Fogo/Gelo/Raio/Caos/Físico/Elemental" e o "aumentado" de um elemento dos suportes valem SÓ na parte daquele tipo do golpe (o PoB:
//      FireDamage/ColdDamage/… MORE e INC, as keywords por tipo — CalcOffence, "Calculate damage"), e não no golpe inteiro nem só quando a ativa tem a tag. O "mais" sem
//      flag de acerto (o Foco Elemental, a Combustão, o Mutilar, a Brutalidade, a Manipulação do Vazio, o Resfriamento Ósseo, o Dano Elemental com Ataques) vale no acerto e
//      nas afecções (`maisDoTipoPct:<tipo>`, no multiplicador da parte — `Acoes.contaDoDano`, pelo caminho da parte: o Físico convertido em Gelo leva os dois); o "mais"
//      com a flag Melee / Projectile (o Dano Físico Corpo a Corpo: ModFlag.Melee; os Projéteis Viciosos: Projectile+Attack) só no acerto da parte Física
//      (`maisDoTipoAcertoPct:physical@<tags>` — no multiplicador da parte, e a afecção sai sem ele); o "aumentado" de um elemento vai ao "aumentado" daquele tipo
//      (`af:fire_dmg`… — o Elemental, nos três);
//   2. o PACTO DE LYCIA (o PoB, other.lua PactOfLycia + TriggeredHeavensScourge): o uso não causa dano (base_deal_no_damage); fortalece as próximas 3 magias de
//      CANALIZAÇÃO que você conjura (skill_empowers_next_x_spells_cast 3 — "the next channelling spells you cast yourself": o totem, a armadilha, a mina e o gatilho não
//      contam), cada uma com 40% mais Dano (pact_skill_grant_damage_+%_final_to_exerted_skills 40 — Damage MORE, no acerto e nas afecções); enquanto você canaliza uma
//      delas, o FLAGELO CELESTIAL cai a cada 0,3 s (heavens_scourge_channeling_trigger_interval_ms 300), até 10 por canalização (…_max_channelling_lightning_strikes);
//      ao parar, os que faltam caem a cada 0,05 s (…_unwinding_trigger_interval_ms 50). Cada um num inimigo a até 7 m de você (active_skill_base_auto_targetting_radius
//      70), na área de 1,2 m (+ 0,1 m por qualidade — os qualityStats) × √ da Área, com o dano de Raio da gema (o do Flagelo: 0,1–1,9 × a eficácia 2,3) e 7,5% de crítico.
//      A Aflição do Pacto não tem dado no PoB nem no poedb (fica sem efeito);
//   3. o AÇO ESTRAÇALHADOR (o PoB, act_dex.lua ShatteringSteel/AltX: a parte "Cone AoE", radius 28): cada projétil que acerta despedaça num CONE de 2,8 m × √ da Área à
//      frente do alvo (na direção do tiro); quem está no cone leva o acerto dele (vários cones, vários acertos). O TIRO CINÉTICO DA FRAGMENTAÇÃO (act_int.lua
//      KineticBoltAltX, "projectiles_can_shotgun"): os projéteis podem acertar o mesmo alvo — os que não acham outro inimigo vão nele (contra um alvo sozinho, os 3 acertam);
//   4. as BOMBAS CONGELANTES (todas — o PoB: "When the crystal's duration ends, it explodes"): o cristal fica no alvo e explode depois da duração da habilidade (2 s na
//      comum e na da Aproximação, 1,5 s na da Instabilidade) × a Duração; o debuff (a Exposição, a Regeneração reduzida) vem na explosão;
//   5. a CHUVA DE FLECHAS DA ARTILHARIA: as 22 flechas caem em sequência numa linha da casa à SUA FRENTE até o alvo, distribuídas igualmente; cada flecha acerta a casa
//      dela, na área de 1 m × √ da Área (em casas, a fração como chance — sorteada por flecha); quem está em mais de uma leva mais de um acerto;
//   6. a ÁREA com suporte numa conta só: o raio em metros × √(1 + Área) ÷ 2, a fração como chance (`raioComAArea`) — antes o raio da gema em casas era sorteado e as
//      casas a mais pela Área eram sorteadas de novo (`casasPelaArea`), arredondando duas vezes.

const N = String.raw`(-?\d+(?:[.,]\d+)?)`;
const num = (x) => parseFloat(String(x).replace(',', '.'));
const temTag = (ativa, t) => !!ativa?.tags?.includes(`poe:${t}`);

// ---------------------------------------------------------------- 1. o "mais" e o "aumentado" de um tipo

const TIPO_DO_TEXTO = { 'de fogo': 'fire', 'de gelo': 'ice', 'de raio': 'energy', 'de caos': 'chaos', 'físico': 'physical', fisico: 'physical', elemental: 'elemental' };
export const ELEMENTAIS = Object.freeze(['fire', 'ice', 'energy']);
/** O "aumentado" dos três elementos (o "Dano Elemental aumentado" — o PoB: ElementalDamage INC, que vale na parte de Fogo, de Gelo e de Raio). */
const aumentadoElemental = (v) => ({ 'af:fire_dmg': v, 'af:ice_dmg': v, 'af:energy_dmg': v });
/**
 * As REGRAS dos suportes do lote, antes das gerais de `suportes-poe.mjs` (que davam o "mais" ao golpe inteiro — `maisDanoPct`/`maisDanoAcertoPct` — e o "aumentado" ao
 * dano todo — `danoPct` —, só com a tag do tipo na ativa): `[regex, (m, texto, ativa) → efeito]`.
 */
export const REGRAS_C2R4 = [
  [new RegExp(`^Habilidades (de Ataque )?Suportadas causam ${N}% (mais|menos) Dano (de Fogo|de Gelo|de Raio|de Caos|Físico|Elemental)$`, 'i'), (m, t, a) => {
    if (m[1] && !temTag(a, 'Ataque')) return {};
    return { [`maisDoTipoPct:${TIPO_DO_TEXTO[m[4].toLowerCase()]}`]: (m[3].toLowerCase() === 'mais' ? 1 : -1) * num(m[2]) };
  }],
  [new RegExp(`^Habilidades Suportadas causam ${N}% (mais|menos) Dano Físico Corpo a Corpo$`, 'i'), (m) => ({ 'maisDoTipoAcertoPct:physical@corpo': (m[2].toLowerCase() === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`^Habilidades Suportadas causam ${N}% (mais|menos) Dano Físico de Ataque de Projétil$`, 'i'), (m) => ({ 'maisDoTipoAcertoPct:physical@projetil+ataque': (m[2].toLowerCase() === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`^Habilidades Suportadas causam ${N}% de Dano Elemental aumentado$`, 'i'), (m) => aumentadoElemental(num(m[1]))],
  [new RegExp(`^Dano Elemental aumentado em ${N}% com Habilidades de Ataque$`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? aumentadoElemental(num(m[1])) : {})],
  [new RegExp(`^Habilidades Suportadas causam ${N}% de Dano Físico Corpo a Corpo aumentado$`, 'i'), (m) => ({ 'af:phys_dmg@corpo': num(m[1]) })],
  // (rodada 4, etapa final — o dono, 28/10: "como o PoE") o "Inimigos Mutilados por Habilidades Suportadas sofrem X% de Dano Físico aumentado" é um DEBUFF no inimigo:
  // a Mutilação posta pela habilidade suportada leva o "dano físico sofrido aumentado" (`mutilados_fisico_sofrido` — `ModsPoe.aoAcertar` o põe em `estados.mutilado`),
  // que vale para toda fonte — você, os lacaios, a party, o acerto e o degenerativo (`CondicoesPoe.fatorRecebidoPeloBicho`)
  [new RegExp(`^Inimigos Mutilados por Habilidades Suportadas sofrem ${N}% de Dano Físico aumentado$`, 'i'), (m) => ({ 'af:mutilados_fisico_sofrido': num(m[1]) })],
];
// (as chaves `maisDoTipoPct:<tipo>` e `maisDoTipoAcertoPct:<tipo>@<tags>` multiplicam entre os suportes — `Gemas.efeitoNaSkill`)
/**
 * O fator dos "mais" de um tipo SÓ DO ACERTO dos suportes (`maisDoTipoAcertoPct:<tipo>@<tag>+<tag>` — o Dano Físico Corpo a Corpo: ModFlag.Melee; os Projéteis Viciosos:
 * Projectile+Attack — as afecções não têm essas flags no PoB): na parte que passou pelos `tipos`, no golpe com todas as `tags` da condição. 1 sem nenhum.
 */
export function maisDosSuportesNoAcerto(efeito, tipos = [], tags = []) {
  if (!efeito) return 1;
  let f = 1;
  for (const [k, v0] of Object.entries(efeito)) {
    if (!k.startsWith('maisDoTipoAcertoPct:')) continue;
    const v = Number(v0) || 0;
    const [tipo, cond = ''] = k.slice('maisDoTipoAcertoPct:'.length).split('@');
    if (!v || !(tipos.includes(tipo) || (tipo === 'elemental' && tipos.some((t) => ELEMENTAIS.includes(t))))) continue;
    if (cond && !cond.split('+').every((c) => tags.includes(c))) continue;
    f *= Math.max(0, 1 + v / 100);
  }
  return f;
}
/**
 * O fator dos "mais" de um tipo dos suportes (`efeito['maisDoTipoPct:<tipo>']`) na parte que passou pelos `tipos` (o caminho dela — o Físico convertido em Gelo:
 * ['physical', 'ice']): o de cada tipo do caminho uma vez, e o "Elemental" uma vez se algum deles for elemental. 1 sem nenhum.
 */
export function maisDosSuportesNosTipos(efeito, tipos = []) {
  if (!efeito) return 1;
  let f = 1;
  for (const t of new Set(tipos)) {
    const v = Number(efeito[`maisDoTipoPct:${t}`]) || 0;
    if (v) f *= Math.max(0, 1 + v / 100);
  }
  const el = Number(efeito['maisDoTipoPct:elemental']) || 0;
  if (el && tipos.some((t) => ELEMENTAIS.includes(t))) f *= Math.max(0, 1 + el / 100);
  return f;
}

// ---------------------------------------------------------------- 2. o Pacto de Lycia

// (rodada 4, correções finais — achado C: o qualityStats do PoB, active_skill_base_area_of_effect_radius 0.1 por ponto, é em DÉCIMOS de metro — +0,01 m por ponto, 1,4 m
// no q20; a Bola de Fogo confirma a escala: 0.15 no PoB, "(0—0,3) metros" no poedb)
export const LYCIA = Object.freeze({ slug: 'Pact_of_Lycia', magias: 3, maisPct: 40, raios: 10, intervaloMs: 300, desenroloMs: 50, alcanceM: 7, raioM: 1.2, raioPorQualidadeM: 0.01 });
export const ehPactoDeLycia = (slug) => slug === LYCIA.slug;
/** A magia fortalecida pelo Pacto de Lycia: uma magia de canalização sua (não o próprio Pacto). */
export const fortalecePeloLycia = (slug, tags = []) => !ehPactoDeLycia(slug) && tags.includes('magia') && tags.includes('canalizar');
/** O raio do Flagelo Celestial na qualidade, em metros (antes da Área de Efeito). */
export const raioDoFlageloM = (qualidade = 0) => LYCIA.raioM + LYCIA.raioPorQualidadeM * Math.max(0, Number(qualidade) || 0);
/**
 * O passo do Flagelo `o` (`{ feitos }`) no instante `t`: `canalizando` — a canalização fortalecida segue — cai a cada 0,3 s; parada, os que faltam a cada 0,05 s.
 * Devolve `{ cai, intervaloMs, acabou }`.
 */
export function passoDoFlagelo(o, canalizando) {
  if ((o.feitos ?? 0) >= LYCIA.raios) return { cai: false, intervaloMs: LYCIA.desenroloMs, acabou: true };
  return { cai: true, intervaloMs: canalizando ? LYCIA.intervaloMs : LYCIA.desenroloMs, acabou: (o.feitos ?? 0) + 1 >= LYCIA.raios };
}

// ---------------------------------------------------------------- 3. o Aço Estraçalhador e o Tiro Cinético da Fragmentação

export const ACO_ESTRACALHADOR = Object.freeze({ re: /^Shattering_Steel(?:_of_|$)/, raioM: 2.8 });
export const temConeDoAco = (slug) => ACO_ESTRACALHADOR.re.test(String(slug ?? ''));
/** Os projéteis podem acertar o mesmo alvo (o PoB: projectiles_can_shotgun) — os que não acham outro inimigo vão no alvo. */
export const projeteisNoMesmoAlvo = (slug) => slug === 'Kinetic_Bolt_of_Fragmentation';

// ---------------------------------------------------------------- 4. as Bombas Congelantes

export const BOMBA = Object.freeze({ re: /^Frost_Bomb(?:_of_|$)/ });
export const ehBombaCongelante = (slug) => BOMBA.re.test(String(slug ?? ''));
/** O objeto do uso da Bomba Congelante: o cristal no alvo, que explode depois da duração da gema (× a Duração, no uso) no raio dela. null nas outras. */
export function bombaDaGema(slug, stats = {}, raioM = null) {
  if (!ehBombaCongelante(slug)) return null;
  return { tipo: 'explosaoDivina', bomba: true, semAcerto: true, atrasoMs: Math.round((stats.duracao ?? 2) * 1000), raioM: raioM ?? stats.raio ?? 3.1, maisPct: 0 };
}

// ---------------------------------------------------------------- 5. a Chuva de Flechas da Artilharia

export const ARTILHARIA = Object.freeze({ slug: 'Rain_of_Arrows_of_Artillery', flechas: 22, raioM: 1 });
/** A sequência da Artilharia (`GemasPoe.sequenciaDaGema` → `acoes`, a forma `linhaDeFlechas`), ou null. */
export const sequenciaDaArtilharia = (slug) => (slug === ARTILHARIA.slug ? { forma: 'linhaDeFlechas', flechas: ARTILHARIA.flechas, raioM: ARTILHARIA.raioM } : null);
/**
 * As casas das `n` flechas na linha de `casas` (da casa à sua frente até o alvo), distribuídas igualmente: a flecha k na casa ⌊k × L ÷ n⌋ (L casas — cada casa recebe
 * n ÷ L flechas, a fração para as primeiras). Devolve a lista das casas, uma por flecha, na ordem em que caem.
 */
export function casasDasFlechas(casas, n) {
  const L = casas?.length ?? 0;
  if (!L || !(n > 0)) return [];
  return Array.from({ length: n }, (_, k) => casas[Math.min(L - 1, Math.floor((k * L) / n))]);
}

// ---------------------------------------------------------------- 6. a área numa conta só

/**
 * O raio em casas de uma área de `casas` (os metros ÷ 2, sem arredondar) com a Área de Efeito `fator` (o "aumentado" e os "mais" — `ModsPoe.fatorDaArea`), numa conta só:
 * casas × √fator, a fração como chance pelo mesmo sorteio `u` (0 ≤ u < 1). `minimo`: o raio não fica abaixo dele (a armadilha).
 */
export function raioComAArea(casas, u, fator = 1, minimo = 0) {
  const c = Math.max(0, Number(casas) || 0) * Math.sqrt(Math.max(0, Number(fator) || 0));
  const t = Math.trunc(c + 1e-9);
  return Math.max(minimo, t + (u < c - t - 1e-9 ? 1 : 0));
}
/**
 * O sorteio `u` coerente com o raio `r` já sorteado para `casas` (o guardado antes deste lote, ou o que um teste fixou): r = ⌊casas⌋ + 1 quer dizer u na fração; r = ⌊casas⌋,
 * u acima dela. `rng` sorteia dentro da faixa.
 */
export function sorteioDoRaio(casas, r, rng = Math.random) {
  const f = Math.max(0, Number(casas) || 0) % 1;
  if (r > Math.trunc(casas)) return rng() * f;
  return f + rng() * (1 - f);
}
