// O LOTE E1b das gemas ATIVAS do PoE (26/10: as parciais mais fáceis de Armadilhas, Minas, Auras e Arautos — 1 ou 2 linhas faltando —, mais as ativas
// parciais que restavam em outros arquétipos). Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a
// caçada, sem acoes.mjs); quem usa é gemas-poe.mjs (os leitores no nível e o status), linhas-das-gemas.mjs (as linhas de buff e as locais), acoes.mjs (o
// arremesso, a ativação das Armadilhas, a aura das Minas, o acerto contra o Queimando), hunt/resistencia.mjs (a resistência ignorada), poderes.mjs (o
// Acerto Suprimido) e personagem/defesa.mjs (a recarga do Escudo de Energia).
//
// Tudo pela regra do PoE (o PoB, Skills/*.lua):
//   - "X% de Chance de uma Armadilha ser Ativada uma vez adicional" (trap_%_chance_to_trigger_twice — a Armadilha Glacial e a do Vão, a Relampejante e a das
//     Fagulhas, a da Espiral da Eletrização, na qualidade; a Flamejante da Explosão, 50% no nível): SOMA com a das peças e da árvore (armadilha_ativa_de_novo) e
//     a habilidade sai mais uma vez do mesmo lugar (acoes.tiqueDasPlantadas); na Espiral, a Armadilha ativada de novo cria outra Espiral no mesmo lugar;
//   - "30% menos Velocidade de Arremesso de Armadilhas" (a Explosiva da Magnitude — trap_throwing_speed_+%_final −30) e "25% menos velocidade de lançar armadilhas
//     com arma de duas mãos" (a Hélice Espectral de Trarthus — o mesmo stat, com a condição): o "menos" multiplica o tempo do arremesso, como o dos suportes;
//     "Lança até 1 armadilhas a mais ao usar duas armas" (a de Trarthus — number_of_additional_traps_to_throw com DualWielding): +1 Armadilha no arremesso;
//   - "X a Y de Dano de Fogo adicionado contra Inimigos Queimando" (a Armadilha Flamejante e a da Explosão — global_minimum/maximum_added_fire_damage_vs_burning_
//     enemies): o Fogo adicionado no acerto do Queimando (o Incêndio ou outro dano degenerativo de Fogo nele), × a Eficácia do Dano Adicionado da gema, com o
//     "aumentado" do Fogo e os "mais" do golpe, como o Físico adicionado da Marca do Caçador;
//   - "Converte 100% do Dano Físico para um Elemento aleatório" (a Devastação da Refração — skill_convert_%_physical_damage_to_random_element): a conversão da
//     gema, com o elemento sorteado a cada uso;
//   - "Projéteis Ricocheteiam ao colidirem com o terreno" (a Relampejante das Fagulhas): 100% de chance de o projétil que bate no terreno ricochetear (o mesmo
//     motor do "Projéteis têm X% de chance de conseguirem Ricochetear ao colidirem com o terreno" das peças — gasta um ricochete);
//   - "Receba X% do Dano Físico como Dano de Gelo Extra" (a qualidade da Pancada Glacial e da da Cadência): o "Físico como Extra" do uso (linhas-das-gemas);
//   - "Empala Inimigos ao Acertar" (a Armadilha de Urso dos Espetos — impale_on_hit_%_chance 100);
//   - as MINAS: a qualidade da Tormenta Explosiva ("Cada mina aplica Dano aumentado em +X%…" — o mesmo stat do nível, soma no "por Mina"); a da Congelante da
//     Sabotagem ("Efeito das Auras aumentado em X%" — o aura_effect_+% da gema, que vale na aura das Minas dela); a Exposição ao Fogo da Piroclástica
//     (pyroclast_mine_aura_fire_exposure_%_to_apply −15/−25 — "exposure_uses_aura_effect_+%_instead_of_effect_+%": o Efeito de Aura das Minas a escala), nos
//     inimigos perto das Minas plantadas dela, enquanto estão perto (a Exposição do PoE: só a mais forte de cada elemento vale);
//   - o ARAUTO TROVEJANTE: "Tempestades Acertam Inimigos com Frequência aumentada em X%" (a qualidade) — o jogo já a lia (acoes.tiqueDaTempestade);
//   - as AURAS (o buff — linhas-das-gemas.atributosDoBuff): a Disciplina ("30% de Velocidade de Recarga de Escudo de Energia aumentada" —
//     energy_shield_recharge_rate_+%); a Graça Vaal ("+15% de chance de Evadirem Acertos de Ataques" — chance_to_evade_attacks_%, e "Dano Mágico Suprimido causado
//     em você é Azarado" — damage_taken_from_suppressed_hits_is_unlucky: o dano da magia suprimida rola duas vezes e fica o menor); a Clareza Vaal ("não Custam
//     Mana" — no_mana_cost, ManaCost MORE −100); a Disciplina Vaal ("A Recarga do seu Escudo de Energia … não é impedida por Dano" —
//     energy_shield_recharge_not_delayed_by_damage); a Pureza Elementar ("Imunes a todas as Afecções Elementais": o Incêndio, o Resfriamento, o Congelamento e a
//     Eletrização do jogo); o Fanatismo ("10% de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando 8 segundos" — o mesmo evento das
//     peças); os ESTANDARTES: o Horrendo ("Recuperem X de Vida ao Bloquear" — recover_X_life_on_block) e o Desafiador ("−X de Dano sofrido de cada Tipo de Dano dos
//     Acertos Suprimidos" — damage_taken_+_from_suppressed_hits, na magia suprimida, por tipo, sem passar do dano daquele tipo);
//   - as IMPUREZAS VAAL: "Efeito das Auras aumentado em X%" (aura_effect_+% da própria gema — soma com o dos suportes no efeito do buff) e "Resistência a <El> de
//     Inimigos Próximos é Ignorada por Acertos" (hits_ignore_my_<el>_resistance, AuraDebuff): os inimigos no raio da aura (em volta de você) têm a resistência
//     POSITIVA daquele elemento ignorada pelos acertos (a negativa fica; o jeito do "Golpes Críticos ignoram as Resistências" do jogo); o dano degenerativo, não.

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const somar = (linhas, re, g = 1) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[g]) || 0), 0);
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));

// ---------------------------------------------------------------- as Armadilhas

const LINHA_ATIVA_DE_NOVO = /^\+?([\d.]+) % de Chance de uma Armadilha ser Ativada uma vez adicional$/i;
/** O "X% de Chance de uma Armadilha ser Ativada uma vez adicional" da gema (o nível + a qualidade), em %. */
export const chanceDeAtivarDeNovo = (linhas = [], daQualidade = []) => somar([...linhas, ...daQualidade], LINHA_ATIVA_DE_NOVO);
/** Sorteia se a Armadilha ativa de novo: a chance da gema (daGemaPct) SOMADA à das peças (daFichaPct). */
export const ativaDeNovo = (daFichaPct, daGemaPct, rng = Math.random) => { const c = (Number(daFichaPct) || 0) + (Number(daGemaPct) || 0); return c > 0 && rng() * 100 < c; };

const LINHA_ARREMESSO_MENOS = /^([\d.]+) % menos Velocidade de Arremesso de Armadilhas$/i;
const LINHA_ARREMESSO_DUAS_MAOS = /^([\d.]+) % menos velocidade de lançar armadilhas com arma de duas mãos$/i;
const LINHA_EXTRAS_DUAS_ARMAS = /^Lança até (\d+) armadilhas? a mais ao usar duas armas$/i;

const LINHA_FOGO_QUEIMANDO = /^([\d.]+) a ([\d.]+) de Dano de Fogo adicionado contra Inimigos Queimando$/i;
/** O Fogo adicionado contra o Queimando ([min, max]), ou null. */
export function fogoContraQueimandoDasLinhas(linhas = []) {
  for (const l of linhas) { const m = LINHA_FOGO_QUEIMANDO.exec(norm(l)); if (m) return [Number(m[1]), Number(m[2])]; }
  return null;
}
/** O inimigo está Queimando? (o Incêndio, ou qualquer dano degenerativo de Fogo nele — o Burning do PoE). */
export const queimando = (bicho) => (bicho?.dots ?? []).some((d) => (d.tipo === 'queimadura' || d.tipo === 'degenFogo') && d.falta > 0);
/**
 * O arremesso da gema: { maisPct, extras } — o "X% menos Velocidade de Arremesso" (negativo; com duasMaos, + o "com arma de duas mãos") e as Armadilhas a mais
 * com duasArmas. conds: as condições do personagem (condicoes-poe.condicoesDe — um Set com duasMaos/duasArmas).
 */
export function arremessoDasLinhas(linhas = [], conds = null) {
  const duasMaos = conds ? conds.has('duasMaos') : false;
  const duasArmas = conds ? conds.has('duasArmas') : false;
  const menos = somar(linhas, LINHA_ARREMESSO_MENOS) + (duasMaos ? somar(linhas, LINHA_ARREMESSO_DUAS_MAOS) : 0);
  return { maisPct: -menos, extras: duasArmas ? somar(linhas, LINHA_EXTRAS_DUAS_ARMAS) : 0 };
}

// ---------------------------------------------------------------- o golpe

const LINHA_CONVERTE_ALEATORIO = /^Converte ([\d.]+) % do Dano Físico para um Elemento aleatório$/i;
/** A conversão do Físico da gema para um elemento sorteado ([{ para: 'aleatorio', pct }]), ou []. */
export function conversaoAleatoriaDasLinhas(linhas = []) {
  const pct = achar(linhas, LINHA_CONVERTE_ALEATORIO);
  return pct > 0 ? [{ para: 'aleatorio', pct }] : [];
}
const LINHA_RICOCHETE_TERRENO = /^Projéteis Ricocheteiam ao colidirem com o terreno$/i;
/** "Projéteis Ricocheteiam ao colidirem com o terreno": a chance (100) ou 0. */
export const ricocheteNoTerrenoDasLinhas = (linhas = []) => (tem(linhas, LINHA_RICOCHETE_TERRENO) ? 100 : 0);

const LINHA_FEIXES = /^Aplica feixes aos \+?([\d.]+) Inimigos próximos$/i;
/**
 * As Armadilhas Drenantes: "Aplica feixes aos N Inimigos próximos" (+ a qualidade, "+N" — ice_siphon_trap_max_beam_targets): os feixes vão aos N inimigos mais perto
 * da Armadilha no raio dela; o máximo de alvos do uso, ou null.
 */
export function feixesDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Siphoning_Trap(_of_Pain)?$/.test(slug)) return null;
  const n = Math.floor(somar([...linhas, ...daQualidade], LINHA_FEIXES) + 1e-9);
  return n > 0 ? n : null;
}

// ---------------------------------------------------------------- o Clamor do Mago de Batalha

// (o PoB, act_str.lua BattlemagesCry/BattlemagesCrySupport: "Exerted Attacks Trigger Supported Spells" — triggered_by_divine_cry; support_divine_cry_damage_+%_final, o
// "X% menos Dano" das suportadas, no acerto e nas afecções; as suportadas: magias ativáveis, sem as de Armadilha, Mina, Totem, as que reservam, as Vaal e as de Canalização)
const LINHA_MAGO_ATIVA = /^Ataques Impelidos ativam as Magias Suportadas$/i;
const LINHA_MAGO_MENOS = /^Habilidades Suportadas causam ([\d.]+) % menos Dano$/i;
/** O Clamor do Mago de Batalha: { menosPct } (o "X% menos Dano" das magias suportadas), ou null. */
export function magoDeBatalhaDasLinhas(slug, linhas = []) {
  if (slug !== 'Battlemages_Cry' || !tem(linhas, LINHA_MAGO_ATIVA)) return null;
  return { menosPct: achar(linhas, LINHA_MAGO_MENOS) ?? 0 };
}

// ---------------------------------------------------------------- as decisões do dono (26/10)

// (dono, 26/10) as Armadilhas de Urso: "Trava o inimigo no lugar" — o inimigo acertado fica Imobilizado (não anda; ataca) por 3 s × a Duração da Habilidade (a base:
// a duração dela, 3 s + a qualidade; a dos Espetos, sem duração própria, os mesmos 3 s)
const LINHA_TRAVA = /^Trava o inimigo no lugar$/i;
export const TRAVA = Object.freeze({ baseMs: 3000 });
/** A Imobilização das Armadilhas de Urso: { ms } (antes da Duração da Habilidade) — `duracaoS`, a duração da gema (a base), ou null. */
export function travaDasLinhas(slug, linhas = [], duracaoS = null) {
  if (!/^Bear_Trap(_of_Skewers)?$/.test(slug) || !tem(linhas, LINHA_TRAVA)) return null;
  return { ms: slug === 'Bear_Trap' && duracaoS > 0 ? Math.round(duracaoS * 1000) : TRAVA.baseMs };
}
/** O bicho está Imobilizado agora (não anda — `hunt/monstros`)? */
export const imobilizado = (m, agora) => (m?.estados?.imobilizado?.ate ?? 0) > agora;
/** Imobiliza o bicho até `ate` (fica o fim maior). */
export function imobilizar(m, ate) {
  if (!m || !(m.hp > 0)) return false;
  const e = (m.estados ??= {});
  e.imobilizado = { ate: Math.max(e.imobilizado?.ate ?? 0, ate) };
  return true;
}

// (dono, 26/10) a Lança-Chamas: um acerto a cada 0,1 s (o hitTimeOverride do PoB na boa posição) na área em volta da Armadilha, pela duração (3,5 s; a da Estabilidade, 2 s)
// × a Duração da Habilidade; o número de chamas não muda a frequência (o PoB não o usa)
const LINHA_CHAMAS = /^Tem (\d+) chamas$/i;
const LINHA_CHAMAS_Q = /^Possui \+?([\d.]+) Chamas$/i;
export const CHAMAS = Object.freeze({ intervaloMs: 100 });
/** A Lança-Chamas: { intervaloMs, duracaoMs, areas: 1, chamas } (o objeto que pulsa — o da Espiral, `acoes.tiqueDasTorres`), ou null. */
export function chamasDasLinhas(slug, linhas = [], daQualidade = [], duracaoS = null) {
  if (!/^Flamethrower_Trap/.test(slug)) return null;
  const n = achar(linhas, LINHA_CHAMAS);
  if (!n) return null;
  return { intervaloMs: CHAMAS.intervaloMs, duracaoMs: Math.round((duracaoS > 0 ? duracaoS : 3.5) * 1000), areas: 1, chamas: n + Math.floor(somar(daQualidade, LINHA_CHAMAS_Q) + 1e-9) };
}

// (dono, 26/10 — o PoB, SeismicTrapAltX) a Sísmica dos Poços: N ondas (3, + a qualidade), cada uma acerta cada inimigo na área da Armadilha com a chance da sobreposição
// do PoB: (raio da onda + raio do inimigo − 1)² ÷ raio total² = (9 + 3 − 1)² ÷ 18² = 121/324 ≈ 37,3% (o tamanho do inimigo padrão do PoB: Medium, 3)
const LINHA_ONDAS = /^Libera (\d+) ondas?$/i;
const LINHA_ONDAS_Q = /^Libera \+([\d.]+) ondas?$/i;
export const ONDAS = Object.freeze({ raioDaOnda: 9, raioTotal: 18, raioDoInimigo: 3 });
export const chanceDaOnda = (o = ONDAS) => Math.min(1, ((o.raioDaOnda + o.raioDoInimigo - 1) ** 2) / (o.raioTotal ** 2));
/** As ondas da Sísmica dos Poços: { n, chance }, ou null. */
export function ondasDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Seismic_Trap_of_Swells') return null;
  const n = achar(linhas, LINHA_ONDAS);
  if (!n) return null;
  return { n: n + Math.floor(somar(daQualidade, LINHA_ONDAS_Q) + 1e-9), chance: chanceDaOnda() };
}

// (dono, 26/10) o Clamor de Reunião: "Buff tem 100% mais Efeito em seus Lacaios" — o Dano de Ataque Adicional do buff (a foto `hunt.poeReuniao`) vale nos SEUS lacaios no raio
// do Clamor, × (1 + 100%), no golpe de ataque deles
/** As partes adicionais do buff do Clamor de Reunião no golpe do lacaio `l`: [{ el, min, max }] (vazio fora do raio ou sem o buff). */
export function reuniaoNoLacaio(hunt, l, agora = hunt?.clock ?? 0) {
  const reu = hunt?.poeReuniao;
  if (!reu || !(reu.ate > agora) || !hunt.pos || !l || (l.z ?? hunt.z ?? 0) !== (reu.z ?? 0)) return [];
  if (Math.max(Math.abs(l.x - hunt.pos.x), Math.abs(l.y - hunt.pos.y)) > (reu.raio ?? 0)) return [];
  const f = 1 + (Number(reu.lacaiosMaisPct) || 0) / 100;
  const af = reu.af ?? {};
  const partes = [];
  const por = (el, a, b) => { if ((Number(a) || 0) > 0 || (Number(b) || 0) > 0) partes.push({ el, min: (Number(a) || 0) * f, max: (Number(b) || 0) * f }); };
  por('physical', af.phys_add_min, af.phys_add_max);
  for (const el of ['fire', 'ice', 'energy', 'chaos']) por(el, af[`added_${el}_dmg_min`], af[`added_${el}_dmg_max`]);
  return partes;
}

// ---------------------------------------------------------------- as Minas

const LINHA_MINA_DANO_Q = /^Cada mina aplica Dano aumentado em \+([\d.]+) % aos Inimigos próximos máximo de ([\d.]+) ?%$/i;
const LINHA_EFEITO_AURA = /^Efeito das Auras aumentado em ([\d.]+) %$/i;
const LINHA_EXPOSICAO_FOGO = /^Aura de Exposição ao Fogo aplica -([\d.]+) % à resistência a dano de fogo$/i;
/**
 * O que a qualidade e as linhas a mais dão à aura das Minas da gema: { danoPorMinaExtra, efeitoAuraPct, exposicaoFogoPct } (só o que a gema tem), ou null.
 * linhas: as do nível; daQualidade: as da qualidade.
 */
export function auraDaMinaE1b(linhas = [], daQualidade = []) {
  const r = {};
  const dano = somar(daQualidade, LINHA_MINA_DANO_Q);
  if (dano > 0) r.danoPorMinaExtra = dano;
  const efeito = somar([...linhas, ...daQualidade], LINHA_EFEITO_AURA);
  if (efeito > 0) r.efeitoAuraPct = efeito;
  const exp = achar(linhas, LINHA_EXPOSICAO_FOGO);
  if (exp > 0) r.exposicaoFogoPct = exp;
  return Object.keys(r).length ? r : null;
}

// ---------------------------------------------------------------- as Auras

const LINHA_IGNORA_RES = /^Resistência à (Fogo|Gelo|Raio) de Inimigos Próximos é Ignorada por Acertos$/i;
const EL = { fogo: 'fire', gelo: 'ice', raio: 'energy' };
/**
 * As Impurezas Vaal: { ignoraRes, efeitoAuraPct } — o elemento cuja resistência os acertos ignoram nos inimigos no raio da aura e o "Efeito das Auras aumentado"
 * da própria gema —, ou null.
 */
export function impurezaDasLinhas(linhas = []) {
  const m = linhas.map((l) => LINHA_IGNORA_RES.exec(norm(l))).find(Boolean);
  if (!m) return null;
  return { ignoraRes: EL[m[1].toLowerCase()], efeitoAuraPct: somar(linhas, LINHA_EFEITO_AURA) };
}
/**
 * A resistência do tipo do bicho é ignorada pelos seus acertos agora? (a Impureza Vaal ligada — hunt.buffs[].e1b.ignoraRes — e o bicho a até o raio dela,
 * em casas, de você.)
 */
export function resIgnoradaNoAlvo(hunt, alvo, tipo) {
  if (!hunt?.buffs || !alvo || !hunt.pos) return false;
  const agora = hunt.clock ?? 0;
  for (const b of Object.values(hunt.buffs)) {
    if (b?.e1b?.ignoraRes !== tipo || !(b.ate > agora)) continue;
    if ((alvo.z ?? hunt.z ?? 0) !== (hunt.z ?? 0)) continue;
    if (Math.max(Math.abs(alvo.x - hunt.pos.x), Math.abs(alvo.y - hunt.pos.y)) <= (b.raio ?? 1)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- o que o status lê

/** As linhas do lote que o jogo faz (saem de "efeito não simulado" — GemasPoe.ehLinhaFeita): [regex, slugs]. */
const FEITAS = [
  [LINHA_ATIVA_DE_NOVO, /^(Ice_Trap|Ice_Trap_of_Hollowness|Lightning_Trap|Lightning_Trap_of_Sparking|Lightning_Spire_Trap_of_Zapping|Fire_Trap_of_Blasting)$/],
  [LINHA_ARREMESSO_MENOS, /^Explosive_Trap_of_Magnitude$/], [LINHA_ARREMESSO_DUAS_MAOS, /^Spectral_Helix_of_Trarthus$/], [LINHA_EXTRAS_DUAS_ARMAS, /^Spectral_Helix_of_Trarthus$/],
  [LINHA_FOGO_QUEIMANDO, /^Fire_Trap(_of_Blasting)?$/],
  [LINHA_CONVERTE_ALEATORIO, /^Reave_of_Refraction$/],
  [LINHA_RICOCHETE_TERRENO, /^Lightning_Trap_of_Sparking$/],
  [LINHA_MINA_DANO_Q, /^Stormblast_Mine$/], [LINHA_EFEITO_AURA, /^(Icicle_Mine_of_Sabotage|Vaal_Impurity_of_(Fire|Ice|Lightning))$/], [LINHA_EXPOSICAO_FOGO, /^Pyroclast_Mine(_of_Sabotage)?$/],
  [/^Tempestades Acertam Inimigos com Frequência aumentada em [\d.]+ %$/i, /^Herald_of_Thunder$/],
  [LINHA_IGNORA_RES, /^Vaal_Impurity_of_(Fire|Ice|Lightning)$/],
  [LINHA_FEIXES, /^Siphoning_Trap(_of_Pain)?$/],
  [LINHA_MAGO_ATIVA, /^Battlemages_Cry$/], [LINHA_MAGO_MENOS, /^Battlemages_Cry$/],
  // (as decisões do dono, 26/10)
  [LINHA_TRAVA, /^Bear_Trap(_of_Skewers)?$/],
  [LINHA_CHAMAS, /^Flamethrower_Trap(_of_Stability)?$/], [LINHA_CHAMAS_Q, /^Flamethrower_Trap(_of_Stability)?$/],
  [/^Raio Base terciário igual a [\d.]+ metros?$/i, /^Ice_Trap$/],
  [LINHA_ONDAS, /^Seismic_Trap_of_Swells$/], [LINHA_ONDAS_Q, /^Seismic_Trap_of_Swells$/],
  [/^Sacrifica \+?[\d.]+ % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos$/i, /^Dark_Bargain$/],
  [/^Buff tem [\d.]+ % mais Efeito em seus Lacaios$/i, /^Rallying_Cry$/],
];
export const ehLinhaE1b = (slug, l) => FEITAS.some(([re, s]) => s.test(slug) && re.test(norm(l)));
