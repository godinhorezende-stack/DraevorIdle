// O LOTE E2B das gemas ATIVAS do PoE (26/10: as parciais mais difíceis de Armadilhas, Minas, Auras e Arautos — as que pedem mecânica nova). Aqui ficam os DADOS
// (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada, sem acoes.mjs); quem usa é gemas-poe.mjs (os leitores no
// nível e o status), linhas-das-gemas.mjs (as linhas de buff e as locais), acoes.mjs (as explosões menores, os pulsos da Sísmica, o debuff da Armadilha de Urso,
// o Solo Eletrizado da Relampejante Vaal, o Fogo Justo base), condicoes-poe.mjs (o dano sofrido do debuff de Urso), hunt/monstros.mjs (o passo) e o `adds` de
// gemas-poe.mjs (a Regeneração da Armadilha Sifão de Gelo).
//
// Tudo pela regra do PoE (o PoB, Skills/*.lua):
//   - a ARMADILHA EXPLOSIVA e a dos ESTILHAÇOS (act_dex.lua ExplosiveTrap/ExplosiveTrapAltX): depois da explosão principal, N explosões menores
//     (shrapnel_trap_number_of_secondary_explosions — 7 no nível 20, + 0,1 por qualidade) caem em lugares sorteados da ÁREA SECUNDÁRIA em volta da Armadilha
//     (active_skill_base_secondary_area_of_effect_radius — 1,8 m na base, 3 m na dos Estilhaços, no nível 20), cada uma com o raio da explosão menor (o terciário,
//     1,3 m no nível 20) × um sorteio entre −30% e +30% (radiusTertiaryBaseMargin 30 do PoB; o poedb: "entre 30% de redução e 30% de aumento do raio base"); cada
//     explosão é um acerto em quem ela pega. (O poedb salvo junta as colunas do raio — "1, 1.8", "3, 0.7"; a célula do nível é a da POSIÇÃO do número do
//     cabeçalho, como nas outras gemas — `compilador-de-gemas/progressao.mjs`);
//   - a ARMADILHA SÍSMICA (SeismicTrap): ativada, libera ondas a cada 0,9 s (phys_cascade_trap_base_interval_duration_ms; os modificadores da Velocidade de
//     Arremesso de Armadilhas valem na frequência — modifiers_to_trap_throw_speed_apply_to_seismic_trap_frequency) pela duração (3,5 s × a Duração): os pulsos são
//     ⌊duração × frequência⌋ (o PoB); cada pulso, N ondas (5, + 0,05 por qualidade), e cada onda acerta cada inimigo na área (1,8 m) com a chance da sobreposição
//     do PoB — (9 + 3 − 1)² ÷ 18² (a mesma da Sísmica dos Poços do E1b);
//   - a ARMADILHA SIFÃO DE GELO (SiphoningTrap): enquanto algum inimigo está com o debuff dela, X de Regeneração de Vida e Y de Mana por segundo
//     (…_with_at_least_1_affected_enemy) e, por inimigo afetado (até 10 — o `limit` do PoB), Z de Vida e W de Mana por segundo (…_per_affected_enemy);
//   - a ARMADILHA DE URSO (BearTrap): o acertado fica com o debuff — "Inimigos recebem 25% de aumento de Dano dos Acertos de Minas ou Armadilhas"
//     (bear_trap_damage_taken_+%_from_traps_and_mines, TrapMineDamageTaken INC) — do acerto até o fim do debuff, que dura a duração da habilidade DEPOIS da
//     Imobilização (o PoB: "After the immobilise expires, a debuff remains on the enemy for a duration"); a Velocidade de Movimento −80% no começo do debuff
//     (bear_trap_movement_speed_+%_final −80), "que diminui com o tempo" (a descrição do PoB) — em linha reta até 0 no fim;
//   - a ARMADILHA RELAMPEJANTE VAAL (VaalLightningTrap): os projéteis deixam Solo Eletrizado no caminho, pela duração (4 s × a Duração); o inimigo nele fica
//     Eletrizado com o efeito do solo (shocked_ground_base_magnitude_override — 15%, + 0,25 por qualidade), enquanto está nele;
//   - a ARMADILHA DE LÂMINAS DA LACERAÇÃO (BladeTrapAltY): "Sangramentos infligidos por esta Habilidade causam Dano X% mais rápido" (faster_bleed_% 50, + 0,5 por
//     qualidade) — o "mais rápido" do Sangramento do uso (`sangramento_mais_rapido`, linhas-das-gemas);
//   - o ESTANDARTE DA GUERRA (WarBanner): "Precisão aumentada em X%" (Accuracy INC) e "X% mais Dano Físico com Habilidades Corpo a Corpo" (PhysicalDamage MORE com
//     SkillType.Melee) a você e aos aliados na área do Estandarte plantado (linhas-das-gemas, o buff);
//   - o FOGO JUSTO (RighteousFire): a queima em volta de você — 70% da Vida máxima + 70% do Escudo de Energia máximo como Fogo base por segundo
//     (base_righteous_fire_%_of_max_life/energy_shield_to_deal_to_nearby_per_minute), pela conta do degenerativo da gema; você queima 90% da Vida máxima + 70% do
//     Escudo de Energia máximo por segundo como Fogo (base_nonlethal_fire_damage_%_of_maximum_life/energy_shield_taken_per_minute: NÃO letal — o mesmo
//     mecanismo do Fogo Justo da Devoção do G-D: com 1 de Vida o buff acaba); "X% mais Dano Mágico" (righteous_fire_spell_damage_+%_final — nos acertos das
//     magias, como o do Fogo Justo Vaal); o raio, 1,8 m + 0,015 m por qualidade (o poedb: 2,3 m no nível 20, + 0,3 m na qualidade 20).

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const somar = (linhas, re, g = 1) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[g]) || 0), 0);
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));
const ativo = (x, agora) => (x?.ate ?? 0) > agora;

// ---------------------------------------------------------------- a Armadilha Explosiva

const LINHA_EXPLOSOES = /^Causa (\d+) explosões menores\b/i;
const LINHA_EXPLOSOES_Q = /^Causa \+([\d.]+) explosões menores$/i;
const LINHA_RAIO_SECUNDARIO = /^Raio de alcance secundário base é de ([\d.]+) metros?$/i;
const LINHA_RAIO_MENOR = /^Raio Base da explosão menor igual a ([\d.]+) metros?$/i;
const LINHA_RAIO_PRINCIPAL = /^Raio Base da explosao igual a ([\d.]+) metros?$/i;
/** A variação do raio de cada explosão menor (o PoB: radiusTertiaryBaseMargin 30 — de −30% a +30%). */
export const EXPLOSOES = Object.freeze({ variacaoPct: 30 });
/**
 * As explosões menores das Armadilhas Explosivas: `{ n, raioSecundarioM, raioMenorM, variacaoPct }`, ou null. `qualidade`: 0–20 (o PoB: 0,1 explosão por ponto —
 * a linha da qualidade do poedb arredonda; a conta usa o stat).
 */
export function explosoesDasLinhas(slug, linhas = [], qualidade = 0) {
  if (!/^Explosive_Trap(_of_Shrapnel)?$/.test(slug)) return null;
  const n = achar(linhas, LINHA_EXPLOSOES);
  const raioSecundarioM = achar(linhas, LINHA_RAIO_SECUNDARIO);
  const raioMenorM = achar(linhas, LINHA_RAIO_MENOR);
  if (!n || !raioSecundarioM || !raioMenorM) return null;
  return { n: n + Math.floor((Math.max(0, Number(qualidade) || 0) * 0.1) + 1e-9), raioSecundarioM, raioMenorM, variacaoPct: EXPLOSOES.variacaoPct };
}
/** O raio (m) de UMA explosão menor: o base × (1 + um sorteio entre −variação e +variação). */
export const raioDaExplosaoMenor = (d, rng = Math.random) => d.raioMenorM * (1 + ((rng() * 2 - 1) * d.variacaoPct) / 100);

// ---------------------------------------------------------------- a Armadilha Sísmica

const LINHA_INTERVALO = /^Libera ondas a cada ([\d.]+) segundos?$/i;
const LINHA_ONDAS = /^Libera (\d+) ondas?$/i;
const LINHA_ONDAS_Q = /^Libera \+([\d.]+) ondas?$/i;
const LINHA_FREQUENCIA = /^Modificadores à Velocidade de Arremesso de Armadilhas também se aplicam à Frequência de liberação de ondas$/i;
/** O PoB (SeismicTrap): o raio da área (18 = 1,8 m), o da onda (9) e o do inimigo padrão (Medium, 3). */
export const SISMICA = Object.freeze({ raioM: 1.8, raioDaOnda: 9, raioTotal: 18, raioDoInimigo: 3 });
export const chanceDaOndaSismica = (o = SISMICA) => Math.min(1, ((o.raioDaOnda + o.raioDoInimigo - 1) ** 2) / (o.raioTotal ** 2));
/** A Armadilha Sísmica: `{ intervaloMs, ondas, chance, raioM }`, ou null. `qualidade`: 0–20 (o PoB: 0,05 onda por ponto). */
export function sismicaDasLinhas(slug, linhas = [], qualidade = 0) {
  if (slug !== 'Seismic_Trap') return null;
  const s = achar(linhas, LINHA_INTERVALO);
  const n = achar(linhas, LINHA_ONDAS);
  if (!s || !n) return null;
  return { intervaloMs: Math.round(s * 1000), ondas: n + Math.floor((Math.max(0, Number(qualidade) || 0) * 0.05) + 1e-9), chance: chanceDaOndaSismica(), raioM: SISMICA.raioM };
}
/**
 * Os pulsos de uma Armadilha Sísmica ativada (o PoB): a frequência = (1 + a Velocidade de Arremesso aumentada) × o "mais" ÷ o intervalo; os pulsos = ⌊duração ×
 * frequência⌋, cada um a 1 ÷ frequência do anterior (o primeiro, um intervalo depois da ativação). `{ intervaloMs, pulsos }`.
 */
export function pulsosDaSismica(d, duracaoMs, incPct = 0, maisPct = 0) {
  const freq = (Math.max(0.1, 1 + (Number(incPct) || 0) / 100) * Math.max(0.1, 1 + (Number(maisPct) || 0) / 100)) / (d.intervaloMs / 1000);
  return { intervaloMs: Math.max(50, Math.round(1000 / freq)), pulsos: Math.max(0, Math.floor((duracaoMs / 1000) * freq + 1e-9)) };
}

// ---------------------------------------------------------------- a Armadilha Sifão de Gelo

const LINHA_SIFAO_VIDA_1 = /^Concede ([\d.]+) de Regeneração de Vida por segundo caso um Inimigo esteja afetado$/i;
const LINHA_SIFAO_MANA_1 = /^Concede ([\d.]+) de Regeneração de Mana por segundo se qualquer Inimigo está afetado$/i;
const LINHA_SIFAO_VIDA_N = /^Concede ([\d.]+) de Regeneração de Vida por segundo para cada Inimigo afetado$/i;
const LINHA_SIFAO_MANA_N = /^Concede ([\d.]+) de Regeneração de Mana por segundo para cada Inimigo afetado$/i;
/** O `limit` do PoB no "por inimigo afetado". */
export const SIFAO = Object.freeze({ maxInimigos: 10 });
/** A Armadilha Sifão de Gelo: `{ vida, mana, vidaPor, manaPor }` (por segundo), ou null. */
export function sifaoDasLinhas(slug, linhas = []) {
  if (slug !== 'Siphoning_Trap') return null;
  const r = { vida: achar(linhas, LINHA_SIFAO_VIDA_1) ?? 0, mana: achar(linhas, LINHA_SIFAO_MANA_1) ?? 0, vidaPor: achar(linhas, LINHA_SIFAO_VIDA_N) ?? 0, manaPor: achar(linhas, LINHA_SIFAO_MANA_N) ?? 0 };
  return r.vida || r.mana || r.vidaPor || r.manaPor ? r : null;
}
/** A Regeneração (por segundo) com `n` inimigos afetados: `{ life_regen, mana_regen }` (0 sem nenhum). */
export function regeneracaoDoSifao(d, n) {
  const k = Math.min(SIFAO.maxInimigos, Math.max(0, n | 0));
  if (!d || !k) return { life_regen: 0, mana_regen: 0 };
  return { life_regen: d.vida + d.vidaPor * k, mana_regen: d.mana + d.manaPor * k };
}
/** Quantos inimigos vivos estão com o debuff (o degenerativo `chave`) da Armadilha agora. */
export const afetadosPeloSifao = (monstros = [], chave = 'Siphoning_Trap') => monstros.filter((m) => m.hp > 0 && !m.dummy && (m.dots ?? []).some((d) => d.chave === chave && d.falta > 0)).length;
/** (para `GemasPoe.adds`) a Regeneração da Sifão ligada agora (`hunt.poeSifaoE2b`), ou null. */
export function addsDoSifao(hunt) {
  const s = hunt?.poeSifaoE2b;
  if (!s || !(s.ate > (hunt.clock ?? 0)) || !(s.life_regen > 0 || s.mana_regen > 0)) return null;
  return { ...(s.life_regen > 0 ? { life_regen: s.life_regen } : {}), ...(s.mana_regen > 0 ? { mana_regen: s.mana_regen } : {}) };
}

// ---------------------------------------------------------------- a Armadilha de Urso

const LINHA_URSO_DANO = /^Inimigos recebem ([\d.]+) % de aumento de Dano dos Acertos de Minas ou Armadilhas$/i;
const LINHA_URSO_PASSO = /^Inimigos possuem ([\d.]+) % menos Velocidade de Movimento no início do Debuff$/i;
/** O debuff da Armadilha de Urso: `{ danoPct, passoPct }`, ou null. */
export function ursoDasLinhas(slug, linhas = []) {
  if (slug !== 'Bear_Trap') return null;
  const danoPct = achar(linhas, LINHA_URSO_DANO) ?? 0;
  const passoPct = achar(linhas, LINHA_URSO_PASSO) ?? 0;
  return danoPct || passoPct ? { danoPct, passoPct } : null;
}
/**
 * Põe o debuff de Urso no bicho: o dano sofrido dos acertos de Armadilha/Mina vale desde agora até `ate`; a lentidão do passo começa em `desde` (o fim da
 * Imobilização) com `passoPct` e cai em linha reta até 0 em `ate`. Fica o que dura mais.
 */
export function porDebuffDoUrso(m, d, desde, ate) {
  if (!m || !(m.hp > 0) || !d || !(ate > desde)) return false;
  const e = (m.estados ??= {});
  if ((e.ursoE2b?.ate ?? 0) >= ate) return false;
  e.ursoE2b = { desde, ate, danoPct: d.danoPct, passoPct: d.passoPct };
  return true;
}
/** O "% de aumento de Dano dos Acertos de Minas ou Armadilhas" do debuff de Urso no bicho agora (0 sem ele). */
export const danoDoUrso = (m, agora) => (ativo(m?.estados?.ursoE2b, agora) ? m.estados.ursoE2b.danoPct ?? 0 : 0);
/** O "menos Velocidade de Movimento" do debuff de Urso agora (%): o cheio no começo, 0 no fim (antes do começo — Imobilizado —, o cheio). */
export function passoDoUrsoPct(m, agora) {
  const u = m?.estados?.ursoE2b;
  if (!ativo(u, agora) || !(u.passoPct > 0)) return 0;
  const t = Math.max(0, Math.min(1, (agora - u.desde) / Math.max(1, u.ate - u.desde)));
  return u.passoPct * (1 - t);
}
/** Quanto o passo do bicho demora a mais pelo debuff de Urso (1 = normal): 1 / (1 − %). */
export const fatorDoPassoDoUrso = (m, agora) => { const p = passoDoUrsoPct(m, agora); return p > 0 ? 1 / Math.max(0.1, 1 - p / 100) : 1; };

// ---------------------------------------------------------------- a Armadilha Relampejante Vaal

const LINHA_SOLO = /^Projéteis deixam Solo Eletrizado$/i;
const LINHA_SOLO_EFEITO = /^Solo Eletrizado causa \+?([\d.]+) % de Dano sofrido aumentado$/i;
/** O Solo Eletrizado da Relampejante Vaal: `{ efeitoPct }` (15 + 0,25 por qualidade — o PoB), ou null. */
export function soloEletrizadoDasLinhas(slug, linhas = [], qualidade = 0) {
  if (slug !== 'Vaal_Lightning_Trap' || !tem(linhas, LINHA_SOLO)) return null;
  return { efeitoPct: (achar(linhas, LINHA_SOLO_EFEITO) ?? 15) + Math.max(0, Number(qualidade) || 0) * 0.25 };
}
/** As casas da reta de `a` a `b` (Bresenham, com `a` e `b`). */
export function casasDaReta(a, b) {
  const r = [{ x: a.x, y: a.y }];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 64 && !(x === b.x && y === b.y); i++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    r.push({ x, y });
  }
  return r;
}
/**
 * As casas do Solo Eletrizado dos `n` projéteis em círculo da Armadilha (em `centro`; o primeiro na direção `a0`, os outros a cada 2π/n — "Dispara Projéteis em um
 * círculo"): a reta de cada um até o `alcance` (os projéteis Perfuram todos os Alvos — vão até o fim).
 */
export function casasDoSolo(centro, a0 = 0, n = 1, alcance = 1) {
  const casas = new Set();
  const k = Math.max(1, n | 0);
  for (let i = 0; i < k; i++) {
    const a = a0 + (2 * Math.PI * i) / k;
    for (const c of casasDaReta(centro, { x: Math.round(centro.x + Math.cos(a) * alcance), y: Math.round(centro.y + Math.sin(a) * alcance) })) casas.add(`${c.x},${c.y}`);
  }
  return [...casas];
}
/** Eletriza (o `chocado` do jogo) quem está numa casa do Solo agora, com o efeito dele, até `ate` (vale o mais forte — o PoE). Devolve quantos. */
export function eletrizarNoSolo(monstros, solos, agora, renovaMs = 500) {
  let n = 0;
  for (const s of solos ?? []) {
    if (!(s.ate > agora)) continue;
    const casas = s.casasSet ?? (s.casasSet = new Set(s.casas));
    for (const m of monstros ?? []) {
      if (!(m.hp > 0) || m.dummy || (m.z ?? s.z ?? 0) !== (s.z ?? 0) || !casas.has(`${m.x},${m.y}`)) continue;
      const e = (m.estados ??= {});
      const ch = e.chocado;
      if (ativo(ch, agora) && (ch.pct ?? 0) > s.efeitoPct) continue;
      e.chocado = { ate: Math.max(ativo(ch, agora) && (ch.pct ?? 0) === s.efeitoPct ? ch.ate : 0, agora + renovaMs), pct: s.efeitoPct, dur: renovaMs };
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- o Fogo Justo

const LINHA_RF_VIDA = /^Causa ([\d.]+) % de sua Vida Máxima como Dano Base de Fogo por segundo$/i;
const LINHA_RF_ES = /^Causa ([\d.]+) % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo$/i;
const LINHA_RF_QUEIMA_VIDA = /^Você Queima por ([\d.]+) % de sua Vida máxima por segundo como Dano de Fogo$/i;
const LINHA_RF_QUEIMA_ES = /^Você Queima por ([\d.]+) % do seu Escudo de Energia máximo por segundo como Dano de Fogo$/i;
const LINHA_RF_MAGICO = /^Concede ([\d.]+) % mais Dano Mágico$/i;
const LINHA_RF_RAIO = /^O raio Base é de ([\d.]+) metros?$/i;
const LINHA_RF_RAIO_Q = /^\+([\d.]+) metros de raio$/i;
/**
 * O Fogo Justo (a base): `{ modo: 'vida', vidaPct, esPct, queimaVidaPct, queimaEsPct, raioM, magicoMaisPct, conjuracaoMaisPct: 0, dotMagico: false }` — o mesmo
 * formato do Fogo Justo da Devoção do G-D (`GemasGBD.fogoJustoDasLinhas`, o tique `Acoes.tiqueDoFogoJusto`) —, ou null.
 */
export function fogoJustoBaseDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Righteous_Fire') return null;
  const vidaPct = achar(linhas, LINHA_RF_VIDA);
  if (vidaPct == null) return null;
  return {
    modo: 'vida', vidaPct, esPct: achar(linhas, LINHA_RF_ES) ?? 0, queimaVidaPct: achar(linhas, LINHA_RF_QUEIMA_VIDA) ?? 0, queimaEsPct: achar(linhas, LINHA_RF_QUEIMA_ES) ?? 0,
    raioM: (achar(linhas, LINHA_RF_RAIO) ?? 1.8) + somar(daQualidade, LINHA_RF_RAIO_Q), magicoMaisPct: achar(linhas, LINHA_RF_MAGICO) ?? 0, conjuracaoMaisPct: 0, dotMagico: false,
  };
}
/** O Fogo base por segundo do Fogo Justo (a base): X% da Vida máxima + Y% do Escudo de Energia máximo. */
export const fogoJustoBasePorS = (d, { maxHp = 0, maxEs = 0 } = {}) => (Math.max(0, maxHp) * (d?.vidaPct ?? 0) + Math.max(0, maxEs) * (d?.esPct ?? 0)) / 100;
/** A queima em você por segundo (antes da resistência): X% da Vida máxima + Y% do Escudo de Energia máximo. */
export const queimaDoFogoJustoBasePorS = (d, { maxHp = 0, maxEs = 0 } = {}) => (Math.max(0, maxHp) * (d?.queimaVidaPct ?? 0) + Math.max(0, maxEs) * (d?.queimaEsPct ?? 0)) / 100;

// ---------------------------------------------------------------- o Castigo e o Castigo Vaal

// (o PoB, act_str.lua Smite/VaalSmite: "Performs a melee attack, and causes lightning to strike a nearby enemy, dealing damage in an area … Hitting an enemy grants an
// aura for a duration" — o uso é o ATAQUE corpo a corpo; o raio, o mesmo do Castigo do Julgamento Divino do C1 (`raiosDoCastigo` — os N mais perto de você no alcance,
// a área em volta de cada um, sem o corpo a corpo da ficha); a aura vem ao ACERTAR (antes, o uso só ligava a aura). As partes do raio: base_smite_number_of_targets
// (1; a Vaal, 30), smite_lightning_target_range (5 m; a Vaal, 10 m), active_skill_area_damage_+%_final (−20 no nível 20 do Castigo, + 0,5 por qualidade nos dois); a
// aura do Castigo Vaal dá +1 alvo ao raio do Castigo (buff_grants_smite_additional_lightning_targets) e a do Castigo não vale com a do Vaal (AffectedByVaalSmite)
const LINHA_CASTIGO_ALVOS = /^Raio acerta (\d+) alvos? dentro de ([\d.]+) metros$/i;
const LINHA_CASTIGO_MENOS = /^(-?[\d.]+) % menos Dano em Área$/i;
const LINHA_CASTIGO_MAIS_Q = /^\+([\d.]+) % mais Dano em Área$/i;
const LINHA_CASTIGO_VAAL_ALVO = /^Aura faz com que Castigo ataque \+(\d+) alvos com relâmpagos$/i;
const LINHA_NAO_EVADIDO = /^Não pode ser Evadido$/i;
export const CASTIGOS = Object.freeze(new Set(['Smite', 'Vaal_Smite']));
export const ehCastigo = (slug) => CASTIGOS.has(String(slug ?? ''));
/**
 * O raio do Castigo e do Castigo Vaal (o formato do C1, `GemasC1.raioDoCastigoDasLinhas`): `{ alvos, alcanceM, maisAreaPct }`, ou null. `qualidade`: 0–20 (o PoB: + 0,5%
 * do "mais Dano em Área" por ponto; o poedb salvo inverte a faixa da linha da qualidade do Castigo — a conta usa o stat).
 */
export function castigoDasLinhas(slug, linhas = [], qualidade = 0) {
  if (!ehCastigo(slug)) return null;
  const m = linhas.map((l) => LINHA_CASTIGO_ALVOS.exec(norm(l))).find(Boolean);
  if (!m) return null;
  const menos = achar(linhas, LINHA_CASTIGO_MENOS) ?? 0;
  return { alvos: Number(m[1]), alcanceM: Number(m[2]), maisAreaPct: -menos + Math.max(0, Number(qualidade) || 0) * 0.5 };
}
/** O "+N alvos" que a aura do Castigo Vaal dá ao raio do Castigo (0 sem a linha). */
export const alvosDaAuraVaal = (linhas = []) => achar(linhas, LINHA_CASTIGO_VAAL_ALVO) ?? 0;

// ---------------------------------------------------------------- a gema Detonar Minas

// (o poedb salvo — a cópia do PoB não tem a gema: "Primeira Mina é Detonada Instantaneamente Minas recebem 10% mais Velocidade de Detonação para cada Mina anterior na
// Sequência de Detonação" — a Sequência de Detonação do jogo, `Plantadas.minasQueDetonam` — e a qualidade "Minas tem Velocidade de Detonação aumentada em (0 — 20)%")
const LINHA_DETONAR = /^Primeira Mina é Detonada Instantaneamente Minas recebem ([\d.]+) % mais Velocidade de Detonação para cada Mina ant\S+ na Sequência de Detonação$/i;
const LINHA_DETONAR_Q = /^Minas tem Velocidade de Detonação aumentada em ([\d.]+) %$/i;
/** A Velocidade de Detonação aumentada da qualidade da gema Detonar Minas (as linhas da qualidade), em %. */
export const velocidadeDeDetonacaoDasLinhas = (daQualidade = []) => somar(daQualidade, LINHA_DETONAR_Q);
/** As gemas do lote cujo efeito não é dano (sem o "sem dano direto"): a Detonar Minas (detona as suas Minas). */
export const EFEITO_SEM_DANO_E2B = new Set(['Detonate_Mines']);

// ---------------------------------------------------------------- o que o status lê

/** As linhas do lote que o jogo faz (saem de "efeito não simulado" — GemasPoe.ehLinhaFeita): [regex, slugs]. */
const FEITAS = [
  [LINHA_EXPLOSOES, /^Explosive_Trap(_of_Shrapnel)?$/], [LINHA_EXPLOSOES_Q, /^Explosive_Trap(_of_Shrapnel)?$/], [LINHA_RAIO_MENOR, /^Explosive_Trap(_of_Shrapnel)?$/],
  [LINHA_RAIO_SECUNDARIO, /^Explosive_Trap(_of_Shrapnel)?$/], [LINHA_RAIO_PRINCIPAL, /^Explosive_Trap(_of_Shrapnel)?$/],
  [LINHA_INTERVALO, /^Seismic_Trap$/], [LINHA_ONDAS, /^Seismic_Trap$/], [LINHA_ONDAS_Q, /^Seismic_Trap$/], [LINHA_FREQUENCIA, /^Seismic_Trap$/],
  [LINHA_SIFAO_VIDA_1, /^Siphoning_Trap$/], [LINHA_SIFAO_MANA_1, /^Siphoning_Trap$/], [LINHA_SIFAO_VIDA_N, /^Siphoning_Trap$/], [LINHA_SIFAO_MANA_N, /^Siphoning_Trap$/],
  [LINHA_URSO_DANO, /^Bear_Trap$/], [LINHA_URSO_PASSO, /^Bear_Trap$/],
  [LINHA_SOLO, /^Vaal_Lightning_Trap$/], [LINHA_SOLO_EFEITO, /^Vaal_Lightning_Trap$/],
  [LINHA_RF_VIDA, /^Righteous_Fire$/], [LINHA_RF_ES, /^Righteous_Fire$/], [LINHA_RF_QUEIMA_VIDA, /^Righteous_Fire$/], [LINHA_RF_QUEIMA_ES, /^Righteous_Fire$/], [LINHA_RF_MAGICO, /^Righteous_Fire$/],
  [LINHA_RF_RAIO, /^Righteous_Fire$/], [LINHA_RF_RAIO_Q, /^Righteous_Fire$/],
  [LINHA_DETONAR, /^Detonate_Mines$/], [LINHA_DETONAR_Q, /^Detonate_Mines$/],
  [LINHA_CASTIGO_ALVOS, /^(Vaal_)?Smite$/], [LINHA_CASTIGO_MENOS, /^Smite$/], [LINHA_CASTIGO_MAIS_Q, /^Vaal_Smite$/], [LINHA_CASTIGO_VAAL_ALVO, /^Vaal_Smite$/], [LINHA_NAO_EVADIDO, /^Vaal_Smite$/],
];
export const ehLinhaE2b = (slug, l) => FEITAS.some(([re, s]) => s.test(slug) && re.test(norm(l)));
/** As gemas do lote cujo efeito é a mecânica (sem o "sem dano direto" / "nenhum efeito do buff"): o Fogo Justo base (a queima em volta). */
export const SEM_AF_NO_BUFF_E2B = new Set(['Righteous_Fire']);
