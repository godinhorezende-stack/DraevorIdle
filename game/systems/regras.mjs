// Constantes do núcleo do jogo. Lidas do cliente recuperado (auth.mjs
// `VOCATION_INFO`, panels.mjs "Todo personagem começa no level 8") e, onde
// existe, das fórmulas REAIS capturadas do servidor original ainda vivo em
// produção (ver `api-mapeada/character-real-example.json` e o pé desta
// leitura em `game/engine/formulas.mjs`, que o próprio cliente usa
// para prever o resultado — client e servidor calculam a MESMA conta).
import {
  maxHealth,
  maxMana,
  maxCapacity,
  baseSpeed,
  expForLevel,
  levelFromExp,
  triesForSkill,
  manaForMagicLevel,
  levelBonus,
  attackDamage as attackDamageDoMotor,
  magicDamage,
  armorReduction,
  blockChance,
  duracaoDoPasso,
  applyElement,
  RESISTENCIA_MAXIMA_DE_BOSS,
} from '../engine/formulas.mjs';
import * as Formulas from './combate/formulas.mjs';
export { applyElement, RESISTENCIA_MAXIMA_DE_BOSS };

export const NIVEL_INICIAL = 8;

/** looktype por vocação/sexo — de `client/src/auth.mjs`'s `VOCATION_INFO`. */
export const LOOK_DA_VOCACAO = {
  knight: { male: 131, female: 139 },
  paladin: { male: 129, female: 137 },
  druid: { male: 130, female: 138 },
  sorcerer: { male: 133, female: 141 },
  monk: { male: 1824, female: 1825 },
};

export const VOCACOES_VALIDAS = new Set(Object.keys(LOOK_DA_VOCACAO));

/** A mesma regra de nome que `auth.mjs`'s `NOME_VALIDO`/`problemaNoNome`. */
const NOME_VALIDO = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,19}$/;

export function problemaNoNomeDePersonagem(cru) {
  const nome = String(cru ?? '');
  if (!nome) return 'Escreva um nome.';
  if (nome !== nome.trim()) return 'Sem espaço no começo nem no fim.';
  if (nome.length < 3) return 'Pelo menos 3 letras.';
  if (nome.length > 20) return 'No máximo 20 letras.';
  if (/\s{2,}/.test(nome)) return 'Sem dois espaços seguidos.';
  if (!NOME_VALIDO.test(nome)) return 'Só letras e espaço, começando com letra.';
  return null;
}

export const MAXIMO_DE_PERSONAGENS = 5;

/*
 * A posição de nascimento é a REAL: capturada ao vivo criando uma conta de
 * teste no `ravoxidle.com.br` (que ainda respondia no momento desta captura —
 * ver `api-mapeada/city-meta.json`'s `player`). `moveMs` também é o real: o
 * client mandava 290 (chute), o servidor original usa 250.
 */
export const POSICAO_INICIAL = { x: 99, y: 65, z: 7, dir: 2 };

/** Vida/mana máxima no level dado — fórmula real, não chute (ver import acima). */
export function statsBase(vocacao, level = NIVEL_INICIAL) {
  return { maxHp: maxHealth(vocacao, level), maxMana: maxMana(vocacao, level) };
}

export const TICKS_POR_SEGUNDO = 4;

/*
 * ---- A folga do passo ----
 *
 * O passo só sai num tique, e o tique vem a cada ~250 ms — às vezes 249. Com a
 * regra "passaram 250 ms desde o último passo?" o passo que caía num tique de
 * 249 ms esperava o PRÓXIMO: 500 ms parado, e o boneco andava aos trancos
 * (medido: 8 passos em 4 s em vez de 16). Meia volta de relógio de folga
 * resolve e não deixa andar mais rápido que um passo por tique.
 */
export const FOLGA_DO_TIQUE = 1000 / TICKS_POR_SEGUNDO / 2;
/** Já dá para o próximo passo/golpe marcado para `quando`? */
export const jaPode = (agora, quando) => agora + FOLGA_DO_TIQUE >= (quando ?? 0);
export const PASSO_MS = 250;

/*
 * ---- O RELÓGIO LÓGICO das magias (decisão do dono, 01/10) ----
 *
 * O tique anda de ~250 em ~250 ms, e uma magia só sai num tique. Antes, cada
 * tempo arredondava de um jeito: o cooldown global para o tique SEGUINTE, a
 * conjuração e as recargas para o tique mais PERTO (`jaPode`, meia volta de
 * folga). Resultado: degraus de Cast Speed que não mudavam nada (de 25% a 30%,
 * o mesmo ciclo) e online (tique oscilando) diferente do offline (tique exato).
 *
 * Agora, para o cooldown global, a conjuração e as recargas das magias e
 * poções, vale UMA regra:
 *   - nada sai antes do instante liberado (`liberou`: sem folga);
 *   - quem sai conta a partir do instante em que PODIA sair, se ele caiu dentro
 *     do último tique (`instanteLogico`), e não do tique em que saiu.
 * A média fica exata (cada ponto de Cast Speed vale) e o tique deixa de pesar.
 * Entre dois tiques reais um intervalo pode ficar até um tique menor que o
 * global, mas a média nunca passa dele.
 */
/** O instante `quando` já chegou? (Sem folga: nunca antes.) */
export const liberou = (agora, quando) => agora >= (quando ?? 0);
/**
 * O instante LÓGICO de uma execução no tique `agora`: a última liberação que
 * caiu dentro deste tique (depois de `anterior`, o tique de antes, e até
 * `agora`) — ou `agora`, se nenhuma caiu (a magia esperava outra coisa: mana,
 * alvo, a vez dela).
 */
export function instanteLogico(agora, anterior, liberacoes) {
  if (anterior == null || !(anterior < agora)) return agora;
  let l = null;
  for (const q of liberacoes) if (q != null && q > anterior && q <= agora && (l == null || q > l)) l = q;
  return l ?? agora;
}

/*
 * ---- O COOLDOWN GLOBAL das magias de ataque ----
 *
 * Pedido do dono (01/10): entre a execução REAL de uma magia de ataque e a
 * seguinte, no mínimo isto — medido no relógio da caçada, pelo instante em que
 * `Acoes.disparar` de fato lançou a anterior (uma skill recusada por recarga,
 * mana ou alvo não conta). Decisões do dono: vale só para as de ATAQUE (cura,
 * suporte e poção seguem no laço deles, sem esperar) e o Cast Speed encurta
 * (`intervaloGlobal` em acoes.mjs: 2000 / (1 + castSpeed%)). É independente da
 * recarga individual de cada magia: as duas valem ao mesmo tempo. Antes eram
 * 500 ms (+ a recarga do grupo de ataque, 1 s). Mudar a cadência é mudar só isto.
 */
export const GLOBAL_SPELL_COOLDOWN = 2000;

/*
 * O intervalo mínimo entre duas coletas da recompensa diária. 20h, e não
 * exatamente 24h — é a folga clássica do "server save" do Tibia: quem joga
 * um pouco mais tarde ou mais cedo todo dia não perde o dia por sincronizar
 * mal com um relógio de 24h em ponto.
 */
export const INTERVALO_DIARIO_MS = 20 * 60 * 60 * 1000;
export { duracaoDoPasso, blockChance, expForLevel, triesForSkill, manaForMagicLevel, levelFromExp, baseSpeed, maxCapacity, levelBonus, magicDamage, armorReduction };

/**
 * O dano de ataque físico (faixa mínimo–máximo): a faixa de ataque da PRÓPRIA arma (`attackMin`–`attackMax`) pela mesma conta nas duas pontas; arma sem
 * faixa leva a variação configurável (`gamedata/combate/formulas.json` → `danoFisico`). Todos os caminhos do jogo (ficha, golpe, duelo) passam por aqui.
 */
export const attackDamage = (args) => attackDamageDoMotor({ ...args, variacao: Formulas.PARAMETROS.danoFisico.variacaoPct / 100, fatorPericia: Formulas.PARAMETROS.danoFisico.fatorDaPericia });

/** Um golpe da própria arma — real: `attack` vem do item, `skill` do personagem (10 fixo, ver `CHARACTER_TEMPLATE`). */
export function golpeDoJogador(arma, skill, level) {
  const lo = arma?.attackMin;
  const hi = arma?.attackMax;
  // Arma com FAIXA de ataque: UM sorteio dentro dela (a faixa da arma já é a variação) pela mesma conta das duas pontas.
  if (lo != null && hi != null && hi > lo) {
    const { min, max } = attackDamage({ attack: arma?.attack ?? lo, attackMin: lo, attackMax: hi, skill, level });
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  const { min, max } = attackDamage({ attack: arma?.attack ?? 0, skill, level });
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Quanto um monstro bate — APROXIMADO, não real. O bestiary capturado ao vivo
 * (`catalog-real.json`) tem hp/armor/velocidade/loot REAIS de 1.840 bichos,
 * mas nunca teve um campo de ataque — confirmado batendo numa hunt de
 * verdade em produção e vendo o wire: só chega o dano JÁ CALCULADO
 * (`{t:'dmg', de:'Troll', v:4}`), nunca o ataque bruto que gerou aquele
 * número. Calibrado à mão contra as duas amostras reais capturadas em
 * 2026-09-23 (Troll bateu 4, Amazon bateu 1 — as duas numa Knight nível 33
 * bem armada; ver `api-mapeada/captura-combate-real.json`), não inventado do
 * nada: cresce com a vida do bicho, que É real.
 */
export function ataqueDoMonstro(bicho) {
  return Math.max(1, Math.round((bicho.hp ?? 10) * 0.5 + (bicho.stars ?? 1) * 4));
}

/** Dano final que chega no personagem, depois da armadura dele absorver uma parte. */
export function danoRecebido(ataqueBruto, armorDoPersonagem) {
  // Modo 'poe' (`combate/formulas.json`): a armadura corta uma FRAÇÃO do golpe físico, que encolhe contra golpes muito fortes; sem sorteio.
  if (Formulas.PARAMETROS.armadura.modo === 'poe') return Math.max(0, ataqueBruto * (1 - Formulas.reducaoDeArmaduraPoe(armorDoPersonagem, ataqueBruto)));
  const absorvido = Formulas.absorcaoPorArmadura(armorDoPersonagem, Math.random());
  return Math.max(0, ataqueBruto - absorvido);
}

/** Progresso real até o próximo level, pela mesma curva de `expForLevel`. */
export function progressoDoLevel(level, exp) {
  const piso = expForLevel(level);
  const proximo = expForLevel(level + 1);
  const necessario = proximo - piso;
  const atual = Math.max(0, exp - piso);
  return {
    current: atual,
    needed: necessario,
    percent: necessario > 0 ? atual / necessario : 0,
    toNext: Math.max(0, necessario - atual),
  };
}
