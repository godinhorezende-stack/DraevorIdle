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
import * as ItensConfig from './itens/config.mjs';
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
import * as Aparencia from './aparencia.mjs';
// Os efeitos especiais (Lendário) e supremos (Mítico) das peças vestidas.
import * as EfeitosDeItem from './itens/efeitos.mjs';
import { metaDaPeca, faixaDoCampo } from './itens/item.mjs';
import { SLOTS_DE_JOIA } from './itens/gerar.mjs';
import * as Atributos from './personagem/atributos.mjs';
import * as Especializacoes from './personagem/especializacoes.mjs';
import * as Passivas from './passivas/arvore.mjs';
import * as Keystones from './passivas/keystones.mjs';
import * as PoderDaArma from './armas/poder.mjs';
import * as Limites from './combate/limites.mjs';
import * as ArmaMod from '../engine/arma.mjs';
import './classes.mjs'; // aplica no boot as classes e os bônus de atributo do Editor de Classes (override)
import { simples } from './combate/modificadores.mjs';
import { PARAMETROS as FORMULAS } from './combate/formulas.mjs';
import * as FORMULAS_FN from './combate/formulas.mjs';
import * as AfeccoesPoe from './itens-poe/afeccoes.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';
import * as CargasPoe from './itens-poe/cargas.mjs';

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
// O 3% do molde real (`combate/formulas.json`). No modo PoE não há chance "do personagem" (dono, 07/10: "só mantenha o modo PoE"): o ataque
// usa a chance-base da ARMA e a magia a da GEMA (`acoes.contaDoDano`), × os "aumentada".
const CRITICO_BASE = itensPoeLigado() ? 0 : FORMULAS.critico.chanceBase;
// No modo PoE o multiplicador de crítico começa em 150%, como no PoE (dono, 07/10); no Draevor, o "+60% de dano" do molde real.
const MULTIPLICADOR_CRITICO_BASE = itensPoeLigado() ? 1.5 : FORMULAS.critico.multiplicadorBase;
const ELEMENTOS = ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'];
/** Os elementos do dano somado das peças do PoE: Fogo, Gelo, Raio e Caos (decisão do dono, 04/10). */
const ELEMENTOS_DO_POE = ['fire', 'ice', 'energy', 'chaos'];
// O catálogo chama a terra de `poison` em parte dos itens (o nome do OTServ).
const ELEMENTO_DO_CATALOGO = { poison: 'earth' };

// `metaDaPeca`: o catálogo com o ataque/defesa/armadura que a peça sorteou no drop.
const pecas = (estado) => Object.values(estado.equipment ?? {}).filter(Boolean).map((p) => metaDaPeca(p)).filter(Boolean);
const arma = (estado) => metaDaPeca(estado.equipment?.weapon) ?? null;
const metasDasPecas = (estado) => pecas(estado);

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

/** O bônus de empunhar DUAS ARMAS no PoE: +15% de chance de bloqueio (somada) e 10% mais velocidade de ataque. */
export const BONUS_DE_DUAS_ARMAS = { bloqueio: 0.15, velocidadeMais: 1.1 };
function comDuasArmas(bloqueio, armaSecundaria) {
  if (!armaSecundaria) return bloqueio;
  const teto = Atributos.CONFIG.bloqueio.MAX;
  const mais = (v) => Math.min(teto, (v ?? 0) + BONUS_DE_DUAS_ARMAS.bloqueio);
  return { ...bloqueio, blockChance: mais(bloqueio.blockChance), blockChanceMin: mais(bloqueio.blockChanceMin), blockChanceMax: mais(bloqueio.blockChanceMax) };
}

function calcularCombate(estado) {
  const itens = pecas(estado);
  const soma = (f) => itens.reduce((a, it) => a + (Number(f(it)) || 0), 0);
  const w = arma(estado);
  const escudo = metaDaPeca(estado.equipment?.shield);
  // PoE: a arma de uma mão na mão secundária (duas armas). Ela soma os mods dela, tem o próprio dano (o golpe alterna) e o bônus de
  // empunhar duas armas do PoE (+15% de bloqueio, 10% mais velocidade de ataque); a chance de crítico de arma é a da principal.
  const armaSecundaria = itensPoeLigado() && escudo?.slot === 'weapon' ? escudo : null;
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
  /*
   * ---- A CLASSE e as especializações naturais ----
   * `gamedata/classes.json` (ver `personagem/especializacoes.mjs`): afinidades
   * de dano por TAG (`afinidades`, lidas por quem calcula cada golpe/skill com
   * `afinidadePara`) e de stat (Armour, Life, Accuracy, Evasion, Attack/Cast
   * Speed, Movement, Healing), somadas abaixo no número que o combate já lê.
   */
  const esp = Especializacoes.efeitos(estado);
  const espStat = (k) => esp.stats[k] ?? 0;
  const bonusDePericia = {};
  const somaPericia = (k, v) => { const p = Treino.canonica(k); bonusDePericia[p] = (bonusDePericia[p] ?? 0) + v; };
  for (const it of itens) for (const [k, v] of Object.entries(it.skillBonus ?? {})) somaPericia(k, v);
  for (const [k, v] of Object.entries(af)) {
    if (k.startsWith('skill_')) somaPericia(k.slice(6), v);
  }
  // A árvore de habilidades (ver `game/systems/arvore.mjs`): o `bonus` que o
  // original manda, em fração (0,05 = 5%), com as perícias já inteiras.
  // + a ÁRVORE DE PASSIVAS: as chaves da árvore antiga que não têm add de item (absorção,
  // penetração, "todo dano", flecha que atravessa) vêm dos nós dela, em fração, no mesmo lugar.
  const arv = { ...Arvore.bonus(estado) };
  const passivas = Passivas.efeitos(estado);
  for (const [k, v] of Object.entries(passivas.legado)) arv[k] = (arv[k] ?? 0) + v;
  // As gemas encaixadas e acesas (ver `game/systems/gemas.mjs`), em % e pontos.
  const gem = Gemas.bonus(estado);
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
  // "Dano adicional" (`phys_add`): soma ao ataque MÍNIMO o valor e ao MÁXIMO `proporcaoDoMaximo` vezes ele (T1 10–20 … T5 50–100). O `atk_flat`
  // (Attack, que não cai mais) segue valendo nas peças antigas: soma o mesmo número aos dois.
  const razaoDoMaximo = ItensConfig.ATRIBUTOS.phys_add?.proporcaoDoMaximo ?? 2;
  const addMin = af.phys_add ?? 0;
  const addMax = addMin * razaoDoMaximo;
  const calcAtaque = (a, adicional = (addMin + addMax) / 2) => Math.round((a ?? 0) + (af.atk_flat ?? 0) + adicional);
  // A faixa da PEÇA (piso e teto sorteados no drop): cada golpe sorteia entre as duas (`ataqueDoGolpe`).
  const [faixaMin, faixaMax] = faixaDoCampo(estado.equipment?.weapon, 'attack');
  // A munição do tipo da arma (flecha no arco) soma o ataque dela, também em faixa.
  const [mMin, mMax] = daMunicao ? faixaDoCampo(estado.equipment?.ammo, 'attack') : [0, 0];
  const temAtaque = !!w?.attack || jMax > 0 || mMax > 0;
  // Sem NENHUM ataque (punho, arco sem flecha): o ataque BASE de `danoFisico.ataqueSemArma` — senão a perícia (Melee/Distance) não valia nada, porque o
  // dano é ataque × (perícia + 4) e o ataque era 0 (o Monk sem arma dava o mesmo 42–78 com Melee 10 ou 120).
  const ataqueBase = !temAtaque && !w?.wand ? FORMULAS.danoFisico?.ataqueSemArma ?? 0 : 0;
  // O "Ataque" mostrado (e o `ataque` da ficha) segue sendo o da arma/munição (0 sem eles); o ataque BASE só entra na conta do dano (mín. e máx. do golpe).
  // ---- A ARMA: qualidade (0–20%) e modificadores LOCAIS (`engine/arma.mjs`, a conta única) ----
  // Só a PRÓPRIA arma: o dano físico dela = base (a faixa sorteada) → + adicional local → × % local → × qualidade. Os adds GLOBAIS (afixos das outras peças, `phys_add`/`atk_flat` abaixo,
  // joias, munição, proficiência) entram DEPOIS, fora da base e sem receber a qualidade. Sem qualidade nem locais o resultado é idêntico ao de antes. A wand/rod não tem dano físico de base
  // (o dano dela é o Magic Attack): a qualidade só mexe na velocidade dela.
  const pecaDaArma = estado.equipment?.weapon ?? null;
  const baseDaArma = ArmaMod.baseDaArma(w, [faixaMin, faixaMax]);
  const armaFinal = baseDaArma ? ArmaMod.statsDaArma(baseDaArma, { qualidade: pecaDaArma?.qualidade, locais: pecaDaArma?.locais }) : null;
  const armaAlteraODano = !!armaFinal && !w?.wand && (armaFinal.qualidade > 0 || armaFinal.locais.addMin > 0 || armaFinal.locais.addMax > 0 || armaFinal.locais.pctDano !== 0);
  const [armaMin, armaMax] = armaAlteraODano ? [armaFinal.danoMin, armaFinal.danoMax] : [faixaMin, faixaMax];
  const ataque = calcAtaque((armaAlteraODano ? (armaMin + armaMax) / 2 : (w?.attack ?? 0)) + Math.round((jMin + jMax) / 2) + (daMunicao?.attack ?? 0));
  const ataqueMin = temAtaque ? calcAtaque(armaMin + jMin + mMin, addMin) : ataque + ataqueBase;
  const ataqueMax = temAtaque ? calcAtaque(armaMax + jMax + mMax, addMax) : ataque + ataqueBase;
  const valorDaPericia = Treino.valor(estado, pericia) + (bonusDePericia[pericia] ?? 0);
  const shielding = Treino.valor(estado, 'shielding') + (bonusDePericia.shielding ?? 0);
  // Wand e rod (dono, 02/10): o Magic Attack (fixo, × raridade) é o "ataque" da arma e o Magic Level a perícia — o MESMO cálculo do golpe físico.
  // O `wand.min/max` do catálogo (o 8–18 do Tibia) não entra mais no "Dano".
  // O dano pela conta do Draevor (perícia e level): é a régua com que as magias escalam (`acoes.contaDoDano` → `danoDeEscala`).
  const danoDoDraevor = w?.wand
    ? R.attackDamage({ attack: Math.round(PoderDaArma.poderDaPeca(estado.equipment?.weapon)), skill: valorDaPericia, level: estado.level ?? 1 })
    : {
        // A faixa da PRÓPRIA arma (o piso e o teto sorteados no drop) pela mesma conta nas duas pontas (`regras.attackDamage`).
        ...R.attackDamage({ attack: Math.round((ataqueMin + ataqueMax) / 2), attackMin: ataqueMin, attackMax: ataqueMax, skill: valorDaPericia, level: estado.level ?? 1 }),
      };
  // No PoE o golpe é o dano da ARMA (sem perícia nem level — `regras.golpeDoJogador`): a ficha mostra a mesma faixa.
  const damage = itensPoeLigado() ? { min: Math.max(1, Math.round(ataqueMin)), max: Math.max(1, Math.round(ataqueMax)) } : danoDoDraevor;
  const protection = Object.fromEntries(ELEMENTOS.map((e) => [e, 0]));
  for (const it of itens) {
    for (const [k, v] of Object.entries(it.protection ?? {})) {
      const el = ELEMENTO_DO_CATALOGO[k] ?? k;
      if (el in protection) protection[el] += v;
    }
  }
  // As resistências dos adds (uma por tipo de dano, holy incluso), das gemas e dos imbuements.
  for (const el of ELEMENTOS) {
    protection[el] += (af[el === 'physical' ? 'phys_res' : `${el}_res`] ?? 0) + (gem.resistencia[el] ?? 0);
  }
  // O LIMITE (`combate/limites.json`): a proteção final de cada elemento vai de 0 a 100%; o que passa disso fica em `excedentes` (a tela mostra à parte).
  const excedentes = { protection: {}, critChance: 0, ataqueDuplo: 0, resistenciaAControle: Math.max(0, (af.control_resist ?? 0) - Limites.LIMITES.resistenciaAControle.maximo) };
  for (const el of ELEMENTOS) {
    const bruto = protection[el];
    protection[el] = Limites.resistenciaDoJogador(bruto);
    excedentes.protection[el] = Math.max(0, bruto - protection[el]);
  }
  // Chance de crítico e de ataque duplo (frações de 0 a 1), com o teto; a penetração (em %) por tipo: física, elemental global e por elemento.
  // O crítico BASE da arma (`critChance` do catálogo, já na soma das peças) × o % de crítico LOCAL dela: só o ACRÉSCIMO local entra aqui (a qualidade não mexe em crítico).
  const critLocalDaArma = armaFinal ? (armaFinal.critChance.final - armaFinal.critChance.base) / 10000 : 0;
  // A chance em pontos (base + o que soma) × o "Chance de Crítico aumentada" RELATIVO das peças do PoE (`crit_chance_inc`, 0 sem elas).
  const critPontos = CRITICO_BASE + critLocalDaArma + (soma((it) => it.critChance) - (armaSecundaria?.critChance ?? 0)) / 10000 + (af.crit_chance ?? 0) / 100 + (arv.critChance ?? 0) + Aparencia.colecao(estado).critChance;
  const critBruto = critPontos * (1 + (af.crit_chance_inc ?? 0) / 100);
  const critChance = Math.min(Limites.LIMITES.critico.chanceMaxima / 100, Math.max(0, critBruto));
  excedentes.critChance = Math.max(0, critBruto - critChance);
  // Nas magias o PoE ainda soma o "Chance de Golpe Crítico com Magias aumentada" (`spell_crit_chance_inc`).
  const critChanceMagia = Math.min(Limites.LIMITES.critico.chanceMaxima / 100, Math.max(0, critPontos * (1 + ((af.crit_chance_inc ?? 0) + (af.spell_crit_chance_inc ?? 0)) / 100)));
  // A magia do PoE: a chance-base é a da GEMA (somada a estes "+% de chance" fixos) × (1 + o "aumentada" geral e o de magias).
  const critMagiaPoe = itensPoeLigado() ? { fixa: (af.crit_chance ?? 0) / 100 + (arv.critChance ?? 0), aumentada: (af.crit_chance_inc ?? 0) + (af.spell_crit_chance_inc ?? 0) } : null;
  // O dano elemental SOMADO das peças do PoE (`added_<el>_dmg_min/max`): faixa por elemento, nos ataques e nas magias.
  const somado = (prefixo) => Object.fromEntries(ELEMENTOS_DO_POE.map((el) => [el, [af[`${prefixo}${el}_dmg_min`] ?? 0, af[`${prefixo}${el}_dmg_max`] ?? 0]]).filter(([, [a, b]]) => a > 0 || b > 0));
  // Caos (elemento próprio do PoE — decisão do dono, 04/10): só aparece na ficha quando alguma peça dá (no PoE, sempre: a penalidade o deixa negativo).
  if (af.chaos_res || itensPoeLigado()) {
    protection.chaos = Limites.resistenciaDoJogador(af.chaos_res ?? 0);
    excedentes.protection.chaos = Math.max(0, (af.chaos_res ?? 0) - protection.chaos);
  }
  /*
   * ---- A PENALIDADE DE RESISTÊNCIA da campanha (PoE; dono, 07/10) ----
   * Vencer o chefe do Ato 5 tira 30% de todas as resistências (Fogo, Gelo, Raio e Caos); o do Ato 10, mais 30% (−60% ao todo). A conta é
   * a do PoE: a penalidade entra ANTES do máximo (75%), e a resistência pode ficar NEGATIVA (até −200%: o dano daquele elemento AUMENTA).
   */
  const penalidade = itensPoeLigado() ? penalidadeDeResistencia(estado) : 0;
  if (itensPoeLigado()) {
    for (const el of ['fire', 'ice', 'energy', 'chaos']) {
      const bruto = (el === 'chaos' ? af.chaos_res ?? 0 : protection[el] + (excedentes.protection[el] ?? 0)) - penalidade;
      protection[el] = Math.max(-200, Math.min(Limites.LIMITES.resistenciaDoJogador.maximo, bruto));
      excedentes.protection[el] = Math.max(0, bruto - protection[el]);
    }
  }
  const duploBruto = (af.double_attack ?? 0) / 100;
  const ataqueDuplo = Math.min(Limites.LIMITES.ataqueDuplo.chanceMaxima / 100, Math.max(0, duploBruto));
  excedentes.ataqueDuplo = Math.max(0, duploBruto - ataqueDuplo);
  const penetracao = {
    // Física: o add Physical Penetration + o nó "Penetração de armadura" da árvore (fração → %).
    fisica: Limites.limitar((af.phys_pen ?? 0) + (arv.armorPenetration ?? 0) * 100, Limites.LIMITES.penetracao.maximo),
    // Elemental GLOBAL (todos os elementos, menos o físico) e a específica de cada elemento (`<elemento>_pen`).
    elemental: Limites.limitar(af.elem_pen ?? 0, Limites.LIMITES.penetracao.maximo),
    porElemento: Object.fromEntries(Limites.ELEMENTOS_DE_PENETRACAO.map((el) => [el, Limites.limitar(af[`${el}_pen`] ?? 0, Limites.LIMITES.penetracao.maximo)])),
  };
  const alcance = w?.wand || w?.skill === 'distance' ? (w?.range ?? 3) : 1;
  const defesas = defesasDaFicha(estado, af, doAtributo, espStat);
  const ficha = {
    // STR/DEX/INT (total, e o que veio da vocação+level — a ficha mostra os dois).
    atributos: { str: principais.str, dex: principais.dex, int: principais.int, daVocacao: principais.daVocacao },
    // O que STR/DEX/INT estão dando agora (vida, dano físico %, precisão, evasão, velocidade %, mana, dano mágico %).
    efeitosDosAtributos: doAtributo,
    // A classe e as especializações naturais (a ficha mostra) e as afinidades de dano por tag (o combate lê).
    classe: {
      id: Especializacoes.classeDe(estado),
      nome: Especializacoes.CONFIG.classes[Especializacoes.classeDe(estado)]?.nome ?? '',
      especializacoes: Especializacoes.especializacoesDe(estado).map((e) => ({ id: e.id, nome: e.nome, efeitos: e.efeitos })),
    },
    afinidades: esp.dano,
    fontesDasAfinidades: esp.fontes,
    // De onde vem cada parte dos números (a ficha mostra ao passar o mouse): ver `origensDaFicha`.
    origens: origensDaFicha({ estado, af, arv, doAtributo, esp, principais, somaDosItens: soma, gem, buff }),
    armor: defesas.armour,
    ataque,
    ataqueMin,
    ataqueMax,
    defense,
    damage,
    // A régua das magias (a conta do Draevor; igual a `damage` sem o PoE).
    danoDeEscala: danoDoDraevor,
    // A recarga do Energy Shield (PoE): "Recarga aumentada em X%" e "Início da Recarga X% mais rápido" (`personagem/defesa.mjs`).
    esRecargaPct: af.es_recharge ?? 0,
    esInicioPct: af.es_recharge_start ?? 0,
    skillName: pericia,
    skillValue: valorDaPericia,
    skillBonus: bonusDePericia,
    critChance,
    critChanceMagia,
    critMagiaPoe,
    // Os números da PRÓPRIA arma (base, qualidade, locais → dano físico final, APS, crítico, DPS físico da arma): o que o tooltip e o editor mostram. `null` sem arma.
    arma: armaFinal,
    critMultiplier: MULTIPLICADOR_CRITICO_BASE + soma((it) => it.critDamage) / 10000 + buff.critMultiplier + (af.crit_dmg ?? 0) / 100 + (arv.critDamage ?? 0) + gem.critico / 100,
    // Só o escudo bloqueia (a defesa da arma não entra): sem escudo, 0%.
    // O bloqueio vem do escudo (se tiver) MAIS a defesa da arma (metade + o extra dela, como sempre), com a
    // faixa de cada peça: a chance de cada golpe sorteia entre `blockChanceMin` e `blockChanceMax`.
    // Sem escudo, a defesa da arma sozinha já bloqueia (0 de defesa = 0%).
    ...comDuasArmas(bloqueioDaFicha(estado, escudo, w, shielding, af), armaSecundaria),
    // O dano da arma da mão secundária (PoE, duas armas): o golpe alterna entre as duas (`hunt/combate.mjs`).
    ...(armaSecundaria
      ? (() => {
          const [oMin, oMax] = faixaDoCampo(estado.equipment?.shield, 'attack');
          return { duasArmas: true, ataqueSecundarioMin: calcAtaque(oMin + jMin, addMin), ataqueSecundarioMax: calcAtaque(oMax + jMax, addMax), armaSecundaria: armaSecundaria.name ?? null };
        })()
      : {}),
    ...faixaDeArmadura(estado, af, espStat('armour')),
    // As defesas novas: Evasion (esquiva do golpe do bicho) e Energy Shield (barra antes da vida).
    evasion: defesas.evasion,
    energyShield: defesas.energyShield,
    // Accuracy: a chance de o golpe da arma/wand acertar o bicho (`Atributos.chanceDeAcerto`).
    accuracy: Math.round(simples(Atributos.precisaoBase(estado.level), { fixos: doAtributo.precisao + (af.accuracy ?? 0), pct: espStat('accuracy') }).bruto),
    lifeLeech: soma((it) => it.lifeLeech) / 10000 + buff.lifeLeech + (af.life_leech ?? 0) / 100 + (arv.lifeLeech ?? 0) + gem.lifeLeech / 100,
    manaLeech: soma((it) => it.manaLeech) / 10000 + buff.manaLeech + (af.mana_leech ?? 0) / 100 + (arv.manaLeech ?? 0) + gem.manaLeech / 100,
    // Gemas: esquiva (chance de o golpe não pegar) e "dano recebido" (corte), em fração.
    esquiva: gem.esquiva / 100,
    // A mitigação das gemas, a dos poderes (Pele de Pedra, Coração do Titã) e o add Damage Reduction multiplicam: 1 − (1 − a)(1 − b)(1 − c).
    danoRecebidoDasGemas: 1 - (1 - gem.mitigacao / 100) * (1 - EfeitosDeItem.reducaoDeDano(estado)) * (1 - (af.dmg_reduction ?? 0) / 100),
    // Chance to Avoid Damage: chance de ignorar um golpe OU magia inteiro (a Evasion só pega o golpe).
    evitarDano: (af.avoid_damage ?? 0) / 100,
    magiasDasGemas: gem.magias,
    // O resto dos perks da proficiência (golpe básico, runas, boss, classe, vida/mana, perícia como dano).
    // Imbuement de dano elemental na arma: {tipo, pct} — X% do golpe físico vira o elemento.
    // A conversão de físico em elemento (as keystones da árvore põem aqui; os imbuements, que também punham, saíram).
    imbuElemental: null,
    protection,
    element: w?.element ?? daMunicao?.element ?? (w?.wand ? { type: w.wand.element, value: 0 } : null),
    attackRange: alcance,
    regenFlat: { hp: soma((it) => it.regen?.hp) + (af.life_regen ?? 0), mana: soma((it) => it.regen?.mana) + (af.mana_regen ?? 0) },
    // Movement Speed %: sobre a velocidade base do level (+ o speed fixo das botas e do imbuement).
    speed: Math.round(R.baseSpeed(estado.level ?? 1) * (1 + ((af.move_speed ?? 0) + espStat('moveSpeed')) / 100) + soma((it) => it.speed)),
    // O resto dos afixos, para quem usa: velocidade de ataque (%), dano por
    // elemento (%), dano/cura de magia (%), Onslaught (%), exp e loot (%).
    // % de Attack Speed: o add + o que a DEX dá.
    velocidadeDeAtaque: (af.atk_speed ?? 0) + doAtributo.velocidadeDeAtaquePct + espStat('attackSpeed'),
    // O intervalo REAL entre golpes, em ms (o que a caçada usa e a ficha mostra): "Tempo entre golpes"
    // da árvore mexe no próprio intervalo (−3% é 3% mais curto), e a velocidade de ataque (%) o encurta.
    // O intervalo BASE vem do APS FINAL da arma (APS base × % local × qualidade; padrão 0,5 = 2 s): `1000 / APS`. Os aumentos GLOBAIS de velocidade e os limites seguem abaixo, como sempre.
    intervaloDoGolpeMs: Math.round((armaSecundaria ? 1 / BONUS_DE_DUAS_ARMAS.velocidadeMais : 1) * ((armaFinal && armaFinal.aps.intervaloMs ? armaFinal.aps.intervaloMs : INTERVALO_BASE_DO_GOLPE_MS) * Math.max(0.2, 1 + (arv.attackInterval ?? 0))) / (1 + ((af.atk_speed ?? 0) + doAtributo.velocidadeDeAtaquePct + espStat('attackSpeed')) / 100)),
    // Em %, somando o afixo e o "Dano de <elemento>" da árvore.
    // O físico soma o add Physical Damage e o que a STR dá.
    danoDoElemento: Object.fromEntries([
      ...ELEMENTOS.map((el) => [el, (af[el === 'physical' ? 'phys_dmg' : `${el}_dmg`] ?? 0) + (arv[`elemento:${el}`] ?? 0) * 100 + (el === 'physical' ? doAtributo.danoFisicoPct : 0)]),
      // O "Dano de Caos aumentado" das peças do PoE (só aparece quando alguma dá).
      ...(af.chaos_dmg ? [['chaos', af.chaos_dmg]] : []),
    ]),
    // A parte do "Dano físico" que vem da STR (já somada em `danoDoElemento.physical`): no PoE ela é só de CORPO A CORPO ("+1% de dano físico
    // corpo a corpo a cada 5 de Força") — quem bate de longe ou com magia física tira esta parte.
    danoFisicoDaForca: doAtributo.danoFisicoPct ?? 0,
    // Magic Damage (magias, runas, wand): o que a INT dá.
    danoDeMagia: doAtributo.danoMagicoPct,
    // Sistema de itens do PoE (Fase 1; tudo 0/vazio sem peças do PoE): "Dano Mágico aumentado" (só magias), o dano elemental somado
    // nos ataques e nas magias, e vida/mana por abate e por acerto.
    danoDeMagiaDoPoe: af.spell_dmg ?? 0,
    danoSomado: somado('added_'),
    // As afecções do PoE (chances, multiplicadores, duração) — só com o sistema do PoE ligado (`itens-poe/afeccoes.mjs`).
    afeccoes: itensPoeLigado() ? AfeccoesPoe.daSoma(af) : null,
    // As cargas do PoE: o fator do golpe (4% mais por Frenesi, dano por Poder) e as regras de máximo/duração/ganho (`itens-poe/cargas.mjs`).
    ...(itensPoeLigado() ? { fatorDasCargas: CargasPoe.fatorDeDano(estado, af), cargas: CargasPoe.regrasDaSoma(af) } : {}),
    danoSomadoMagia: somado('spell_added_'),
    vidaPorAbate: af.life_on_kill ?? 0,
    manaPorAbate: af.mana_on_kill ?? 0,
    vidaPorAcerto: af.life_on_hit ?? 0,
    manaPorAcerto: af.mana_on_hit ?? 0,
    curaDeMagia: (arv.cura ?? 0) * 100 + espStat('healing'),
    // Cast Speed (intervalo global entre magias), Cooldown Recovery (recarga de cada magia), Skill Cost Reduction.
    // + a identidade da wand na mão (`armas/poder.json`: conjura mais rápido).
    castSpeed: (af.cast_speed ?? 0) + espStat('castSpeed') + PoderDaArma.castSpeedDaIdentidade(estado),
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
    // A regeneração do PoE (só com ITENS_POE=1): vida = (+N/s + N% da vida máxima/s) × (1 + aumentada%); mana = (1,8% da máxima + N/s) × (1 + aumentada%).
    regenPoe: itensPoeLigado() ? regenDoPoe(estado, af) : null,
    // A SUPRESSÃO DE FEITIÇO do PoE (chance, 0 a 1): a magia suprimida causa 50% menos dano (`poderes.mjs → dispararMagia`).
    supressaoDeMagia: Math.min(1, Math.max(0, (af.spell_suppression ?? 0) / 100)),
    penalidadeDeResistencia: penalidade,
    flechaAtravessa: arv.flechaAtravessa ?? 0, // chance de a flecha acertar também quem está atrás
    penetracao,
    ataqueDuplo,
    // A resistência do JOGADOR aos efeitos de controle dos mobs (add Control Resistance), no teto (`combate/limites.json`), em %.
    resistenciaAControle: Limites.limitar(af.control_resist ?? 0, Limites.LIMITES.resistenciaAControle.maximo),
    // Bloqueio de MAGIA (add Spell Block Chance), no teto do tipo (`combate/formulas.json`); só vale com `bloqueio.modo` = 'poe'.
    bloqueioDeMagia: FORMULAS_FN.bloqueioFinal((af.spell_block ?? 0) / 100, 'magia'),
    // A ARMA equipada e o poder que ela dá às habilidades (`armas/poder.mjs`): nome, level exigido e Magic Attack (wand/rod) ou poder.
    armaEquipada: armaEquipadaDaFicha(estado),
    // O que passou do limite (a ficha mostra à parte) e os tetos que a tela usa para marcar "no limite".
    excedentes,
    limites: Limites.tetos(),
    // Os nós da árvore de passivas alocados (a ficha mostra quantos e quais keystones).
    passivas: { keystones: passivas.keystones.map((k) => k.nome) },
  };
  // Os KEYSTONES da árvore que mudam a regra (INT → Ranged, Life Leech ×1,5, físico → fogo), por cima da ficha pronta.
  return Keystones.aplicarNaFicha(ficha, passivas.keystones, principais, estado);
}

/*
 * ---- De onde vem cada número (a ficha mostra ao passar o mouse) ----
 * O dono: "mostrar a origem do bônus — Fire Damage: Base 100%, Equipment +25%,
 * Specialization +15%, Total 140%". São as MESMAS parcelas que a conta acima
 * soma (nada é recalculado para a tela): `{ chave: [{ fonte, valor, pct? }] }`
 * — `pct: true` quando a parcela é um "+X%" sobre as outras (Armour, Evasion,
 * Accuracy). Parcela zero não entra.
 */
/** A arma na mão para a ficha: nome, level exigido, o poder (× raridade) e se é Magic Attack. `null` sem arma. */
function armaEquipadaDaFicha(estado) {
  const peca = estado.equipment?.weapon;
  const meta = peca ? ITEM_CATALOG[peca.id] : null;
  if (!meta) return null;
  return {
    nome: meta.name,
    nivelRequerido: meta.minLevel ?? 0,
    poder: Math.round(PoderDaArma.poderDaPeca(peca)),
    ehMagicAttack: PoderDaArma.familiaDaArma(meta) === 'magic',
    familia: PoderDaArma.familiaDaArma(meta),
    raridade: peca.raridade ?? 'comum',
  };
}

/** A penalidade de resistência da campanha (PoE): −30% depois do chefe do Ato 5 e −60% depois do Ato 10, em qualquer dificuldade. */
export function penalidadeDeResistencia(estado) {
  const vencidos = new Set(Object.values(estado?.campanha ?? {}).flatMap((d) => (Array.isArray(d?.bosses) ? d.bosses.map(Number) : [])));
  return (vencidos.has(5) ? 30 : 0) + (vencidos.has(10) ? 30 : 0);
}
/** A regeneração por segundo no PoE (`{ vidaPorSegundo, manaPorSegundo, vidaPctDoMax, vidaAumentada, manaAumentada }`). */
export const MANA_REGEN_BASE_POE = 1.8;
export function regenDoPoe(estado, af) {
  const vidaPctDoMax = af.life_regen_max_pct ?? 0;
  const vidaAumentada = af.life_regen_pct ?? 0;
  const manaAumentada = af.mana_regen_pct ?? 0;
  const vidaPorSegundo = Math.max(0, ((af.life_regen ?? 0) + ((estado.maxHp ?? 0) * vidaPctDoMax) / 100) * (1 + vidaAumentada / 100));
  const manaPorSegundo = Math.max(0, (((estado.maxMana ?? 0) * MANA_REGEN_BASE_POE) / 100 + (af.mana_regen ?? 0)) * (1 + manaAumentada / 100));
  return { vidaPorSegundo, manaPorSegundo, vidaPctDoMax, vidaAumentada, manaAumentada, vidaFixa: af.life_regen ?? 0, manaFixa: af.mana_regen ?? 0 };
}

function origensDaFicha({ estado, af, arv, doAtributo, esp, principais, somaDosItens, gem, buff }) {
  const o = {};
  const por = (chave, fonte, valor, extra = {}) => {
    if (!valor) return;
    (o[chave] ??= []).push({ fonte, valor: Math.round(valor * 100) / 100, ...extra });
  };
  const daEspecializacao = (chave, tag) => {
    for (const f of esp.fontes[tag] ?? []) por(chave, `Especialização: ${f.especializacao}`, f.pct);
  };
  // Dano por tag: os elementos (itens, árvore, STR no físico, especialização) e Melee/Ranged/Spell.
  for (const el of ELEMENTOS) {
    const k = `dano.${el}`;
    por(k, 'Equipamento', af[el === 'physical' ? 'phys_dmg' : `${el}_dmg`] ?? 0);
    por(k, 'Árvore', (arv[`elemento:${el}`] ?? 0) * 100);
    if (el === 'physical') por(k, `STR (${principais.str})`, doAtributo.danoFisicoPct);
    daEspecializacao(k, el);
  }
  daEspecializacao('dano.melee', 'melee');
  daEspecializacao('dano.ranged', 'ranged');
  por('dano.spell', `INT (${principais.int})`, doAtributo.danoMagicoPct);
  daEspecializacao('dano.spell', 'spell');
  // Velocidades e cura.
  por('velocidadeDeAtaque', 'Equipamento', af.atk_speed ?? 0);
  por('velocidadeDeAtaque', `DEX (${principais.dex})`, doAtributo.velocidadeDeAtaquePct);
  daEspecializacao('velocidadeDeAtaque', 'attackSpeed');
  por('castSpeed', 'Equipamento', af.cast_speed ?? 0);
  por('castSpeed', 'Wand', PoderDaArma.castSpeedDaIdentidade(estado));
  daEspecializacao('castSpeed', 'castSpeed');
  por('curaDeMagia', 'Árvore', (arv.cura ?? 0) * 100);
  daEspecializacao('curaDeMagia', 'healing');
  por('speed', 'Equipamento', af.move_speed ?? 0, { pct: true });
  daEspecializacao('speed', 'moveSpeed');
  // Defesas: o valor das fontes, e os "+X%" por cima.
  por('accuracy', `Base do level ${estado.level ?? 1}`, Atributos.precisaoBase(estado.level));
  por('accuracy', `DEX (${principais.dex})`, doAtributo.precisao);
  por('accuracy', 'Equipamento', af.accuracy ?? 0);
  for (const f of esp.fontes.accuracy ?? []) por('accuracy', `Especialização: ${f.especializacao}`, f.pct, { pct: true });
  por('evasion', `DEX (${principais.dex})`, doAtributo.evasao);
  por('evasion', 'Equipamento', af.evasion ?? 0);
  por('evasion', 'Equipamento', af.evasion_pct ?? 0, { pct: true });
  for (const f of esp.fontes.evasion ?? []) por('evasion', `Especialização: ${f.especializacao}`, f.pct, { pct: true });
  por('armour', 'Equipamento', af.armor_flat ?? 0);
  por('armour', 'Equipamento', af.armour_pct ?? 0, { pct: true });
  for (const f of esp.fontes.armour ?? []) por('armour', `Especialização: ${f.especializacao}`, f.pct, { pct: true });
  for (const f of esp.fontes.life ?? []) por('vida', `Especialização: ${f.especializacao}`, f.pct, { pct: true });

  /*
   * Os atributos com LIMITE (crítico, resistências, penetração, ataque duplo): as MESMAS parcelas da conta de cima, por categoria —
   * base, equipamento (base das peças e afixos), árvore de passivas, altar, proficiência, imbuement, coleção. A tela soma, mostra o
   * limite, o efetivo (o valor da ficha) e o excedente (`excedentes`).
   */
  const dosItens = Afixos.somaDeItens(estado);
  const adds = Passivas.efeitos(estado).adds;
  const dosAfixos = (chave, id, fator = 1) => {
    const total = af[id] ?? 0;
    const peca = dosItens[id] ?? 0;
    const arvore = adds[id] ?? 0;
    por(chave, 'Equipamento (afixos)', peca * fator);
    por(chave, 'Árvore de passivas', arvore * fator);
    por(chave, 'Altar (temporário)', (total - peca - arvore) * fator);
  };
  // Chance de crítico (em pontos %): 3% base + a base das peças + afixos + árvore + proficiência + imbuement + coleção.
  por('critChance', 'Base do personagem', CRITICO_BASE * 100);
  por('critChance', 'Equipamento (base das peças)', somaDosItens((it) => it.critChance) / 100);
  dosAfixos('critChance', 'crit_chance');
  por('critChance', 'Árvore de habilidades', (arv.critChance ?? 0) * 100);
  por('critChance', 'Coleção (outfits e montarias)', Aparencia.colecao(estado).critChance * 100);
  // Multiplicador de crítico (em % de dano, sem limite): 160% base + peças + afixos + buffs + árvore + gemas + proficiência + imbuement.
  por('critMultiplier', 'Base do personagem', MULTIPLICADOR_CRITICO_BASE * 100);
  por('critMultiplier', 'Equipamento (base das peças)', somaDosItens((it) => it.critDamage) / 100);
  dosAfixos('critMultiplier', 'crit_dmg');
  por('critMultiplier', 'Buffs', buff.critMultiplier * 100);
  por('critMultiplier', 'Árvore de habilidades', (arv.critDamage ?? 0) * 100);
  por('critMultiplier', 'Gemas (Atelier)', gem.critico);
  // Ataque duplo e penetração.
  dosAfixos('ataqueDuplo', 'double_attack');
  dosAfixos('resistenciaAControle', 'control_resist');
  dosAfixos('penetracao.fisica', 'phys_pen');
  por('penetracao.fisica', 'Árvore de habilidades', (arv.armorPenetration ?? 0) * 100);
  dosAfixos('penetracao.elemental', 'elem_pen');
  // As resistências, uma por elemento: a proteção das peças (catálogo), os afixos, as gemas do Atelier e o imbuement.
  for (const el of ELEMENTOS) {
    const k = `protection.${el}`;
    let dasPecas = 0;
    for (const it of metasDasPecas(estado)) for (const [kk, v] of Object.entries(it.protection ?? {})) if ((ELEMENTO_DO_CATALOGO[kk] ?? kk) === el) dasPecas += v;
    por(k, 'Equipamento (base das peças)', dasPecas);
    dosAfixos(k, el === 'physical' ? 'phys_res' : `${el}_res`);
    por(k, 'Gemas (Atelier)', gem.resistencia[el] ?? 0);
  }
  if (itensPoeLigado()) {
    const pen = penalidadeDeResistencia(estado);
    for (const el of ['fire', 'ice', 'energy', 'chaos']) {
      if (el === 'chaos') { por('protection.chaos', 'Equipamento (afixos)', dosItens.chaos_res ?? 0); por('protection.chaos', 'Árvore de passivas', adds.chaos_res ?? 0); }
      por(`protection.${el}`, `Penalidade da campanha (${pen >= 60 ? 'Atos 5 e 10' : 'Ato 5'})`, -pen);
    }
  }
  return o;
}

/**
 * A afinidade de dano (%) que vale para uma skill/golpe com estas `tags` — a
 * das especializações da classe. O combate soma no mesmo "+X%" do dano do
 * elemento e do dano mágico (uma soma só, como o dono pediu: base + equipamento
 * + especialização). `{ pct, fontes }`.
 */
export const afinidadePara = (ficha, tags) => Especializacoes.afinidade(ficha?.afinidades, tags, ficha?.fontesDasAfinidades);

/*
 * As defesas da ficha: Armour (a soma das bases + o add fixo, × o add %),
 * Evasion (bases + add + DEX, × o add %) e Energy Shield (bases + add, × o add
 * %). As bases são a média da faixa de cada peça vestida.
 */
function defesasDaFicha(estado, af, doAtributo, espStat = () => 0) {
  const somaDoCampo = (campo) => Object.values(estado.equipment ?? {}).reduce((n, p) => {
    if (!p) return n;
    const [a, b] = faixaDoCampo(p, campo);
    return n + (a + b) / 2;
  }, 0);
  const armour = simples(somaDoCampo('armor'), { fixos: af.armor_flat ?? 0, pct: (af.armour_pct ?? 0) + espStat('armour') }).bruto;
  // (+ a evasão % da DEX e o escudo % da INT — `Atributos.efeitos`; na escala do PoE com o PoE ligado.)
  const evasion = simples(somaDoCampo('evasion'), { fixos: (af.evasion ?? 0) + doAtributo.evasao, pct: (af.evasion_pct ?? 0) + espStat('evasion') + (doAtributo.evasaoPct ?? 0) }).bruto;
  const energyShield = simples(somaDoCampo('es'), { fixos: af.energy_shield ?? 0, pct: (af.es_pct ?? 0) + (doAtributo.energyShieldPct ?? 0) }).bruto;
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
  // O teto da chance FINAL (a ficha + os suportes, os reforços, os charms e o crítico do golpe básico somam depois dela): `combate/limites.json`.
  const chanceDeCritico = Math.min(Limites.LIMITES.critico.chanceMaxima / 100, Math.max(0, ficha.critChance + doCharm.chance / 100));
  const crit = mesmaRolagem ? mesmaRolagem.crit : Math.random() < chanceDeCritico;
  const onslaught = mesmaRolagem ? mesmaRolagem.onslaught : Tiers.rolar(estado, 'weapon');
  // Prey de dano: só contra a criatura do slot (`alvo.key`). Todo golpe do
  // jogador — arma, wand/rod, magia, runa — passa por aqui.
  // A árvore: o "Dano" dos nós e as habilidades que mexem no golpe (ver `Arvore.fatorDasHabilidades`).
  const daArvore = (1 + (ficha.danoDaArvore ?? 0)) * Arvore.fatorDasHabilidades(estado, alvo) * AfeccoesPoe.fatorDeEletrizacao(alvo, estado.hunt?.clock ?? 0) * (ficha.fatorDasCargas ?? 1);
  // E os efeitos de item (Fúria do Desespero, Carrasco, Colheita de Almas — ver `systems/itens/efeitos.mjs`).
  const dano = Math.round(base * (crit ? ficha.critMultiplier + doCharm.dano / 100 : 1) * (onslaught ? FORMULAS.critico.onslaught : 1) * Prey.fatorDeDano(estado, alvo.key) * daArvore * EfeitosDeItem.fatorDeDano(estado, alvo) * fatorContraOAlvo(estado, alvo, ficha));
  if (crit) eventos.push({ t: 'fx', id: EFEITO_CRITICO, uid: alvo.uid, x: alvo.x, y: alvo.y });
  return { dano, crit, onslaught, chance: chanceDeCritico };
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
  if (estado.hunt?.isBoss || alvo.chefe) pct += d.boss ?? 0;
  if (alvo.elite) pct += d.elite ?? 0;
  return 1 + pct / 100;
}

/** A defesa que sustenta o bloqueio, em faixa: o escudo + metade da defesa da arma + o extra dela (+ perks). */
function bloqueioDaFicha(estado, escudo, w, shielding, af = {}) {
  const [eMin, eMax] = escudo ? faixaDoCampo(estado.equipment?.shield, 'defense') : [0, 0];
  const [aMin, aMax] = faixaDoCampo(estado.equipment?.weapon, 'defense');
  const extra = w?.extraDefense ?? 0;
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
function faixaDeArmadura(estado, af, pctDaEspecializacao = 0) {
  const soma = { armor: [0, 0] };
  for (const p of Object.values(estado.equipment ?? {})) {
    if (!p) continue;
    for (const campo of ['armor']) {
      const [a, b] = faixaDoCampo(p, campo);
      soma[campo][0] += a;
      soma[campo][1] += b;
    }
  }
  const opcoes = { fixos: af?.armor_flat ?? 0, pct: (af?.armour_pct ?? 0) + pctDaEspecializacao };
  return {
    armorMin: Math.round(simples(soma.armor[0], opcoes).bruto),
    armorMax: Math.round(simples(soma.armor[1], opcoes).bruto),
  };
}

/** O ataque DESTE golpe: sorteado entre o piso e o teto da arma (a média, `ficha.ataque`, é o que a ficha mostra). */
export function ataqueDoGolpe(ficha, rng = Math.random) {
  const lo = ficha.ataqueMin ?? ficha.ataque;
  const hi = ficha.ataqueMax ?? ficha.ataque;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Vida/mana a mais (por acerto ou por abate dos afixos), com o número na tela. */
export function curar(estado, vida, mana, eventos, quem, pos) {
  const ganhoVida = Math.min(vida, Math.max(0, (estado.maxHp ?? 0) - (estado.hp ?? 0)));
  const ganhoMana = Math.min(mana, Math.max(0, (estado.maxMana ?? 0) - (estado.mana ?? 0)));
  if (ganhoVida > 0) {
    estado.hp += ganhoVida;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoVida, color: '#00ff66' });
  }
  if (ganhoMana > 0) {
    estado.mana += ganhoMana;
    eventos.push({ t: 'heal', uid: 'player', quem, x: pos.x, y: pos.y, v: ganhoMana, color: '#4fc3ff' });
  }
}

/** Leech de um dano total causado: devolve vida e mana e mostra o quanto. */
/*
 * ---- O ROUBO (leech) no modo PoE (dono, 07/10) ----
 * Como no PoE: as MAGIAS não roubam (só os ataques). Cada acerto cria uma INSTÂNCIA de roubo com no máximo 10% da vida/mana máxima, que
 * recupera a 2% da máxima por segundo (um golpe forte dura até 5 s); a soma de todas as instâncias ativas não passa de 20% da máxima por
 * segundo (é preciso ~10 instâncias para bater o teto). Quem faz a recuperação ao longo do tempo é `recuperarRoubo` (no tique da caçada).
 */
export const LEECH_POE = { porInstanciaPct: 10, taxaDaInstanciaPct: 2, porSegundoPct: 20 };
export function aplicarLeech(estado, danoTotal, eventos, quem, pos, ficha = combate(estado), key = null, { ataque = true } = {}) {
  if (itensPoeLigado() && !ataque) return;
  // Vampiric Embrace e Void's Call (charms): leech a mais na criatura apontada.
  const doCharm = Charms.leechExtra(estado, key, ficha);
  const vida = Math.floor(danoTotal * ((ficha.lifeLeech ?? 0) + doCharm.vida));
  const mana = Math.floor(danoTotal * ((ficha.manaLeech ?? 0) + doCharm.mana));
  if (itensPoeLigado()) {
    if (!estado.hunt) return;
    const lista = (estado.hunt.roubos ??= []);
    const instancia = (recurso, total, max) => {
      const quanto = Math.min(total, (max * LEECH_POE.porInstanciaPct) / 100);
      if (quanto > 0) lista.push({ recurso, restante: quanto, porSegundo: (max * LEECH_POE.taxaDaInstanciaPct) / 100 });
    };
    instancia('vida', vida, estado.maxHp ?? 0);
    instancia('mana', mana, estado.maxMana ?? 0);
    return;
  }
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

/** A recuperação das instâncias de roubo do PoE em `ms` de caçada: cada uma a 2%/s da máxima, a soma até 20%/s; acabou, sai. */
export function recuperarRoubo(estado, ms) {
  const lista = estado.hunt?.roubos;
  if (!lista?.length || !(ms > 0)) return;
  const s = ms / 1000;
  const resto = (estado.hunt.restoDoRoubo ??= { vida: 0, mana: 0 });
  for (const [recurso, campo, max] of [['vida', 'hp', estado.maxHp ?? 0], ['mana', 'mana', estado.maxMana ?? 0]]) {
    const ativas = lista.filter((x) => x.recurso === recurso);
    if (!ativas.length) continue;
    const pedido = ativas.reduce((n, x) => n + Math.min(x.restante, x.porSegundo * s), 0);
    const teto = (max * LEECH_POE.porSegundoPct * s) / 100;
    const fator = pedido > teto ? teto / pedido : 1;
    let ganho = 0;
    for (const x of ativas) {
      const d = Math.min(x.restante, x.porSegundo * s) * fator;
      x.restante -= d;
      ganho += d;
    }
    resto[recurso] += ganho;
    const inteiro = Math.floor(resto[recurso]);
    resto[recurso] -= inteiro;
    if (inteiro > 0 && (campo !== 'hp' || (estado.hp ?? 0) > 0)) estado[campo] = Math.min(max, (estado[campo] ?? 0) + inteiro);
  }
  estado.hunt.roubos = lista.filter((x) => x.restante > 0.001);
}

// As cargas do PoE: o Conduíte reparte as cargas com a party — o módulo das cargas lê as regras dos outros e a keystone por aqui.
CargasPoe.definirLeitores({ regras: (e) => combate(e).cargas ?? {}, conduite: (e) => Passivas.temHabilidade(e, 'conduite') });
