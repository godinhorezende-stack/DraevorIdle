// A ficha do personagem — "Detalhes de combate", "Proteção elemental" e
// "Totais" — calculada do equipamento REAL (`item-catalog.json`) e das
// perícias, em vez de copiada fixa do molde (um knight level 8 com o
// equipamento inicial: armadura 18, defesa 31, bloqueio 42% para sempre).
//
// As mesmas contas valem no combate (`cacadas.mjs`): bloqueio apara o golpe do
// bicho, crítico multiplica o golpe, leech devolve vida/mana, proteção corta o
// dano do elemento. Unidades do catálogo, como o tooltip do client lê:
// `critChance`/`critDamage`/`lifeLeech`/`manaLeech` em centésimos de % (1000 =
// 10%); `protection` em % por elemento; `regen` por segundo.
import * as R from './regras.mjs';
import { ITEM_CATALOG } from './dados.mjs';
import * as Treino from './treino.mjs';
import * as BuffPower from './buffpower.mjs';
import * as Tiers from './tiers.mjs';
import * as Afixos from './afixos.mjs';
import * as Prey from './prey.mjs';
import * as Arvore from './arvore.mjs';
import * as Gemas from './gemas.mjs';
import * as Charms from './charms.mjs';
import * as Proficiencia from './proficiencia.mjs';
import * as Imbuements from './imbuements.mjs';
import * as Aparencia from './aparencia.mjs';
// Os efeitos especiais (Lendário) e supremos (Mítico) das peças vestidas.
import * as EfeitosDeItem from './itens/efeitos.mjs';
import { metaDaPeca, faixaDoCampo } from './itens/item.mjs';
import { SLOTS_DE_JOIA } from './itens/gerar.mjs';
import * as Atributos from './personagem/atributos.mjs';

/*
 * Os `skill:*` da árvore em perícias de verdade. Melee é uma perícia só
 * (punho, clava, espada e machado), então "Skill corpo a corpo" e "Skill de
 * punho" da árvore somam na mesma.
 */
const PERICIAS_DA_ARVORE = {
  'skill:melee': ['melee'],
  'skill:distance': ['distance'],
  'skill:fist': ['melee'],
  'skill:magic': ['magic'],
  'skill:shielding': ['shielding'],
};

/** O intervalo entre golpes da arma, sem bônus: o 2s do Tibia (a caçada, a barra de magias e o troco dos bichos seguem esse relógio). */
export const INTERVALO_BASE_DO_GOLPE_MS = 2000;
const CRITICO_BASE = 0.03; // o 3% do molde real
const MULTIPLICADOR_CRITICO_BASE = 1.6; // "+60% de dano", idem
const ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'];
// O catálogo chama a terra de `poison` em parte dos itens (o nome do OTServ).
const ELEMENTO_DO_CATALOGO = { poison: 'earth' };

// `metaDaPeca`: o catálogo com o ataque/defesa/armadura que a peça sorteou no drop.
const pecas = (estado) => Object.values(estado.equipment ?? {}).filter(Boolean).map((p) => metaDaPeca(p)).filter(Boolean);
const arma = (estado) => metaDaPeca(estado.equipment?.weapon) ?? null;

/** A perícia que a arma usa (sem arma, punho — que também é melee). */
export function periciaDaArma(item) {
  // Wand e rod treinam o MAGIC LEVEL (cada tiro gasta mana) — antes caíam em
  // 'fist', e o sorcerer/druid via "fist" no pátio, no treino offline e na ficha.
  if (item?.wand || item?.skill === 'magic') return 'magic';
  return Treino.canonica(item?.skill ?? 'fist');
}

/*
 * ---- Uma ficha por tique, não uma por chamada ----
 *
 * `combate(estado)` é pura (só lê `estado` e o catálogo), mas cara: soma
 * peças, afixos, gemas, proficiência, imbuements, árvore. Medido num tique
 * de verdade (200 jogadores caçando, `tools/perfil-servidor.mjs`), ela é
 * chamada de 5 a 8 vezes NO MESMO TIQUE do mesmo personagem — regenerar, cada
 * golpe recebido, o golpe dado, `characterParaCliente` (2x) — sempre com o
 * mesmo equipamento, porque nada troca de arma no meio de um tique. Isso
 * sozinho era 14% do tempo do tique (docs/auditoria-performance.md).
 *
 * O cache é por OBJETO `estado` (`WeakMap`, some sozinho se o personagem sair
 * e a sessão for coletada) e vale até a próxima invalidação — `invalidar()`,
 * chamada pela sessão UMA vez no início de cada `tique()` e de cada
 * `despachar()` (game/websocket/sessao.mjs). Isso cobre os dois jeitos de o
 * equipamento mudar: o relógio (regeneração, buff que expira) e um comando do
 * jogador (equipar, forjar, imbuir — inclusive os que respondem direto, sem
 * passar por `aplicar()`). Entre uma invalidação e a outra é tudo o MESMO
 * tique ou o MESMO comando — síncrono, sem nada mudando o equipamento no meio.
 */
const CACHE = new WeakMap();

/** Esquece a ficha guardada (a sessão chama no início de cada tique/comando). */
export function invalidar(estado) {
  if (estado) CACHE.delete(estado);
}

export function combate(estado) {
  const guardada = CACHE.get(estado);
  if (guardada) return guardada;
  const valor = calcularCombate(estado);
  CACHE.set(estado, valor);
  return valor;
}

function calcularCombate(estado) {
  const itens = pecas(estado);
  const soma = (f) => itens.reduce((a, it) => a + (Number(f(it)) || 0), 0);
  const w = arma(estado);
  const escudo = metaDaPeca(estado.equipment?.shield);
  // Escudo inteiro + METADE da defesa da arma (+ o extra dela): é a conta que
  // bate com o personagem real capturado — dwarven shield 26 + steel axe 10/2
  // = 31, e com ele o bloqueio de 42% da ficha real.
  let defense = (escudo?.defense ?? 0) + Math.floor((w?.defense ?? 0) / 2) + (w?.extraDefense ?? 0);
  const pericia = periciaDaArma(w);
  const buff = BuffPower.bonusDeCombate(estado);
  // Os adds das peças vestidas — ver `afixos.mjs`.
  const af = Afixos.soma(estado);
  /*
   * ---- STR, DEX, INT ----
   * Base da vocação + pontos por level + os adds (`personagem/atributos.mjs`);
   * os efeitos (Life/Mana nos máximos, % de dano físico e mágico, Accuracy,
   * Evasion, Attack Speed) entram abaixo, cada um no número que o combate lê.
   */
  const principais = Atributos.principais(estado, af);
  const doAtributo = Atributos.efeitos(principais);
  const bonusDePericia = {};
  const somaPericia = (k, v) => { const p = Treino.canonica(k); bonusDePericia[p] = (bonusDePericia[p] ?? 0) + v; };
  for (const it of itens) for (const [k, v] of Object.entries(it.skillBonus ?? {})) somaPericia(k, v);
  for (const [k, v] of Object.entries(af)) {
    if (k.startsWith('skill_')) somaPericia(k.slice(6), v);
  }
  // A árvore de habilidades (ver `game/systems/arvore.mjs`): o `bonus` que o
  // original manda, em fração (0,05 = 5%), com as perícias já inteiras.
  const arv = Arvore.bonus(estado);
  // As gemas encaixadas e acesas (ver `game/systems/gemas.mjs`), em % e pontos.
  const gem = Gemas.bonus(estado);
  // Os perks escolhidos da proficiência da arma na mão (ver `game/systems/proficiencia.mjs`).
  const prof = Proficiencia.bonus(estado);
  for (const [p, v] of Object.entries(prof.pericias)) somaPericia(p, v);
  // Os imbuements das peças vestidas (ver `game/systems/imbuements.mjs`).
  const imb = Imbuements.bonus(estado);
  for (const [p, v] of Object.entries(imb.pericias)) somaPericia(p, v);
  for (const [chave, pericias] of Object.entries(PERICIAS_DA_ARVORE)) {
    for (const p of pericias) if (arv[chave]) somaPericia(p, arv[chave]);
  }
  /*
   * A munição do tipo da arma (flecha no arco, bolt na besta): o ataque dela
   * SOMA ao da arma, como no Tibia — o arco e a besta não têm ataque próprio no
   * catálogo, e o golpe saía com ataque zero (decisão do dono, 29/09). A flecha
   * elemental traz o elemento dela (abaixo, `element`).
   */
  const municao = w?.ammo ? metaDaPeca(estado.equipment?.ammo) : null;
  const daMunicao = municao?.ammo === w?.ammo ? municao : null;
  // "Ataque" (+N no ataque da arma) e "Ataque da arma" (+% dele).
  // O ataque de anel e amuleto (`base.attack` sorteado no drop) soma ao da arma, também em faixa.
  const joias = Object.entries(estado.equipment ?? {}).filter(([slot, p]) => p && SLOTS_DE_JOIA.has(slot));
  const [jMin, jMax] = joias.reduce(([a, b], [, p]) => { const [x, y] = faixaDoCampo(p, 'attack'); return [a + x, b + y]; }, [0, 0]);
  const calcAtaque = (a) => Math.round((a ?? 0) + (af.atk_flat ?? 0) + prof.ataque);
  // A faixa da PEÇA (piso e teto sorteados no drop): cada golpe sorteia entre as duas (`ataqueDoGolpe`).
  const [faixaMin, faixaMax] = faixaDoCampo(estado.equipment?.weapon, 'attack');
  // A munição do tipo da arma (flecha no arco) soma o ataque dela, também em faixa.
  const [mMin, mMax] = daMunicao ? faixaDoCampo(estado.equipment?.ammo, 'attack') : [0, 0];
  const temAtaque = !!w?.attack || jMax > 0 || mMax > 0;
  const ataque = calcAtaque((w?.attack ?? 0) + Math.round((jMin + jMax) / 2) + (daMunicao?.attack ?? 0));
  const ataqueMin = temAtaque ? calcAtaque(faixaMin + jMin + mMin) : ataque;
  const ataqueMax = temAtaque ? calcAtaque(faixaMax + jMax + mMax) : ataque;
  const valorDaPericia = Treino.valor(estado, pericia) + (bonusDePericia[pericia] ?? 0);
  const shielding = Treino.valor(estado, 'shielding') + (bonusDePericia.shielding ?? 0);
  const damage = w?.wand
    ? { min: w.wand.min, max: w.wand.max }
    : {
        // A faixa da arma inteira: o menor golpe com o piso dela, o maior com o teto.
        min: R.attackDamage({ attack: ataqueMin, skill: valorDaPericia, level: estado.level ?? 1 }).min,
        max: R.attackDamage({ attack: ataqueMax, skill: valorDaPericia, level: estado.level ?? 1 }).max,
      };
  const protection = Object.fromEntries(ELEMENTOS.map((e) => [e, 0]));
  for (const it of itens) {
    for (const [k, v] of Object.entries(it.protection ?? {})) {
      const el = ELEMENTO_DO_CATALOGO[k] ?? k;
      if (el in protection) protection[el] += v;
    }
  }
  // As resistências dos adds (uma por tipo de dano, holy incluso), das gemas e dos imbuements.
  for (const el of ELEMENTOS) {
    protection[el] += (af[el === 'physical' ? 'phys_res' : `${el}_res`] ?? 0) + (gem.resistencia[el] ?? 0) + (imb.protecao[el] ?? 0);
  }
  defense += prof.defesa;
  const alcance = w?.wand || w?.skill === 'distance' ? (w?.range ?? 3) + prof.alcance : 1;
  const defesas = defesasDaFicha(estado, af, doAtributo);
  return {
    // STR/DEX/INT (total, e o que veio da vocação+level — a ficha mostra os dois).
    atributos: { str: principais.str, dex: principais.dex, int: principais.int, daVocacao: principais.daVocacao },
    // O que STR/DEX/INT estão dando agora (vida, dano físico %, precisão, evasão, velocidade %, mana, dano mágico %).
    efeitosDosAtributos: doAtributo,
    armor: defesas.armour,
    ataque,
    ataqueMin,
    ataqueMax,
    defense,
    damage,
    skillName: pericia,
    skillValue: valorDaPericia,
    skillBonus: bonusDePericia,
    critChance: CRITICO_BASE + soma((it) => it.critChance) / 10000 + (af.crit_chance ?? 0) / 100 + (arv.critChance ?? 0) + prof.critChance + imb.critChance + Aparencia.colecao(estado).critChance,
    critMultiplier: MULTIPLICADOR_CRITICO_BASE + soma((it) => it.critDamage) / 10000 + buff.critMultiplier + (af.crit_dmg ?? 0) / 100 + (arv.critDamage ?? 0) + gem.critico / 100 + prof.critDano + imb.critDano,
    // Só o escudo bloqueia (a defesa da arma não entra): sem escudo, 0%.
    // O bloqueio vem do escudo (se tiver) MAIS a defesa da arma (metade + o extra dela, como sempre), com a
    // faixa de cada peça: a chance de cada golpe sorteia entre `blockChanceMin` e `blockChanceMax`.
    // Sem escudo, a defesa da arma sozinha já bloqueia (0 de defesa = 0%).
    ...bloqueioDaFicha(estado, escudo, w, prof, shielding, af),
    ...faixaDeArmadura(estado, af),
    // As defesas novas: Evasion (esquiva do golpe do bicho) e Energy Shield (barra antes da vida).
    evasion: defesas.evasion,
    energyShield: defesas.energyShield,
    // Accuracy: a chance de o golpe da arma/wand acertar o bicho (`Atributos.chanceDeAcerto`).
    accuracy: Math.round(Atributos.precisaoBase(estado.level) + doAtributo.precisao + (af.accuracy ?? 0)),
    lifeLeech: soma((it) => it.lifeLeech) / 10000 + buff.lifeLeech + (af.life_leech ?? 0) / 100 + (arv.lifeLeech ?? 0) + gem.lifeLeech / 100 + prof.lifeLeech + imb.lifeLeech,
    manaLeech: soma((it) => it.manaLeech) / 10000 + buff.manaLeech + (af.mana_leech ?? 0) / 100 + (arv.manaLeech ?? 0) + gem.manaLeech / 100 + prof.manaLeech + imb.manaLeech,
    // Gemas: esquiva (chance de o golpe não pegar) e "dano recebido" (corte), em fração.
    esquiva: gem.esquiva / 100,
    // A mitigação das gemas, a dos poderes (Pele de Pedra, Coração do Titã) e o add Damage Reduction multiplicam: 1 − (1 − a)(1 − b)(1 − c).
    danoRecebidoDasGemas: 1 - (1 - gem.mitigacao / 100) * (1 - EfeitosDeItem.reducaoDeDano(estado)) * (1 - (af.dmg_reduction ?? 0) / 100),
    // Chance to Avoid Damage: chance de ignorar um golpe OU magia inteiro (a Evasion só pega o golpe).
    evitarDano: (af.avoid_damage ?? 0) / 100,
    magiasDasGemas: gem.magias,
    // O resto dos perks da proficiência (golpe básico, runas, boss, classe, vida/mana, perícia como dano).
    proficiencia: prof,
    // Imbuement de dano elemental na arma: {tipo, pct} — X% do golpe físico vira o elemento.
    imbuElemental: imb.elemental,
    protection,
    element: w?.element ?? daMunicao?.element ?? (w?.wand ? { type: w.wand.element, value: 0 } : null),
    attackRange: alcance,
    regenFlat: { hp: soma((it) => it.regen?.hp) + (af.life_regen ?? 0), mana: soma((it) => it.regen?.mana) + (af.mana_regen ?? 0) },
    // Movement Speed %: sobre a velocidade base do level (+ o speed fixo das botas e do imbuement).
    speed: Math.round(R.baseSpeed(estado.level ?? 1) * (1 + (af.move_speed ?? 0) / 100) + soma((it) => it.speed) + imb.velocidade),
    // O resto dos afixos, para quem usa: velocidade de ataque (%), dano por
    // elemento (%), dano/cura de magia (%), Onslaught (%), exp e loot (%).
    // % de Attack Speed: o add + o que a DEX dá.
    velocidadeDeAtaque: (af.atk_speed ?? 0) + doAtributo.velocidadeDeAtaquePct,
    // O intervalo REAL entre golpes, em ms (o que a caçada usa e a ficha mostra): "Tempo entre golpes"
    // da árvore mexe no próprio intervalo (−3% é 3% mais curto), e a velocidade de ataque (%) o encurta.
    intervaloDoGolpeMs: Math.round((INTERVALO_BASE_DO_GOLPE_MS * Math.max(0.2, 1 + (arv.attackInterval ?? 0))) / (1 + ((af.atk_speed ?? 0) + doAtributo.velocidadeDeAtaquePct) / 100)),
    // Em %, somando o afixo e o "Dano de <elemento>" da árvore.
    // O físico soma o add Physical Damage e o que a STR dá.
    danoDoElemento: Object.fromEntries(
      ELEMENTOS.map((el) => [el, (af[el === 'physical' ? 'phys_dmg' : `${el}_dmg`] ?? 0) + (arv[`elemento:${el}`] ?? 0) * 100 + (el === 'physical' ? doAtributo.danoFisicoPct : 0)]),
    ),
    // Magic Damage (magias, runas, wand): o que a INT dá.
    danoDeMagia: doAtributo.danoMagicoPct,
    curaDeMagia: (arv.cura ?? 0) * 100,
    // Cast Speed (intervalo global entre magias), Cooldown Recovery (recarga de cada magia), Skill Cost Reduction.
    castSpeed: af.cast_speed ?? 0,
    recuperacaoDeRecarga: af.cooldown_recovery ?? 0,
    // Damage vs Boss / vs Elite / vs Monsters (não-boss), em %.
    danoContra: { boss: af.dmg_vs_boss ?? 0, elite: af.dmg_vs_elite ?? 0, monstros: af.dmg_vs_monsters ?? 0 },
    // Utilidade: Gold Find, Loot Rate e Experience (%).
    goldFind: af.gold_find ?? 0,
    lootRate: af.loot_bonus ?? 0,
    experiencia: af.exp_bonus ?? 0,
    // O resto da árvore, em fração, para quem usa (`cacadas.mjs`, `acoes.mjs`):
    danoDaArvore: arv.attackDamage ?? 0, // "Dano": todo dano causado
    intervaloDeAtaque: arv.attackInterval ?? 0, // "Tempo entre golpes" (negativo = mais rápido)
    custoDeMana: (arv.custoDeMana ?? 0) - (af.skill_cost ?? 0) / 100, // "Custo de mana das magias" (árvore) − Skill Cost Reduction
    absorcao: arv.absorb ?? 0, // "Absorção": corta o dano recebido
    danoRecebidoExtra: arv.danoRecebido ?? 0, // "Dano recebido": o preço de algumas vias
    // "% a mais de regeneração": a árvore + o add Life/Mana Regeneration %.
    regenDaArvore: { hp: (arv.regenHp ?? 0) + (af.life_regen_pct ?? 0) / 100, mana: (arv.regenMana ?? 0) + (af.mana_regen_pct ?? 0) / 100 },
    flechaAtravessa: arv.flechaAtravessa ?? 0, // chance de a flecha acertar também quem está atrás
    penetracao: arv.armorPenetration ?? 0,
  };
}

/*
 * As defesas da ficha: Armour (a soma das bases + o add fixo, × o add %),
 * Evasion (bases + add + DEX, × o add %) e Energy Shield (bases + add, × o add
 * %). As bases são a média da faixa de cada peça vestida.
 */
function defesasDaFicha(estado, af, doAtributo) {
  const somaDoCampo = (campo) => Object.values(estado.equipment ?? {}).reduce((n, p) => {
    if (!p) return n;
    const [a, b] = faixaDoCampo(p, campo);
    return n + (a + b) / 2;
  }, 0);
  const armour = (somaDoCampo('armor') + (af.armor_flat ?? 0)) * (1 + (af.armour_pct ?? 0) / 100);
  const evasion = (somaDoCampo('evasion') + (af.evasion ?? 0) + doAtributo.evasao) * (1 + (af.evasion_pct ?? 0) / 100);
  const energyShield = (somaDoCampo('es') + (af.energy_shield ?? 0)) * (1 + (af.es_pct ?? 0) / 100);
  return { armour: Math.round(armour), evasion: Math.round(evasion), energyShield: Math.round(energyShield) };
}

/** Os totais da vida do personagem (monstros, ouro, mortes, tempo caçando). */
export function totais(estado) {
  estado.totals ??= { kills: 0, exp: 0, gold: 0, deaths: 0, time: 0 };
  return estado.totals;
}

/*
 * ---- Crítico e leech, em TODO dano do jogador ----
 *
 * Antes só o golpe da arma (melee/distância) rolava crítico e leech — wand,
 * rod, magia e runa nunca, e o leech subia a vida calado. Como no Tibia, cada
 * dano causado rola o crítico (a chance e o multiplicador da ficha, com o que
 * equipamento e Buff Power somam) e devolve vida/mana pelo leech.
 *
 * O crítico desenha o efeito do Tibia em cima do alvo (CONST_ME_CRITICAL_DAMAGE,
 * 173 — está no `effect-sprites.json` do original) e o número sai maior (`crit`
 * no `dmg`, map.mjs). O leech sobe como cura no personagem: verde a vida, azul
 * a mana — as mesmas cores da poção.
 */
export const EFEITO_CRITICO = 173;

/**
 * Rola o crítico de um dano — e o Onslaught do tier da arma ("chance de o golpe
 * sair 60% mais forte", `Tiers`). Devolve `{dano, crit, onslaught}` e já põe o
 * efeito do crítico na fila; o `onslaught` vai no `dmg` (o número engorda, map.mjs).
 */
export function rolarCritico(estado, base, alvo, eventos, ficha = combate(estado), mesmaRolagem = null) {
  // `mesmaRolagem` ({crit, onslaught}): a parte elemental do golpe da arma usa a
  // rolagem da parte física — é UM golpe só, com dois números.
  // Low Blow e Savage Blow (charms): mais chance e mais dano crítico na criatura apontada.
  const doCharm = Charms.criticoExtra(estado, alvo?.key);
  const crit = mesmaRolagem ? mesmaRolagem.crit : Math.random() < ficha.critChance + doCharm.chance / 100;
  const onslaught = mesmaRolagem ? mesmaRolagem.onslaught : Tiers.rolar(estado, 'weapon');
  // Prey de dano: só contra a criatura do slot (`alvo.key`). Todo golpe do
  // jogador — arma, wand/rod, magia, runa — passa por aqui.
  // A árvore: o "Dano" dos nós e as habilidades que mexem no golpe (ver `Arvore.fatorDasHabilidades`).
  const daArvore = (1 + (ficha.danoDaArvore ?? 0)) * Arvore.fatorDasHabilidades(estado, alvo);
  // E os efeitos de item (Fúria do Desespero, Carrasco, Colheita de Almas — ver `systems/itens/efeitos.mjs`).
  const dano = Math.round(base * Proficiencia.fatorContra(ficha.proficiencia, alvo) * (crit ? ficha.critMultiplier + doCharm.dano / 100 : 1) * (onslaught ? 1.6 : 1) * Prey.fatorDeDano(estado, alvo.key) * daArvore * EfeitosDeItem.fatorDeDano(estado, alvo) * fatorContraOAlvo(estado, alvo, ficha));
  if (crit) eventos.push({ t: 'fx', id: EFEITO_CRITICO, uid: alvo.uid, x: alvo.x, y: alvo.y });
  return { dano, crit, onslaught };
}

/**
 * Os adds "Damage vs Boss / Elite / Monsters" (%): contra o boss (a sala do
 * boss), contra elite (`alvo.elite`, quando existir) e contra qualquer
 * criatura (não vale no PvP — alvo sem `key`).
 */
export function fatorContraOAlvo(estado, alvo, ficha) {
  const d = ficha.danoContra;
  if (!d || !alvo?.key) return 1;
  let pct = d.monstros ?? 0;
  if (estado.hunt?.isBoss) pct += d.boss ?? 0;
  if (alvo.elite) pct += d.elite ?? 0;
  return 1 + pct / 100;
}

/** A defesa que sustenta o bloqueio, em faixa: o escudo + metade da defesa da arma + o extra dela (+ perks). */
function bloqueioDaFicha(estado, escudo, w, prof, shielding, af = {}) {
  const [eMin, eMax] = escudo ? faixaDoCampo(estado.equipment?.shield, 'defense') : [0, 0];
  const [aMin, aMax] = faixaDoCampo(estado.equipment?.weapon, 'defense');
  const extra = (w?.extraDefense ?? 0) + (prof?.defesa ?? 0);
  const defMin = eMin + Math.floor(aMin / 2) + extra;
  const defMax = eMax + Math.floor(aMax / 2) + extra;
  // A defesa da arma bloqueia mesmo SEM escudo (só que 0 de defesa = 0% de bloqueio).
  // + o add Block Chance (em %), com o teto da configuração.
  const extra2 = (af.block ?? 0) / 100;
  const teto = Atributos.CONFIG.bloqueio.MAX;
  const com = (d) => Math.min(teto, R.blockChance(shielding, d) + (d > 0 || extra2 > 0 ? extra2 : 0));
  return {
    blockChance: com(Math.round((defMin + defMax) / 2)),
    blockChanceMin: com(defMin),
    blockChanceMax: com(defMax),
    defesaBloqueioMin: defMin,
    defesaBloqueioMax: defMax,
  };
}

/** As armaduras em faixa: a soma dos pisos e dos tetos das peças vestidas (+ a armadura plana dos afixos, que é física). */
function faixaDeArmadura(estado, af) {
  const soma = { armor: [0, 0] };
  for (const p of Object.values(estado.equipment ?? {})) {
    if (!p) continue;
    for (const campo of ['armor']) {
      const [a, b] = faixaDoCampo(p, campo);
      soma[campo][0] += a;
      soma[campo][1] += b;
    }
  }
  const plana = af?.armor_flat ?? 0;
  const pct = 1 + (af?.armour_pct ?? 0) / 100;
  return {
    armorMin: Math.round((soma.armor[0] + plana) * pct),
    armorMax: Math.round((soma.armor[1] + plana) * pct),
  };
}

/** O ataque DESTE golpe: sorteado entre o piso e o teto da arma (a média, `ficha.ataque`, é o que a ficha mostra). */
export function ataqueDoGolpe(ficha, rng = Math.random) {
  const lo = ficha.ataqueMin ?? ficha.ataque;
  const hi = ficha.ataqueMax ?? ficha.ataque;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** A ficha do GOLPE BÁSICO (arma ou wand): + crítico de auto-ataque da proficiência. */
export function fichaDoGolpeBasico(ficha) {
  const p = ficha.proficiencia;
  if (!p?.critChanceBasico && !p?.critDanoBasico) return ficha;
  return { ...ficha, critChance: ficha.critChance + p.critChanceBasico, critMultiplier: ficha.critMultiplier + p.critDanoBasico };
}

/** Leech de um dano total causado: devolve vida e mana e mostra o quanto. */
export function aplicarLeech(estado, danoTotal, eventos, quem, pos, ficha = combate(estado), key = null) {
  // Vampiric Embrace e Void's Call (charms): leech a mais na criatura apontada.
  const doCharm = Charms.leechExtra(estado, key, ficha);
  const vida = Math.floor(danoTotal * ((ficha.lifeLeech ?? 0) + doCharm.vida));
  const mana = Math.floor(danoTotal * ((ficha.manaLeech ?? 0) + doCharm.mana));
  const ganhoVida = Math.min(vida, Math.max(0, (estado.maxHp ?? 0) - (estado.hp ?? 0)));
  const ganhoMana = Math.min(mana, Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
  if (ganhoVida > 0) {
    estado.hp += ganhoVida;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoVida, color: '#00ff66', leech: 'life' });
  }
  if (ganhoMana > 0) {
    estado.mana += ganhoMana;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoMana, color: '#4fc3ff', leech: 'mana' });
  }
}
