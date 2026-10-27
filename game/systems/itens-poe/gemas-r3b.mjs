// O LOTE R3B das gemas do PoE (27/10: as parciais mais difíceis que sobraram — os lacaios invocados por gatilho, as Sentinelas e as habilidades que outra
// "coisa" usa por você). Aqui ficam os DADOS (o que as linhas dizem, os números do PoB) e as contas puras (sem a caçada); quem usa é gemas-poe.mjs (o status e o
// arquétipo), suportes-poe.mjs (as linhas próprias dos suportes), acoes.mjs (o uso, o acerto, a morte, o tique), cacadas.mjs (o golpe do lacaio) e hunt/combate.mjs
// (a morte e o golpe básico). Este arquivo não importa nada.
//
// A fonte é o PoB (Skills/act_str.lua, act_int.lua, sup_int.lua, minion.lua; Minions.lua):
//   - a ABSOLVIÇÃO e a da INSPIRAÇÃO (act_str.lua Absolution/AbsolutionAltX): o acerto põe a penalidade (base_skill_effect_duration 3000) — o inimigo NÃO-ÚNICO que
//     morre com ela tem o cadáver consumido e vira uma Sentinela da Absolvição pela duração SECUNDÁRIA (15 s), ou renova a duração e a vida de uma em campo se você já
//     tem o máximo (3; 2 na da Inspiração); "absolution_blast_chance_to_summon_on_hitting_rare_or_unique_%" 25 — o acerto num Raro ou Único tem 25% de chance de
//     convocar uma; "Esta Magia e Lacaios Convertem 50%" — a Sentinela também converte (MinionModifier); a qualidade da comum, "minion_cooldown_recovery_+%" 2 por
//     ponto — a recarga das habilidades da Sentinela (a Absolvição Fortalecida: o golpe em área dela, `cacadas`);
//   - o ARAUTO DA PUREZA (act_str.lua HeraldOfPurity): um ARAUTO (o buff com reserva — "Buff concede X% mais Dano Físico"); matar um inimigo com o buff convoca uma
//     Sentinela da Pureza (ou renova a duração e a vida de uma, no máximo — a descrição); o acerto num Raro ou Único tem 20% de chance de convocar uma;
//   - a RELÍQUIA SAGRADA (act_int.lua SummonHolyRelic; minion.lua RelicTriggeredNova): a Relíquia não ataca (skillList: a Nova e o Teleporte); quando VOCÊ acerta um
//     inimigo com um ataque, ela solta a Nova (recarga 0,3 s): o Dano Físico da magia do lacaio (0,8–1,2 × a eficácia do nível dele — `eficaciaDaMagia`), 5% de crítico,
//     "active_skill_area_of_effect_radius_+%_final" −24…0 pelo nível da gema; e o "Holy Relic's Boon" (base_skill_effect_duration 4000) nos aliados no raio: a Vida
//     regenerada por segundo aos Aliados (você — o mod sem applyNotPlayer) e a dos Lacaios (applyMinions); "skill_buff_effect_+%" 2 por qualidade — o Efeito do Buff
//     da Nova. O raio base da Nova não está no PoB nem no poedb: a escolha registrada é 3 m (1 casa e meia — a fração é a chance de mais uma);
//   - o GOLPE SAGRADO (act_str.lua HolyStrike): o ataque corpo a corpo da gema (o "Dano de Ataque: X% de base"), com "Este ataque e lacaios convertem 50% do dano
//     físico em dano elétrico"; ao acertar, convoca o Armamento Sagrado (o máximo, a duração, o alcance — lacaios-poe/gemas-e2a);
//   - o CLAMOR DO GENERAL (act_str.lua GeneralsCry/GeneralsCrySupport): "warcry_gain_mp_from_corpses" — o Poder conta os inimigos E os cadáveres no alcance; convoca 2
//     Guerreiros Ilusórios por cada 5 de Poder, até 5 ("maximum_number_of_spiritual_cry_warriors" 5, +0,05 por qualidade); cada um usa UM dos Ataques corpo a corpo
//     ligados ao Clamor, uma vez, com o "X% menos Dano" do suporte embutido (support_spiritual_cry_damage_+%_final — Damage MORE, só no uso dos Guerreiros);
//   - o ARQUEIRO ILUSÓRIO (o poedb salvo): ao acertar com uma Flecha da suportada, o Arqueiro (máximo 1, 4 s) usa a SUA habilidade com 60% menos Velocidade de Ataque e
//     X% menos Dano; ele usa os Ataques Ativados como se não fossem Ativados;
//   - os ESPÍRITOS SAGRADOS (sup_int.lua SupportSacredWisps/SummonSacredWisp): o acerto da suportada convoca 2 Espíritos (máximo 2, 10 s); quando você dispara um
//     Projétil da suportada, cada Espírito tem 25% de chance (+25% com um Raro ou Único na sua Presença) de usar a habilidade, com "skill_used_by_sacred_wisp_damage_+%_final"
//     (−60…−51) — só no uso deles; só com Varinhas;
//   - o RELÂMPAGO VIVO (sup_int.lua TriggeredSupportLivingLightning; minion.lua SummonedLivingLightningZap; Minions.lua LivingLightningMinion): o acerto da suportada que
//     causa Dano de Raio ativa a invocação (recarga 0,2 s, 5 usos); 1 por vez, máximo 5–8 pelo nível, 5 s; o lacaio converte 100% do Físico em Raio, ataca 3 vezes
//     (+0,1 por qualidade) e some; o golpe dele (cooldown 0,25 s, +8% de crítico base) Ricocheteia 3 vezes (MinionModifier ChainCountMax); não pode ser atingido;
//   - o NASCIDO DA COLMEIA (sup_int.lua SupportHiveborn/TriggeredSupportHiveborn; Minions.lua Hiveborn): a Oferenda suportada que você usa ativa a invocação (recarga
//     5 s): 3–5 pelo nível (nível do lacaio 72–76), máximo 12 (+0,1 por qualidade), 10 s, no raio de 4,5 m em volta de você; todo o Físico deles vira Gelo; 20% de
//     chance de Cobrir de Gelo ao acertar ("cover_in_frost_on_hit_%").

const norm = (t) => String(t ?? '').replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const N = String.raw`([\d.]+)`;
const num = (x) => Number(String(x).replace(',', '.')) || 0;
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return num(m[g]); } return null; };

// ---------------------------------------------------------------- as Sentinelas (a Absolvição e o Arauto da Pureza)

const RE = {
  absChance: new RegExp(`^${N} % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único$`, 'i'),
  absMaximo: /^Máximo de \d+ Sentinelas da Absolvição invocadas$/i,
  absConversao: /^Esta Magia e Lacaios Convertem [\d.]+ % do Dano Físico para Dano de Raio$/i,
  recargaLacaios: new RegExp(`^Lacaios têm Recuperação da Recarga aumentada em ${N} %$`, 'i'),
  purezaMatar: /^Convoca um Sentinela da Pureza quando você Matar um Inimigo$/i,
  purezaChance: new RegExp(`^${N} % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único$`, 'i'),
  purezaMaximo: /^Máximo de \d+ Sentinelas? da Pureza Convocad[oa]s?$/i,
  duracao: new RegExp(`^Duração base é de ${N} segundos?$`, 'i'),
  maisVida: new RegExp(`^Lacaios têm ${N} % mais Vida Máxima$`, 'i'),
  maisDanoFisico: new RegExp(`^Lacaios causam ${N} % mais Dano Físico$`, 'i'),
  // (a coluna do poedb "Lacaios causam 100 % de Dano Físico" — o mesmo stat do "mais Dano Físico", mal rotulada; o PoB não tem outra linha)
  colunaDanoFisico: new RegExp(`^Lacaios causam ${N} % de Dano Físico$`, 'i'),
  // a Relíquia Sagrada
  novaAliados: new RegExp(`^A Habilidade Explosiva da Relíquia Sagrada concede ${N} de Vida regenerada por segundo aos Aliados$`, 'i'),
  novaLacaios: new RegExp(`^A Habilidade Explosiva da Relíquia Sagrada concede ${N} de Vida regenerada por segundo aos Lacaios$`, 'i'),
  efeitoDoBuff: new RegExp(`^Efeito do Buff aumentado em ${N} %$`, 'i'),
  // o Golpe Sagrado
  hsConversao: new RegExp(`^Este ataque e lacaios convertem ${N} % do dano físico em dano elétrico$`, 'i'),
  hsMaximo: /^Máximo de \d+ Armamentos Sagrados$/i,
  hsMenos: /^Lacaios causam -?[\d.]+ % (?:menos|mais) Dano$/i,
  hsAlcance: /^\+[\d.]+ metros para o alcance do golpe corpo a corpo do lacaio$/i,
  // o Clamor do General
  gcPoder: /^Conta o Poder total de Inimigos e Cadáveres no Alcance$/i,
  gcConvoca: new RegExp(`^Convoca ${N} Guerreiros Ilusórios por cada ${N} de Poder, até ${N}, que usam os Ataques conectados uma vez$`, 'i'),
  gcMaximo: new RegExp(`^\\+${N} ao número máximo de Guerreiros Ilusórios$`, 'i'),
  gcMenos: new RegExp(`^Habilidades Suportadas causam ${N} % menos Dano$`, 'i'),
};

/** As gemas de SENTINELA do lote: o slug → o que o acerto num Raro/Único e a morte fazem. */
export const ABSOLVICAO = /^Absolution(_of_Inspiring)?$/;
export const PUREZA = 'Herald_of_Purity';
/** (o PoB) a duração da penalidade da Absolvição (base_skill_effect_duration), em ms */
export const PENALIDADE_ABSOLVICAO_MS = 3000;
/** A chance de convocar uma Sentinela ao acertar um Raro ou Único (a Absolvição: 25; o Arauto da Pureza: 20), pelas linhas do nível; 0 sem a linha. */
export const chanceDeSentinelaNoRaro = (slug, linhas = []) => (ABSOLVICAO.test(String(slug ?? '')) ? achar(linhas, RE.absChance) : slug === PUREZA ? achar(linhas, RE.purezaChance) : null) ?? 0;
/** O Raro ou Único (o Chefe também) — o critério das outras gemas. */
export const raroOuUnico = (b) => !!b && (/raro|unico/.test(String(b.raridade ?? b.raridadePoe ?? '')) || !!b.boss || !!b.chefe);
/** O Único (o Chefe também): a penalidade da Absolvição não convoca no Único. */
export const unico = (b) => !!b && (/unico/.test(String(b.raridade ?? b.raridadePoe ?? '')) || !!b.boss || !!b.chefe);
/** A penalidade da Absolvição no monstro (`b.r3bAbsolvicao = { ate, acao }`): ativa agora? */
export const comPenalidadeDaAbsolvicao = (b, agora) => !!b?.r3bAbsolvicao && (b.r3bAbsolvicao.ate ?? 0) > agora;
/**
 * Convocar ou RENOVAR (a descrição das duas gemas: "ou atualizará a duração e vida de um existente ao invés caso você possua o número máximo deles"): com `vivos`
 * (os lacaios da gema em campo) no `maximo`, renova o que acaba antes; senão, convoca. Devolve `{ renovar: lacaio }` ou `{ convocar: true }`.
 */
export function convocarOuRenovar(vivos = [], maximo = 1) {
  if (vivos.length < Math.max(1, maximo)) return { convocar: true };
  const r = [...vivos].sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity))[0];
  return { renovar: r };
}
/** A conversão da SENTINELA da Absolvição ("Esta Magia e Lacaios Convertem X% do Dano Físico para Dano de Raio" — o MinionModifier do PoB): `{ energy: X }`, ou null. */
export function conversaoDaSentinela(slug, linhas = []) {
  if (!ABSOLVICAO.test(String(slug ?? ''))) return null;
  const pct = achar(linhas, /^Esta Magia e Lacaios Convertem ([\d.]+) % do Dano Físico para Dano de Raio$/i);
  return pct > 0 ? { energy: pct } : null;
}

// ---------------------------------------------------------------- a Relíquia Sagrada

/** (o PoB, minion.lua RelicTriggeredNova) a Nova: 0,8–1,2 × a eficácia, a eficácia da magia de lacaio, a recarga, o crítico, a duração do Boon e o raio por nível */
export const NOVA = Object.freeze({
  base: [0.80000001192093, 1.2000000476837], baseEf: 1.1052000522614, incEf: 0.057900000363588, recargaMs: 300, crit: 5, duracaoMs: 4000,
  // (escolha registrada — sem fonte no PoB nem no poedb) o raio base da Nova
  raioM: 3,
  // active_skill_area_of_effect_radius_+%_final nos níveis 1–20 da gema
  raioFinalPct: [-24, -23, -22, -20, -19, -18, -17, -15, -14, -13, -12, -10, -9, -8, -7, -5, -4, -3, -2, 0, 1],
});
/** A eficácia de uma magia de lacaio do PoB no nível `n` (statInterpolation 3 — a mesma de `lacaios-poe.eficaciaDaMagiaDoPob`). */
export const eficaciaDaMagia = (n, baseEf, incEf) => (3.885209 + 0.360246 * (Math.max(1, n) - 1)) * baseEf * (1 + incEf) ** (Math.max(1, n) - 1);
/**
 * A Nova da Relíquia Sagrada: `{ min, max, crit, recargaMs, raioM, duracaoMs, regenAliados, regenLacaios, efeitoPct }` — o dano pelo nível do LACAIO (`nivelDoLacaio`),
 * o raio pelo nível da GEMA, a regeneração e o Efeito do Buff pelas linhas do nível e da qualidade; null sem as linhas da Nova.
 */
export function novaDasLinhas(linhas = [], linhasQ = [], nivelDaGema = 1, nivelDoLacaio = 1) {
  const aliados = achar(linhas, RE.novaAliados);
  const lacaios = achar(linhas, RE.novaLacaios);
  if (aliados == null && lacaios == null) return null;
  const ef = eficaciaDaMagia(nivelDoLacaio, NOVA.baseEf, NOVA.incEf);
  const i = Math.max(1, Math.min(NOVA.raioFinalPct.length, Math.round(nivelDaGema) || 1)) - 1;
  return {
    min: NOVA.base[0] * ef, max: NOVA.base[1] * ef, crit: NOVA.crit, recargaMs: NOVA.recargaMs, raioM: NOVA.raioM * (1 + NOVA.raioFinalPct[i] / 100), duracaoMs: NOVA.duracaoMs,
    regenAliados: aliados ?? 0, regenLacaios: lacaios ?? 0, efeitoPct: achar(linhasQ, RE.efeitoDoBuff) ?? 0,
  };
}
/** A Relíquia Sagrada não ataca (o PoB: a skillList dela é a Nova e o Teleporte). */
export const RELIQUIA = 'Summon_Holy_Relic';
export const lacaioSemAtaque = (slug) => slug === RELIQUIA;

// ---------------------------------------------------------------- o Golpe Sagrado

export const GOLPE_SAGRADO = 'Holy_Strike';
/** O Golpe Sagrado é um ATAQUE corpo a corpo que invoca ao acertar (antes, a gema só invocava): o arquétipo do lote. */
export const ARQUETIPO_R3B = { [GOLPE_SAGRADO]: 'corpo_a_corpo', [PUREZA]: 'arauto' };
/** A conversão do Físico do ATAQUE da gema ("Este ataque e lacaios convertem X% do dano físico em dano elétrico"): `{ energy: X }`, ou null. */
export function conversaoDoAtaque(slug, linhas = []) {
  if (slug !== GOLPE_SAGRADO) return null;
  const pct = achar(linhas, RE.hsConversao);
  return pct > 0 ? { energy: pct } : null;
}

// ---------------------------------------------------------------- o Clamor do General

export const CLAMOR_DO_GENERAL = 'Generals_Cry';
/** (o PoB) os Guerreiros Ilusórios: 5 no máximo de base, +0,05 por qualidade (a linha da qualidade já traz o número) */
export const GUERREIROS = Object.freeze({ maximoBase: 5, porQualidade: 0.05 });
/** (escolha registrada — o PoB não dá o Poder do cadáver: "warcry_gain_mp_from_corpses") cada cadáver no alcance vale 1 de Poder, como um inimigo Normal. */
export const PODER_DO_CADAVER = 1;
/** O alcance do Poder do Clamor em casas (o mesmo de `ModsPoe.poderDoClamor`: os inimigos a até 6 casas). */
export const CASAS_DO_PODER = 6;
/** Os Guerreiros do Clamor: `{ porCada, cada, maximo, menosPct }` pelas linhas do nível e da qualidade, ou null. */
export function guerreirosDasLinhas(linhas = [], linhasQ = []) {
  const m = (linhas ?? []).map((l) => RE.gcConvoca.exec(norm(l))).find(Boolean);
  if (!m) return null;
  const extra = Math.floor((achar(linhasQ, RE.gcMaximo) ?? 0) + 1e-9);
  return { porCada: num(m[1]), cada: Math.max(1, num(m[2])), maximo: Math.floor(num(m[3])) + extra, menosPct: achar(linhas, RE.gcMenos) ?? 0 };
}
/** Quantos Guerreiros com `poder`: `porCada` por cada `cada` de Poder, até o máximo. */
export const quantosGuerreiros = (g, poder) => (g ? Math.max(0, Math.min(g.maximo, Math.floor(Math.max(0, poder) / g.cada) * g.porCada)) : 0);

// ---------------------------------------------------------------- os suportes (as linhas próprias — `suportes-poe.efeitoNoNivel`)

/** A RECARGA com usos ("Recarga: 0.20 seg (5 Times)") e o tempo de conjuração dos suportes que concedem a habilidade: a recarga é da habilidade concedida. */
const RECARGA = new RegExp(`^Recarga: ${N} seg(?:\\s*\\((\\d+) Times\\))?`, 'i');
/**
 * As linhas dos suportes do lote, lidas como do SUPORTE (as regras gerais as leriam como da suportada — o "menos Dano" do Arqueiro Ilusório valia sempre na sua):
 *   - o Arqueiro Ilusório: `arqueiroIlusorio`, `arqueiroMax`, `arqueiroMs`, `arqueiroMenosVelPct`, `arqueiroMenosDanoPct`;
 *   - os Espíritos Sagrados: `espiritosSagrados`, `espiritosN`, `espiritosMax`, `espiritosMs`, `espiritosChance`, `espiritosChanceRaro`, `espiritosMenosDanoPct`, `soVarinha`;
 *   - o Relâmpago Vivo: `relampagoVivo`, `relampagoN`, `relampagoMax`, `relampagoMs`, `relampagoAtaques`, `relampagoRicochetes`, `relampagoConvPct`, `relampagoRecargaMs`,
 *     `relampagoUsos`;
 *   - o Nascido da Colmeia: `colmeia`, `colmeiaN`, `colmeiaMax`, `colmeiaMs`, `colmeiaRaioM`, `colmeiaGeloPct`, `colmeiaRecargaMs`.
 */
export const PROPRIAS_R3B = {
  Mirage_Archer_Support: [
    [/^Máximo de (\d+) Arqueiros? Ilusórios? Convocados?$/i, (m, e) => { e.arqueiroMax = num(m[1]); }],
    [/^Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade(?:\\n|\s)+Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados$/i, (m, e) => { e.arqueiroIlusorio = 1; }],
    [new RegExp(`^Arqueiro Ilusório utiliza Habilidades Suportadas com ${N}% menos Velocidade de Ataque$`, 'i'), (m, e) => { e.arqueiroMenosVelPct = num(m[1]); }],
    [new RegExp(`^Arqueiro Ilusório dura ${N} segundos?$`, 'i'), (m, e) => { e.arqueiroMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Arqueiro Ilusório causa ${N}% menos Dano com Habilidades Suportadas$`, 'i'), (m, e) => { e.arqueiroMenosDanoPct = num(m[1]); }],
  ],
  Sacred_Wisps_Support: [
    [new RegExp(`^Habilidades Suportadas causam ${N}% menos Dano quando usadas por Espíritos Sagrados$`, 'i'), (m, e) => { e.espiritosMenosDanoPct = num(m[1]); }],
    [/^Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar$/i, (m, e) => { e.espiritosSagrados = 1; }],
    [/^Habilidades Suportadas só podem ser usadas com Varinhas$/i, (m, e) => { e.soVarinha = 1; }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.espiritosMs = Math.round(num(m[1]) * 1000); }],
    [/^Convoca (\d+) Espíritos Sagrados(?:\\n|\s)+Máximo de (\d+) Espíritos Sagrados$/i, (m, e) => { e.espiritosN = num(m[1]); e.espiritosMax = num(m[2]); }],
    [new RegExp(`^Espíritos Sagrados têm ${N}% de chance de usar a Habilidade Ativadora quando voc\\S+ disparar um(?:\\\\n|\\s)+Projétil com tal Habilidade$`, 'i'), (m, e) => { e.espiritosChance = num(m[1]); }],
    [new RegExp(`^Espíritos Sagrados têm \\+${N}% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença$`, 'i'), (m, e) => { e.espiritosChanceRaro = num(m[1]); }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  Living_Lightning_Support: [
    [/^Ativa Invocar Relâmpago Vivo quando uma habilidade(?:\\n|\s)+de reforço causa dano elétrico com o acerto$/i, (m, e) => { e.relampagoVivo = 1; }],
    [/^Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto$/i, (m, e) => { e.relampagoVivo = 1; }],
    [new RegExp(`^Lacaios convertem ${N}% do Dano Físico para Dano de Raio$`, 'i'), (m, e) => { e.relampagoConvPct = num(m[1]); }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.relampagoMs = Math.round(num(m[1]) * 1000); }],
    [/^Máximo de (\d+) Lacaios Relâmpagos Vivos$/i, (m, e) => { e.relampagoMax = num(m[1]); }],
    [/^Invoca (\d+) Lacaios Relâmpagos Vivos$/i, (m, e) => { e.relampagoN = num(m[1]); }],
    [/^Lacaios Relâmpagos Vivos atacam (\d+) vezes antes de desaparecerem$/i, (m, e) => { e.relampagoAtaques = num(m[1]); }],
    [new RegExp(`^Lacaios Relâmpagos Vivos atacam \\+${N} vezes antes de desaparecerem$`, 'i'), (m, e) => { e.relampagoAtaquesQ = num(m[1]); }],
    [/^Habilidades dos Lacaios Ricocheteiam \+(\d+) Vezes$/i, (m, e) => { e.relampagoRicochetes = num(m[1]); }],
    [RECARGA, (m, e) => { e.relampagoRecargaMs = Math.round(num(m[1]) * 1000); e.relampagoUsos = m[2] ? Number(m[2]) : 1; }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
  Hiveborn_Support: [
    [/^Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar$/i, (m, e) => { e.colmeia = 1; }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.colmeiaMs = Math.round(num(m[1]) * 1000); }],
    [/^Máximo de (\d+) Nascido\(s\) da Colmeia$/i, (m, e, q) => { if (q) e.colmeiaMaxQ = num(m[1]); else e.colmeiaMax = num(m[1]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.colmeiaRaioM = num(m[1]); }],
    [/^Invoca (\d+) Nascido\(s\) da Colmeia$/i, (m, e) => { e.colmeiaN = num(m[1]); }],
    [new RegExp(`^Lacaios têm ${N}% de chance de cobrir os inimigos de gelo ao atingir$`, 'i'), (m, e) => { e.colmeiaGeloPct = num(m[1]); }],
    [RECARGA, (m, e) => { e.colmeiaRecargaMs = Math.round(num(m[1]) * 1000); }],
    [/^Tempo de Conjuração:/i, () => {}],
  ],
};
/**
 * Os lacaios dos suportes (o PoB): o Relâmpago Vivo — o golpe (SummonedLivingLightningZap: cooldown 0,25 s, +8% de crítico base sobre os 5%); o Nascido da Colmeia — o nome
 * (o PoB: "It That Crawls") e o Cobrir de Gelo dele (a duração de sempre do jogo, 4 s — `mods-poe`, o Coberto de Gelo).
 */
// (correções R3: `golpeMs` é a RECARGA do golpe — o piso do intervalo, não o intervalo; o intervalo é o attackTime do PoB, 1,17 s)
export const RELAMPAGO = Object.freeze({ nome: 'Relâmpago Vivo', golpeMs: 250, critico: 13 });
export const NASCIDO = Object.freeze({ nome: 'Nascido da Colmeia', cobrirDeGeloMs: 4000 });
/** Os níveis dos lacaios dos suportes (o PoB): o Nascido da Colmeia — base_display_minion_actor_level 72/74/76… pelo nível do suporte. */
export const NIVEL_DO_NASCIDO = [72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 91, 92, 93, 94, 95];
/**
 * O que o lote completa no efeito do suporte depois das linhas (`suportes-poe.efeitoNoNivel`): o nível do lacaio (o Relâmpago Vivo — o RequerNível do suporte, como o
 * PoB faz sem `display_minion_actor_level`; o Nascido — a tabela do PoB) e os totais (os ataques e o máximo com a qualidade).
 */
export function completarEfeito(slug, efeito, nivel = 1, requer = 1) {
  if (slug === 'Living_Lightning_Support' && efeito.relampagoVivo) {
    efeito.relampagoNivel = Math.max(1, Number(requer) || 1);
    efeito.relampagoAtaques = (efeito.relampagoAtaques ?? 3) + Math.floor((efeito.relampagoAtaquesQ ?? 0) + 1e-9);
    delete efeito.relampagoAtaquesQ;
  }
  if (slug === 'Hiveborn_Support' && efeito.colmeia) {
    efeito.colmeiaNivel = NIVEL_DO_NASCIDO[Math.max(1, Math.min(NIVEL_DO_NASCIDO.length, Math.round(nivel) || 1)) - 1];
    efeito.colmeiaMax = (efeito.colmeiaMax ?? 12) + Math.floor((efeito.colmeiaMaxQ ?? 0) + 1e-9);
    delete efeito.colmeiaMaxQ;
  }
  return efeito;
}

// ---------------------------------------------------------------- as contas dos que usam a SUA habilidade

/** O tempo entre os usos do Arqueiro Ilusório: o seu tempo de uso ÷ (1 − X%) (o "X% menos Velocidade de Ataque" — um "mais" negativo na velocidade). */
export const intervaloDoArqueiro = (usoMs, menosVelPct = 60) => Math.round(Math.max(1, usoMs) / Math.max(0.05, 1 - (Number(menosVelPct) || 0) / 100));
/** (escolha registrada — PoE 1 não publica a Presença dos Espíritos) a "sua Presença": a até 2 casas (4 m) de você. */
export const CASAS_DA_PRESENCA = 2;
/** A chance de cada Espírito usar a habilidade agora: a de base + a do Raro/Único na sua Presença. */
export const chanceDoEspirito = (ef, raroPerto) => Math.min(100, (ef?.espiritosChance ?? 25) + (raroPerto ? ef?.espiritosChanceRaro ?? 25 : 0));

// ---------------------------------------------------------------- utilidades da grade e da recarga

/** Um raio em metros em casas (1 casa = 2 m): a parte inteira e a fração como chance de mais uma. */
export const casasDoRaio = (metros, rng = Math.random) => Math.floor(Math.max(0, metros) / 2) + (rng() < (Math.max(0, metros) / 2) % 1 ? 1 : 0);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Os SALTOS do ricochete do lacaio (`n` saltos a até `distancia` casas, sem repetir): a partir de `alvo`, o vivo mais perto do último. Devolve os novos alvos. */
export function saltosDoRicochete(alvo, vivos = [], n = 0, distancia = 2) {
  const fora = new Set([alvo]);
  const saida = [];
  let ultimo = alvo;
  for (let k = 0; k < n; k++) {
    let melhor = null;
    for (const b of vivos) if (!fora.has(b) && b.hp > 0 && cheb(ultimo, b) <= distancia && (!melhor || cheb(ultimo, b) < cheb(ultimo, melhor))) melhor = b;
    if (!melhor) break;
    fora.add(melhor);
    saida.push(melhor);
    ultimo = melhor;
  }
  return saida;
}
/** A recarga com USOS guardados (a Nova, o Relâmpago Vivo, a Colmeia): gasta um, se houver. `s` é o estado do lote (`hunt.poeR3B`). */
export function gastarUso(s, chave, recargaMs, usos = 1, agora = 0) {
  if (!s) return false;
  const r = (s.recargas ??= {})[chave] ?? { n: usos, em: agora };
  if (r.n < usos && recargaMs > 0) {
    const ganhos = Math.floor((agora - r.em) / recargaMs);
    if (ganhos > 0) { r.n = Math.min(usos, r.n + ganhos); r.em = r.n >= usos ? agora : r.em + ganhos * recargaMs; }
  }
  s.recargas[chave] = r;
  if (r.n < 1) return false;
  if (r.n >= usos) r.em = agora;
  r.n -= 1;
  return true;
}
/** As casas livres em volta de `c` a até `raio` casas (no mesmo andar — `andavel`, o conjunto "x,y"; `ocupadas`, idem), da mais perto para a mais longe. */
export function casasEmVolta(c, raio = 1, andavel = null, ocupadas = new Set()) {
  const lista = [];
  for (let dx = -raio; dx <= raio; dx++) for (let dy = -raio; dy <= raio; dy++) {
    const k = `${c.x + dx},${c.y + dy}`;
    if ((dx || dy) && (!andavel || andavel.has(k)) && !ocupadas.has(k)) lista.push({ x: c.x + dx, y: c.y + dy, d: Math.max(Math.abs(dx), Math.abs(dy)) });
  }
  return lista.sort((a, b) => a.d - b.d);
}

// ---------------------------------------------------------------- o status (as linhas que o lote faz)

/**
 * A linha das ATIVAS do lote que sai de "efeito não simulado" (`gemas-poe.ehLinhaFeita` e o status dos lacaios): a Absolvição (o acerto no Raro/Único, o máximo, a
 * conversão dos lacaios, a recarga deles), o Arauto da Pureza (as Sentinelas, a vida e o dano delas, a duração, a coluna mal rotulada, a recarga), a Relíquia Sagrada
 * (a Nova e o Efeito do Buff dela), o Golpe Sagrado (o ataque e o lacaio) e o Clamor do General (o Poder com os cadáveres, os Guerreiros, o máximo).
 */
export function ehLinhaR3B(slug, l) {
  const s = String(slug ?? '');
  const t = norm(l);
  if (ABSOLVICAO.test(s)) return [RE.absChance, RE.absMaximo, RE.absConversao, RE.recargaLacaios].some((re) => re.test(t));
  if (s === PUREZA) return [RE.purezaMatar, RE.purezaChance, RE.purezaMaximo, RE.duracao, RE.maisVida, RE.maisDanoFisico, RE.colunaDanoFisico, RE.recargaLacaios].some((re) => re.test(t));
  if (s === RELIQUIA) return [RE.novaAliados, RE.novaLacaios, RE.efeitoDoBuff].some((re) => re.test(t));
  if (s === GOLPE_SAGRADO) return [RE.hsConversao, RE.hsMaximo, RE.hsMenos, RE.hsAlcance, RE.duracao].some((re) => re.test(t));
  if (s === CLAMOR_DO_GENERAL) return [RE.gcPoder, RE.gcConvoca, RE.gcMaximo, RE.gcMenos].some((re) => re.test(t));
  return false;
}
/**
 * O que o lote ainda não faz ou o que é a limitação do idle (vai nos motivos do status): as gemas que agora convocam lacaios por outro caminho (o Armamento do Golpe Sagrado,
 * a Sentinela da Absolvição e a da Pureza) têm a mesma limitação documentada de todo lacaio do jogo — ele ataca do jeito do tipo dele (o texto é o das gemas de lacaio).
 */
const LACAIO_DO_IDLE = 'o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro';
export const MOTIVOS_R3B = { [GOLPE_SAGRADO]: [LACAIO_DO_IDLE], [PUREZA]: [LACAIO_DO_IDLE], Absolution: [LACAIO_DO_IDLE], Absolution_of_Inspiring: [LACAIO_DO_IDLE] };
