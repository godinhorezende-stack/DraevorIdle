// Os LACAIOS e os TOTENS das gemas do PoE (dono, 06/10: "sistema de lacaios do PoE" — as 58 gemas de invocação e os 21 totens estavam
// bloqueados porque o jogo não tinha lacaios). O que cada gema invoca, NO NÍVEL dela, sai das linhas da gema (poedb):
//   - "Máximo de (3 — 6) Zumbis Evocados", "Máximo de Espíritos Furiosos Convocados: 20" → o máximo em campo;
//   - "Convoca 2 Guerreiros Esqueleto" → quantos por uso (1 se não diz);
//   - "Duração base é de 20 segundos" / "Totem dura 8 segundos" → a duração (sem: ficam até morrer);
//   - "Lacaios têm X% mais Vida Máxima", "Lacaio causa X% mais Dano" → por cima da força de base;
//   - "Espectros Erguidos são de Nível N" → o nível do lacaio (sem: o nível que a gema pede — o "RequerNível" do nível dela);
//   - "+N ao número máximo de Totens" → mais totens.
// A FORÇA de base de um lacaio do nível N (lote 44, dono, 16/10: "Aplicar o PoB" e "Incluir no lote 44") é a do PoE: a TABELA DE ALIADOS do
// nível × o multiplicador do tipo do lacaio no Path of Building (`gamedata/itens-poe/pob-lacaios.json` — `tools/importar-pob-lacaios.mjs`):
// a vida, o golpe, o tempo de ataque, o escudo de energia, a armadura, a evasão, as resistências de base e o "não pode sofrer dano". O lacaio
// sem tipo no PoB (o Espectro, que é o monstro erguido; o Totem) segue com a de um monstro COMUM do PoE desse nível (a mediana da campanha:
// `campanha-poe.json`), e o desenho vem do nome (zumbi, esqueleto, espírito, golem...). O TOTEM fica parado onde nasce e usa a própria skill da gema, com o dano
// dela (a conta do jogo) e o visual dela.
import { CATALOGO } from '../dados.mjs';
import * as GemasPoe from './gemas-poe.mjs';
import { CAMPANHA, desenhoPeloNome } from './monstros.mjs';
import * as Controle from '../combate/controle.mjs';
import { slugDoNome, fatorDaArea, casasPelaArea, almasDoLacaio, DEVORADOR_DE_ALMAS, sorteado, criticoDoBicho } from './condicoes-poe.mjs';
import { PARAMETROS } from '../combate/formulas.mjs';
import { chanceDeEsquiva } from '../personagem/atributos.mjs';
import * as CargasPoe from './cargas.mjs';
// (lote E1a, 26/10: as linhas que faltavam nos lacaios — a qualidade, o Ceifador, o Golem da Carniça… — `gemas-e1a.mjs`)
import * as GemasE1a from './gemas-e1a.mjs';
// (lote E2A, 26/10: as linhas difíceis dos lacaios — os Espectros, os Zumbis da Pancada e da Queda, o Golpe Sagrado, as Sentinelas Ascendidas, os Robôs — `gemas-e2a.mjs`)
import * as GemasE2a from './gemas-e2a.mjs';
import * as SuportesS2B from './suportes-s2b.mjs';
export { aplicarCeifador, fatorDoCeifador, fatorPorNaoGolemPerto, danoDoGolemDaCarnica, desviarParaOGolemDePedra } from './gemas-e1a.mjs';
import { readFileSync } from 'node:fs';

const BESTIARY = CATALOGO.bestiary;

// ---- (lote 44) a força do PoE, pelo Path of Building ----
export const POB = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/pob-lacaios.json', import.meta.url), 'utf8'));
/** A gema (o slug) → o lacaio dela no PoB (`Data/Minions.lua`). O Espectro (o monstro erguido) e os Totens não estão: seguem a força de monstro. */
const LACAIO_DO_POB = [
  [/^Raise_Zombie/, 'RaisedZombie'], [/^Summon_Skeletons_of_Archers/, 'RaisedSkeletonArcher'], [/^Summon_Skeletons_of_Mages/, 'RaisedSkeletonCaster'],
  [/^Vaal_Summon_Skeletons/, 'RaisedSkeletonMeleeVaal'], [/^Summon_Skeletons/, 'RaisedSkeleton'], [/^Summon_Raging_Spirit/, 'SummonedRagingSpirit'],
  [/^Summon_Flame_Golem/, 'SummonedFlameGolem'], [/^Summon_Ice_Golem/, 'SummonedIceGolem'], [/^Summon_Lightning_Golem/, 'SummonedLightningGolem'],
  [/^Summon_Chaos_Golem/, 'SummonedChaosGolem'], [/^Summon_Stone_Golem/, 'SummonedStoneGolem'], [/^Summon_Carrion_Golem/, 'SummonedCarrionGolem'],
  [/^Summon_Holy_Relic/, 'HolyLivingRelic'], [/^Herald_of_Purity/, 'AxisEliteSoldierHeraldOfLight'], [/^Herald_of_Agony/, 'HeraldOfAgonySpiderPlated'],
  [/^Vaal_Domination/, 'AxisEliteSoldierDominatingBlowVaal'], [/^Dominating_Blow/, 'AxisEliteSoldierDominatingBlow'], [/^Vaal_Absolution/, 'AbsolutionTemplarJudgeVaal'],
  [/^Absolution/, 'AbsolutionTemplarJudge'], [/^Summon_Reaper/, 'SummonedReaper'], [/^Summon_Skitterbots/, 'SkitterbotCold'],
  [/^(?:Blink|Mirror)_Arrow/, 'ArrowClone'], [/^(?:Vaal_)?Animate_Weapon/, 'AnimatedWeapon'], [/^Animate_Guardian/, 'AnimatedArmour'], [/^Holy_Strike/, 'HolyStrikeMinion'],
];
/** A habilidade PRINCIPAL do lacaio quando não é o golpe comum (o multiplicador e a velocidade dela — `Skills/minion.lua`). */
const HABILIDADE_PRINCIPAL = { GuardianSentinel: 'VaalDominationMelee' };
/** O lacaio que bate com a SUA arma no PoE (o clone das Flechas Ilusória e Espelhada usa o seu arco): o golpe não é o da tabela. */
const USA_A_SUA_ARMA = new Set(['ArrowClone']);
export const lacaioDoPob = (slug) => LACAIO_DO_POB.find(([re]) => re.test(slug ?? ''))?.[1] ?? null;
/**
 * A força do lacaio `id` do PoB no nível `n`: `{ vida, dano, spread, tempo, es, armadura, evasao, res, imune }`. A vida e o golpe são os da
 * tabela de aliados × o multiplicador (o golpe × o da habilidade principal); o tempo de ataque ÷ a velocidade dela; o escudo de energia é a
 * fração da vida; a armadura e a evasão, as tabelas de monstro × o multiplicador. `dano`/`tempo` nulos: o lacaio usa uma ARMA (a Arma Animada,
 * o Guardião Animado, o Armamento Sagrado; o clone das Flechas, a sua) — o jogo segue com o golpe de monstro do nível.
 */
/**
 * (lote 87, a revisão) O golpe do lacaio é MAGIA (para o erro — `lacaioPodeErrar`)? A 1ª habilidade da lista do PoB que não seja o 'Melee' (a
 * principal, se houver — `HABILIDADE_PRINCIPAL`) é magia: o Golem de Chamas, o de Raios. Pela HABILIDADE PRINCIPAL no PoE (dono, 19/10: "Pela
 * habilidade principal no PoE"): o Fantasma (o projétil mágico) e o Juiz da Absolvição (a magia Absolvição) são MAGIA; o Golem de Caos (o golpe
 * corpo a corpo; a Tempestade de Areia e a Cascata saem à parte) é ATAQUE.
 * (Só a classificação: o multiplicador e a velocidade do golpe seguem a `HABILIDADE_PRINCIPAL`.)
 */
const MAGIA_NO_POE = new Set(['SummonedPhantasm', 'AbsolutionTemplarJudge']);
const ATAQUE_NO_POE = new Set(['SummonedChaosGolem']);
function golpeDeMagiaDoPob(id, p) {
  if (MAGIA_NO_POE.has(id)) return true;
  if (ATAQUE_NO_POE.has(id)) return false;
  const principal = HABILIDADE_PRINCIPAL[id] ?? (p.habilidades ?? []).find((h) => h !== 'Melee');
  return !!POB.habilidades[principal]?.magia;
}
export function forcaDoPob(id, n) {
  const p = POB.lacaios[id];
  if (!p) return null;
  const i = Math.max(1, Math.min(POB.tabelas.vida.length, Math.round(n) || 1)) - 1;
  const h = POB.habilidades[HABILIDADE_PRINCIPAL[id]] ?? {};
  const vida = POB.tabelas.vida[i] * p.vida;
  return {
    // (o `spread` é o do golpe do PoB; o de quem usa a arma, o do jogo: ±20%)
    id, vida, dano: p.dano > 0 && !USA_A_SUA_ARMA.has(id) ? POB.tabelas.dano[i] * p.dano * (h.mult ?? 1) : null, spread: p.dano > 0 && !USA_A_SUA_ARMA.has(id) ? p.spread ?? 0.2 : 0.2,
    tempo: p.tempo > 0 ? p.tempo / Math.max(0.1, 1 + (h.velPct ?? 0) / 100) : null, es: p.es ? vida * p.es : 0,
    armadura: p.armadura ? POB.tabelas.armadura[i] * p.armadura : 0, evasao: p.evasao ? POB.tabelas.evasao[i] * p.evasao : 0,
    res: { fire: 0, ice: 0, energy: 0, chaos: 0, ...(p.res ?? {}) }, imune: !!p.imune,
    // (lote 87, dono 19/10: a parte B, "Todos os lacaios (PoE)") a PRECISÃO: o jogo segue o PoE — o golpe de ataque do lacaio pode errar (decisão
    // do dono) —, com a tabela de precisão de monstro do nível × o `accuracy` do lacaio que o PoB guarda (o PoB mesmo não a usa: sem a flag
    // MinionAccuracyEqualsAccuracy, o lacaio dele sempre acerta); o golpe de MAGIA (nunca erra); o "Limiar de Atordoamento aumentado" (o Zumbi,
    // +30%) e o "não pode ser Atordoado" (os Robôs)
    precisao: POB.tabelas.precisao[Math.min(POB.tabelas.precisao.length, i + 1) - 1] * (p.precisao ?? 1),
    golpeDeMagia: golpeDeMagiaDoPob(id, p),
    limiarAtordoamentoPct: p.limiarAtordoamentoPct ?? 0, imuneAtordoamento: !!p.imuneAtordoamento,
  };
}
/**
 * Os campos de `l.poe` de um lacaio que não sai de uma gema (o Sentinela, as Relíquias, o Fantasma, as Aranhas — `acoes.lacaioDoGuardian`) só
 * com as defesas de base do PoB (`forcaDoPob`): as resistências, a armadura, a evasão e o escudo de energia; o resto, zero.
 */
export function poeDeBase(f) {
  return {
    danoIncPct: 0, res: 0, resCaos: f?.res?.chaos ?? 0, resFogo: f?.res?.fire ?? 0, resGelo: f?.res?.ice ?? 0, resRaio: f?.res?.energy ?? 0,
    danoRecebidoPct: 0, regenPct: 0, regen: 0, roubo: 0, movimentoPct: 0, dotMulti: 0, degenPct: 0, bloqueio: 0,
    chances: { cegar: 0, provocar: 0, desacelerar: 0, envenenar: 0, incendiar: 0, definhar: 0, cinzas: 0, empalar: 0 },
    armadura: f?.armadura ?? 0, evasao: f?.evasao ?? 0, esFixo: f?.es ?? 0, reducaoFisica: 0, bloqueioMagico: 0, resMax: 0, esDaVidaPct: 0,
    // (lote 86) a Égide Necromântica: o máximo de uma resistência, os efeitos ao bloquear e o "se Bloqueou Recentemente" — zerados
    resMaxEl: { fire: 0, ice: 0, energy: 0 }, resMaxCaos: 0, aoBloquear: { causticar: 0, enfraquecer: 0, exaurir: 0, eventos: [] },
    seBloqueou: { armadura: 0, penFogo: 0, fogo: [0, 0], sortudo: 0, bloqueio: 0, bloqueioMagico: 0, critMult: 0, trespassar: 0 },
    naoBloqueou: { bloqueio: 0, critInc: 0, noMaximo: 0, magiaNoMaximo: 0 }, bloqueioSortudo: 0, bloqueioMax: 0, bloqueioMagicoMax: 0, fatorDoDano: 1,
    aoMatar: { poderProfano: [0, 4], agressividade: [0, 4] },
    // (lote 87) a precisão, o atordoamento e o crítico recebido de base (do PoB — `forcaDoPob`)
    precisaoBase: f?.precisao ?? null, precisaoFixa: 0, precisaoInc: 0, golpeDeMagia: !!f?.golpeDeMagia, limiarAtordoamentoPct: f?.limiarAtordoamentoPct ?? 0,
    imuneAtordoamento: !!f?.imuneAtordoamento, recBloqueio: 0, recAtordoamento: 0, critRecebidoRed: 0,
  };
}
/** O PODER FANTASMAL de cada Fantasma pelo nível do Suporte: Convocar Fantasma (o PoB — `[mín, máx]` de Dano Físico Mágico Adicional). */
export function poderFantasmalNoNivel(nivel) {
  const t = POB.poderFantasmal;
  const ks = Object.keys(t).map(Number).sort((a, b) => a - b);
  const k = ks.filter((x) => x <= Math.max(ks[0], Math.round(nivel) || 1)).at(-1) ?? ks[0];
  return t[k];
}
/** As palavras de cada tipo de lacaio nos mods das peças (`max_lacaio:golem`, `lacaio_dano:espirito`…). */
const PALAVRA_DO_TIPO = { sentinela: /sentinela|sentinel/i, zumbi: /zumbi|zombie/i, espectro: /espectro|spectre/i, golem: /golem/i, esqueleto: /esqueleto|skeleton/i, totem: /totem/i,
  espirito: /espírito furioso|raging spirit/i, fantasma: /fantasma|phantasm/i, reliquia: /relíquia|relic/i, sagrado: /espírito sagrado|holy/i, arma: /arma animada|animate/i, aranha: /aranha|spider/i,
  // (ciclo 7) os clones da Flecha Ilusória / Flecha Espelhada ("Duração do Arqueiro Ilusório aumentada").
  arqueiro: /arqueir|clone|mirror arrow|blink arrow|flecha (?:ilusória|espelhada)/i, balista: /balista|ballista/i,
  // (lote 80, o Mensageiro Solitário: "Lacaios de Habilidades de Arautos" — a Sentinela da Pureza, o Rastejador Agonizante)
  arauto: /herald|arauto/i, qualquer: /./ };

// ---- a força de base por nível (a mediana dos monstros comuns da campanha) ----
// PREGUIÇOSA (calculada no primeiro uso e guardada): calcular na carga do módulo lia `CAMPANHA` enquanto `monstros.mjs` ainda carregava,
// quando a cadeia de imports começava por `itens-poe/campanha.mjs` (campanha → monstros → … → lacaios-poe → monstros):
// "ReferenceError: Cannot access 'CAMPANHA' before initialization". Sem áreas ainda (campanha não carregada), não guarda.
let pontosGuardados = null;
function pontos() {
  if (pontosGuardados) return pontosGuardados;
  const calculados = calcularPontos();
  if (calculados.length) pontosGuardados = calculados;
  return calculados;
}
function calcularPontos() {
  const por = new Map();
  for (const a of Object.values(CAMPANHA.areas ?? {})) for (const m of a.monstros ?? []) {
    if (m.unico || !(m.vida > 0) || !(m.nivel > 0)) continue;
    if (!por.has(m.nivel)) por.set(m.nivel, []);
    por.get(m.nivel).push(m);
  }
  const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return [...por.entries()].sort((a, b) => a[0] - b[0]).map(([n, ms]) => ({ n, vida: med(ms.map((m) => m.vida)), dano: med(ms.map((m) => m.dano ?? 1)), tempo: med(ms.map((m) => m.tempoAtaque ?? 1.2)) }));
}
/** A vida, o dano por golpe e o tempo de ataque (s) de um monstro comum do nível `n` (interpolado entre os da campanha). */
export function forcaDoNivel(n) {
  const PONTOS = pontos();
  if (!PONTOS.length) return { vida: 50 + n * 30, dano: 4 + n * 2, tempo: 1.2 };
  if (n <= PONTOS[0].n) return { ...PONTOS[0] };
  for (let i = 1; i < PONTOS.length; i++) {
    const a = PONTOS[i - 1];
    const b = PONTOS[i];
    if (n <= b.n) {
      const f = (n - a.n) / Math.max(1, b.n - a.n);
      return { n, vida: a.vida + (b.vida - a.vida) * f, dano: a.dano + (b.dano - a.dano) * f, tempo: a.tempo + (b.tempo - a.tempo) * f };
    }
  }
  const u = PONTOS.at(-1);
  // Acima da campanha: cresce como no fim dela (~6% por nível).
  const k = 1.06 ** (n - u.n);
  return { n, vida: u.vida * k, dano: u.dano * k, tempo: u.tempo };
}

// ---- o desenho do lacaio, pelo nome ----
/** (lote 75) A conversão do lacaio no PoB (Minions.lua) que o importador do `pob-lacaios.json` não lê: o id do PoB → `{ <elemento>: % }`. */
const CONVERSAO_DO_POB = { HeraldOfAgonySpiderPlated: { chaos: 40 } };
const DESENHO_POR_PALAVRA = [
  [/zumbi/i, 'zombie'], [/esqueleto/i, 'skeleton-warrior'], [/espectro/i, 'spectre'], [/fantasma|espírito/i, 'ghost'], [/golem.*(chama|fogo)/i, 'fire-elemental'],
  [/golem.*(gelo|geada)/i, 'ice-golem'], [/golem.*(relâmp|raio)/i, 'energy-elemental'], [/golem.*(caos)/i, 'lich'], [/golem/i, 'stone-golem'], [/guardi/i, 'gargoyle'],
  [/sentinela/i, 'banshee'], [/totem/i, 'minotaur-totem'], [/arma|lâmina|armas animadas/i, 'demon-skeleton'], [/aranha|rastejador/i, 'giant-spider'], [/corvo|abutre/i, 'gargoyle'],
];
const DESENHO_DO_ELEMENTO = { fire: 'fire-elemental', ice: 'ice-golem', energy: 'energy-elemental', chaos: 'lich', physical: 'skeleton' };
export function desenhoDe(nome, elemento, totem) {
  // O golem é do elemento da gema (Golem de Chamas: o elemental de fogo; de Gelo: o golem de gelo); o de pedra é o físico.
  const golem = /golem/i.test(nome) ? (elemento && elemento !== 'physical' ? DESENHO_DO_ELEMENTO[elemento] : 'stone-golem') : null;
  const k = (totem ? 'minotaur-totem' : null) ?? golem ?? DESENHO_POR_PALAVRA.find(([re]) => re.test(nome))?.[1] ?? desenhoPeloNome(nome) ?? DESENHO_DO_ELEMENTO[elemento] ?? 'skeleton';
  const b = BESTIARY[k] ?? BESTIARY.skeleton ?? Object.values(BESTIARY)[0];
  return { look: b.look, colors: b.colors ?? null, lookItem: b.lookItem ?? 0 };
}
/** "Zumbis Evocados" → "Zumbi"; "Espíritos Furiosos" → "Espírito Furioso". */
const singular = (t) => String(t).trim().split(/\s+/).map((p) => (/ões$|ãos$/i.test(p) ? p.replace(/(ões|ãos)$/i, 'ão') : /ns$/i.test(p) ? p.replace(/ns$/i, 'm') : /ais$/i.test(p) ? p.replace(/ais$/i, 'al') : /eis$/i.test(p) ? p.replace(/eis$/i, 'el') : /ores$/i.test(p) ? p.replace(/ores$/i, 'or') : p.replace(/s$/i, ''))).join(' ');

/**
 * O que a gema invoca no `nivel`: `{ tipo: 'lacaio'|'totem', nome, maximo, porUso, duracaoMs, nivel, vida, dano: {min,max}, intervaloMs, desenho }`.
 * `efeito` (o dos suportes ligados): `lacaioVidaPct`, `lacaioDanoPct` (o aumentado, soma), `lacaioMaisDanoPct` (o mais/menos, multiplica), `totensExtras`, `duracaoPct`.
 */
/**
 * (18/10, lote G20a) O multiplicador de VIDA do tipo de totem no PoB (`totemLifeMult[skillTotemId]` — Misc.lua:214; o id em act_str/act_dex.lua): ×1,2
 * no Chamariz (6), no Devorador (7), no Rejuvenescedor (4), no Rejuvenescedor Vaal (21) e no Flamejante Sagrado (17); os outros ×1 (o Sísmico 5, o
 * Vínculo 9, as Balistas 12/18/19, e o totem sem id próprio — os ancestrais, os de suporte —, que fica com o da cor da gema: 1, 2 ou 3, todos ×1 —
 * CalcActiveSkill.lua:434-441).
 */
const VIDA_DO_TOTEM_MAIS = /^(?:Decoy_Totem|Devouring_Totem|Rejuvenation_Totem|Vaal_Rejuvenation_Totem|Holy_Flame_Totem)/;
export const multDaVidaDoTotem = (slug) => (VIDA_DO_TOTEM_MAIS.test(String(slug ?? '')) ? 1.2 : 1);
/**
 * (18/10, lote G20c) Os EFEITOS PRÓPRIOS do totem, das linhas do nível e da qualidade (`oQueInvoca` → `Acoes.invocarLacaios` → o tique e
 * `GemasPoe.adds`):
 * - o ANCESTRAL (o Chefe Guerreiro, o Protetor): a distância de ativação — o totem só ataca, e o buff só vale, com você a até 80 unidades (8 m) do
 *   Chefe e 85 (8,5 m) do Protetor (a wiki no poedb: "Activation: The totem is active as long as the player remains within a 80/85 unit radius";
 *   a Vaal, a do Chefe), × a "Distância de Ativação aumentada" da qualidade —, e o buff ATIVO ("X% mais Dano Corpo a Corpo / Velocidade de Ataque
 *   enquanto o Totem estiver Ativo": seu; não soma entre totens — "Melee damage buff does not stack when multiple totems are summoned");
 * - o REJUVENESCEDOR: a aura de "N de Vida Regenerada por segundo" num raio de 40 unidades (4 m — act_str.lua:9343), × √ do "menos Área de Efeito"
 *   (a Vaal), com o Efeito de Aura (a wiki); a Vaal: "40% do Dano de Acertos contra alvos afetados pela Aura é sofrido na Vida do Totem antes";
 * - o FLAMEJANTE SAGRADO: o Solo Sagrado em volta do totem (16 unidades, 1,6 m — act_str.lua:5869; × √ da "Área do Solo Sagrado aumentada" da
 *   Ira), com a imunidade a maldições ("Solo Sagrado concede Imunidade a Maldições para você e Aliados");
 * - a BALISTA DE CERCO: "Velocidade de Ataque aumentada em X% por Totem máximo" (a qualidade — act_dex.lua:13962);
 * - o DEVORADOR: "Drena N de Vida / de Mana para si a cada cadáver consumido" (lifeLeechPerUse/manaLeechPerUse — act_str.lua:2667).
 */
function efeitosDoTotem(slug, linhas) {
  const achar = (re) => linhas.reduce((n, l) => n + (Number(re.exec(l)?.[1]) || 0), 0);
  const r = {};
  const ativacaoBase = /^Ancestral_Protector/.test(slug) ? 8.5 : /^(?:Vaal_)?Ancestral_Warchief/.test(slug) ? 8 : 0;
  if (ativacaoBase) r.ativacaoM = ativacaoBase * (1 + achar(/^Distância de Ativação aumentada em ([\d.]+) ?%$/i) / 100);
  const maisCorpo = achar(/^([\d.]+) ?% mais Dano Corpo a Corpo enquanto o Totem estiver Ativo$/i);
  const maisVel = achar(/^([\d.]+) ?% mais Velocidade de Ataque enquanto o Totem estiver Ativo$/i);
  if (maisCorpo || maisVel) r.buffAtivo = { ...(maisCorpo ? { 'mais_dano@corpo': maisCorpo } : {}), ...(maisVel ? { atk_speed_mais: maisVel } : {}) };
  const regen = /^(?:Vaal_)?Rejuvenation_Totem/.test(slug) ? achar(/^([\d.]+) de Vida Regenerada por segundo$/i) : 0;
  if (regen) {
    const menosArea = achar(/^([\d.]+) ?% menos Área de Efeito$/i);
    r.auraDoTotem = { af: { life_regen: regen }, raioM: 4 * Math.sqrt(Math.max(0, 1 - menosArea / 100)), absorvePct: achar(/^([\d.]+) ?% do Dano de Acertos contra alvos afetados pela Aura é sofrido na Vida do Totem antes do alvo$/i) };
  }
  if (linhas.some((l) => /^Solo Sagrado concede Imunidade a Maldições para você e Aliados$/i.test(l))) r.soloSagradoM = 1.6 * Math.sqrt(1 + achar(/^Área do Solo Sagrado aumentada em ([\d.]+) ?%$/i) / 100);
  const porMaximo = achar(/^Velocidade de Ataque aumentada em ([\d.]+) ?% por Totem máximo$/i);
  if (porMaximo) r.velPorMaximo = porMaximo;
  const vida = achar(/^Drena ([\d.]+) de Vida para si a cada cadáver consumido$/i);
  const mana = achar(/^Drena ([\d.]+) de Mana para si a cada cadáver consumido$/i);
  if (vida || mana) r.devorador = { vida, mana };
  return r;
}
/**
 * (lote 86, dono 19/10) Os EVENTOS de bloqueio que o escudo da Égide Necromântica dá ao lacaio (`minion_ev:bloquear[Ataque|Magia]:<ação>[:<param>]`
 * — `afixos.passarOEscudoAosLacaios`): `[{ evento, acao, param, valor }]`.
 */
function eventosDeBloqueioDoLacaio(af) {
  const saida = [];
  for (const [k, v] of Object.entries(af ?? {})) {
    const m = /^minion_ev:(bloquear(?:Ataque|Magia)?):([^:]+)(?::(.*))?$/.exec(k);
    if (m && typeof v === 'number' && v) saida.push({ evento: m[1], acao: m[2], param: m[3] ?? '', valor: v });
  }
  return saida;
}
export function oQueInvoca(slug, nivelDaGema = 1, efeito = null, af = null, grupo = null) {
  // (revisão E1a/S1: `grupo` — um dos tipos de uma invocação MISTA, a Vaal Convocar Esqueletos: `{ pob, nome }`, o lacaio do PoB e o nome desse tipo —
  // `GRUPOS_DO_POB`; uso interno, o próprio `oQueInvoca` monta os `grupos`)
  // `af`: a soma do DONO (`ficha.afPoe`) — os mods do PoE dos lacaios e totens (vida, dano, velocidade, dano somado, máximos…).
  const m0 = (k) => Number(af?.[k]) || 0;
  const r = GemasPoe.doSlug(slug);
  if (!r) return null;
  const t = GemasPoe.textosDaGema(slug, nivelDaGema);
  // (lote G20b: + a habilidade que um SUPORTE torna totem — `efeito.viraTotem`, o Totem de Magia, o Totem Balista, o Devastador)
  const doSuporte = r.arquetipo !== 'totem' && efeito?.viraTotem > 0;
  const totem = r.arquetipo === 'totem' || doSuporte || t.linhas.some((l) => /Invoca um Totem/i.test(l));
  const mn = totem ? () => 0 : m0;
  let nome = totem ? 'Totem' : 'Lacaio';
  let maximo = totem ? 1 : 1;
  let porUso = 1;
  let duracao = null;
  let maisVida = 0;
  let maisDano = 0;
  let nivel = null;
  // As HABILIDADES próprias (as linhas da gema): velocidade de ataque, crítico, dano adicionado, sangramento; e os bônus do golem ao dono.
  let velAtaquePct = 0;
  let semprecritico = false;
  let critMult = 0;
  let somado = [0, 0];
  let sangrar = 0;
  const afDono = {};
  let porLacaioFisico = null;
  // (lote 75 — o Arauto da Agonia, dono: "No máximo, como o PoB") o Rastejador por VIRULÊNCIA (`efeito.virulencia` — `itens-poe/virulencia.mjs`):
  // a velocidade de ataque, o Dano Físico aumentado e o adicionado por Virulência; "Lacaios não podem Provocar Inimigos".
  const V = Math.max(0, Number(efeito?.virulencia) || 0);
  let velV = 0;
  let incV = 0;
  let somadoV = [0, 0];
  let semProvocar = false;
  const soma = (k, v) => { afDono[k] = (afDono[k] ?? 0) + v; };
  // (lote G20b: o totem do SUPORTE não lê as linhas da habilidade — a "Duração base" e o "Máximo de" dela não são do totem; a duração é a do
  // suporte, "Totem dura N segundos")
  if (doSuporte) duracao = efeito.totemDuracaoMs ?? null;
  // (lote E1a: o "Convoca N …" de cada tipo soma — a Vaal Convocar Esqueletos chama soldados, arqueiros, magos e o general de uma vez —, sem as colunas
  // mal rotuladas do poedb — `GemasE1a.COLUNA_MAL_ROTULADA_E1A`)
  let convoca = null;
  let dominio = null;
  // (revisão E1a: a "Duração Base Secundária" — o Golpe Dominador: a Sentinela vive a duração SECUNDÁRIA, 30 s; os 3 s da base são a penalidade no inimigo.
  // O PoB: base_secondary_skill_effect_duration 30000, act_str.lua:2975 — "summoned for a longer secondary duration")
  let duracaoSecundaria = null;
  // (revisão E1a: os TIPOS de uma invocação mista — "Convoca 9 Esqueletos Arqueiros por vez" —, para os `grupos`)
  const porTipoConvoca = [];
  for (const l of doSuporte ? [] : t.linhas) {
    let m;
    if (GemasE1a.COLUNA_MAL_ROTULADA_E1A[slug]?.test(l)) continue;
    if ((m = l.match(/^Rastejador Agonizante possui (\d+(?:\.\d+)?) ?% de aumento da Velocidade de Ataque por Virulência/i))) velV += Number(m[1]) * V;
    if ((m = l.match(/^Rastejador Agonizante causa Dano Físico aumentado em (\d+(?:\.\d+)?) ?% por Virulência/i))) incV += Number(m[1]) * V;
    if ((m = l.match(/^O Rastejador da Agonia possui de (\d+) a (\d+) de Dano Físico Adicional por Virulência/i))) somadoV = [Number(m[1]) * V, Number(m[2]) * V];
    if (/^Lacaios não podem Provocar Inimigos$/i.test(l)) semProvocar = true;
    if ((m = l.match(/Lacaios? (?:tem|têm) (\d+(?:\.\d+)?) ?% mais Velocidade de Ataque/i))) velAtaquePct += Number(m[1]);
    if (/Acertos dos Lacaios são sempre Golpes Críticos/i.test(l)) semprecritico = true;
    if ((m = l.match(/Lacaios têm \+(\d+) ?% de Multiplicador de Acerto Crítico/i))) critMult += Number(m[1]);
    if ((m = l.match(/Ataques de Lacaios causam (\d+) a (\d+) de Dano Físico adicional/i))) somado = [somado[0] + Number(m[1]), somado[1] + Number(m[2])];
    // (revisão E1a: soma — as linhas BASE do mesmo stat somam no PoB, `bleed_on_hit_with_attacks_%`)
    if ((m = l.match(/Ataques dos Lacaios têm (\d+) ?% de chance de infligir Sangramento/i))) sangrar += Number(m[1]);
    if ((m = l.match(/^Duração Base Secundária é de (\d+(?:\.\d+)?) segundos?/i))) duracaoSecundaria = Number(m[1]) * 1000;
    if ((m = l.match(/Lacaios causam (\d+(?:\.\d+)?) ?% menos Dano/i))) maisDano -= Number(m[1]);
    // O GOLEM ao dono (enquanto vive).
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Dano/i))) soma('dmg_vs_monsters', Number(m[1]));
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Chance de Crítico/i))) soma('crit_chance_inc', Number(m[1]));
    if ((m = l.match(/^Golens aumentam (\d+(?:\.\d+)?) ?% de Velocidade de Ataque e Conjuração/i))) { soma('atk_speed', Number(m[1])); soma('cast_speed', Number(m[1])); }
    if ((m = l.match(/^Golens concedem \+?(\d+(?:\.\d+)?) de precisão/i))) soma('accuracy', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) de Vida Regenerada por segundo/i))) soma('life_regen', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) de regeneração de mana por segundo/i))) soma('mana_regen', Number(m[1]));
    if ((m = l.match(/^Golens concedem \+ ?(\d+(?:\.\d+)?) ?% de resistência a dano de caos/i))) soma('chaos_res', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) ?% mais defesas/i))) { soma('armour_pct', Number(m[1])); soma('evasion_pct', Number(m[1])); }
    // (dono, 26/10: o Golem Flamejante — "fire_golem_grants_area_of_effect_+%", a Área de Efeito AUMENTADA no PoB, act_str.lua:11336; o texto diz "mais")
    if ((m = l.match(/^Golens concedem (\d+(?:\.\d+)?) ?% mais área de efeito$/i))) soma('area_inc', Number(m[1]));
    if ((m = l.match(/^Golens concedem (\d+) a (\d+) de Dano Físico adicional para cada Lacaio Não-Golem/i))) porLacaioFisico = [Number(m[1]), Number(m[2])];
    // (dono, 26/10 — o Golpe Dominador: as Sentinelas do Domínio têm um máximo por raridade — 3 Mágicas, 9 Normais, 1 Rara —; o jogo não separa as raridades,
    // então o máximo é a soma; antes valia o da última linha, 1, e a Sentinela a mais dos 25% trocava a que estava em campo)
    if ((m = l.match(/^Máximo de (\d+) (Sentinelas do Domínio) \S+ (?:Evocad|Convocad|Erguid|Invocad|Animad)/i))) { dominio = (dominio ?? 0) + Number(m[1]); nome = singular(m[2]); }
    else if ((m = l.match(/^Máximo de (\d+) (.+?) (?:Evocad|Convocad|Erguid|Invocad|Animad)/i))) { maximo = Number(m[1]); nome = singular(m[2]); }
    else if ((m = l.match(/^Máximo de (.+?) (?:Evocad|Convocad|Erguid|Invocad)\S*: (\d+)/i))) { maximo = Number(m[2]); nome = singular(m[1]); }
    else if ((m = l.match(/^\+(\d+) ao número máximo de Totens/i))) maximo += Number(m[1]);
    else if ((m = l.match(/^Convoca (\d+) (.+)$/i))) { convoca = (convoca ?? 0) + Number(m[1]); porTipoConvoca.push({ n: Number(m[1]), texto: m[2] }); if (nome === 'Lacaio') nome = singular(m[2]); }
    else if ((m = l.match(/^(?:Duração base é de|Totem dura) (\d+(?:\.\d+)?) segundos?/i))) duracao = Number(m[1]) * 1000;
    else if ((m = l.match(/Lacaios? têm (\d+(?:\.\d+)?) ?% mais Vida/i))) maisVida += Number(m[1]);
    // (dono, 26/10: o "mais Dano com Sangramento" do Ceifador vale só no Sangramento — `maisSangramentoPct`, `GemasE1a.doNivelDoLacaio`)
    else if ((m = l.match(/Lacaios? causam? (\d+(?:\.\d+)?) ?% mais Dano(?! com Sangramento)/i))) maisDano += Number(m[1]);
    else if ((m = l.match(/são de Nível (\d+)/i))) nivel = Number(m[1]);
  }
  if (convoca != null) porUso = convoca;
  if (dominio != null) maximo = dominio;
  if (duracaoSecundaria != null && !totem && !doSuporte) duracao = duracaoSecundaria;
  // (revisão E1a) a Sangramento da QUALIDADE soma à do nível (o PoB, SummonReaper: qualityStats bleed_on_hit_with_attacks_% 1 — o mesmo stat BASE: 50 + 20 = 70)
  if (!totem && !doSuporte) for (const l of GemasPoe.linhasDaQualidadeDe(slug, efeito?.qualidade ?? 0)) { const m = /^Ataques dos Lacaios têm (\d+(?:\.\d+)?) ?% de chance de infligir Sangramento/i.exec(l); if (m) sangrar += Number(m[1]); }
  if (grupo?.nome) nome = grupo.nome;
  // (lote E2A) o que o lote lê nas linhas do nível e da qualidade (`GemasE2a.doLacaioE2a`): o máximo das Sentinelas Ascendidas e da Queda, o "mais Dano" delas e o
  // sinal certo do Golpe Sagrado (o PoB), o nome do Zumbi da Queda
  const e2a = !totem && !doSuporte ? GemasE2a.doLacaioE2a(slug, t.linhas, GemasPoe.linhasDaQualidadeDe(slug, efeito?.qualidade ?? 0), nivelDaGema) : {};
  if (e2a.maximoBase != null) maximo = e2a.maximoBase;
  if (e2a.maximoExtra) maximo += e2a.maximoExtra;
  if (e2a.nome && nome === 'Lacaio') nome = e2a.nome;
  if (e2a.correcaoMaisDano) maisDano += e2a.correcaoMaisDano;
  if (e2a.maisDanoPct) maisDano += e2a.maisDanoPct;
  if (e2a.duracaoMs) duracao = e2a.duracaoMs;
  // (lote E1a) a QUALIDADE do lacaio (o máximo, o movimento, a recarga, o Efeito do Buff do golem, a regeneração, o lacaio extra, o Efeito da Oferenda) e o
  // que o NÍVEL ainda não lia (o "menos Vida", o "Anima até N Armas", o Ceifador, o Golem da Carniça) — `GemasE1a`
  const e1aQ = !totem && !doSuporte ? GemasE1a.daQualidadeDoLacaio([...t.linhas.filter((l) => !GemasE1a.COLUNA_MAL_ROTULADA_E1A[slug]?.test(l)), ...GemasPoe.linhasDaQualidadeDe(slug, efeito?.qualidade ?? 0)]) : GemasE1a.daQualidadeDoLacaio([]);
  const e1aN = !totem && !doSuporte ? GemasE1a.doNivelDoLacaio(t.linhas) : GemasE1a.doNivelDoLacaio([]);
  if (e1aN.animaAte) porUso = e1aN.animaAte;
  maximo += e1aQ.maximo;
  if (totem) maximo += efeito?.totensExtras ?? 0;
  // (18/10, lote G20a) + o "+N ao número máximo de Totens Convocados" da QUALIDADE (o Vínculo Abrasador: 0,1 por % — act_str.lua:9511)
  if (totem) for (const l of GemasPoe.linhasDaQualidadeDe(slug, efeito?.qualidade ?? 0)) { const m = /^\+([\d.]+) ao número máximo de Totens/i.exec(l); if (m) maximo += Math.floor(Number(m[1])); }
  // "+N ao número máximo de Zumbis / Espectros / Golens / Esqueletos / Totens…" (peças do PoE): `max_lacaio:<palavra>`.
  if (/zumbi/i.test(nome)) maximo += m0('max_zumbis');
  if (/espectro/i.test(`${nome} ${t.nome}`)) maximo += m0('max_espectros');
  const texto = `${nome} ${t.nome} ${r.gema?.en ?? ''}`;
  const porTipo = (campo) => Object.entries(af ?? {}).reduce((n, [k, v]) => { const m = new RegExp(`^${campo}:(\\w+)$`).exec(k); return n + (m && typeof v === 'number' && (totem ? m[1] === 'totem' : PALAVRA_DO_TIPO[m[1]]?.test(texto)) ? v : 0); }, 0);
  maximo += porTipo('max_lacaio');
  // (11/10, os únicos:) o máximo de UMA gema de totem ("Balista Estilhaçante tem +1 ao número máximo de Totens Convocados por cada 25 de
  // Força" — `max_totem_gema:<nome>`) e o teto por tipo ("Você não pode ter mais de N totens invocados do mesmo tipo").
  if (totem) {
    maximo += m0(`max_totem_gema:${slugDoNome(t.nome)}`);
    if (m0('max_totem_mesmo_tipo') > 0) maximo = Math.min(maximo, m0('max_totem_mesmo_tipo'));
  }
  // "Número máximo de Zumbis Erguidos reduzido em X%" (o % do máximo).
  // (lote G20d) o Vínculo Abrasador da Detonação: "+1 à quantidade máxima de totens invocados por carga de poder máxima" (o máximo de Cargas de
  // Poder — `CargasPoe.maximo`; act_str.lua:9593) e a detonação ao chegar ao máximo
  const porPoder = totem ? t.linhas.reduce((n, l) => n + (Number(/^\+([\d.]+) à quantidade máxima de totens invocados por carga de poder máxima$/i.exec(l)?.[1]) || 0), 0) : 0;
  if (porPoder) maximo += porPoder * CargasPoe.maximo(af ?? {}, 'poder');
  // (lote S1: + o da Congregação — "+X% para o número máximo de lacaios de habilidades reforçadas", `efeito.maxLacaioPct`)
  maximo = Math.max(1, Math.round(maximo * (1 + (porTipo('max_lacaio_pct') + (totem ? 0 : efeito?.maxLacaioPct ?? 0)) / 100)));
  // (lote G20c) os efeitos próprios do totem (a gema de totem; o totem de um suporte não tem) e a velocidade por totem máximo da Balista de Cerco
  const doTotem = totem && !doSuporte ? efeitosDoTotem(slug, [...t.linhas, ...GemasPoe.linhasDaQualidadeDe(slug, efeito?.qualidade ?? 0)]) : {};
  // (lote E2A) o ANEL da Balista de Cerco de Trarthus: N balistas por uso (o do PoB no nível), em volta do alvo, que disparam uma vez e somem (`GemasE2a.anelDoTotem`)
  const anel = totem && !doSuporte ? GemasE2a.anelDoTotem(slug, t.linhas, nivelDaGema) : null;
  if (anel) porUso = anel.n;
  // As OFERENDAS (Osso, Carne, Espírito) e a CONVOCAÇÃO não invocam: dão bônus aos lacaios em campo / chamam todos para perto.
  const en = r.gema.en ?? '';
  // (lote E1a: + o "Efeito da Oferenda aumentado em X%" da qualidade — `offering_spells_effect_+%`)
  // (dono, 26/10: + os cadáveres — a Oferenda consome os a até 4 casas e dura N s a mais por cadáver extra, `porCadaverMs`; sem cadáver, não sai)
  if (/Offering/i.test(en)) return { tipo: 'oferenda', nome: t.nome, duracaoMs: duracao ?? 4000, porCadaverMs: e1aN.porCadaverMs, bonus: GemasE1a.oferendaComEfeito(bonusDaOferenda(t.linhas), e1aQ.efeitoDaOferendaPct) };
  if (/^Convocation/i.test(en)) return { tipo: 'convocacao', nome: t.nome, curaPct: Number(t.linhas.map((l) => l.match(/Regenera (\d+(?:\.\d+)?) ?% da Vida por segundo/i)).find(Boolean)?.[1] ?? 0) };
  const n = nivel ?? Math.max(1, t.requer);
  // (lote 44) a força do PoE: a tabela de aliados × o multiplicador do lacaio no PoB (`forcaDoPob`); o golpe de quem usa a arma e o lacaio sem
  // tipo no PoB, a de um monstro comum do nível.
  const pob = totem ? null : forcaDoPob(grupo?.pob ?? lacaioDoPob(slug), n);
  // (lote 75) a CONVERSÃO do lacaio no PoB que o importador não lê (o Rastejador Agonizante: Físico, com 40% convertidos em Caos — Minions.lua)
  const conv = CONVERSAO_DO_POB[pob?.id] ?? null;
  // (lote E2A: o Armamento do Golpe Sagrado bate com a cópia da sua arma — Físico, com 50% convertidos em Raio — `e2a.conversaoRaioPct`)
  const elemento = conv || e2a.conversaoRaioPct ? 'physical' : r.elemento;
  const f0 = forcaDoNivel(n);
  const f = pob ? { vida: pob.vida, dano: pob.dano ?? f0.dano, tempo: pob.tempo ?? f0.tempo } : f0;
  const spread = pob?.spread ?? 0.2;
  // (+ a "Vida máxima dos Lacaios aumentada" / "Vida do Totem aumentada" e o "Lacaios causam Dano aumentado" das peças do PoE.)
  // (+ os do TIPO de lacaio: "Golens possuem X% menos Vida", "Espíritos Furiosos Convocados causam Dano aumentado", "Zumbis têm X% da Vida
  // máxima aumentada", "Zumbis causam X% mais Dano Físico", "+N de Vida máxima" dos Zumbis…)
  // (ciclo 7: + o "Lacaios tem X% mais Vida Máxima" da árvore — `lacaio_vida_mais:<tipo>`, multiplica.)
  // (lote 43, P040: + a vida fixa do escudo da Égide Necromântica — `minion_vida_fixa`)
  // (18/10, lote G20a) a VIDA DO TOTEM pelo PoB (CalcOffence.lua:316-318): round(floor(a vida dos aliados no nível do totem — o RequerNível da gema
  // — × o multiplicador do tipo de totem) × (1 + a "Vida do Totem aumentada" da gema, dos suportes e das peças) × o "mais Vida de Totens" da
  // qualidade). Os modificadores de LACAIO não valem no totem (antes: a mediana de vida de um monstro da campanha, sem a vida da gema).
  const st = totem ? GemasPoe.compilada(slug, nivelDaGema, efeito?.qualidade ?? 0)?.stats ?? {} : null;
  const vida = totem
    ? Math.max(1, Math.round(Math.floor(POB.tabelas.vida[Math.max(1, Math.min(POB.tabelas.vida.length, n)) - 1] * multDaVidaDoTotem(slug)) * Math.max(0.01, 1 + ((st.totemVidaInc ?? 0) + (efeito?.totemVidaPct ?? 0) + m0('totem_life') + porTipo('lacaio_vida')) / 100) * Math.max(0, 1 + (st.totemVidaMais ?? 0) / 100) * Math.max(0, 1 + porTipo('lacaio_vida_mais') / 100)))
    : Math.max(10, Math.round((f.vida + porTipo('lacaio_vida_fixa') + m0('minion_vida_fixa')) * (1 + maisVida / 100) * (1 + ((efeito?.lacaioVidaPct ?? 0) + m0('minion_life') + porTipo('lacaio_vida')) / 100) * Math.max(0, 1 + porTipo('lacaio_vida_mais') / 100) * Math.max(0, 1 - e1aN.menosVidaPct / 100)));
  // ("Lacaios ganham X% do Dano Físico / Elemental como Dano de Caos/Fogo Extra" — dono, 11/10: os únicos: o extra entra no golpe do lacaio
  // do tipo certo — o físico no lacaio físico, o elemental no de Fogo/Gelo/Raio —, sem a resistência do outro elemento.)
  const fisico = (elemento ?? 'physical') === 'physical';
  const extra = 1 + (fisico ? m0('minion_phys_as_extra') : ['fire', 'ice', 'energy'].includes(elemento) ? m0('minion_elem_as_extra') : 0) / 100;
  // (lote 43, P040: + do escudo da Égide Necromântica — o "Dano Mágico aumentado" no lacaio que conjura, o dano do elemento dele)
  const conjura = /mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`);
  const doEscudo = (conjura ? m0('minion_dano_magico') : 0) + m0(`minion_dano_${elemento ?? 'physical'}`);
  const golpe = f.dano * (1 + maisDano / 100) * (1 + ((efeito?.lacaioDanoPct ?? 0) + m0('minion_dmg') + porTipo('lacaio_dano') + doEscudo + incV) / 100) * Math.max(0, 1 + porTipo('lacaio_mais_dano') / 100) * Math.max(0, 1 + (efeito?.lacaioMaisDanoPct ?? 0) / 100) * extra;
  // O dano SOMADO aos lacaios das peças ("Lacaios causam X a Y de Dano de Fogo adicional"): no golpe deles, como o dano adicionado da gema.
  for (const el of ['physical', 'fire', 'ice', 'energy', 'chaos']) somado = [somado[0] + m0(`minion_added_${el}_min`), somado[1] + m0(`minion_added_${el}_max`)];
  // (+ o do TIPO: "Golens têm X a Y de Dano Físico de Ataques Adicional".)
  somado = [somado[0] + porTipo('lacaio_somado_min'), somado[1] + porTipo('lacaio_somado_max')];
  // (lote 75: + o adicionado por Virulência, com o aumentado e o mais do golpe — no PoE o dano adicionado também os recebe)
  if (somadoV[1] > 0) somado = [somado[0] + (somadoV[0] * golpe) / f.dano, somado[1] + (somadoV[1] * golpe) / f.dano];
  velAtaquePct += velV;
  // (lote G20a: no totem, só os modificadores DE TOTEM — os de lacaio não valem nele; a duração é a TotemDuration do PoB, sem a "Duração de Habilidade"
  // — CalcOffence.lua:1624; "Ataques utilizados por Totens têm X% de Velocidade de Ataque aumentada" só no totem de ataque)
  if (!totem) velAtaquePct += m0('minion_atk_speed') + (/mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`) ? m0('minion_cast_speed') : 0);
  // (lote S2B: + a Velocidade do Lacaio — "34% de Velocidade de Ataque / de Conjuração de Lacaios aumentada": a de conjuração no lacaio que conjura, a de ataque nos outros)
  if (!totem) velAtaquePct += /mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`) ? efeito?.lacaioVelConjPct ?? 0 : efeito?.lacaioVelAtaquePct ?? 0;
  // (lote 49, as únicas de joia: "Velocidade de Conjuração dos Esqueletos", "…de Ataque e Conjuração dos Golens" — no lacaio que conjura)
  if (conjura) velAtaquePct += porTipo('lacaio_vel_conj');
  if (duracao) duracao = Math.round(duracao * (1 + (totem ? porTipo('lacaio_duracao') : (efeito?.duracaoPct ?? 0) + porTipo('lacaio_duracao') + m0('minion_duracao')) / 100));
  if (!totem || r.ataque) velAtaquePct += porTipo('lacaio_vel_ataque');
  // (ciclo 7, lote F) "Magias Conjuradas por Totens têm X% de Velocidade de Conjuração aumentada" (o totem de uma gema de Magia).
  if (totem && (r.gema?.tags ?? []).includes('Magia')) velAtaquePct += m0('totem_vel_magia');
  if (doTotem.velPorMaximo) velAtaquePct += doTotem.velPorMaximo * Math.max(1, maximo);
  const estilo = estiloDoLacaio(`${nome} ${t.nome} ${en}`, elemento);
  // (lote 44: o tempo de ataque do PoB já é o do tipo — o "rápido" do Espírito Furioso não multiplica de novo)
  if (pob?.tempo) delete estilo.rapido;
  // A CONVERSÃO do dano Físico do golpe (dono, 11/10: os únicos): "Lacaios convertem X% do Dano Físico para Dano de Gelo" (por Encaixe da cor,
  // com a escala), e o AVATAR DO FOGO de um tipo ("Zumbis Erguidos têm Avatar do Fogo": 50% do Físico vira Fogo e o resto não causa dano).
  // `soDano`: só esse elemento causa dano ("Lacaios não causam Dano Não-Gélido").
  // (lote E2A: + o "Este ataque e lacaios convertem 50% do dano físico em dano elétrico" do Golpe Sagrado, no Armamento)
  const conversao = { fire: m0('minion_conv_fire') + (porTipo('lacaio_so_fogo') > 0 ? 50 : 0) + porTipo('lacaio_conv_fogo'), ice: m0('minion_conv_ice'), energy: m0('minion_conv_energy') + (e2a.conversaoRaioPct ?? 0), chaos: m0('minion_conv_chaos') + porTipo('lacaio_conv_caos') + (conv?.chaos ?? 0) };
  const soDano = m0('minion_so_gelo') > 0 ? 'ice' : porTipo('lacaio_so_fogo') > 0 ? 'fire' : null;
  // A RESTRIÇÃO das peças ("Você não pode ter Lacaios não-Golens / Não-Espectrais", "…que não sejam animados"): o lacaio de outro tipo não vem.
  const permitidos = Object.entries(af ?? {}).filter(([k, v]) => /^so_lacaio:\w+$/.test(k) && v > 0).map(([k]) => k.split(':')[1]);
  const proibido = !totem && permitidos.length && !permitidos.some((tp) => PALAVRA_DO_TIPO[tp]?.test(texto)) ? `Um item equipado não deixa ter este lacaio (só: ${permitidos.join(', ')}).` : null;
  const resultado = {
    estilo, velAtaquePct, critChance: (semprecritico ? 100 : 5) * (1 + m0('minion_crit_inc') / 100), critChanceBase: semprecritico ? 100 : 5, critMult: 1.5 + critMult / 100, somado, sangrar: Math.max(sangrar, m0('minion_chance_sangrar')),
    ...(Object.values(conversao).some((v) => v > 0) || soDano ? { conversao, soDano } : {}),
    ...(proibido ? { proibido } : {}),
    // Os mods do PoE dos lacaios (o tique deles lê): resistências, dano recebido, regeneração, roubo, movimento, multiplicador degenerativo,
    // chances de Cegar/Provocar/Desacelerar/Envenenar/Incendiar.
    // (lote G20a: `mn` — os mods de lacaio; no totem, nenhum: no PoE eles não valem em totem)
    poe: af ? {
      // (13/10) a soma dos "Dano aumentado" do lacaio na invocação: o das auras "Você e Aliados" do dono soma a ela no golpe (`cacadas`).
      danoIncPct: (efeito?.lacaioDanoPct ?? 0) + mn('minion_dmg') + porTipo('lacaio_dano') + incV,
      // (lote 44: + as resistências de base do lacaio no PoB — 40% elementais e 20% de Caos na maioria)
      // (lote 67: + a Resistência a Caos e a regeneração dos TOTENS — "Totens ganham +25% de Resistência a Caos", "Totens Regeneram 2% de Vida")
      // (lote E1a: + a regeneração, o movimento e a recarga da QUALIDADE da gema — `e1aQ`)
      // (lote S2B: + o Exército Elemental — "+X% de todas as Resistências Elementais" e "X% ao máximo de todas as Resistências Elementais")
      res: m0(totem ? 'totem_res' : 'minion_res') + (totem ? 0 : efeito?.lacaioResPct ?? 0), resCaos: mn('minion_chaos_res') + (totem ? m0('totem_res_caos') : 0) + (pob?.res.chaos ?? 0), danoRecebidoPct: mn('lacaios_dano_recebido'), regenPct: mn('minion_regen_pct') + porTipo('lacaio_regen_pct') + (totem ? m0('totem_regen_pct') : 0) + e1aQ.regenPct, regen: mn('minion_regen'),
      roubo: mn('minion_leech'), movimentoPct: mn('minion_move') + porTipo('lacaio_mov') + e1aQ.movimentoPct + (totem ? 0 : efeito?.lacaioMovPct ?? 0), dotMulti: mn('minion_dot_multi'), degenPct: porTipo('lacaio_degen'),
      // (lote E2A: + o "+X% de todas Resistências Elementais" dos Espectros — `e2a.resElemPct`)
      bloqueio: mn('minion_block'), resFogo: mn('minion_fire_res') + (pob?.res.fire ?? 0) + (e2a.resElemPct ?? 0), resGelo: mn('minion_ice_res') + (pob?.res.ice ?? 0) + (e2a.resElemPct ?? 0), resRaio: mn('minion_energy_res') + (pob?.res.energy ?? 0) + (e2a.resElemPct ?? 0),
      // (lote E2A) o "mais" do movimento (o Espectro, a Relíquia — `movimentoDoLacaio`), a Pancada do Zumbi (a área e a recarga só dela), o agravar do Ceifador da
      // Evisceração e o "menos Dano sofrido" das Sentinelas Ascendidas (`danoNoLacaio`)
      ...(e2a.movMaisPct ? { movMaisPct: e2a.movMaisPct } : {}), ...(e2a.movTetoPct != null ? { movTetoPct: e2a.movTetoPct } : {}), ...(e2a.impactoAreaPct ? { impactoAreaPct: e2a.impactoAreaPct } : {}), ...(e2a.impactoRecargaPct ? { impactoRecargaPct: e2a.impactoRecargaPct } : {}),
      ...(e2a.agravarPct ? { agravarPct: e2a.agravarPct } : {}), ...(e2a.menosDanoRecebidoPct ? { menosDanoRecebidoPct: e2a.menosDanoRecebidoPct } : {}),
      // (lote 69, as Ramificadoras: + por TIPO — "Zumbis Erguidos têm X% de chance de Provocar", "Esqueletos Convocados têm X% de chance de Definhar" —
      // e Empurrar com Ataques)
      chances: { cegar: mn('minion_chance_cegar'), provocar: semProvocar ? 0 : mn('minion_chance_provocar') + porTipo('lacaio_provocar') + (totem ? 0 : efeito?.lacaioProvocarPct ?? 0), desacelerar: mn('minion_chance_desacelerar'), envenenar: mn('minion_chance_envenenar'), incendiar: mn('minion_chance_incendiar') + porTipo('lacaio_incendiar'),
        definhar: mn('minion_chance_definhar') + porTipo('lacaio_definhar'), cinzas: porTipo('lacaio_cinzas'), empurrar: mn('minion_chance_empurrar'),
        // (lote 28) o Rasgacarne único: "Lacaios têm X% de chance de empalar ao atingir com ataques por joia Olho Medonho encaixada".
        empalar: mn('minion_chance_empalar') },
      // (lote 28) as Luvas Rebitadas únicas: "Com uma joia Olho Medonho encaixada, os lacaios têm X% de chance de ganhar Poder Profano ao
      // atingir com magias" (4 s, como o "ao Matar").
      poderProfanoAoAcertarMagia: mn('minion_poder_profano_ao_acertar_magia'),
      // (11/10, os únicos:) a vida recuperada ao bloquear e ao matar um envenenado; a duração renovada no acerto em Raro/Único; o dano drenado
      // como vida para o DONO; a explosão do inimigo morto pelo acerto dele (% da vida do morto).
      vidaAoBloquear: mn('minion_vida_ao_bloquear'), vidaAoMatarEnvenenado: mn('minion_vida_ao_matar_envenenado'), renova: porTipo('lacaio_renova'),
      drenoDono: porTipo('lacaio_dreno_dono'), explodir: porTipo('lacaio_explodir'),
      // (ciclo 7, a árvore) o crítico, a área, a recarga, o bloqueio mágico, a redução física, o escudo, o máximo das resistências, a
      // recuperação, os buffs ao matar, o dano dobrado, ignorar a redução física, a penetração nos amaldiçoados, a vida na morte de outro
      // lacaio, o dreno para o dono — `aplicarNoLacaio`, `golpeDoLacaio`, `danoNoLacaio`, `aoMatarDoLacaio`.
      // (lote S2B: + a qualidade do Exemplar e da Carne Fresca — "Lacaios … têm Chance de Golpe Crítico aumentada em X%")
      critInc: mn('minion_crit_inc') + (/mag[oa]|mage|espectro|spectre/i.test(`${nome} ${t.nome}`) ? mn('minion_crit_magico') : 0) + (e2a.critIncPct ?? 0) + (totem ? 0 : efeito?.lacaioCritIncPct ?? 0), critMult: mn('minion_crit_mult'), areaPct: mn('minion_area'), recargaPct: mn('minion_cdr') + porTipo('lacaio_cdr') + e1aQ.recargaPct,
      bloqueioMagico: mn('minion_spell_block'), reducaoFisica: mn('minion_phys_red') + (totem ? m0('totem_phys_red') : 0), esDaVidaPct: mn('minion_es_da_vida'), resMax: mn('minion_res_max') + (totem ? 0 : efeito?.lacaioResMaxPct ?? 0),
      // (lote 86, dono 19/10: a Égide Necromântica, parte A) o máximo de UMA resistência (o do escudo — `tetoDaResDoLacaio`); os efeitos AO
      // BLOQUEAR do escudo (Causticar/Enfraquecer/Exaurir e os eventos `ev:bloquear*` — `cacadas.aoBloquearDoLacaio`) e o "se Bloqueou
      // Recentemente" (a armadura — `danoNoLacaio`; a penetração e o Fogo adicional — `golpeDoLacaio`; o bloqueio Sortudo — `cacadas`)
      resMaxEl: { fire: mn('minion_fire_res_max'), ice: mn('minion_ice_res_max'), energy: mn('minion_energy_res_max') }, resMaxCaos: mn('minion_chaos_res_max'),
      aoBloquear: { causticar: mn('minion_bloqueio_causticar'), enfraquecer: mn('minion_bloqueio_enfraquecer'), exaurir: mn('minion_bloqueio_exaurir'), eventos: totem ? [] : eventosDeBloqueioDoLacaio(af) },
      // (+ a correção do lote 86: o bloqueio de ataque e o de magia, o multiplicador de crítico e o Trespassar "se Bloqueou Recentemente"; o "se NÃO
      // Bloqueou Recentemente" — o bloqueio, o crítico, o bloqueio no máximo; o bloqueio Sortudo sem condição, o Svalinn; o teto do bloqueio)
      seBloqueou: { armadura: mn('minion_se_bloqueou:armor_flat'), penFogo: mn('minion_se_bloqueou:fire_pen'), fogo: [mn('minion_se_bloqueou:added_fire_dmg_min'), mn('minion_se_bloqueou:added_fire_dmg_max')], sortudo: mn('minion_se_bloqueou:bloqueio_sortudo'),
        bloqueio: mn('minion_se_bloqueou:block'), bloqueioMagico: mn('minion_se_bloqueou:spell_block'), critMult: mn('minion_se_bloqueou:crit_dmg'), trespassar: mn('minion_se_bloqueou:sempre:trespassar') },
      naoBloqueou: { bloqueio: mn('minion_nao_bloqueou:block'), critInc: mn('minion_nao_bloqueou:crit_chance_inc'), noMaximo: mn('minion_nao_bloqueou:bloqueio_no_maximo'), magiaNoMaximo: mn('minion_nao_bloqueou:bloqueio_magia_no_maximo') },
      bloqueioSortudo: mn('minion_bloqueio_sortudo'), bloqueioMax: mn('minion_block_max'), bloqueioMagicoMax: mn('minion_spell_block_max'),
      // (lote 86) o "aumentado" e o "mais" do dano do lacaio que a invocação já pôs no `dano` (golpe ÷ a força de base): o Fogo adicional "se
      // Bloqueou Recentemente" é escalado por ele no golpe (`cacadas`), como o resto do golpe
      fatorDoDano: f.dano > 0 ? golpe / f.dano : 1,
      // (lote 87, dono 19/10: a parte B, "Todos os lacaios (PoE)") a PRECISÃO do golpe de ataque (a do PoB — a tabela × o `accuracy` —, + "Lacaios
      // tem +N de Precisão" e o do escudo da Égide; × o aumentado), o golpe de magia (nunca erra), o atordoamento (o limiar do PoB, imune, a
      // recuperação de atordoamento e de bloqueio) e o "Dano Extra recebido de Acertos Críticos reduzido" — `precisaoDoLacaio`,
      // `controleNoLacaio`, `criticoNoLacaio`
      precisaoBase: pob?.precisao ?? null, precisaoFixa: mn('minion_precisao'), precisaoInc: mn('minion_precisao_inc'), golpeDeMagia: !!pob?.golpeDeMagia,
      limiarAtordoamentoPct: pob?.limiarAtordoamentoPct ?? 0, imuneAtordoamento: !!pob?.imuneAtordoamento,
      recBloqueio: mn('minion_block_recovery'), recAtordoamento: mn('minion_stun_recovery'), critRecebidoRed: mn('minion_crit_dmg_taken_red'),
      // (lote 43, P040: as defesas do escudo da Égide Necromântica — a armadura, a evasão, o escudo de energia fixo, a supressão de magia)
      // (lote 44: + a armadura, a evasão e o escudo de energia de base do lacaio no PoB)
      // (lote 49: + "Golens têm +X de Armadura" — `lacaio_armadura:<tipo>`)
      armadura: mn('minion_armadura') + (pob?.armadura ?? 0) + porTipo('lacaio_armadura'), evasao: mn('minion_evasao') + (pob?.evasao ?? 0), esFixo: mn('minion_es') + (pob?.es ?? 0), supressao: mn('minion_supressao'),
      // (lote 50, o Poder Primordial: "Dano dos Golens aumentado em X% se convocados nos últimos N segundos" — `golpeDoLacaio`, por `l.desde`)
      danoRecentePct: porTipo('lacaio_dano_recente'), danoRecenteMs: porTipo('lacaio_dano_recente_s') * 1000,
      // (lote 51) "Lacaios Convocados são Agressivos" — a busca de alvo mais longe (`cacadas.CASAS_DO_AGRESSIVO`)
      // (lote S2B: + o Frenesi Faminto — "Lacaios de Habilidades Suportadas são Agressivos")
      agressivo: m0('lacaios_agressivos') > 0 || (!totem && efeito?.lacaioAgressivo > 0),
      // (lote S2B) o que os suportes do lote dão ao lacaio no combate (`SuportesS2B.doLacaio`: o Exemplar, a Carne Fresca, o Exército Elemental, o Escudo de Carne, o
      // Frenesi Faminto — `cacadas.tiqueDosLacaios`)
      ...(!totem && SuportesS2B.doLacaio(efeito) ? { s2b: SuportesS2B.doLacaio(efeito) } : {}),
      // (lote 52, a Harmonia Primordial: "Dano do Golem aumentado em X% por cada Tipo de Golem Convocado por você" — `golpeDoLacaio`, nos Golens)
      danoPorTipoDeGolemPct: m0('golem_dano_por_tipo'),
      bloqueioInc: mn('minion_block_inc'), evitarAfeccoes: mn('minion_evitar_afeccoes'), reflexoFisico: mn('minion_reflexo_fisico'), esRecargaInicio: mn('minion_es_recarga_inicio'),
      recuperacaoPct: mn('minion_recuperacao'), vidaNaMorteDeLacaioPct: mn('minion_vida_na_morte_lacaio'),
      // (lote 69) "enquanto estiverem em Vida Cheia"; "contra Inimigos Incendiados"; os "criados Recentemente" (os primeiros 4 s — `l.desde`)
      danoDobradoVidaCheia: mn('minion_dano_dobrado_vida_cheia'), danoContraIncendiadosPct: mn('minion_dano_incendiados'),
      movimentoRecentePct: mn('minion_move_recente'), velRecentePct: mn('minion_vel_recente'), invulneravelRecente: mn('minion_invulneravel_recente'),
      danoDobrado: mn('minion_dano_dobrado') + (e2a.danoDobradoPct ?? 0), ignoraReducaoFisica: mn('minion_ignora_reducao_fisica'), penAmaldicoados: mn('minion_pen_amaldicoados'),
      drenoParaODono: mn('minion_dreno_dono'), poderProfano: mn('minion_poder_profano'), explodeVidaBaixaPct: mn('minion_explode_vida_baixa'),
      imuneElemental: porTipo('lacaio_imune_elemental') > 0,
      // (11/10) "A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base" (`controleNoLacaio`).
      semLentidao: totem && m0('totem_sem_lentidao') > 0,
      aoMatar: { poderProfano: [mn('minion_poder_profano_ao_matar'), mn('minion_poder_profano_s') || 4], agressividade: [mn('minion_agressividade_ao_matar'), mn('minion_agressividade_s') || 4],
        // (lote 54, a Fome Eterna: só os Espectros — `espectro_devorador_chance`/`_s`, da árvore com a Inteligência no raio)
        ...(PALAVRA_DO_TIPO.espectro.test(texto) && m0('espectro_devorador_chance') > 0 ? { devoradorDeAlmas: [m0('espectro_devorador_chance'), m0('espectro_devorador_s') || 20] } : {}) },
    } : null,
    afDono: Object.keys(afDono).length ? afDono : null, porLacaioFisico, golem: /golem/i.test(`${nome} ${en}`),
    ...(totem ? { efeitosDoTotem: doTotem } : {}),
    ...(anel ? { anel } : {}),
    ...(porPoder ? { detonaNoMaximo: true } : {}),
    // (lote E1a) o que vai no lacaio (`acoes.invocarLacaios`): o Efeito do Buff do golem, o Ceifador e o "mais Dano por Lacaio Não-Golem próximo" do Golem da
    // Carniça; e a chance de um lacaio extra no uso (o Espírito Furioso)
    // (dono, 26/10: + a proteção do Golem de Pedra e o "mais Dano com Sangramento" do Ceifador)
    ...(e1aQ.efeitoDoBuffPct > 0 || e1aN.ceifador || e1aN.maisPorNaoGolem || e1aN.protecaoPct || e1aN.maisSangramentoPct ? { e1a: { ...(e1aQ.efeitoDoBuffPct > 0 ? { efeitoDoBuffPct: e1aQ.efeitoDoBuffPct } : {}), ...(e1aN.ceifador ? { ceifador: e1aN.ceifador } : {}), ...(e1aN.maisPorNaoGolem ? { maisPorNaoGolem: e1aN.maisPorNaoGolem } : {}), ...(e1aN.protecaoPct ? { protecaoPct: e1aN.protecaoPct } : {}), ...(e1aN.maisSangramentoPct ? { maisSangramentoPct: e1aN.maisSangramentoPct } : {}) } } : {}),
    ...(e1aN.chanceRaroUnico > 0 ? { chanceRaroUnico: e1aN.chanceRaroUnico } : {}),
    ...(e1aQ.chanceDeLacaioExtra > 0 ? { chanceDeLacaioExtra: e1aQ.chanceDeLacaioExtra } : {}),
    // (lote E2A) o alcance a mais do golpe corpo a corpo (o Golpe Sagrado, em metros), a Queda do Zumbi e os dois Robôs Rastejantes (`acoes.invocarLacaios`, `cacadas`)
    ...(e2a.alcanceM ? { alcanceExtraM: e2a.alcanceM } : {}), ...(e2a.queda ? { queda: e2a.queda } : {}), ...(e2a.robos ? { robos: e2a.robos } : {}),
    // (lote E2A: os Robôs Rastejantes — "Máximo de 1 … de cada tipo": o Resfriante e o Eletrizante, os dois num uso)
    tipo: totem ? 'totem' : 'lacaio', nome: totem ? (/totem/i.test(t.nome) ? t.nome : `Totem de ${t.nome}`) : e2a.robos ? 'Robô Rastejante' : nome, maximo: e2a.robos ? 2 : Math.max(1, maximo), porUso: e2a.robos ? 2 : Math.max(1, Math.min(porUso, maximo)), duracaoMs: duracao, nivel: n,
    vida, dano: { min: Math.max(1, Math.round(golpe * (1 - spread))), max: Math.max(1, Math.round(golpe * (1 + spread))) }, intervaloMs: Math.round(f.tempo * 1000), elemento,
    // (lote 44: o lacaio que no PoE não pode sofrer dano — os Robôs Rastejantes, o Armamento Sagrado; lote 75: + o tipo da gema
    // "MinionsAreUndamagable", o Rastejador Agonizante)
    ...(pob?.imune || (r.gema?.tipos ?? []).includes('MinionsAreUndamagable') ? { intocavel: true } : {}), ...(pob ? { pob: pob.id } : {}),
    // (revisão E1a — dono, 27/10) as habilidades com recarga do lacaio no PoB (os golens de Relâmpago e da Carniça — `HABILIDADES_COM_RECARGA`)
    ...(pob && HABILIDADES_COM_RECARGA[pob.id] ? { recargas: habilidadesComRecargaDoPob(pob.id, n) } : {}),
    // O desenho pelo nome do lacaio e o da gema ("Golem" + "Convocar Golem de Chamas").
    desenho: desenhoDe(`${nome} ${t.nome}`, elemento, totem),
  };
  // (revisão E1a) a invocação MISTA (a Vaal Convocar Esqueletos: soldados, arqueiros, magos e o general, cada um com o lacaio dele no PoB — a minionList
  // RaisedSkeletonMeleeVaal / RaisedSkeletonArcherVaal / RaisedSkeletonCaster, act_int.lua:20010): os `grupos`, na ordem das linhas, cada um com a força,
  // o jeito de atacar e o nome do tipo (`acoes.invocarLacaios` → `grupoDoUso`). O máximo, a duração e o resto são os da gema.
  const tipos = !grupo && !totem && !doSuporte ? GRUPOS_DO_POB.find(([re]) => re.test(slug))?.[1] : null;
  if (tipos) {
    const grupos = [];
    for (const { n: qtd, texto } of porTipoConvoca) {
      const tp = tipos.find(([re]) => re.test(texto));
      if (!tp || !(qtd > 0)) continue;
      const sub = oQueInvoca(slug, nivelDaGema, efeito, af, { pob: tp[1], nome: tp[2] });
      if (sub) grupos.push({ n: qtd, q: sub });
    }
    if (grupos.length) resultado.grupos = grupos;
  }
  return resultado;
}
/**
 * (revisão E1a) Os tipos de uma invocação mista: a linha "Convoca N <tipo>" → o lacaio do PoB e o nome. O GENERAL não tem tipo próprio no PoB (a
 * minionList só tem os três; `number_of_leader_skeletons_to_summon` 1): vai como o soldado corpo a corpo, com o nome dele.
 */
const GRUPOS_DO_POB = [
  [/^Vaal_Summon_Skeletons/, [
    [/Soldad/i, 'RaisedSkeletonMeleeVaal', 'Esqueleto Soldado'], [/Arqueir/i, 'RaisedSkeletonArcherVaal', 'Esqueleto Arqueiro'],
    [/Mag[oa]/i, 'RaisedSkeletonCaster', 'Esqueleto Mago'], [/Genera/i, 'RaisedSkeletonMeleeVaal', 'Esqueleto General'],
  ]],
];
/** (revisão E1a) O lacaio de índice `i` de um uso com `grupos` (os primeiros N do 1º grupo, os seguintes do 2º…); além da soma (o lacaio extra), o 1º. */
export function grupoDoUso(q, i) {
  if (!q?.grupos?.length) return q;
  let k = i;
  for (const g of q.grupos) { if (k < g.n) return g.q; k -= g.n; }
  return q.grupos[0].q;
}

/**
 * O JEITO de atacar de cada tipo de lacaio (o que o PoE dá a ele): de longe (arqueiro, mago, espectro, sentinela, golens de fogo e de
 * relâmpago) ou de perto, o elemento, o projétil e o impacto (números do client), o golpe de ÁREA a cada N acertos (a pancada do zumbi,
 * o golem de pedra, a explosão do golem de chamas), a velocidade e a AURA (os robôs rastejantes resfriam/eletrizam em volta).
 */
const ESTILOS_DE_LACAIO = [
  [/arqueir|archer|ranged arms|blink arrow|mirror arrow|clone/i, { alcance: 5, projetil: 3, impacto: 10, elemento: 'physical' }],
  [/mag[oa]s?\b|mage/i, { alcance: 5, magia: true, elementos: ['fire', 'ice', 'energy'] }],
  [/espectro|spectre/i, { alcance: 5, projetil: 11, impacto: 18, elemento: 'chaos' }],
  [/sentinela|sentinel|relíquia|relic/i, { alcance: 4, projetil: 31, impacto: 40, elemento: 'physical', area: { cada: 4, efeito: 50 } }],
  [/golem.*(chama|flame)|flame golem/i, { alcance: 5, projetil: 4, impacto: 16, elemento: 'fire', area: { cada: 3, efeito: 7 } }],
  [/golem.*(relâmp|lightning)|lightning golem/i, { alcance: 5, projetil: 36, impacto: 176, elemento: 'energy' }],
  [/golem.*(gelo|ice)|ice golem/i, { alcance: 1, impacto: 44, elemento: 'ice', area: { cada: 4, efeito: 42 } }],
  [/golem.*(caos|chaos)|chaos golem/i, { alcance: 1, impacto: 17, elemento: 'chaos', area: { cada: 3, efeito: 21 } }],
  [/golem.*(pedra|stone)|stone golem/i, { alcance: 1, impacto: 10, elemento: 'physical', area: { cada: 3, efeito: 45 } }],
  [/zumbi|zombie/i, { alcance: 1, impacto: 10, elemento: 'physical', area: { cada: 4, efeito: 45 } }],
  [/espírito furioso|raging spirit/i, { alcance: 1, impacto: 16, elemento: 'fire', rapido: 0.6 }],
  [/ceifador|reaper/i, { alcance: 1, impacto: 215, elemento: 'physical' }],
  [/robô|skitterbot/i, { aura: { raio: 2, efeito: 42, pct: 0.15 }, alcance: 0 }],
];
export function estiloDoLacaio(texto, elemento) {
  const e = ESTILOS_DE_LACAIO.find(([re]) => re.test(texto))?.[1];
  return { alcance: 1, impacto: 10, elemento: elemento ?? 'physical', ...(e ?? {}) };
}

/** Os bônus de uma OFERENDA aos lacaios em campo: velocidade de ataque, crítico, bloqueio, regeneração. */
function bonusDaOferenda(linhas) {
  // (lote 32, P028: + a Conjuração e o Movimento da Carnal, o bloqueio de Magia da Óssea, e a regeneração dela só "se eles Bloquearam recentemente")
  const b = { velAtaquePct: 0, velConjPct: 0, velMovPct: 0, critInc: 0, critMult: 0, bloqueioPct: 0, bloqueioMagicoPct: 0, regenPct: 0, regenSeBloqueou: false };
  for (const l of linhas) {
    let m;
    if ((m = l.match(/Velocidade de Ataque dos Lacaios em (\d+)/i))) b.velAtaquePct += Number(m[1]);
    if ((m = l.match(/Velocidade de Conjuração dos Lacaios em (\d+)/i))) b.velConjPct += Number(m[1]);
    if ((m = l.match(/Velocidade de Movimento dos Lacaios em (\d+)/i))) b.velMovPct += Number(m[1]);
    if ((m = l.match(/\+(\d+) ?% de Chance de Bloquear Dano Mágico/i))) b.bloqueioMagicoPct += Number(m[1]);
    if (/(\d+(?:\.\d+)?) ?% da Vida Regenerada por Segundo se eles Bloquearam recentemente/i.test(l)) b.regenSeBloqueou = true;
    if ((m = l.match(/Chance de Golpe Crítico aumentada em (\d+)/i))) b.critInc += Number(m[1]);
    if ((m = l.match(/\+(\d+) ?% de Multiplicador de Golpe Crítico/i))) b.critMult += Number(m[1]);
    if ((m = l.match(/\+(\d+) ?% de Chance de Bloquear o Dano de Ataques/i))) b.bloqueioPct += Number(m[1]);
    if ((m = l.match(/(\d+(?:\.\d+)?) ?% da Vida Regenerada por Segundo/i))) b.regenPct += Number(m[1]);
  }
  return b;
}

export { ehLinhaDeLacaio } from './gemas-poe.mjs';

// ---------------------------------------------------------------- (ciclo 7) os mods da árvore no combate do lacaio
// Os números do PoE: Poder Profano = 100% do Dano Físico como Caos extra (`BUFFS.poderProfano`); Agressividade = 20% de Velocidade de Ataque.
const AGRESSIVIDADE_PCT = 20;
/** O lacaio recém-invocado com os mods do dono: o Escudo de Energia ("ganham X% da Vida Máxima como Escudo de Energia"). */
export function aplicarNoLacaio(l) {
  const p = l?.poe;
  // (+ lote 43, P040: o escudo de energia fixo — o do escudo da Égide Necromântica)
  if (!p?.esDaVidaPct && !(p?.esFixo > 0)) return l;
  l.maxEs = Math.round((l.maxHp * (p.esDaVidaPct ?? 0)) / 100 + (p.esFixo ?? 0));
  l.es = l.maxEs;
  return l;
}
/** Um buff do lacaio (Poder Profano, Agressividade) ativo agora? */
export const buffDoLacaio = (l, nome, agora) => (nome === 'poderProfano' && (l?.poe?.poderProfano ?? 0) > 0) || (l?.buffs?.[nome] ?? 0) > agora;
/** A velocidade de ataque (e conjuração) a mais do lacaio agora (%): a Agressividade; (lote 54) as almas do Devorador de Almas, 5% cada. */
/** (lote 69) O lacaio criado RECENTEMENTE (os últimos 4 s — o "Recentemente" do PoE). */
export const LACAIO_RECENTE_MS = 4000;
export const criadoRecentemente = (l, agora) => agora - (l?.desde ?? -Infinity) <= LACAIO_RECENTE_MS;
// (lote 69: + "Lacaios criados Recentemente têm Velocidades de Ataque e Conjuração aumentadas")
export const velocidadeDoLacaio = (l, agora) => (buffDoLacaio(l, 'agressividade', agora) ? AGRESSIVIDADE_PCT : 0) + almasDoLacaio(l, agora) * DEVORADOR_DE_ALMAS.porAlmaPct + (l?.poe?.velRecentePct > 0 && criadoRecentemente(l, agora) ? l.poe.velRecentePct : 0);
/** (lote 69) O movimento do lacaio (a chance do passo a mais): o dele e o "criados Recentemente". */
// (lote E2A, 26/10: + o "Aumenta a Velocidade de Movimento dos Lacaios" da Oferenda Carnal — `oferendaPct`, a do lacaio agora, que quem chama confere no relógio dela —
// e o "X% mais Velocidade de Movimento dos Lacaios" da gema — `poe.movMaisPct`, que multiplica: (1 + aumentado) × (1 + mais) − 1)
export const movimentoDoLacaio = (l, agora, oferendaPct = 0) => {
  const aumentado = (l?.poe?.movimentoPct ?? 0) + (l?.poe?.movimentoRecentePct > 0 && criadoRecentemente(l, agora) ? l.poe.movimentoRecentePct : 0) + (Number(oferendaPct) || 0);
  // (lote D1, decisão do dono 27/10: + o teto dos Espectros — "Velocidade de Movimento dos Lacaios está no Máximo", +75% no total — `poe.movTetoPct`)
  return l?.poe?.movMaisPct || l?.poe?.movTetoPct != null ? GemasE2a.movimentoComMais(aumentado, l?.poe?.movMaisPct ?? 0, l?.poe?.movTetoPct ?? null) : aumentado;
};
/**
 * (11/10) A LENTIDÃO nos lacaios e totens: o golpe de um Elite/Chefe pode deixá-los lentos, como faz com você (`combate/controle.json`: a chance
 * e o peso da lentidão de cada classe, a lentidão e a duração do jogador). "A Velocidade de Ação dos Totens não pode ser modificada para abaixo
 * do valor base": o totem não fica lento (`poe.semLentidao`). Devolve true se pôs.
 */
export function controleNoLacaio(l, bicho, hunt, agora, rng = Math.random, { parede = agora } = {}) {
  if (!l || l.poe?.semLentidao) return false;
  const classe = Controle.classeDoMob(bicho, !!hunt?.isBoss);
  const cfg = classe ? Controle.CONFIG.mobs[classe] : null;
  if (!cfg) return false;
  // (lote 87, dono 19/10: o modelo do jogo para você — `Controle.tentar`: UMA chance por classe — Elite 6%, Chefe 10% — e o efeito sorteado pelos
  // pesos; antes só a lentidão, na chance × o peso dela: a mesma chance de ficar lento)
  const sorte = rng() * 100;
  const efeito = sortearControle(cfg.efeitos ?? {}, rng);
  // (lote 43, P040: o "chance de evitar Afecções Elementais" do escudo da Égide Necromântica — a lentidão do Resfriamento; lote 87: e o Congelamento)
  if ((efeito === 'lento' || efeito === 'congelado') && l.poe?.evitarAfeccoes > 0 && rng() * 100 < l.poe.evitarAfeccoes) return false;
  if (efeito === 'lento') {
    if (!(sorte < cfg.chance)) return false;
    // (a revisão do lote 87: a lentidão no relógio do TIQUE dos lacaios — `parede`, o que `fatorDeLentidao` lê no tique; a magia do monstro chega
    // com o da caçada no `agora`)
    const ate = parede + Controle.CONFIG.jogador.duracaoMs.lento;
    l.lento = { ate: Math.max(l.lento?.ate ?? 0, ate), pct: Math.min(Controle.CONFIG.jogador.lentidaoMaxima, cfg.lentidaoPct ?? 30) };
    return true;
  }
  // (lote 87, dono 19/10: a parte B) o ATORDOAMENTO e o CONGELADO do Chefe no lacaio: ele não anda nem ataca (`lacaioPreso`) por 1,5 s (o
  // atordoamento ÷ (1 + a Recuperação de Atordoamento dele)) e fica 3 s imune aos dois depois — como você. O totem não é atordoado nem congelado
  // (fica fora: dono); os Robôs são imunes ao atordoamento (`StunImmune` do PoB); o "Limiar de Atordoamento aumentado" do PoB (o Zumbi, +30%) ×
  // 1/(1 + X%) na chance. No relógio da CAÇADA (`hunt.clock`). Devolve o nome do efeito ('atordoado'/'congelado'; a lentidão: true).
  if (efeito !== 'atordoado' && efeito !== 'congelado') return false;
  if (l.tipo === 'totem' || ehTotem(l) || (efeito === 'atordoado' && l.poe?.imuneAtordoamento)) return false;
  const p = l.poe ?? {};
  const fator = efeito === 'atordoado' ? 1 / (1 + Math.max(0, p.limiarAtordoamentoPct ?? 0) / 100) : 1;
  if (!(sorte < cfg.chance * fator)) return false;
  const relogio = hunt?.clock ?? agora;
  if (lacaioPreso(l, relogio, { semTrava: true }) || relogio < (l.imuneControleAte ?? 0)) return false;
  const ms = Math.round(Controle.CONFIG.jogador.duracaoMs[efeito] / (efeito === 'atordoado' ? Math.max(0.1, 1 + (p.recAtordoamento ?? 0) / 100) : 1));
  l[efeito] = { ate: relogio + ms, desde: relogio, ms };
  l.imuneControleAte = relogio + ms + Controle.CONFIG.jogador.imunidadeMs;
  return efeito;
}
/** O efeito sorteado pelos pesos (o mesmo sorteio de `combate/controle.mjs`). */
function sortearControle(pesos, rng) {
  const entradas = Object.entries(pesos);
  let sorte = rng() * entradas.reduce((n, [, p]) => n + p, 0);
  for (const [nome, p] of entradas) if ((sorte -= p) < 0) return nome;
  return entradas[0]?.[0] ?? null;
}
/**
 * (lote 87, dono 19/10) O lacaio está PRESO agora (atordoado, congelado, ou na trava do bloqueio — `travarLacaioNoBloqueio`)? Não anda nem ataca
 * (`cacadas.tiqueDosLacaios`). `relogio`: o da caçada. `semTrava`: só o atordoado e o congelado.
 */
export const lacaioPreso = (l, relogio, { semTrava = false } = {}) => relogio != null && ((l?.atordoado?.ate ?? 0) > relogio || (l?.congelado?.ate ?? 0) > relogio || (!semTrava && (l?.travadoAte ?? 0) > relogio));
/**
 * (lote 87, dono 19/10) A RECUPERAÇÃO DE BLOQUEIO no lacaio, como em você (`Controle.travarNoBloqueio`): bloquear trava a próxima ação por 0,35 s
 * ÷ (1 + a "Recuperação de Bloqueio" + a "Recuperação de Atordoamentos e Bloqueios" dele). `relogio`: o da caçada. Devolve os ms.
 */
export function travarLacaioNoBloqueio(l, relogio) {
  if (!l || relogio == null) return 0;
  const ms = Math.round(Controle.BLOQUEIO_TRAVA_MS / Math.max(0.1, 1 + ((l.poe?.recBloqueio ?? 0) + (l.poe?.recAtordoamento ?? 0)) / 100));
  l.travadoAte = Math.max(l.travadoAte ?? 0, relogio + ms);
  return ms;
}
/**
 * (lote 87, dono 19/10: D2/D3) A PRECISÃO do golpe de ataque do lacaio: a base (a do PoB — `precisaoBase`; sem ela, o Espectro e os outros: a
 * tabela de precisão de monstro do nível × 1) + a fixa ("Lacaios tem +N de Precisão", o escudo da Égide) × (1 + o aumentado).
 */
export function precisaoDoLacaio(l) {
  const p = l?.poe ?? {};
  const t = POB.tabelas.precisao;
  const base = p.precisaoBase ?? t[Math.max(1, Math.min(t.length, Math.round(l?.nivel ?? 1) || 1)) - 1];
  return Math.max(0, (base + (p.precisaoFixa ?? 0)) * Math.max(0, 1 + (p.precisaoInc ?? 0) / 100));
}
/** (lote 87, D3) O golpe do lacaio pode ERRAR? Não: a magia (o estilo do mago, a habilidade principal do PoB), o mercenário, o totem. */
export const lacaioPodeErrar = (l, magia = false) => !!l?.poe && !magia && !l.poe.golpeDeMagia && !l.mercenario && l.tipo !== 'totem' && !ehTotem(l);
/**
 * (lote 87, dono 19/10: B3) O CRÍTICO do monstro no lacaio (o golpe e a magia), como em você (`ModsPoe.criticoDoBicho`): a chance do monstro
 * (`base`: `AtributosDoMob.critico` — o "Afiado" e a espécie) × os estados dele (Cego…), e o dano extra × (1 − o "Dano Extra recebido de Acertos
 * Críticos reduzido" do lacaio — o escudo da Égide). `{ critico, fator }`.
 */
export function criticoNoLacaio(l, base, bicho, relogio, rng = Math.random) {
  const c = criticoDoBicho(base, bicho, { afPoe: { crit_dmg_taken_red: l?.poe?.critRecebidoRed ?? 0 } }, relogio, rng);
  if (c) return c;
  return base?.chance > 0 && rng() < base.chance ? { critico: true, fator: base.fator } : { critico: false, fator: 1 };
}
/** Quanto o lacaio LENTO demora a mais no golpe (1 = normal). */
export const fatorDeLentidao = (l, agora) => (l?.lento?.ate > agora && !l.poe?.semLentidao ? 1 / (1 - l.lento.pct / 100) : 1);
/** A chance de crítico (%) e o multiplicador do golpe do lacaio, com os da árvore ("Lacaios têm Chance de Acerto Crítico aumentada", "+X% de Multiplicador"). */
export function criticoDoLacaio(l, oferenda = null, relogio = null) {
  const p = l?.poe ?? {};
  // (lote 86, dono 19/10: a Égide Necromântica — "+X% de Multiplicador de Crítico se você Bloqueou Recentemente" e "X% de Chance de Crítico
  // aumentada se você não Bloqueou Recentemente" do escudo; `relogio`: o da caçada — sem ele, nenhum dos dois)
  const recente = relogio != null && lacaioBloqueouRecente(l, relogio);
  const critInc = relogio != null && !recente ? p.naoBloqueou?.critInc ?? 0 : 0;
  const critMult = recente ? p.seBloqueou?.critMult ?? 0 : 0;
  // (a "Chance de Crítico dos Lacaios aumentada" sobre a BASE — `critChanceBase`, a chance sem ela; `critChance` já a traz: `oQueInvoca`)
  const chance = Math.min(100, (l?.critChanceBase ?? l?.critChance ?? 5) * (1 + ((oferenda?.critInc ?? 0) + (p.critInc ?? 0) + critInc) / 100));
  const mult = (l?.critMult ?? 1.5) + ((oferenda?.critMult ?? 0) + (p.critMult ?? 0) + critMult) / 100;
  return { chance, mult };
}
/**
 * O golpe do lacaio no `alvo` com os mods do dono: o fator (dano dobrado), a ficha para a resistência (ignora a Redução de Dano Físico,
 * penetra as resistências elementais do amaldiçoado) e o Caos extra do Poder Profano; (lote 86) o Fogo adicional "se Bloqueou Recentemente".
 * `{ fator, ficha, caosExtra, fogoExtra }` (`fogoExtra`: o sorteado, sem escala — quem chama escala como o golpe). `relogio`: o da caçada (`hunt.clock`).
 */
export function golpeDoLacaio(l, alvo, fichaDoDono, tipo, agora, rng = Math.random, lacaios = null, relogio = agora) {
  const p = l?.poe ?? {};
  let ficha = fichaDoDono;
  if (tipo === 'physical' && p.ignoraReducaoFisica > 0 && rng() * 100 < p.ignoraReducaoFisica) ficha = { ...ficha, ignoraReducaoFisica: true };
  const amaldicoado = Object.values(alvo?.maldicoes ?? {}).some((m) => (m?.ate ?? 0) > agora) || (alvo?.estados?.amaldicoado?.ate ?? 0) > agora;
  if (amaldicoado && p.penAmaldicoados > 0 && ['fire', 'ice', 'energy'].includes(tipo)) {
    const pen = ficha?.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    ficha = { ...ficha, penetracao: { ...pen, elemental: Math.min(100, (pen.elemental ?? 0) + p.penAmaldicoados) } };
  }
  // (lote 86, dono 19/10: a Égide Necromântica) "Dano Penetra X% de Resistência a Fogo se você Bloqueou Recentemente" do escudo — o lacaio que
  // bloqueou nos últimos 4 s, na parte de Fogo; e o "Adiciona X a Y de Dano de Fogo se você Bloqueou Recentemente" (`fogoExtra`, quem chama resiste)
  // (o "Recentemente" pelo relógio da CAÇADA — `relogio`, o mesmo do `l.bloqueouEm`)
  const recente = lacaioBloqueouRecente(l, relogio);
  if (recente && p.seBloqueou?.penFogo > 0) {
    const pen = ficha?.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    ficha = { ...ficha, penetracao: { ...pen, porElemento: { ...(pen.porElemento ?? {}), fire: Math.min(100, (pen.porElemento?.fire ?? 0) + p.seBloqueou.penFogo) } } };
  }
  const [fMin, fMax] = recente ? p.seBloqueou?.fogo ?? [0, 0] : [0, 0];
  const fogoExtra = fMax > 0 ? fMin + rng() * Math.max(0, fMax - fMin) : 0;
  // Os "aumentados" de agora, somados aos outros aumentos do lacaio (`danoIncPct`, o da invocação): (lote 50) o do convocado há pouco; (lote 52,
  // a Harmonia Primordial) o do Golem × os TIPOS de Golem vivos (as gemas diferentes — ele mesmo conta).
  const recentePct = p.danoRecentePct > 0 && agora - (l.desde ?? -Infinity) <= (p.danoRecenteMs || 0) ? p.danoRecentePct : 0;
  const tiposDeGolem = l?.golem && p.danoPorTipoDeGolemPct > 0 ? new Set([l, ...(lacaios ?? [])].filter((x) => x?.golem && x.hp > 0).map((x) => x.gema ?? x.nome)).size : 0;
  const agoraPct = recentePct + (p.danoPorTipoDeGolemPct ?? 0) * tiposDeGolem;
  const aumentado = agoraPct ? (1 + ((p.danoIncPct ?? 0) + agoraPct) / 100) / (1 + (p.danoIncPct ?? 0) / 100) : 1;
  // (lote 69: + "Lacaios causam Dano com Acertos e Afecções aumentado contra Inimigos Incendiados" e o Dano Dobrado em Vida Cheia)
  const incendiado = p.danoContraIncendiadosPct > 0 && (alvo?.dots ?? []).some((d) => d.tipo === 'queimadura' && d.falta > 0);
  const contraIncendiado = incendiado ? (1 + ((p.danoIncPct ?? 0) + p.danoContraIncendiadosPct) / 100) / (1 + (p.danoIncPct ?? 0) / 100) : 1;
  const dobrado = (p.danoDobrado ?? 0) + (l.hp >= l.maxHp ? p.danoDobradoVidaCheia ?? 0 : 0);
  // (lote E1a: + o "menos Dano" do Ceifador vivo nos outros lacaios e o "mais Dano por Lacaio Não-Golem próximo" do Golem da Carniça — `GemasE1a`)
  const fator = (dobrado > 0 && rng() * 100 < dobrado ? 2 : 1) * aumentado * contraIncendiado * GemasE1a.fatorDoCeifador(l, lacaios) * GemasE1a.fatorPorNaoGolemPerto(l, lacaios);
  const caosExtra = tipo === 'physical' && buffDoLacaio(l, 'poderProfano', agora) ? 1 : 0;
  return { fator, ficha, caosExtra, fogoExtra };
}
/** A área do golpe em área do lacaio, em casas de raio: 1 × √(1 + o "Efeito em Área" dele), a fração como chance — como a das gemas (lote 36). */
export function raioDaAreaDoLacaio(l, rng = Math.random) {
  // (lote E2A: + o "Efeito em Área aumentado" só da Pancada do Zumbi da Pancada — o golpe em área do zumbi é ela)
  return Math.max(1, 1 + casasPelaArea(1, fatorDaArea((l?.poe?.areaPct ?? 0) + (l?.poe?.impactoAreaPct ?? 0)), rng));
}
/**
 * (revisão E1a — dono, 27/10: "crie as habilidades com recarga do PoE, pelo PoB") As HABILIDADES COM RECARGA dos golens (Minions.lua → Skills/minion.lua), por
 * cima do golpe comum; a "Recuperação da Recarga dos Lacaios" as encurta (`recargaDoLacaio`):
 *   - o Golem de Relâmpago (SummonedLightningGolem): o Orbe da Tempestade (LightningGolemArcSummoned — magia de Raio, recarga 8 s, 2 usos guardados, 6% de crítico;
 *     0,2 a 1,8 × a eficácia) e a Ira (LightningGolemWrath — aura de 4 s, recarga 12 s: Dano de Raio adicionado aos Ataques, 0,2 a 1,8 × a eficácia, e às Magias,
 *     0,12 a 1,08, seus e dos lacaios no raio; não causa dano);
 *   - o Golem da Carniça (SummonedCarrionGolem): a Cascata (BoneGolemCascade — ataque em área, 65% do golpe, recarga 6 s) e o Salto Esmagador (BoneGolemLeapSlam —
 *     ataque em área, 225% do golpe, recarga 4 s).
 * A eficácia da magia é a do PoB (statInterpolation 3): (3,885209 + 0,360246 × (N − 1)) × baseEffectiveness × (1 + incrementalEffectiveness)^(N − 1), N o nível do
 * lacaio. (Fora: o Consumir Cadáver e a Cascata Fortalecida da Carniça — sem dano/sem recarga própria; o Orbe é um acerto no alvo quando sai — o jogo não tem o
 * objeto que dura 8 s.)
 */
export const HABILIDADES_COM_RECARGA = {
  SummonedLightningGolem: [
    { id: 'LightningGolemArcSummoned', nome: 'Orbe da Tempestade', tipo: 'magia', elemento: 'energy', recargaMs: 8000, usos: 2, crit: 6, base: [0.2, 1.8], baseEf: 0.78420001268387, incEf: 0.028500000014901, alcance: 5 },
    { id: 'LightningGolemWrath', nome: 'Ira', tipo: 'aura', recargaMs: 12000, usos: 1, duracaoMs: 4000, ataque: [0.2, 1.8], magia: [0.12, 1.08], baseEf: 0.16249999403954, incEf: 0.019999999552965 },
  ],
  SummonedCarrionGolem: [
    { id: 'BoneGolemCascade', nome: 'Cascata', tipo: 'ataqueArea', recargaMs: 6000, usos: 1, mult: 0.65, alcance: 3 },
    { id: 'BoneGolemLeapSlam', nome: 'Salto Esmagador', tipo: 'ataqueArea', recargaMs: 4000, usos: 1, mult: 2.25, alcance: 4 },
  ],
};
/** A eficácia de uma magia de lacaio do PoB no nível `n` (statInterpolation 3). */
export const eficaciaDaMagiaDoPob = (n, baseEf, incEf) => (3.885209 + 0.360246 * (Math.max(1, n) - 1)) * baseEf * (1 + incEf) ** (Math.max(1, n) - 1);
/** As habilidades com recarga do lacaio `pobId` no nível `n`, com os números prontos (o dano das magias e da aura, pelo PoB). */
export function habilidadesComRecargaDoPob(pobId, n) {
  const lista = HABILIDADES_COM_RECARGA[pobId];
  if (!lista) return null;
  return lista.map((h) => {
    const ef = h.baseEf ? eficaciaDaMagiaDoPob(n, h.baseEf, h.incEf) : 0;
    const par = (b) => [Math.round(b[0] * ef), Math.round(b[1] * ef)];
    return { id: h.id, nome: h.nome, tipo: h.tipo, recargaMs: h.recargaMs, usos: h.usos, ...(h.elemento ? { elemento: h.elemento } : {}), ...(h.crit ? { crit: h.crit } : {}), ...(h.mult ? { mult: h.mult } : {}),
      ...(h.alcance ? { alcance: h.alcance } : {}), ...(h.duracaoMs ? { duracaoMs: h.duracaoMs } : {}), ...(h.base ? { dano: par(h.base) } : {}), ...(h.ataque ? { ataque: par(h.ataque), magia: par(h.magia) } : {}) };
  });
}
/** O intervalo de uma magia/habilidade do lacaio com a "Recuperação da Recarga" dele. */
export const recargaDoLacaio = (l, ms) => Math.round(ms / Math.max(0.1, 1 + (l?.poe?.recargaPct ?? 0) / 100));
/**
 * (13/10, o Ritual do Despertar: "Você e seus Totens Regeneram X% de Vida por segundo para cada Totem Convocado") A % da vida máxima por segundo
 * que cada TOTEM vivo regenera agora: `totem_regen_pct_por_totem` × os totens vivos (o tique dos lacaios — `cacadas`). Os totens são os lacaios
 * com "Totem" no nome (a mesma conta da escala `lacaio:totem`).
 */
export const ehTotem = (l) => /totem/i.test(l?.nome ?? '');
export function regenPctDosTotens(afPoe, lacaios) {
  return (Number(afPoe?.totem_regen_pct_por_totem) || 0) * (lacaios ?? []).filter((l) => l.hp > 0 && ehTotem(l)).length;
}

/** A recuperação de vida do lacaio (regeneração, roubo): × (1 + recuperação%) — "Lacaios têm Recuperação de Vida reduzida em X%". */
export const recuperacaoDoLacaio = (l, quanto) => quanto * Math.max(0, 1 + (l?.poe?.recuperacaoPct ?? 0) / 100);
/** Cura o lacaio (com a recuperação dele). */
export function curarLacaio(l, quanto) {
  if (!(quanto > 0) || !(l?.hp > 0)) return;
  l.hp = Math.min(l.maxHp, l.hp + recuperacaoDoLacaio(l, quanto));
}
/**
 * O dano que um bicho causa no lacaio, com as defesas da árvore: o bloqueio mágico (a parte das magias do bicho), a Redução de Dano Físico
 * (na parte física), o máximo das resistências elementais (`resMax`) e o escudo antes da vida. `fisico`: a parte física do golpe;
 * `porElemento`: `[{ elemento, valor }]` as outras partes já sem resistência; `magia`: o golpe é de magia. Devolve `{ dano, bloqueou }`.
 */
/**
 * O dano no lacaio: o bloqueio mágico (a magia); (lote 43, P040) a EVASÃO contra o ataque (a do escudo da Égide Necromântica, pela mesma conta
 * da sua — `chanceDeEsquiva`, contra a `precisao` do bicho); a SUPRESSÃO de magia (50% menos dano); a ARMADURA no físico (armadura ÷ (armadura +
 * 5 × o físico), somada à redução física adicional, no teto de 90%); e o escudo. `{ dano, bloqueou, evadiu }`.
 */
export function danoNoLacaio(l, { fisico = 0, outros = 0, magia = false, rng = Math.random, bloqueioMagicoExtra = 0, precisao = 0, agora = null, relogio = agora } = {}) {
  const p = l?.poe ?? {};
  // (lote 69) "Lacaios criados Recentemente não podem sofrer Dano"
  if (p.invulneravelRecente > 0 && agora != null && criadoRecentemente(l, agora)) return { dano: 0, bloqueou: false };
  // (13/10: + o bloqueio mágico das auras "Você e Aliados" do dono — `bloqueioMagicoExtra`)
  // (lote 86, dono 19/10: a Égide Necromântica — o do escudo "se Bloqueou Recentemente", no teto; "no máximo se não Bloqueou Recentemente";
  // Sortudo (o Svalinn, ou "se Bloqueou Recentemente"): rola duas vezes. `relogio`: o da caçada, o do `l.bloqueouEm`.)
  const bloqueioMagico = chanceDeBloquearDoLacaio(l, (p.bloqueioMagico ?? 0) + bloqueioMagicoExtra, { magia: true, relogio });
  if (magia && bloqueioMagico > 0 && sorteado(bloqueioMagico / 100, bloqueioSortudoDoLacaio(l, relogio) ? 1 : 0, 0, rng)) {
    if (p.vidaAoBloquear > 0) curarLacaio(l, (l.maxHp * p.vidaAoBloquear) / 100);
    return { dano: 0, bloqueou: true };
  }
  if (!magia && p.evasao > 0 && precisao > 0 && rng() < chanceDeEsquiva(p.evasao, l.nivel ?? 1, precisao)) return { dano: 0, bloqueou: false, evadiu: true };
  // (lote 86, dono 19/10: a Égide Necromântica — "+X de Armadura se você Bloqueou Recentemente" do escudo, no lacaio que bloqueou nos últimos 4 s)
  const armadura = armaduraDoLacaio(l, relogio);
  const daArmadura = armadura > 0 && fisico > 0 ? (100 * armadura) / (armadura + 5 * fisico) : 0;
  const red = Math.min(90, Math.max(0, (p.reducaoFisica ?? 0) + daArmadura));
  let dano = fisico * (1 - red / 100) + outros;
  if (magia && p.supressao > 0 && rng() * 100 < p.supressao) dano *= 0.5;
  // (lote E2A: "Sentinelas Ascendidos sofrem 70% menos Dano" — vaal_upgrade_minion_damage_taken_+%_final, no acerto todo)
  if (p.menosDanoRecebidoPct > 0) dano *= Math.max(0, 1 - p.menosDanoRecebidoPct / 100);
  if (l.es > 0) {
    const absorvido = Math.min(l.es, dano);
    l.es -= absorvido;
    dano -= absorvido;
  }
  // (lote 43, P040: "Início da Recarga do Escudo de Energia X% mais rápido" do escudo da Égide — a espera de 2 s ÷ (1 + X%))
  l.esEspera = Math.round(2000 / Math.max(0.1, 1 + (p.esRecargaInicio ?? 0) / 100));
  return { dano, bloqueou: false };
}
/**
 * O teto da resistência do lacaio a `elemento` (`fire`/`ice`/`energy`/`chaos`): o elemental, 75 + "X% de máximo de todas as Resistências
 * Elementais" + (lote 86, dono 19/10: a Égide Necromântica) o máximo daquele elemento do escudo (`resMaxEl`); o de Caos, 75 + o máximo de Caos
 * (`resMaxCaos`) — (lote 86: antes o Caos subia com o "todas as Elementais", e no PoE não sobe). No teto de 90. (Sem `elemento`: o de Fogo.)
 */
export function tetoDaResDoLacaio(l, elemento = 'fire') {
  const p = l?.poe ?? {};
  if (elemento === 'chaos') return Math.min(90, 75 + (p.resMaxCaos ?? 0));
  return Math.min(90, 75 + (p.resMax ?? 0) + (p.resMaxEl?.[elemento] ?? 0));
}
/**
 * (lote 86, dono 19/10) O lacaio Bloqueou Recentemente (nos últimos 4 s — `l.bloqueouEm`)? `relogio`: o da CAÇADA (`hunt.clock` — o mesmo dos
 * estados nos bichos e do seu "Recentemente"); o `l.bloqueouEm` é gravado nele.
 */
export const lacaioBloqueouRecente = (l, relogio) => relogio != null && relogio - (l?.bloqueouEm ?? -Infinity) <= LACAIO_RECENTE_MS;
/** (lote 86) A armadura do lacaio agora: a dele + o "+X de Armadura se você Bloqueou Recentemente" do escudo da Égide. */
export const armaduraDoLacaio = (l, relogio) => (l?.poe?.armadura ?? 0) + (l?.poe?.seBloqueou?.armadura > 0 && lacaioBloqueouRecente(l, relogio) ? l.poe.seBloqueou.armadura : 0);
/** (lote 86) O bloqueio do lacaio é Sortudo? O "Chance de Bloquear é Sortuda" do escudo (o Svalinn) sempre; o "se você Bloqueou Recentemente", nos 4 s. */
export const bloqueioSortudoDoLacaio = (l, relogio) => l?.poe?.bloqueioSortudo > 0 || (l?.poe?.seBloqueou?.sortudo > 0 && lacaioBloqueouRecente(l, relogio));
/**
 * (lote 86, dono 19/10: a Égide Necromântica, "TODO bônus do escudo vale no lacaio") A chance de bloquear do lacaio (%), de ataque ou de
 * `magia`, a partir da `base` (o que quem chama já somou: o dele, a Oferenda, as suas auras e o aumentado): + o do escudo "se Bloqueou
 * Recentemente" / "se não Bloqueou Recentemente"; "Você está na Chance Máxima de Bloquear … caso não tenha Bloqueado Recentemente": o TETO do
 * PoE (os 75% de `combate/formulas.json` — como o seu — + o "+X% à Chance máxima de Bloquear" do escudo, até os 90% do PoE). Todo lacaio
 * para no teto (dono, 19/10: "Teto 75% e ajustar o teste" — antes o lacaio não tinha teto).
 */
export function chanceDeBloquearDoLacaio(l, base, { magia = false, relogio = null } = {}) {
  const p = l?.poe ?? {};
  const recente = lacaioBloqueouRecente(l, relogio);
  const teto = Math.min(90, 100 * (magia ? PARAMETROS.bloqueio.limiteDaMagia : PARAMETROS.bloqueio.limiteDoGolpe) + ((magia ? p.bloqueioMagicoMax : p.bloqueioMax) ?? 0));
  if (relogio != null && !recente && (magia ? p.naoBloqueou?.magiaNoMaximo : p.naoBloqueou?.noMaximo) > 0) return teto;
  const extra = recente ? (magia ? p.seBloqueou?.bloqueioMagico : p.seBloqueou?.bloqueio) ?? 0 : relogio != null && !magia ? p.naoBloqueou?.bloqueio ?? 0 : 0;
  return Math.max(0, Math.min(teto, base + extra));
}
/**
 * O escudo do lacaio recarrega (33%/s, depois de 2 s sem dano — a regra do escudo do PoE; lote 84, dono: "33% como o PoB" — o
 * `RECARGA_POR_SEGUNDO_POE` de atributos-principais.json). `ms`: o tique.
 */
const RECARGA_DO_ESCUDO_POE = JSON.parse(readFileSync(new URL('../../gamedata/atributos-principais.json', import.meta.url), 'utf8')).energyShield?.RECARGA_POR_SEGUNDO_POE ?? 0.33;
export function recarregarEscudoDoLacaio(l, ms) {
  if (!(l?.maxEs > 0)) return;
  if ((l.esEspera ?? 0) > 0) { l.esEspera -= ms; return; }
  l.es = Math.min(l.maxEs, (l.es ?? 0) + (l.maxEs * RECARGA_DO_ESCUDO_POE * ms) / 1000);
}
/**
 * A INSTABILIDADE DO LACAIO (a keystone): o lacaio em Vida Baixa (metade ou menos) explode — X% da vida máxima dele como Dano de Fogo nos
 * bichos a até 1 casa — e morre. Devolve os bichos atingidos `[{ m, dano }]` (o dano antes da resistência; quem chama resiste e mostra).
 */
export function explosaoDoLacaio(l, monstros = []) {
  const pct = l?.poe?.explodeVidaBaixaPct ?? 0;
  if (!(pct > 0) || !(l.hp > 0) || l.hp > l.maxHp * 0.5) return null;
  const dano = (l.maxHp * pct) / 100;
  l.hp = 0;
  return monstros.filter((m) => m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - l.x), Math.abs(m.y - l.y)) <= 1).map((m) => ({ m, dano }));
}
/** O lacaio matou um bicho: os buffs ao matar ("X% de chance de ganhar Poder Profano / Agressividade por N segundos ao Matar"). */
export function aoMatarDoLacaio(l, agora, rng = Math.random) {
  const a = l?.poe?.aoMatar;
  if (!a) return;
  for (const [nome, [chance, seg]] of Object.entries(a)) {
    // (lote 54: o Devorador de Almas não renova enquanto dura — "persiste até a fonte expirar", poedb; o novo começa sem almas)
    if (nome === 'devoradorDeAlmas' && buffDoLacaio(l, nome, agora)) continue;
    if (!(chance > 0 && rng() * 100 < chance)) continue;
    (l.buffs ??= {})[nome] = Math.max(l.buffs[nome] ?? 0, agora + seg * 1000);
    if (nome === 'devoradorDeAlmas') l.almas = { n: 0, em: agora };
  }
}
/** Um lacaio morreu: os outros recuperam X% da vida ("Lacaios Recuperam X% de Vida na Morte de Lacaios"). */
export function naMorteDeUmLacaio(vivos) {
  for (const l of vivos) if (l.poe?.vidaNaMorteDeLacaioPct > 0) curarLacaio(l, (l.maxHp * l.poe.vidaNaMorteDeLacaioPct) / 100);
}
