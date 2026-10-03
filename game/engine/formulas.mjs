// Progressão, atributos derivados e combate. Compartilhado entre servidor e cliente
// (o cliente usa só para exibir previsões; quem decide é sempre o servidor).

export const SKILLS = ['melee', 'distance', 'shielding', 'fishing'];

/** Level e preço da promoção, como no NPC do servidor. */
export const SEXES = ['male', 'female'];

export const PROMOTION_LEVEL = 20;
export const PROMOTION_COST = 20_000;

export const VOCATIONS = {
  none: {
    id: 'none',
    name: 'Sem vocação',
    short: 'SV',
    hp: 5,
    mana: 5,
    cap: 10,
    hpRegen: 6,
    manaRegen: 6,
    // Multiplicador de tentativas para subir cada skill: quanto maior, mais lento.
    rates: { melee: 1.5, distance: 2.0, shielding: 1.5, fishing: 1.1, magic: 3.0 },
    attackFactor: 1.0,
  },
  knight: {
    id: 'knight',
    // O looktype de cada sexo, do outfits.xml do servidor.
    looks: { male: 131, female: 139 },
    // Promoção do servidor: mesmo nome e mesma aceleração de regeneração do
    // vocations.xml (gainhpticks/gainmanaticks da vocação promovida).
    promotion: { name: 'Elite Knight', short: 'EK', hp: 1.5, mana: 1.0 },
    name: 'Knight',
    short: 'EK',
    hp: 15,
    mana: 5,
    cap: 25,
    hpRegen: 6,
    manaRegen: 6,
    rates: { melee: 1.1, distance: 1.4, shielding: 1.1, fishing: 1.1, magic: 3.0 },
    attackFactor: 1.0,
  },
  paladin: {
    id: 'paladin',
    // O looktype de cada sexo, do outfits.xml do servidor.
    looks: { male: 129, female: 137 },
    // Promoção do servidor: mesmo nome e mesma aceleração de regeneração do
    // vocations.xml (gainhpticks/gainmanaticks da vocação promovida).
    promotion: { name: 'Royal Paladin', short: 'RP', hp: 1.333, mana: 1.333 },
    name: 'Paladin',
    short: 'RP',
    hp: 10,
    mana: 15,
    cap: 20,
    hpRegen: 8,
    manaRegen: 4,
    rates: { melee: 1.2, distance: 1.1, shielding: 1.1, fishing: 1.1, magic: 1.4 },
    attackFactor: 1.0,
  },
  sorcerer: {
    id: 'sorcerer',
    // O looktype de cada sexo, do outfits.xml do servidor.
    looks: { male: 133, female: 141 },
    // Promoção do servidor: mesmo nome e mesma aceleração de regeneração do
    // vocations.xml (gainhpticks/gainmanaticks da vocação promovida).
    promotion: { name: 'Master Sorcerer', short: 'MS', hp: 1.0, mana: 1.5 },
    name: 'Sorcerer',
    short: 'MS',
    hp: 5,
    mana: 30,
    cap: 10,
    hpRegen: 12,
    manaRegen: 3,
    rates: { melee: 2.0, distance: 2.0, shielding: 1.5, fishing: 1.1, magic: 1.1 },
    attackFactor: 0.8,
  },
  druid: {
    id: 'druid',
    // O looktype de cada sexo, do outfits.xml do servidor.
    looks: { male: 130, female: 138 },
    // Promoção do servidor: mesmo nome e mesma aceleração de regeneração do
    // vocations.xml (gainhpticks/gainmanaticks da vocação promovida).
    promotion: { name: 'Elder Druid', short: 'ED', hp: 1.0, mana: 1.5 },
    name: 'Druid',
    short: 'ED',
    hp: 5,
    mana: 30,
    cap: 10,
    hpRegen: 12,
    manaRegen: 3,
    rates: { melee: 2.0, distance: 2.0, shielding: 1.5, fishing: 1.1, magic: 1.1 },
    attackFactor: 0.8,
  },
  monk: {
    id: 'monk',
    // O looktype de cada sexo, do outfits.xml do servidor.
    looks: { male: 1824, female: 1825 },
    // Promoção do servidor: mesmo nome e mesma aceleração de regeneração do
    // vocations.xml (gainhpticks/gainmanaticks da vocação promovida).
    promotion: { name: 'Exalted Monk', short: 'EM', hp: 1.4, mana: 1.333 },
    name: 'Monk',
    short: 'EM',
    // Entre o knight e o paladin: bate de perto, mas com mana para as próprias
    // magias. Os números vêm do vocations.xml do crystalserver.
    hp: 13,
    mana: 10,
    // `gaincap="25"` no vocations.xml, como o knight. Estava 22 aqui.
    cap: 25,
    hpRegen: 7,
    manaRegen: 5,
    /*
     * `magic: 1.3` é o `manamultiplier` do Monk no `vocations.xml` da base —
     * MENOR que o 1.4 do paladino, o que quer dizer que o monk sobe magic level
     * mais RÁPIDO que ele. Aqui estava 2.0, que não saiu da base de lugar nenhum.
     */
    rates: { melee: 1.1, distance: 1.6, shielding: 1.1, fishing: 1.1, magic: 1.3 },
    attackFactor: 1.0,
  },
};

const SKILL_GROUP = {
  melee: 'melee',
  distance: 'distance',
  shielding: 'shielding',
  fishing: 'fishing',
};

// ---------- experiência ----------

/** Experiência total acumulada necessária para atingir um nível (curva do Tibia). */
export function expForLevel(level) {
  return Math.max(0, Math.round((50 / 3) * (level ** 3 - 6 * level ** 2 + 17 * level - 12)));
}

export function levelFromExp(exp) {
  let level = 1;
  while (expForLevel(level + 1) <= exp) level++;
  return level;
}

/**
 * Bônus de experiência que decai com o nível — segura a curva no começo
 * sem inflacionar o fim do jogo.
 */
export function levelBonus(level) {
  if (level >= 200) return 0;
  return Math.round((1 - level / 200) * 50);
}

// ---------- atributos derivados ----------

export const BASE_HEALTH = 150;
export const BASE_MANA = 35;
export const BASE_CAPACITY = 400;

export function maxHealth(vocationId, level) {
  const vocation = VOCATIONS[vocationId] ?? VOCATIONS.none;
  return BASE_HEALTH + vocation.hp * (level - 1);
}

export function maxMana(vocationId, level) {
  const vocation = VOCATIONS[vocationId] ?? VOCATIONS.none;
  return BASE_MANA + vocation.mana * (level - 1);
}

/*
 * ---- A capacidade é a do CrystalServer, level a level ----
 *
 * O dono: "volta o CAP da fórmula — tem que ser igual à fórmula da
 * crystalserver".
 *
 * Lá a capacidade não é calculada: ela é GUARDADA no personagem e cresce
 * `gainCap` a cada level (`capacity += vocation->getCapGain()`, player.cpp),
 * e perder level tira o mesmo tanto de volta. O ponto de partida são os
 * personagens de exemplo do `schema.sql`: o de Rookgaard nasce no level 1, e
 * os de vocação nascem no level 8 com 470 — ou seja, até o 8 todo mundo ganha
 * os 10 da vocação "None", e dali em diante cada vocação ganha a dela
 * (vocations.xml: sorcerer e druid 10, paladin 20, knight e monk 25).
 *
 * Aqui dá no mesmo com uma conta só, sem guardar nada:
 *
 *     até o level 8:  390 + 10 × level          (400 no 1, 470 no 8)
 *     depois:         470 + gainCap × (level − 8)
 *
 * A diferença para a conta antiga (`400 + gainCap × (level − 1)`) é que ela
 * dava o ganho da vocação também do level 1 ao 8 — 105 a mais para um
 * knight, 70 para um paladino.
 */
export function maxCapacity(vocationId, level) {
  const vocation = VOCATIONS[vocationId] ?? VOCATIONS.none;
  const nivel = Math.max(1, Math.floor(level));
  if (nivel <= 8) return BASE_CAPACITY - 10 + 10 * nivel;
  return BASE_CAPACITY + 70 + vocation.cap * (nivel - 8);
}

/** Velocidade de movimento em pontos (mesma escala do Tibia). */
export function baseSpeed(level) {
  return 220 + 2 * (level - 1);
}

// ---------- skills ----------

export const SKILL_BASE = 10;
const SKILL_TRIES_BASE = 50;
/**
 * A taxa de subida (tentativas × taxa por nível) das SKILLS DE ATAQUE — a mesma para toda vocação: Melee, Distance e Magic Level (este em mana,
 * `MAGIC_TRIES_BASE × taxa^ML`, sem joelho). Antes cada vocação tinha a sua (1,1 na skill dela e 1,4 a 3,0 nas outras): quem usava uma arma de outra
 * família não evoluía a skill dela nunca. Para mudar o ritmo de todas de uma vez, é só esta taxa.
 */
export const TAXA_DAS_SKILLS_DE_ATAQUE = { melee: 1.1, distance: 1.1, magic: 1.1 };
const MAGIC_TRIES_BASE = 1600;

/** Tentativas necessárias para ir de `skill` para `skill + 1`. */
export function triesForSkill(skill, value, vocationId) {
  const vocation = VOCATIONS[vocationId] ?? VOCATIONS.none;
  // Melee e Distance: UMA curva para todas as vocações (dono, 03/10: "a dificuldade de subir todas as skills de ataque igual"); o resto (shielding, pesca) segue a vocação.
  const rate = TAXA_DAS_SKILLS_DE_ATAQUE[SKILL_GROUP[skill]] ?? vocation.rates[SKILL_GROUP[skill]] ?? 1.5;
  return Math.round(SKILL_TRIES_BASE * rate ** (value - SKILL_BASE));
}

/*
 * O multiplicador de mana por vocação, amaciado para uma caçada automática.
 *
 * O do servidor é o do Tibia — 1.1 para mago, 1.4 para paladino, 3.0 para
 * knight — e a conta é `1600 * multiplicador ^ magicLevel`. Para o mago isso
 * fecha em minutos por nível; para os outros dois, não fecha nunca: medido em
 * trinta minutos de Amazon Camp, o paladino no ML 20 levaria 6,2 horas por
 * nível e o knight no ML 10 precisaria de 94 MILHÕES de mana, o que dá umas
 * setecentas horas de caçada.
 *
 * No Tibia isso faz sentido: ninguém sobe magic level de knight, e o jogador
 * está lá para bater. Aqui o personagem caça sozinho a noite inteira e o magic
 * level é uma das poucas barras que ele vê andar — uma barra que não anda em
 * três das cinco vocações é uma barra quebrada, não uma escolha de vocação.
 *
 * Então a ORDEM continua a mesma (mago sobe mais rápido que paladino, que sobe
 * mais rápido que knight), só que numa escala que cabe numa noite. Com estes
 * números, e a mana que cada vocação de fato gasta caçando: mago ~5 min por
 * nível no ML 30, paladino ~17 min no ML 20, knight ~30 min no ML 10 (e ~21 h
 * no ML 25, que é o freio natural da exponencial — knight não é para chegar a
 * magic level alto).
 *
 * Para voltar ao servidor, é trocar por `vocation.rates.magic`.
 */
/*
 * O KNIGHT saiu desta lista: a curva dele é a da base (3.0) do primeiro nível.
 * Ver o bloco do `MAGIC_JOELHO`, logo abaixo, para o porquê.
 */
// Magic Level: a mesma taxa de todas as skills de ataque, para toda vocação (o knight e o 'none' também; ver `TAXA_DAS_SKILLS_DE_ATAQUE`).
const MAGIC_IDLE = { sorcerer: 1.1, druid: 1.1, paladin: 1.1, monk: 1.1, knight: 1.1, none: 1.1 };

/*
 * ---- O JOELHO: a curva endurece a partir de um magic level ----
 *
 * O amaciamento acima resolveu o começo e criou outro problema no fim: com 1.2
 * do primeiro ao último nível, o paladino sobe magic level a noite inteira sem
 * nunca encontrar um freio. No Tibia global ele encontra — a base de lá é 1.4, e
 * é por volta do ML 45 que cada nível passa a custar dias em vez de horas. Foi o
 * que o dono viu jogando.
 *
 * Então a curva tem duas partes: até o joelho, a suave que faz a barra andar
 * enquanto o personagem está se formando; do joelho em diante, a do servidor.
 * Ela é CONTÍNUA — o custo no próprio joelho é o mesmo dos dois lados, então
 * ninguém vê um degrau —, e a partir dali cada nível pesa mais que o anterior:
 *
 *     ML 45   5,8 mi de mana      igual nos dois
 *     ML 50    14 mi  →   31 mi   (2,2× mais caro)
 *     ML 60    90 mi  →  910 mi   (10×)
 *     ML 70   558 mi  →   26 bi   (47×)
 *
 * Quem já passou do joelho não perde nada: o que mudou é o preço do PRÓXIMO
 * nível, nunca o que já foi conquistado.
 *
 * ---- E DEPOIS: o knight e o monk ganharam joelho também ----
 *
 * O dono, com os reports na mão: "estão me reportando que knights estão pegando
 * ML 50+ muito fácil... um knight tem que demorar pra pegar ML assim como um
 * mage tem que demorar pra pegar axe. Na minha base, pra um knight pegar ML
 * 15~17 já demora bastante".
 *
 * Ele tem razão, e o banco de produção mostrou o tamanho: 36 knights com ML 50
 * ou mais, o maior em 57. O monk também estava alto — 24 de 78 acima de ML 50 —,
 * mas ele é OUTRO caso, e o bloco do `MAGIC_JOELHO` explica por quê.
 *
 * A causa era o amaciamento acima, que valia do primeiro ao último nível: o
 * knight nunca encontrava freio nenhum. O remédio é o mesmo que o paladino já
 * usava — a curva suave enquanto o personagem se forma, e a DA BASE dali em
 * diante. O joelho fica onde o dono apontou:
 *
 *              ML 15        ML 17        ML 20        ML 50
 *   knight     4,6 mi       41 mi        1,1 bi       impossível
 *   (era)      65 mil       106 mil      223 mil      367 mi
 *
 * Ninguém perde o que já tem: o joelho muda o preço do PRÓXIMO nível, nunca o
 * conquistado. Os knights de ML 57 continuam com 57 — só não sobem mais.
 *
 * O paladino fica como está: ele não foi reportado, e no Tibia o paladino tem
 * magic level de verdade. O mago não tem joelho porque magic level é a
 * profissão dele — e o outro lado da simetria que o dono pediu já valia: as
 * skills de arma do mago são 2.0 na nossa tabela, que é o número da base.
 */
/*
 * Só o paladino tinha joelho. Mago não precisa (magic level é a profissão dele) e
 * knight já é freado pelo 1.28 desde o começo.
 */
/*
 * ---- E o MONK não é um knight: ele é um pouco mais rápido que o paladino ----
 *
 * Report do MonkAdrieel, no mesmo dia da mudança: "essa mudança no ML do Monk
 * aí tá errada; o ML do monk é pouco mais rápido que o do RP — enquanto ML de
 * RP é 40, ML de monk é 50, nessa pegada".
 *
 * Ele está certo, e a base confirma: `manamultiplier` do Monk é 1.3, MENOR que
 * o 1.4 do paladino. Menor quer dizer mais rápido.
 *
 * O erro foi meu e foi de fonte: peguei o multiplicador da nossa tabela, onde
 * o monk estava com 2.0 — um número que não vem do `vocations.xml` — e ainda
 * pus o joelho no ML 12, tratando-o como um knight. O resultado teria sido um
 * monk mais lento que o paladino, que é o contrário do que a base diz.
 *
 * Agora ele tem a MESMA forma do paladino (joelho no 45) com o número dele
 * (1.3), então a partir dali cada nível do monk custa menos que o do paladino —
 * e abaixo do joelho os dois são iguais, como sempre foram.
 *
 * O knight continua com o joelho baixo, e isso não é incoerência: o
 * `manamultiplier` dele é 3.0, o maior da tabela depois do "None". Na base o
 * knight realmente não sobe magic level.
 */
/*
 * ---- E o KNIGHT não tem joelho: ele usa a curva da base desde o ML 1 ----
 *
 * O joelho dele estava no ML 10, com a curva suave antes disso. Parecia
 * suficiente — até o dono aparecer com a conta que faltava:
 *
 *   "tô usando exercise de magic level em um knight com ML 1 e tá pegando ML 15
 *    super rápido".
 *
 * O boneco de treino entrega 500 de mana por golpe, dois golpes e meio por
 * segundo, e essa mana ainda é multiplicada pelas rates do servidor. Medido com
 * o joelho no 10: um knight ia de ML 1 a ML 15 em NOVE SEGUNDOS de exercise. A
 * parte suave da curva era tão barata que o freio nunca chegava a morder.
 *
 * Com a curva da base do começo ao fim, o mesmo exercise sem parar dá:
 *
 *     ML 10    3 minutos
 *     ML 15    12,8 horas
 *     ML 17    4,8 dias
 *     ML 20    129 dias
 *
 * que é exatamente o "pra um knight pegar ML 15~17 já demora bastante" que ele
 * descreveu da base dele.
 *
 * O paladino e o monk CONTINUAM com o joelho, e isso não é incoerência: os
 * `manamultiplier` deles são 1.4 e 1.3, perto do 1.1 do mago. O do knight é
 * 3.0 — o maior da tabela. Na base o knight realmente não sobe magic level, e é
 * a única vocação em que a curva crua já é o comportamento certo.
 */
// Sem joelho (dono, 03/10): o Magic Level de Paladin e Monk sobe na mesma curva das outras skills de ataque.
const MAGIC_JOELHO = {};

/** Mana que precisa ser gasta para subir do magic level atual. */
export function manaForMagicLevel(value, vocationId) {
  const vocation = VOCATIONS[vocationId] ?? VOCATIONS.none;
  const multiplicador = TAXA_DAS_SKILLS_DE_ATAQUE.magic;
  const joelho = MAGIC_JOELHO[vocationId];
  if (joelho && value >= joelho.ml) {
    return Math.round(MAGIC_TRIES_BASE * multiplicador ** joelho.ml * joelho.mult ** (value - joelho.ml));
  }
  return Math.round(MAGIC_TRIES_BASE * multiplicador ** value);
}

// ---------- combate ----------

/**
 * Dano de ataque físico. `attack` vem da arma, `skill` da perícia correspondente.
 *
 * A faixa ANTIGA (a do Tibia, sorteio uniforme; sem `variacao`): `max = 0,085 × ataque × (perícia + 4) + level/5`, `min = level/5` — o mínimo só
 * dependia do level (level 190, ataque 78, perícia 77 davam 38–575, mínimo = 6,6% do máximo).
 *
 * A faixa NOVA (com `variacao`; dono, 02/10 — "se a arma tem 48–61, o mínimo inicial é 48, os modificadores afetam os dois lados"): a faixa de ataque da
 * PRÓPRIA arma (`attackMin`–`attackMax`, a sorteada no drop) passa pela MESMA conta nas duas pontas:
 *     ponta = ataque da ponta × `fatorPericia` × (perícia + 4) + level/5
 * `fatorPericia` é 0,0425 (a metade do 0,085 antigo, porque o sorteio antigo ia de ~0 ao máximo): a MÉDIA do golpe fica igual à de antes. A perícia
 * é um "aumentado" que sobe o mínimo e o máximo; o level/5 é um fixo nas duas pontas. Arma SEM faixa (ataque único, ou punho) não tem mínimo
 * próprio: aí a faixa é a média ± `variacao` (fração: 0,30 = ±30%).
 */
export function attackDamage({ attack, attackMin = null, attackMax = null, skill, level, factor = 1, variacao = null, fatorPericia = 0.0425 }) {
  const piso = Math.floor(level / 5);
  if (variacao == null) {
    const teto = Math.max(1, Math.floor((0.085 * factor * attack * (skill + 4)) + level / 5));
    return { min: Math.min(piso, teto), max: Math.max(teto, 1) };
  }
  const multiplicador = fatorPericia * factor * (skill + 4);
  const lo = attackMin ?? attack;
  const hi = attackMax ?? attack;
  if (hi > lo) {
    const min = Math.max(1, Math.floor(lo * multiplicador + level / 5));
    return { min, max: Math.max(min, Math.floor(hi * multiplicador + level / 5)) };
  }
  const media = attack * multiplicador + level / 5;
  const v = Math.max(0, Math.min(1, Number(variacao) || 0));
  const min = Math.max(1, Math.floor(media * (1 - v)));
  return { min, max: Math.max(min, Math.ceil(media * (1 + v))) };
}

/** Dano mágico base de varinha/bastão, escalando com magic level e nível. */
export function magicDamage({ attack, magicLevel, level }) {
  const base = attack + magicLevel * 1.8 + level / 5;
  return { min: Math.floor(base * 0.6), max: Math.floor(base * 1.25) };
}

/** Quanto a armadura absorve de um golpe (faixa aleatória, como no Tibia). */
export function armorReduction(armor, roll) {
  return Math.floor(armor * (0.6 + roll * 0.6));
}

/**
 * Chance de aparar o golpe CORPO A CORPO (físico — magia e dano elemental não
 * passam por aqui, só pela proteção elemental). Vem do slot do ESCUDO: a
 * defesa dele dá a base (até 12,5%, num escudo de 50) e a perícia shielding a
 * AMPLIFICA (até +300%, do nível 10 ao 140). A defesa da arma também soma (com ou
 * sem escudo); sem nenhuma defesa quem chama passa `null`/0 e é 0% — a perícia
 * sozinha não bloqueia nada.
 * Teto de 50%: só com o melhor escudo (defesa 50) e shielding 140 (~120
 * milhões de golpes recebidos para um knight; as outras vocações nem chegam
 * perto) — na prática o teto é uma meta de fim de jogo, não uma expectativa.
 * Ex.: escudo +14 e shielding 20 -> ~4%; escudo 50 e shielding 100 -> ~38%.
 */
export function blockChance(shielding, shieldDefense) {
  if (shieldDefense == null || !(shieldDefense > 0)) return 0;
  const base = (Math.max(0, shieldDefense) / 50) * 0.125;
  const pericia = Math.min(1, Math.max(0, shielding - 10) / 130);
  return Math.min(0.5, base * (1 + 3 * pericia));
}

/*
 * ---- Nenhum bicho e' IMUNE aqui ----
 *
 * O report: "alguns bixo ta com imunidade nao toma dano, retire".
 *
 * O `monster.lua` do servidor dele marca 2.009 resistencias em 100 — imunidade
 * total. E ele esta certo la: no Tibia a imunidade vem acompanhada de uma
 * MECANICA que a contorna. O Dragonking Zyrtarch e' imune aos dez elementos e
 * so' pode ser ferido depois de a soul stone o prender; Zyrtarch aqui e' um
 * boss de sala com 300.000 de vida e nada que o prenda.
 *
 * O jogador deste jogo bate com UM elemento — o da arma, ou o da escola de
 * magia dele. Contra 100 o cavaleiro nao luta mal: ele nao luta. O numero zero
 * subindo da cabeca do boss por vinte e cinco minutos nao e' dificuldade, e'
 * uma parede que se parece com uma luta.
 *
 * Entao a resistencia tem TETO. Abaixo dele nada muda — 0 a 80 sao 92% das
 * linhas do catalogo e continuam exatamente como o arquivo dele diz. Do teto
 * para cima, "imune" passa a querer dizer "quase imune": o golpe entra por um
 * quinto, a luta fica cinco vezes mais longa, e ela existe.
 *
 * O teto e' UM numero, aqui, para o dono mexer. A fraqueza (negativa) nao tem
 * piso mexido: -100 e' o dobro do dano, e nada nela e' impossivel.
 */
export const RESISTENCIA_MAXIMA = 80;

/*
 * ---- E os BOSSES têm um teto muito mais baixo ----
 *
 * O dono: "tira a resistência dos elementos dos bosses, limite todas pra 20%,
 * porque tem boss que tá 80% de resistência em danos".
 *
 * Trinta das quarenta e quatro salas têm um boss com alguma resistência acima
 * de vinte, e dez deles têm CEM em quase tudo — o Dragonking Zyrtarch tem cem
 * nos dez elementos. Com o teto geral, um golpe de 1.000 virava 200 num boss de
 * 300.000 de vida: a luta não ficava difícil, ficava longa de um jeito que
 * ninguém termina.
 *
 * Vinte por cento é o teto de sala: quatro quintos do golpe entram sempre. A
 * dificuldade do boss passa a ser a vida e o que ele bate, que é o que dá para
 * ler na tela — e não uma parede invisível contra a arma que a pessoa escolheu.
 *
 * É um teto SÓ PARA OS BOSSES DE SALA. O bicho comum continua no de 80: a régua
 * dele é a caçada de horas, onde a resistência alta é o que faz trocar de
 * elemento valer a pena. O pedido falava de boss, e é a boss que ele se aplica.
 */
export const RESISTENCIA_MAXIMA_DE_BOSS = 20;

/** Resistência elemental do monstro: negativo = fraqueza; ver `RESISTENCIA_MAXIMA`. */
export function applyElement(damage, percent = 0) {
  const resistencia = Math.min(RESISTENCIA_MAXIMA, percent);
  return Math.max(0, Math.round(damage * (1 - resistencia / 100)));
}

/*
 * ---- Quanto dura um passo ----
 *
 * A conta e a do servidor de Tibia (`Creature::getStepDuration` e
 * `updateCalculatedStepSpeed`), e ela NAO e linear na velocidade:
 *
 *     stepSpeed = floor(speedA * ln(speed + speedB) + speedC + 0.5)
 *     duracao   = floor(1000 * groundSpeed / stepSpeed)
 *
 * Ela mora aqui, e nao dentro da hunt, porque tem DOIS lugares em que o
 * personagem anda: a caçada e a cidade. A cidade tinha uma conta propria, e a
 * conta dela era a linear antiga — a mesma que na hunt deixava o personagem
 * arrastado. Medido na cidade, passo reto, ja arredondado ao tique de 125ms:
 *
 *     speed 220 -> 750ms pela conta antiga contra 250ms por esta  (3x)
 *     speed 400 -> 375ms contra 250ms
 *     speed 700 -> 250ms contra 125ms                             (2x)
 *
 * Duas contas para a mesma pergunta e' como se conserta uma e a outra fica
 * para tras sem ninguem perceber: foi exatamente o que aconteceu — a hunt foi
 * corrigida e a cidade ficou lenta, sozinha.
 *
 * As tres constantes sao as do servidor, sem arredondar.
 */
export const VELOCIDADE_A = 857.36;
export const VELOCIDADE_B = 261.29;
export const VELOCIDADE_C = -4795.01;

/** A velocidade de chao padrao, como no `world.otbm` dele. */
export const GROUND_SPEED = 100;

/**
 * Quanto dura um passo, em milissegundos.
 *
 * `diagonal` custa o triplo, como no `Creature::getStepDuration`. `tick`
 * arredonda para cima ate a virada do tique de quem chamou: o movimento so
 * acontece la, entao mandar ao cliente uma duracao que nao cai na virada faria
 * o desenho e o servidor discordarem.
 */
export function duracaoDoPasso(speed, { diagonal = false, groundSpeed = GROUND_SPEED, tick = 0 } = {}) {
  const velocidade = Math.max(1, speed);
  const passo =
    velocidade > -VELOCIDADE_B
      ? Math.max(1, Math.floor(VELOCIDADE_A * Math.log(velocidade + VELOCIDADE_B) + VELOCIDADE_C + 0.5))
      : 1;
  const bruto = Math.floor((1000 * groundSpeed) / passo);
  const total = diagonal ? bruto * 3 : bruto;
  return tick > 0 ? Math.ceil(total / tick) * tick : total;
}

/*
 * ---- Quantos bichos o lugar sustenta, quando ninguém disse ----
 *
 * `density` multiplica a leva que o JOGADOR escolhe (cautious 2, bold 5,
 * reckless 8): é a parte da conta que pertence ao MAPA, e não a ele.
 *
 * O padrão era 1, e 1 é pouco: numa leva cautelosa dá dois bichos vivos ao
 * mesmo tempo na caverna inteira, que é o que faz uma hunt recém-importada
 * parecer vazia. As hunts desenhadas à mão já corrigiam isso na régua do editor
 * — a troll-cave saiu com 2, o acampamento das amazonas com 3 —, mas quem
 * importava de fora não tinha como saber que aquele 1 era um número a mexer.
 *
 * Dois é o piso do que já estava afinado à mão, e é por isso que ele é o padrão:
 * não é um chute novo, é o menor dos valores que o dono já tinha escolhido
 * olhando o mapa.
 */
export const DENSIDADE_PADRAO = 2;
