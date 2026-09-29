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

/*
 * Os `skill:*` da árvore em perícias de verdade: "Skill corpo a corpo" vale
 * para as três armas de mão (sword, axe, club), como no Tibia.
 */
const PERICIAS_DA_ARVORE = {
  'skill:melee': ['sword', 'axe', 'club'],
  'skill:distance': ['distance'],
  'skill:fist': ['fist'],
  'skill:magic': ['magic'],
  'skill:shielding': ['shielding'],
};

const CRITICO_BASE = 0.03; // o 3% do molde real
const MULTIPLICADOR_CRITICO_BASE = 1.6; // "+60% de dano", idem
const ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'];
// O catálogo chama a terra de `poison` em parte dos itens (o nome do OTServ).
const ELEMENTO_DO_CATALOGO = { poison: 'earth' };

const pecas = (estado) => Object.values(estado.equipment ?? {}).filter(Boolean).map((p) => ITEM_CATALOG[p.id]).filter(Boolean);
const arma = (estado) => ITEM_CATALOG[estado.equipment?.weapon?.id] ?? null;

/** A perícia que a arma usa (sem arma, fist). */
export function periciaDaArma(item) {
  // Wand e rod treinam o MAGIC LEVEL (cada tiro gasta mana) — antes caíam em
  // 'fist', e o sorcerer/druid via "fist" no pátio, no treino offline e na ficha.
  if (item?.wand || item?.skill === 'magic') return 'magic';
  return item?.skill ?? 'fist';
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
  const escudo = ITEM_CATALOG[estado.equipment?.shield?.id];
  const armor = soma((it) => it.armor);
  // Escudo inteiro + METADE da defesa da arma (+ o extra dela): é a conta que
  // bate com o personagem real capturado — dwarven shield 26 + steel axe 10/2
  // = 31, e com ele o bloqueio de 42% da ficha real.
  let defense = (escudo?.defense ?? 0) + Math.floor((w?.defense ?? 0) / 2) + (w?.extraDefense ?? 0);
  const pericia = periciaDaArma(w);
  const buff = BuffPower.bonusDeCombate(estado);
  // Os atributos extras (afixos) das peças vestidas — ver `afixos.mjs`.
  const af = Afixos.soma(estado);
  const bonusDePericia = {};
  for (const it of itens) for (const [k, v] of Object.entries(it.skillBonus ?? {})) bonusDePericia[k] = (bonusDePericia[k] ?? 0) + v;
  for (const [k, v] of Object.entries(af)) {
    if (k.startsWith('skill_')) bonusDePericia[k.slice(6)] = (bonusDePericia[k.slice(6)] ?? 0) + v;
  }
  // A árvore de habilidades (ver `game/systems/arvore.mjs`): o `bonus` que o
  // original manda, em fração (0,05 = 5%), com as perícias já inteiras.
  const arv = Arvore.bonus(estado);
  // As gemas encaixadas e acesas (ver `game/systems/gemas.mjs`), em % e pontos.
  const gem = Gemas.bonus(estado);
  // Os perks escolhidos da proficiência da arma na mão (ver `game/systems/proficiencia.mjs`).
  const prof = Proficiencia.bonus(estado);
  for (const [p, v] of Object.entries(prof.pericias)) bonusDePericia[p] = (bonusDePericia[p] ?? 0) + v;
  // Os imbuements das peças vestidas (ver `game/systems/imbuements.mjs`).
  const imb = Imbuements.bonus(estado);
  for (const [p, v] of Object.entries(imb.pericias)) bonusDePericia[p] = (bonusDePericia[p] ?? 0) + v;
  for (const [chave, pericias] of Object.entries(PERICIAS_DA_ARVORE)) {
    for (const p of pericias) if (arv[chave]) bonusDePericia[p] = (bonusDePericia[p] ?? 0) + arv[chave];
  }
  /*
   * A munição do tipo da arma (flecha no arco, bolt na besta): o ataque dela
   * SOMA ao da arma, como no Tibia — o arco e a besta não têm ataque próprio no
   * catálogo, e o golpe saía com ataque zero (decisão do dono, 29/09). A flecha
   * elemental traz o elemento dela (abaixo, `element`).
   */
  const municao = w?.ammo ? ITEM_CATALOG[estado.equipment?.ammo?.id] : null;
  const daMunicao = municao?.ammo === w?.ammo ? municao : null;
  // "Ataque" (+N no ataque da arma) e "Ataque da arma" (+% dele).
  const ataque = Math.round(((w?.attack ?? 0) + (daMunicao?.attack ?? 0) + (af.atk_flat ?? 0) + prof.ataque) * (1 + (af.weapon_atk_pct ?? 0) / 100));
  const valorDaPericia = Treino.valor(estado, pericia) + (bonusDePericia[pericia] ?? 0);
  const shielding = Treino.valor(estado, 'shielding') + (bonusDePericia.shielding ?? 0);
  const damage = w?.wand
    ? { min: w.wand.min, max: w.wand.max }
    : R.attackDamage({ attack: ataque, skill: valorDaPericia, level: estado.level ?? 1 });
  const protection = Object.fromEntries(ELEMENTOS.map((e) => [e, 0]));
  for (const it of itens) {
    for (const [k, v] of Object.entries(it.protection ?? {})) {
      const el = ELEMENTO_DO_CATALOGO[k] ?? k;
      if (el in protection) protection[el] += v;
    }
  }
  // Resistências dos afixos (e "Proteção contra tudo" em todas).
  for (const el of ELEMENTOS) {
    protection[el] += (af[el === 'physical' ? 'phys_res' : `${el}_res`] ?? 0) + (af.protect_all ?? 0) + (gem.resistencia[el] ?? 0) + (imb.protecao[el] ?? 0);
  }
  defense += prof.defesa;
  const alcance = w?.wand || w?.skill === 'distance' ? (w?.range ?? 3) + prof.alcance : 1;
  return {
    armor: armor + (af.armor_flat ?? 0),
    ataque,
    defense,
    damage,
    skillName: pericia,
    skillValue: valorDaPericia,
    skillBonus: bonusDePericia,
    critChance: CRITICO_BASE + soma((it) => it.critChance) / 10000 + (af.crit_chance ?? 0) / 100 + (arv.critChance ?? 0) + prof.critChance + imb.critChance + Aparencia.colecao(estado).critChance,
    critMultiplier: MULTIPLICADOR_CRITICO_BASE + soma((it) => it.critDamage) / 10000 + buff.critMultiplier + (af.crit_dmg ?? 0) / 100 + (arv.critDamage ?? 0) + gem.critico / 100 + prof.critDano + imb.critDano,
    blockChance: R.blockChance(shielding, defense),
    lifeLeech: soma((it) => it.lifeLeech) / 10000 + buff.lifeLeech + (af.life_leech ?? 0) / 100 + (arv.lifeLeech ?? 0) + gem.lifeLeech / 100 + prof.lifeLeech + imb.lifeLeech,
    manaLeech: soma((it) => it.manaLeech) / 10000 + buff.manaLeech + (af.mana_leech ?? 0) / 100 + (arv.manaLeech ?? 0) + gem.manaLeech / 100 + prof.manaLeech + imb.manaLeech,
    // Gemas: esquiva (chance de o golpe não pegar) e "dano recebido" (corte), em fração.
    esquiva: gem.esquiva / 100,
    // A mitigação das gemas e a dos efeitos de item (Pele de Pedra) multiplicam: 1 − (1 − a)(1 − b).
    danoRecebidoDasGemas: 1 - (1 - gem.mitigacao / 100) * (1 - EfeitosDeItem.reducaoDeDano(estado)),
    magiasDasGemas: gem.magias,
    // O resto dos perks da proficiência (golpe básico, runas, boss, classe, vida/mana, perícia como dano).
    proficiencia: prof,
    // Imbuement de dano elemental na arma: {tipo, pct} — X% do golpe físico vira o elemento.
    imbuElemental: imb.elemental,
    protection,
    element: w?.element ?? daMunicao?.element ?? (w?.wand ? { type: w.wand.element, value: 0 } : null),
    attackRange: alcance,
    regenFlat: { hp: soma((it) => it.regen?.hp) + (af.hp_regen ?? 0), mana: soma((it) => it.regen?.mana) },
    speed: R.baseSpeed(estado.level ?? 1) + soma((it) => it.speed) + (af.speed ?? 0) + imb.velocidade,
    // O resto dos afixos, para quem usa: velocidade de ataque (%), dano por
    // elemento (%), dano/cura de magia (%), Onslaught (%), exp e loot (%).
    velocidadeDeAtaque: af.atk_speed ?? 0,
    // Em %, somando o afixo e o "Dano de <elemento>" da árvore.
    danoDoElemento: Object.fromEntries(
      ELEMENTOS.map((el) => [el, (af[`${el}_dmg`] ?? 0) + (arv[`elemento:${el}`] ?? 0) * 100]),
    ),
    danoDeMagia: af.spell_dmg ?? 0,
    curaDeMagia: (af.spell_heal ?? 0) + (arv.cura ?? 0) * 100,
    // O resto da árvore, em fração, para quem usa (`cacadas.mjs`, `acoes.mjs`):
    danoDaArvore: arv.attackDamage ?? 0, // "Dano": todo dano causado
    intervaloDeAtaque: arv.attackInterval ?? 0, // "Tempo entre golpes" (negativo = mais rápido)
    custoDeMana: arv.custoDeMana ?? 0, // "Custo de mana das magias"
    absorcao: arv.absorb ?? 0, // "Absorção": corta o dano recebido
    danoRecebidoExtra: arv.danoRecebido ?? 0, // "Dano recebido": o preço de algumas vias
    regenDaArvore: { hp: arv.regenHp ?? 0, mana: arv.regenMana ?? 0 }, // "% a mais de regeneração"
    flechaAtravessa: arv.flechaAtravessa ?? 0, // chance de a flecha acertar também quem está atrás
    penetracao: arv.armorPenetration ?? 0,
    onslaughtExtra: af.onslaught ?? 0,
    capacidadeExtra: af.capacity ?? 0,
  };
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
  const onslaught = mesmaRolagem ? mesmaRolagem.onslaught : Tiers.rolar(estado, 'weapon') || Math.random() * 100 < (ficha.onslaughtExtra ?? 0);
  // Prey de dano: só contra a criatura do slot (`alvo.key`). Todo golpe do
  // jogador — arma, wand/rod, magia, runa — passa por aqui.
  // A árvore: o "Dano" dos nós e as habilidades que mexem no golpe (ver `Arvore.fatorDasHabilidades`).
  const daArvore = (1 + (ficha.danoDaArvore ?? 0)) * Arvore.fatorDasHabilidades(estado, alvo);
  // E os efeitos de item (Fúria do Desespero, Carrasco, Colheita de Almas — ver `systems/itens/efeitos.mjs`).
  const dano = Math.round(base * Proficiencia.fatorContra(ficha.proficiencia, alvo) * (crit ? ficha.critMultiplier + doCharm.dano / 100 : 1) * (onslaught ? 1.6 : 1) * Prey.fatorDeDano(estado, alvo.key) * daArvore * EfeitosDeItem.fatorDeDano(estado, alvo));
  if (crit) eventos.push({ t: 'fx', id: EFEITO_CRITICO, uid: alvo.uid, x: alvo.x, y: alvo.y });
  return { dano, crit, onslaught };
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
