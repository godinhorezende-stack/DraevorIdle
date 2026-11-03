// O MOTOR DAS HABILIDADES DOS LACAIOS pelo Path of Building (rodada 4 das gemas, lote L — o dono, 27/10: "quero resolver" a limitação "o lacaio ataca do jeito
// do tipo dele"; como no PoE, cada lacaio usa as HABILIDADES dele do PoB). Generaliza o que os Golens de Relâmpago e da Carniça (revisão E1a), o Golem Caótico e o
// Rastejador (lote R3D) e a Relíquia (lote R3B) já faziam um a um.
//
// A fonte é `gamedata/itens-poe/pob-habilidades-lacaios.json` (`tools/importar-pob-habilidades-lacaios.mjs`: o `Minions.lua`, o `Skills/minion.lua` e as tabelas
// de monstro do `Misc.lua`). Para cada lacaio do PoB (`lacaioDoPob` da gema) o motor monta:
//   - a habilidade PRINCIPAL (o golpe que ele repete — a 1ª da `skillList` com dano e sem recarga, ou a que o PoE dá como a dele: a Absolvição do Juiz, o projétil
//     do Golem de Relâmpago, o ataque de projétil do clone…; a lista de VARIANTES quando ele alterna — o mago de um elemento sorteado na invocação, a Sentinela da
//     Pureza com o golpe de alvo único e o golpe em área);
//   - as habilidades com RECARGA (o motor as junta às `recargas` do lacaio — `cacadas.habilidadesComRecarga` as solta quando estão prontas, pela recarga e pelos usos
//     guardados do PoB, com a "Recuperação da Recarga" do lacaio);
//   - a do INÍCIO (o Meteoro do Golem Flamejante do Meteoro, uma vez, ao chegar) e a da VIDA BAIXA (o Golem Glacial do Despedaçamento se destrói: a explosão e os
//     projéteis em nova).
// Cada habilidade sai com os números do PoB no NÍVEL do lacaio (o nível da linha da tabela de níveis é o maior com o requisito até o nível do lacaio — como o PoB
// escolhe o nível de uma habilidade de lacaio):
//   - o ATAQUE: o golpe do lacaio (a tabela de dano de aliado × o `damage` dele — `forcaDoPob`) × o `baseMultiplier` × o "active_skill_damage_+%_final"; o tempo é o
//     `attackTime` do lacaio ÷ (1 + o `attackSpeedMultiplier`) ÷ (1 + o "active_skill_attack_speed_+%_final") ÷ (1 + o "mais" de velocidade do lacaio);
//   - a MAGIA: o dano base do nível (os "spell_minimum/maximum_base_<elemento>_damage" × a eficácia da magia de lacaio — statInterpolation 3), × o
//     "active_skill_damage_+%_final"; o tempo é o `castTime` ÷ (1 + o "active_skill_cast_speed_+%_final"); o crítico da linha do nível;
//   - o ELEMENTO (o da magia; no ataque, a conversão "skill_physical_damage_%_to_convert_to_X" e a do lacaio — o Espírito Furioso, 100% em Fogo);
//   - a ÁREA: o raio de base (`skill("radius", N)` / "active_skill_base_area_of_effect_radius", em unidades — 10 = 1 m; sem raio no PoB: 2 m, uma casa) × (1 + o
//     "active_skill_area_of_effect_radius_+%_final") × √(1 + o "active_skill_area_of_effect_+%_final"), e no uso × √ do "Efeito em Área" do lacaio; em casas é o
//     metro ÷ 2, a fração como chance (a grade do jogo);
//   - os PROJÉTEIS (1 + "number_of_additional_projectiles"), o alcance (o corpo a corpo: 1 casa; o de longe: as 5 casas do jogo × (1 + o
//     "spell_maximum_action_distance_+%"), no mínimo 1), as chances (Congelar, Incendiar, Eletrizar, Provocar) e o "não pode ser crítico".
// O dano sai pelo GOLPE DO LACAIO de sempre (`cacadas.golpeDoLacaioNoBicho`): as auras, o crítico, os suportes do lote S2B, as afecções, o erro do ataque.
// (100% — dados) o elemento da magia do Esqueleto Mago pelo nome do PoB (o Foco de Combate)
import { elementoDoNome } from './prismaticas.mjs';
import { readFileSync } from 'node:fs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pob-habilidades-lacaios.json', import.meta.url), 'utf8'));
const FORCA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pob-lacaios.json', import.meta.url), 'utf8'));

/** A eficácia de uma magia de lacaio do PoB no nível `n` (statInterpolation 3 — a mesma de `LacaiosPoe.eficaciaDaMagiaDoPob`). */
export const eficacia = (n, baseEf, incEf) => (3.885209 + 0.360246 * (Math.max(1, n) - 1)) * (baseEf ?? 0) * (1 + (incEf ?? 0)) ** (Math.max(1, n) - 1);
/** As unidades do PoE em metros (10 = 1 m) e as casas do jogo (1 casa = 2 m). */
export const metrosDe = (unidades) => unidades / 10;
/** O raio de base de uma área sem raio no PoB: 20 unidades (2 m — uma casa). */
export const RAIO_PADRAO_UNIDADES = 20;
/** O alcance de base do lacaio que usa habilidade de longe (projétil, magia): as 5 casas do jogo (o "de longe" dos lacaios de sempre). */
export const ALCANCE_DE_LONGE = 5;
const ELEMENTO_DO_STAT = { physical: 'physical', fire: 'fire', cold: 'ice', lightning: 'energy', chaos: 'chaos' };
const CONVERSAO = { fire: 'fire', cold: 'ice', lightning: 'energy', chaos: 'chaos' };
/** O desenho do projétil e do impacto por elemento (os mesmos do golpe do lacaio em `cacadas`). */
export const PROJETIL = { fire: 4, ice: 37, energy: 36, chaos: 11, physical: 12 };
export const IMPACTO = { fire: 16, ice: 44, energy: 176, chaos: 17, physical: 10 };

/**
 * As habilidades de cada GEMA (a variante decide quais o lacaio usa — a descrição da gema no poedb): `principal` (as variantes do golpe; `fixa` — uma sorteada na
 * invocação), `recargas` (as com recarga que o motor solta; as que outro lote já faz ficam com ele: o Orbe e a Ira do Golem de Relâmpago e a Cascata e o Salto da
 * Carniça — `LacaiosPoe.HABILIDADES_COM_RECARGA`; as do Golem Caótico — `GemasR3D`), `inicio` (uma vez, ao chegar), `vidaBaixa` (na Vida Baixa, e o lacaio morre),
 * `arma: 'sua'` (o golpe é o da SUA arma principal — o clone das Flechas, o Armamento do Golpe Sagrado, a cópia da Auto-reflexão).
 * A ordem importa: a primeira que casa.
 */
export const GEMAS = [
  [/^Raise_Zombie_of_Falling$/, { queda: true }],
  [/^Raise_Zombie/, { principal: ['Melee'], recargas: ['ZombieSlam'] }],
  [/^Summon_Skeletons_of_Mages$/, { principal: ['SkeletonMinionProjectileCold', 'SkeletonMinionProjectileFire', 'SkeletonMinionProjectileLightning'], fixa: true }],
  [/^Summon_Skeletons_of_Archers$/, { principal: ['Melee'] }],
  [/^Vaal_Summon_Skeletons$/, { porGrupo: true }],
  [/^Summon_Skeletons$/, { principal: ['Melee'] }],
  [/^Summon_Raging_Spirit/, { principal: ['SumonRagingSpiritMelee'] }],
  [/^Summon_Flame_Golem_of_the_Meteor$/, { principal: ['FireElementalFlameRedSummoned'], recargas: ['FireElementalConeSummoned'], inicio: 'FireElementalMeteorSummoned' }],
  [/^Summon_Flame_Golem/, { principal: ['FireElementalFlameRedSummoned'], recargas: ['FireElementalConeSummoned', 'FireElementalMortarSummoned'] }],
  [/^Summon_Ice_Golem_of_Shattering$/, { principal: ['Melee'], recargas: ['IceElementalIceCyclone', 'IceElementalSpearSummoned'], vidaBaixa: ['DeathExplodeIceElementalSummoned', 'IceElementalSpearSummonedDeathNova'] }],
  [/^Summon_Ice_Golem/, { principal: ['Melee'], recargas: ['IceElementalIceCyclone', 'IceElementalSpearSummoned'] }],
  [/^Summon_Lightning_Golem/, { principal: ['MonsterProjectileSpellLightningGolemSummoned'], recargas: [] }],
  [/^Summon_Chaos_Golem/, { principal: ['Melee'], recargas: [] }],
  [/^Summon_Stone_Golem/, { principal: ['Melee'], recargas: ['RockGolemSlam', 'RockGolemMinionWhirlingBlades'] }],
  [/^Summon_Carrion_Golem/, { principal: ['BoneGolemMultiAttack'], recargas: [] }],
  [/^Summon_Holy_Relic/, { reliquia: true }],
  [/^Herald_of_Purity$/, { principal: ['Melee', 'HeraldOfLightMinionSlam'], recargas: ['SentinelHolySlam'] }],
  [/^Vaal_Domination$/, { principal: ['VaalDominationMelee'], recargas: ['GAVaalDominationLargeSlam'] }],
  [/^Dominating_Blow/, { principal: ['Melee'], recargas: ['DominatingBlowMinionCharge', 'SentinelHolySlam'] }],
  [/^Vaal_Absolution$/, { principal: ['AbsolutionMinionVaal'], recargas: ['VaalAbsolutionDelayedBlast'] }],
  [/^Absolution/, { principal: ['AbsolutionMinion'], recargas: ['AbsolutionMinionEmpowered'] }],
  // (o Ceifador: o golpe do PoB; usar a gema com ele em campo o faz avançar até o alvo e soltar o Ultimate — `porUso`, a descrição da gema; o da Evisceração "segue
  // você passivamente sem atacar": só o Ultimate; o dos Fantasmas não tem o Ultimate)
  [/^Summon_Reaper_of_Eviscerating$/, { principal: [], semGolpe: true, porUso: 'SummonedReaperUltimate' }],
  [/^Summon_Reaper_of_Revenants$/, { principal: ['SummonedReaperMelee'] }],
  [/^Summon_Reaper$/, { principal: ['SummonedReaperMelee'], porUso: 'SummonedReaperUltimate' }],
  [/^(?:Blink|Mirror)_Arrow/, { principal: ['BlinkMirrorArrowMelee'], arma: 'sua' }],
  [/^Holy_Strike$/, { principal: ['HolyStrikeMinionAttack'], arma: 'sua' }],
  [/^Animate_Weapon_of_Self_Reflection$/, { principal: ['Melee'], arma: 'sua' }],
  // (lote C1, dono 28/10: o item animado é uma BASE Normal do nível da gema — `LacaiosAnimados`: a Arma Animada com o dano e o tempo da base de arma; o Guardião
  // desarmado com as defesas da Armadura de Corpo base; o do Castigo usa o Castigo do PoB)
  [/^(?:Vaal_)?Animate_Weapon/, { principal: ['Melee'], arma: 'base' }],
  [/^Animate_Guardian_of_Smiting$/, { principal: ['AnimateGuardianSmite'], armadura: 'base' }],
  [/^Animate_Guardian$/, { principal: ['Melee'], armadura: 'base' }],
  [/^Summon_Skitterbots$/, { semAtaque: true }],
];
/** As gemas que não invocam (dão bônus aos lacaios em campo, ou os chamam): não têm golpe de lacaio a seguir. */
const SEM_LACAIO = /^(?:Bone_Offering|Flesh_Offering|Spirit_Offering|Convocation)$/;
/** O Espectro: o monstro erguido (sem tipo no PoB), com os multiplicadores dele nas tabelas de aliado do nível do Espectro (`espectroPeloPob`). */
const ESPECTRO = /^Raise_Spectre/;
export const configDaGema = (slug) => GEMAS.find(([re]) => re.test(String(slug ?? '')))?.[1] ?? null;
/**
 * A gema SEGUE O PoB no golpe do lacaio (o motivo "o lacaio ataca do jeito do tipo dele" sai do status): o lacaio dela usa as habilidades do PoB (este motor, ou o lote
 * que já as fazia — a Queda do Zumbi, a Relíquia, os Robôs, que não atacam no PoE), o Espectro usa as do monstro erguido com a força pelo PoB, e as Oferendas e a
 * Convocação não invocam lacaio.
 */
export const segueOPob = (slug) => !!configDaGema(slug) || SEM_LACAIO.test(String(slug ?? '')) || ESPECTRO.test(String(slug ?? ''));

/** O valor de um stat do nível (posicional, na ordem dos `stats`), com a interpolação 2 (linear até a próxima linha pelo nível do lacaio). */
function statDoNivel(h, i, nome, nivel) {
  const k = h.stats.indexOf(nome);
  if (k < 0) return null;
  const linha = h.niveis[i];
  const v = linha?.v?.[k];
  if (v == null) return null;
  if (linha.interp?.[k] === 2) {
    const prox = h.niveis[i + 1];
    if (prox?.v?.[k] != null && prox.req > linha.req && nivel > linha.req) return v + ((prox.v[k] - v) * Math.min(1, (nivel - linha.req) / (prox.req - linha.req)));
  }
  return v;
}
/** A linha da tabela de níveis da habilidade para o lacaio do nível `n`: a última com o requisito até `n` (sem nenhuma, a primeira). */
function indiceDoNivel(h, n) {
  let i = 0;
  h.niveis.forEach((l, k) => { if ((l.req ?? 0) <= n) i = k; });
  return i;
}
const somaConst = (h, k) => Number(h?.const?.[k]) || 0;

/**
 * Uma habilidade `id` do PoB pronta para o lacaio `pobId` no nível `n`: `{ id, nome, magia, corpo, projetil, area, centro, mult, dano, elemento, conversao, crit,
 * semCritico, tempoMs, recargaMs, usos, raioM, projeteis, alcance, hits, chances, dotPorSegundo, dotMs }`. `'Melee'` é o ataque padrão do lacaio (o golpe da tabela,
 * de projétil com o arco). Null se a habilidade não está nos dados.
 */
export function habilidade(id, pobId, n) {
  const lac = DADOS.lacaios[pobId] ?? {};
  const forca = FORCA.lacaios[pobId] ?? {};
  const tempoDoLacaio = (forca.tempo > 0 ? forca.tempo : 1) / Math.max(0.1, 1 + (lac.velMaisPct ?? 0) / 100);
  const convLacaio = lac.conversao ?? null;
  const elementoDaConversao = (c) => {
    const ks = Object.entries(c ?? {}).filter(([, v]) => v > 0);
    return ks.length === 1 && ks[0][1] >= 100 ? ks[0][0] : null;
  };
  if (id === 'Melee') {
    const arco = /bow/i.test(lac.arma ?? '');
    return {
      id, nome: arco ? 'Projectile Attack' : 'Default Attack', magia: false, corpo: !arco, projetil: arco, area: false, mult: 1, tempoMs: Math.round(tempoDoLacaio * 1000),
      elemento: elementoDaConversao(convLacaio) ?? 'physical', ...(convLacaio && !elementoDaConversao(convLacaio) ? { conversao: convLacaio } : {}),
      alcance: arco ? ALCANCE_DE_LONGE : 1, projeteis: 1, hits: 1,
    };
  }
  const h = DADOS.habilidades[id];
  if (!h) return null;
  const i = indiceDoNivel(h, n);
  const linha = h.niveis[i] ?? {};
  const magia = !!h.magia;
  // o DANO da magia (o elemento do stat) ou o multiplicador do ataque
  let dano = null;
  let elemento = 'physical';
  if (magia) {
    for (const [stat, el] of Object.entries(ELEMENTO_DO_STAT)) {
      const min = statDoNivel(h, i, `spell_minimum_base_${stat}_damage`, n);
      const max = statDoNivel(h, i, `spell_maximum_base_${stat}_damage`, n);
      if (min != null && max != null) {
        const ef = eficacia(n, h.baseEf, h.incEf);
        dano = [min * ef, max * ef];
        elemento = el;
        break;
      }
    }
  }
  const maisDano = (statDoNivel(h, i, 'active_skill_damage_+%_final', n) ?? 0) + somaConst(h, 'active_skill_damage_+%_final');
  // (a conversão da habilidade: "skill_physical_damage_%_to_convert_to_X"; no ataque sem ela, a do lacaio)
  const conv = {};
  for (const [k, el] of Object.entries(CONVERSAO)) { const v = somaConst(h, `skill_physical_damage_%_to_convert_to_${k}`); if (v) conv[el] = v; }
  const conversao = Object.keys(conv).length ? conv : !magia ? convLacaio : null;
  if (!magia && conversao) elemento = elementoDaConversao(conversao) ?? 'physical';
  // (o Combo do Golem da Carniça: "+200% de velocidade e +20% de dano depois do terceiro golpe" — o PoB tira a média da série, statMap div 1,5: +133% mais
  // velocidade de ataque e +13,3% mais dano)
  const comboVel = somaConst(h, 'bone_golem_attack_speed_+%_final_after_third_combo_index') / 1.5;
  const comboDano = somaConst(h, 'bone_golem_damage_+%_final_after_third_combo_index') / 1.5;
  // o TEMPO de uso
  const tempo = (1 / Math.max(0.1, 1 + comboVel / 100)) * (magia
    ? (h.conjuracao ?? 1) / Math.max(0.1, 1 + (statDoNivel(h, i, 'active_skill_cast_speed_+%_final', n) ?? somaConst(h, 'active_skill_cast_speed_+%_final')) / 100)
    : tempoDoLacaio / Math.max(0.1, 1 + (linha.velPct ?? 0) / 100) / Math.max(0.1, 1 + (statDoNivel(h, i, 'active_skill_attack_speed_+%_final', n) ?? somaConst(h, 'active_skill_attack_speed_+%_final')) / 100));
  // a ÁREA (o raio de base em unidades × o "+% final" do raio × √ do "+% final" da área)
  const raioBase = h.raio ?? somaConst(h, 'active_skill_base_area_of_effect_radius') ?? 0;
  const raioPct = (statDoNivel(h, i, 'active_skill_area_of_effect_radius_+%_final', n) ?? 0) + somaConst(h, 'active_skill_area_of_effect_radius_+%_final');
  const areaPct = somaConst(h, 'active_skill_area_of_effect_+%_final');
  const raioM = h.area ? metrosDe((raioBase || RAIO_PADRAO_UNIDADES) * Math.max(0, 1 + raioPct / 100) * Math.sqrt(Math.max(0, 1 + areaPct / 100))) : 0;
  const projeteis = 1 + somaConst(h, 'number_of_additional_projectiles') + Math.max(0, somaConst(h, 'base_number_of_projectiles') - 1);
  const deLonge = magia || (h.projetil && !h.corpo);
  const alcance = deLonge ? Math.max(1, Math.round(ALCANCE_DE_LONGE * (1 + somaConst(h, 'spell_maximum_action_distance_+%') / 100))) : 1 + Math.floor((somaConst(h, 'melee_range_+') / 10) / 2);
  const chances = {};
  for (const [k, nome] of [['base_chance_to_freeze_%', 'congelar'], ['base_chance_to_ignite_%', 'incendiar'], ['base_chance_to_shock_%', 'eletrizar'], ['chance_to_taunt_on_hit_%', 'provocar']]) if (somaConst(h, k)) chances[nome] = somaConst(h, k);
  // o DANO DE FOGO no chão (o Meteoro: "base_fire_damage_to_deal_per_minute" × a eficácia, pela duração)
  const porMinuto = statDoNivel(h, i, 'base_fire_damage_to_deal_per_minute', n);
  return {
    id, nome: h.nome, magia, corpo: !!h.corpo, projetil: !!h.projetil, area: !!h.area, movimento: !!h.movimento,
    // (a área sem alvo: em volta do próprio lacaio — o Ciclone, a Nova, a Explosão)
    centro: h.area && (h.movimento && h.corpo && !h.projetil ? true : /Nova|Explode|Cyclone/.test(id)) ? 'lacaio' : 'alvo',
    ...(magia ? { dano } : { mult: (linha.mult ?? 1) * (1 + maisDano / 100) * (1 + comboDano / 100) }),
    ...(magia && maisDano ? { maisDanoPct: maisDano } : {}),
    elemento, ...(conversao && !elementoDaConversao(conversao) ? { conversao } : {}),
    ...(linha.crit != null ? { crit: linha.crit } : {}), ...(h.stats.includes('global_cannot_crit') ? { semCritico: true } : {}),
    tempoMs: Math.max(100, Math.round(tempo * 1000)),
    ...(linha.cd ? { recargaMs: Math.round(linha.cd * 1000), usos: linha.usos ?? 1 } : {}),
    raioM, projeteis, alcance, hits: Math.max(1, h.dps ?? 1),
    ...(Object.keys(chances).length ? { chances } : {}),
    ...(porMinuto != null ? { dotPorSegundo: (porMinuto * eficacia(n, h.baseEf, h.incEf)) / 60, dotMs: somaConst(h, 'base_skill_effect_duration') || 4000 } : {}),
    ...(somaConst(h, 'shield_charge_damage_+%_maximum') ? { investidaMaxPct: somaConst(h, 'shield_charge_damage_+%_maximum') } : {}),
  };
}

/**
 * As habilidades do lacaio da gema `slug` (o lacaio `pobId` do PoB, no nível `n`): `{ principal: [h], fixa, recargas: [h], inicio, vidaBaixa: [h], arma }`, ou null
 * (a gema fora do motor, ou o lacaio dela sem habilidade com golpe — a Queda, a Relíquia, os Robôs, que outros lotes fazem). `extra`: o que a gema muda numa
 * habilidade só — a Pancada do Zumbi da Pancada (`areaPct`, `recargaPct` — lote E2A).
 */
export function doLacaio(slug, pobId, n, extra = {}) {
  const c = configDaGema(slug);
  if (!c || !pobId || c.queda || c.reliquia || c.semAtaque) return null;
  // (a invocação MISTA — a Vaal Convocar Esqueletos —: cada tipo pelo PoB — o soldado e o arqueiro com o ataque padrão, o mago com a magia de projétil de um elemento)
  const doGrupo = c.porGrupo ? (DADOS.lacaios[pobId]?.habilidades ?? []).includes('Melee') ? { principal: ['Melee'] } : { principal: (DADOS.lacaios[pobId]?.habilidades ?? []).filter((id) => !DADOS.habilidades[id]?.niveis?.[0]?.cd), fixa: true } : null;
  const principalIds = doGrupo ? doGrupo.principal : c.principal ?? [];
  const principal = principalIds.map((id) => habilidade(id, pobId, n)).filter(Boolean);
  if (!principal.length && !c.semGolpe) return null;
  const comExtra = (h) => {
    if (!h) return h;
    const e = extra[h.id];
    if (!e) return h;
    return { ...h, ...(e.recargaPct ? { recargaMs: Math.round(h.recargaMs / Math.max(0.1, 1 + e.recargaPct / 100)) } : {}), ...(e.areaPct ? { areaExtraPct: e.areaPct } : {}) };
  };
  const recargas = (c.recargas ?? []).map((id) => comExtra(habilidade(id, pobId, n))).filter((h) => h && h.recargaMs > 0);
  const inicio = c.inicio ? habilidade(c.inicio, pobId, n) : null;
  const vidaBaixa = (c.vidaBaixa ?? []).map((id) => habilidade(id, pobId, n)).filter(Boolean);
  const porUso = c.porUso ? habilidade(c.porUso, pobId, n) : null;
  return { principal, ...(c.fixa || doGrupo?.fixa ? { fixa: true } : {}), ...(c.semGolpe ? { semGolpe: true } : {}), recargas, ...(inicio ? { inicio } : {}), ...(vidaBaixa.length ? { vidaBaixa } : {}), ...(porUso ? { porUso } : {}), ...(c.arma ? { arma: c.arma } : {}) };
}

/**
 * O JEITO de atacar do lacaio pela habilidade principal (o `estilo` de `LacaiosPoe.oQueInvoca`, lido pelo tique — o alcance, a magia, o elemento e os desenhos): de
 * longe com o alcance dela, a magia com o(s) elemento(s) das variantes, o projétil e o impacto do elemento (o arco: a flecha).
 */
export function estiloDaPrincipal(hab, pobId) {
  // (o lacaio sem golpe — o Ceifador da Evisceração: o jeito do corpo a corpo, só para andar perto)
  if (!hab.principal.length) return { alcance: 1, impacto: 10, elemento: 'physical', pob: true };
  const p = hab.principal[0];
  const arco = /bow/i.test(DADOS.lacaios[pobId]?.arma ?? '') || p.id === 'BlinkMirrorArrowMelee' || !!p.arco;
  const alcance = Math.max(...hab.principal.map((h) => h.alcance ?? 1));
  return {
    alcance, impacto: IMPACTO[p.elemento] ?? 10, elemento: p.elemento,
    ...(alcance > 1 ? { projetil: arco ? 3 : PROJETIL[p.elemento] ?? 12 } : {}),
    ...(hab.principal.some((h) => h.magia) ? { magia: true, elementos: [...new Set(hab.principal.map((h) => h.elemento))] } : {}),
    pob: true,
  };
}

/**
 * Os números das habilidades de RECARGA no formato das `recargas` do lacaio (`cacadas.habilidadesComRecarga` — a carga, os usos, a recarga com a recuperação do
 * lacaio): `tipo: 'pob'` (o motor as usa — `usar`). A do INÍCIO vem com um uso e sem recarga (sai uma vez); as da VIDA BAIXA, só com o lacaio na Vida Baixa.
 */
export function recargasDoMotor(hab) {
  if (!hab) return [];
  // (a do início primeiro: sai assim que há um inimigo ao alcance, antes das outras)
  const saida = [];
  if (hab.inicio) saida.push({ ...hab.inicio, tipo: 'pob', recargaMs: 1e12, usos: 1, umaVez: true, alcance: Math.max(hab.inicio.alcance ?? 1, ALCANCE_DE_LONGE) });
  for (const h of hab.recargas) saida.push({ ...h, tipo: 'pob', alcance: h.alcance });
  // (a da Vida Baixa: todas saem no mesmo tique — a explosão e a nova — e a última destrói o lacaio)
  // (a do USO da gema com o lacaio em campo — o Ultimate do Ceifador: pronta a cada pedido, `pedirUltimate`)
  if (hab.porUso) saida.push({ ...hab.porUso, tipo: 'pob', recargaMs: 0, usos: 1, porUso: true, alcance: 99 });
  (hab.vidaBaixa ?? []).forEach((h, i, lista) => saida.push({ ...h, tipo: 'pob', recargaMs: 1e12, usos: 1, umaVez: true, vidaBaixa: true, alcance: 99, ...(i === lista.length - 1 ? { ultimo: true } : {}) }));
  return saida;
}

/** A habilidade principal da vez (a variante sorteada; `fixa`: a mesma do lacaio inteiro, sorteada no primeiro golpe e guardada em `l.habPobIndice`). */
// (100% — dados, 03/11: `proibidos` — os elementos que o Foco de Combate proíbe às Habilidades Prismáticas: o Esqueleto Mago não escolhe a magia daquele elemento;
// a escolhida que ficou proibida é refeita)
export function principalDaVez(l, rng = Math.random, proibidos = null) {
  const lista = l?.habPob?.principal;
  if (!lista?.length) return null;
  if (lista.length === 1) return lista[0];
  if (l.habPob.fixa) {
    const vale = (i) => !!lista[i] && !proibidos?.has?.(elementoDoNome(lista[i].id));
    if (l.habPobIndice == null || !vale(l.habPobIndice)) {
      const livres = lista.map((_, i) => i).filter(vale);
      const de = livres.length ? livres : lista.map((_, i) => i);
      l.habPobIndice = de[Math.min(de.length - 1, Math.floor(rng() * de.length))];
    }
    return lista[l.habPobIndice];
  }
  return lista[Math.floor(rng() * lista.length)];
}

/** A habilidade pode sair agora? A da Vida Baixa só com o lacaio na metade da vida ou menos (a Vida Baixa do PoE: 50%). */
export const podeUsar = (l, h) => (h.porUso ? !!l?.ultimatePedido : !h.vidaBaixa || (l?.hp > 0 && l.hp <= (l.maxHp ?? 0) * 0.5));
/** A gema tem a habilidade do USO com o lacaio em campo (o Ultimate do Ceifador)? */
export const temUltimate = (slug) => !!configDaGema(slug)?.porUso;
/**
 * O USO da gema com o lacaio dela em campo (o Ceifador): ele avança até o alvo e solta o Ultimate no próximo tique (`l.ultimatePedido`, limpo no uso — `usar`). Devolve
 * se havia lacaio para pedir.
 */
export function pedirUltimate(hunt, slug, alvo) {
  if (!temUltimate(slug)) return false;
  const l = (hunt?.lacaios ?? []).find((x) => x.gema === slug && x.hp > 0 && (x.recargas ?? []).some((h) => h.porUso));
  if (!l) return false;
  l.ultimatePedido = { uid: alvo?.uid ?? null };
  return true;
}

/** As partes do golpe da habilidade `h` (a conversão dela por cima das partes do lacaio): `[{ tipo, f }]`. `partesDoLacaio(l, tipo)`: a de `cacadas`. */
export function partesDaHabilidade(l, h, partesDoLacaio) {
  if (!h?.conversao) return partesDoLacaio(l, h?.elemento ?? 'physical');
  const total = Object.values(h.conversao).reduce((n, v) => n + Math.max(0, v), 0);
  const escala = total > 100 ? 100 / total : 1;
  const resto = Math.max(0, 1 - (total * escala) / 100);
  const partes = Object.entries(h.conversao).filter(([, v]) => v > 0).map(([el, v]) => ({ tipo: el, f: (v * escala) / 100 }));
  if (resto > 1e-9) for (const p of partesDoLacaio(l, 'physical')) partes.push({ tipo: p.tipo, f: p.f * resto });
  return partes;
}

/** As casas do raio `raioM` (metros) × √(1 + `areaPct`%): o metro ÷ 2, a fração como chance. */
export function casasDoRaio(raioM, areaPct = 0, rng = Math.random) {
  const m = raioM * Math.sqrt(Math.max(0, 1 + areaPct / 100));
  const c = m / 2;
  return Math.floor(c) + (rng() < c % 1 ? 1 : 0);
}

/**
 * As opções do golpe do lacaio para a habilidade `h` (`cacadas.golpeDoLacaioNoBicho`): a magia (sem o dano adicionado de ataque e sem errar), o dano base da magia × o
 * "aumentado/mais" do lacaio (`l.poe.fatorDoDano`, o que a invocação pôs no golpe) × o "mais" final dela, o multiplicador do ataque, o crítico de base da linha e o
 * "não pode ser crítico".
 */
export function opcoesDoGolpe(l, h, partes) {
  const tipo = partes.length ? partes.reduce((a, b) => (b.f > a.f ? b : a)).tipo : h.elemento ?? 'physical';
  const fator = l?.poe?.fatorDoDano ?? 1;
  return {
    partes, tipo, magia: !!h.magia, habilidade: h.id, impacto: IMPACTO[tipo] ?? 10,
    ...(h.dano ? { base: [h.dano[0] * fator * (1 + (h.maisDanoPct ?? 0) / 100), h.dano[1] * fator * (1 + (h.maisDanoPct ?? 0) / 100)], semSomado: true } : {}),
    ...(h.mult != null && h.mult !== 1 ? { mult: h.mult } : {}),
    ...(h.crit != null ? { critBase: h.crit } : {}), ...(h.semCritico ? { semCritico: true } : {}),
  };
}

/**
 * Os OUTROS atingidos pelo golpe principal (o alvo já levou): a área (em volta do alvo, ou do lacaio) e os projéteis a mais (nos inimigos mais perto do alvo, ao
 * alcance). `vivos`: os inimigos do andar. Devolve `{ area: [bichos], casas, centro, projeteis: [bichos] }`.
 */
export function outrosAtingidos(l, h, alvo, vivos, rng = Math.random) {
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const saida = { area: [], projeteis: [], casas: 0, centro: null };
  if (h.area && h.raioM > 0) {
    const centro = h.centro === 'lacaio' ? l : alvo;
    const casas = casasDoRaio(h.raioM, (l?.poe?.areaPct ?? 0) + (h.areaExtraPct ?? 0), rng);
    saida.casas = casas;
    saida.centro = { x: centro.x, y: centro.y };
    saida.area = vivos.filter((m) => m !== alvo && m.hp > 0 && dist(m, centro) <= casas);
  }
  if (h.projeteis > 1) {
    const ja = new Set([alvo, ...saida.area]);
    saida.projeteis = vivos.filter((m) => !ja.has(m) && m.hp > 0 && dist(m, l) <= (h.alcance ?? ALCANCE_DE_LONGE)).sort((a, b) => dist(a, alvo) - dist(b, alvo)).slice(0, h.projeteis - 1);
  }
  return saida;
}

/**
 * USA a habilidade de recarga `h` do lacaio `l` no `alvo` (`cacadas.habilidadesComRecarga`, o ramo `tipo: 'pob'`). `c`: `{ hunt, vivos, golpe(b, pct, opcoes), partesDoLacaio,
 * relogio, agora }`. O golpe sai pelo golpe do lacaio (as afecções, o crítico, as auras, o erro do ataque); a área em volta do alvo (ou do lacaio — o Ciclone, a Nova, a
 * Explosão), os projéteis em inimigos diferentes (a Nova: todos em volta), os acertos repetidos (o Ciclone: 2), o "+30% no alcance máximo" da Investida, o Provocar
 * (a Pancada do Golem de Pedra) e o Fogo no chão do Meteoro. O lacaio fica ocupado o tempo de uso da habilidade. Devolve os eventos.
 */
export function usar(l, h, alvo0, c) {
  let alvo = alvo0;
  const eventos = [];
  const rng = c.rng ?? Math.random;
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const partes = partesDaHabilidade(l, h, c.partesDoLacaio);
  if (!partes.length) return eventos;
  const op = opcoesDoGolpe(l, h, partes);
  const vivos = c.vivos.filter((m) => m.hp > 0);
  let atingidos;
  // (o Ultimate: o alvo do pedido, se vivo; o lacaio avança até a casa ao lado dele)
  if (h.porUso) {
    const pedido = vivos.find((m) => m.uid === l.ultimatePedido?.uid);
    if (pedido) alvo = pedido;
    delete l.ultimatePedido;
    if (dist(l, alvo) > 1) {
      const dx = Math.sign(l.x - alvo.x);
      const dy = Math.sign(l.y - alvo.y);
      l.x = alvo.x + dx;
      l.y = alvo.y + dy;
    }
  }
  if (h.vidaBaixa && h.projeteis > 1) {
    // (a Nova da Vida Baixa: os projéteis em todas as direções — cada inimigo ao alcance leva um)
    atingidos = vivos.filter((m) => dist(m, l) <= ALCANCE_DE_LONGE).slice(0, h.projeteis);
  } else if (h.area) {
    const o = outrosAtingidos(l, h, alvo, vivos, rng);
    atingidos = h.centro === 'lacaio' ? vivos.filter((m) => dist(m, l) <= o.casas) : [alvo, ...o.area];
    eventos.push({ t: 'explosao', id: IMPACTO[op.tipo] ?? 10, x: o.centro?.x ?? alvo.x, y: o.centro?.y ?? alvo.y, lado: 1 + 2 * o.casas });
  } else if (h.movimento && h.corpo) {
    // (a investida e o rolamento: a reta do lacaio ao alvo — cada inimigo nela leva o golpe)
    const passos = Math.max(1, dist(l, alvo));
    const naReta = [];
    for (let k = 1; k <= passos; k++) {
      const p = { x: Math.round(l.x + ((alvo.x - l.x) * k) / passos), y: Math.round(l.y + ((alvo.y - l.y) * k) / passos) };
      for (const m of vivos) if (m.x === p.x && m.y === p.y && !naReta.includes(m)) naReta.push(m);
    }
    atingidos = naReta.length ? naReta : [alvo];
  } else {
    const o = outrosAtingidos(l, h, alvo, vivos, rng);
    atingidos = [alvo, ...o.projeteis];
  }
  if (h.projetil || h.magia) for (const m of atingidos) if (!h.area || h.centro !== 'lacaio') eventos.push({ t: 'shot', id: PROJETIL[op.tipo] ?? 12, x: l.x, y: l.y, tx: m.x, ty: m.y });
  // (a Investida: até +30% no alcance máximo — pela distância percorrida)
  const maisDaInvestida = h.investidaMaxPct ? 1 + ((h.investidaMaxPct / 100) * Math.min(1, dist(l, alvo) / Math.max(1, h.alcance ?? ALCANCE_DE_LONGE))) : 1;
  for (const m of atingidos) {
    for (let k = 0; k < (h.hits ?? 1); k++) {
      if (!(m.hp > 0)) break;
      const r = c.golpe(m, 100 * maisDaInvestida, op);
      if (r?.errou) continue;
      // (o Provocar da habilidade — a Pancada do Golem de Pedra: 33%)
      if (h.chances?.provocar > 0 && m.hp > 0 && rng() * 100 < h.chances.provocar) {
        (m.estados ??= {}).provocado = { ate: (c.relogio ?? 0) + 3000, por: l.nome, deLacaio: true };
        eventos.push({ t: 'estado', uid: m.uid, x: m.x, y: m.y, estado: 'provocado' });
      }
    }
  }
  // (o Meteoro: o Fogo no chão — o dano por segundo nos atingidos, pela duração, pela resistência a Fogo deles; × o "aumentado/mais" do lacaio)
  if (h.dotPorSegundo > 0 && c.queimar) for (const m of atingidos) if (m.hp > 0) c.queimar(m, h.dotPorSegundo * (l?.poe?.fatorDoDano ?? 1), h.dotMs);
  // (o lacaio fica ocupado o tempo de uso da habilidade; a da Vida Baixa o destrói)
  l.proximoGolpe = Math.max(l.proximoGolpe ?? 0, (c.agora ?? 0) + (h.tempoMs ?? 0));
  if (h.vidaBaixa && h.ultimo) l.hp = 0;
  return eventos;
}

// ---- O ESPECTRO pelo PoB ----
/**
 * A força do ESPECTRO pelo PoB: o monstro erguido (`poe` do bestiário — o nível, o dano e o tempo de ataque dele; `vida` — a vida + o escudo) leva os MULTIPLICADORES
 * dele (a vida e o dano ÷ as tabelas de monstro do nível dele — `monsterLifeTable`, `monsterDamageTable`) para as tabelas de ALIADO do nível do Espectro
 * (`monsterAllyLifeTable`, `monsterAllyDamageTable` — como o PoB monta o Espectro); o tempo de ataque é o dele. As MAGIAS do monstro sobem do nível dele para o do
 * Espectro pela EFICÁCIA do PoB (lote C1, dono 28/10 — no lugar da tabela de dano de monstro): a magia de monstro tem o dano base × a eficácia do nível (statInterpolation
 * 3: (3,885209 + 0,360246 × (N − 1)) × (1 + o incremental)^(N − 1)), e o Espectro a usa no nível dele — o fator é a eficácia no nível do Espectro ÷ a no nível do monstro.
 * O incremental de cada magia de monstro está no `Skills/spectre.lua` do PoB, que a cópia salva não tem: vale o 0,04 (`INCREMENTAL_DAS_MAGIAS_DO_ESPECTRO` — o das
 * magias de monstro do PoB fica entre 0,035 e 0,058, a maioria perto de 0,04). `{ vida, golpe, tempoMs, fatorDasMagias }`, ou null.
 */
export const INCREMENTAL_DAS_MAGIAS_DO_ESPECTRO = 0.04;
/** O fator das magias do monstro erguido (nível `nMon`) no Espectro de nível `nivel`: a eficácia do PoB num ÷ no outro. */
export const fatorDasMagiasDoEspectro = (nMon, nivel, inc = INCREMENTAL_DAS_MAGIAS_DO_ESPECTRO) => eficacia(nivel, 1, inc) / eficacia(nMon, 1, inc);
export function espectroPeloPob(poe, vida, nivel) {
  const nMon = Math.round(Number(poe?.nivel) || 0);
  if (!(nMon >= 1) || !(Number(poe?.dano) > 0)) return null;
  const T = DADOS.tabelas;
  const k = (t, n) => t[Math.max(1, Math.min(t.length, Math.round(n))) - 1];
  const multVida = (Number(vida) || 0) / k(T.vidaMonstro, nMon);
  const multDano = Number(poe.dano) / k(T.danoMonstro, nMon);
  return {
    vida: k(FORCA.tabelas.vida, nivel) * multVida,
    golpe: k(FORCA.tabelas.dano, nivel) * multDano,
    tempoMs: Math.round((Number(poe.tempoAtaque) || 1) * 1000),
    fatorDasMagias: fatorDasMagiasDoEspectro(nMon, Math.max(1, Math.round(Number(nivel) || 1))),
  };
}

/**
 * O lacaio recém-invocado (`acoes.invocarLacaios`): o golpe da SUA arma principal (o clone das Flechas, o Armamento do Golpe Sagrado, a cópia da Auto-reflexão — o PoB:
 * o lacaio usa a arma de quem o invoca) — a faixa da arma com os modificadores locais (`Ficha.armasEquipadas`) × o "aumentado/mais" do lacaio, e o tempo de ataque
 * dela. `armas`: as de `Ficha.armasEquipadas`. Sem arma, fica a força de antes.
 */
export function aoInvocar(l, { armas = [] } = {}) {
  if (l?.habPob?.arma !== 'sua') return;
  const a = (armas ?? []).find((x) => x.slot === 'weapon');
  if (!a || !(a.max > 0)) return;
  const f = l.poe?.fatorDoDano ?? 1;
  l.dano = { min: Math.max(1, Math.round(a.min * f)), max: Math.max(1, Math.round(a.max * f)) };
  if (a.intervaloMs > 0) {
    l.intervaloMs = Math.round(a.intervaloMs);
    l.habPob = { ...l.habPob, principal: l.habPob.principal.map((h) => ({ ...h, tempoMs: Math.round(a.intervaloMs) })) };
  }
}
