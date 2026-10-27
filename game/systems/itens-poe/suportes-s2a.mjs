// O LOTE S2A dos SUPORTES do PoE (27/10: a primeira metade dos suportes parciais que sobraram — os que pedem mecânica nova). Aqui ficam as REGRAS das linhas
// (o que cada linha do suporte vira no efeito do uso — `suportes-poe.efeitoNoNivel`, antes das regras gerais) e as contas puras; o que mexe na caçada fica em
// `suportes-s2a-jogo.mjs` (este arquivo não importa nada: `suportes-poe.mjs` o lê no carregamento).
//
// Tudo pela regra do PoE 1 (o PoB — Modules/ConfigOptions.lua, CalcPerform.lua, ModParser.lua — e, para os suportes de Força e Destreza, que não estão na cópia
// do PoB, as linhas do poedb salvo em `gamedata/itens-poe/suportes-poe.json`):
//   - o EXCOMUNGAR: "excomungam os inimigos ao atingir corpo a corpo por 3 segundos" — o Excomungado do jogo (`estados.excomungado`: o inimigo não causa dano de
//     Caos — o PoB: Excommunicated → ChaosDamage MORE −100, CalcPerform.lua:821), pela duração × a Duração da Habilidade;
//   - o TOQUE DEFINHADOR: "25% de chance de causar Definhado ao Acertar" por "2 segundos" (o Definhamento do jogo — +6% de Caos sofrido por acúmulo, até 15) e o
//     "29% de Dano Físico como Dano de Caos Extra" (o `phys_as_extra_chaos` do uso);
//   - a SANTIFICAÇÃO: "infligem Chama Santificada ao atingir corpo a corpo" (a mesma Chama do Marechal da Divindade — `porChamaSantificada`) com a
//     "Intensidade … aumentada em X%" (o `chama_santificada_efeito`, somado ao das peças);
//   - o ROMPIMENTO: o Golpe Crítico que inflige Sangramento também inflige Rompimento (o PoB: "Rupture applies more bleed damage and faster bleeds for 3 seconds,
//     up to 4 stacks" — ConfigOptions.lua:1795): cada acúmulo dura 3 s, até 4; no alvo, o Sangramento causa X% mais dano por acúmulo e expira Y% mais rápido por
//     acúmulo (o mesmo dano total em menos tempo — o "BleedFaster" do PoB: o pulso × (1 + Y% × n));
//   - o TRAUMATISMO (o suporte): o mesmo Traumatismo do Esmagar Ossos (`GemasC2.ganharTrauma` — +1 na primeira vez que cada ataque acerta, cada um com os seus
//     6,9 s × a Duração, e o Físico em você por Traumatismo a cada ganho), com o "X a Y de Dano de Ataque Físico Adicional por Traumatismo" e a "Duração do
//     Atordoamento aumentada em X% por Traumatismo" pelos Traumatismos de agora;
//   - a INSPIRAÇÃO: uma Carga de Inspiração a cada uso que gasta Mana (até 5 — o PoB: InspirationChargesMax = maximum_righteous_charges, CalcSetup.lua:37);
//     "Chance de Golpe Crítico aumentada em 8% por Carga" e "5% mais Dano Elemental por Carga" (antes, 5% mais fixo em todo o dano); "Perca todas … após Gastar
//     um total de 800 de Mana" (o gasto das habilidades suportadas soma; no limite, as cargas zeram e a conta recomeça);
//   - a FONTE DE VIDA: "Ganha Fonte de Vida após Gastar um total de X de Vida" no custo das habilidades suportadas (a conta recomeça a cada ganho), por "4
//     segundos" (+2 da qualidade) × a Duração; o buff dá "20% de Recuperação de Vida dos Frascos aumentada" (o PoB: Lifetap → FlaskLifeRecovery INC 20,
//     ConfigOptions.lua:997) e o "X% mais Dano enquanto você tiver Fonte de Vida" só vale com ele (antes, sempre);
//   - o COMBATE PRÓXIMO: o acerto dá o Ímpeto de Combate (2 s × a Duração); com ele, o próximo uso de uma Habilidade de Deslocamento de ataque NÃO suportada pelo
//     Combate Próximo tem "20% mais Velocidade de Ataque" (o PoB: "Combat Rush grants 20% more Attack Speed to Travel Skills not Supported by Close Combat"); usar
//     qualquer Habilidade de Deslocamento tira o Ímpeto;
//   - as ARMADILHAS MÚLTIPLAS e as AGRUPADAS: "Efeito em Área da Ativação de Armadilhas aumentado em 20%" — o raio de ativação da Armadilha (1 casa) × √(1 + X%),
//     a fração como chance de uma casa a mais, sorteada ao plantar;
//   - o CHAMADO ABENÇOADO: o Clamor suportado cria o Solo Sagrado (o "chão consagrado") em volta de você por 6 s × a Duração, tem "−40% de área de efeito" (o
//     "aumentado" negativo, somado ao das peças no raio do Clamor) e a "velocidade de recarga reduzida em 20%" (a recuperação da recarga);
//   - o MARCAR AO ACERTAR: a Marca suportada é Ativada quando você Acerta um Inimigo Raro ou Único com um Ataque (a recarga de 4 s do suporte) e o "Efeito das
//     Marcas … reduzido em X%" / "aumentado em Y%" (a qualidade) vai no efeito da Marca;
//   - o CLAMOR CORROMPEDOR: o Clamor suportado inflige 4 Sangues Corrompidos em cada inimigo no raio dele (o Sangue Corrompido do jogo — Físico degenerativo,
//     até 10 acúmulos, cada um com a sua duração; não é Sangramento), cada um com "691.8 de Dano Físico base por segundo" pela conta do degenerativo (os
//     multiplicadores e o "aumentado" do Físico e do degenerativo, o "mais" degenerativo do suporte) por "2 segundos" × a Duração; e cada ataque que ele Impelir
//     inflige mais 1 no primeiro inimigo que acertar;
//   - o ESTANDARTE ENSANGUENTADO: o Estandarte suportado, plantado, inflige 1 Sangue Corrompido a cada segundo em cada inimigo na área dele, com "X de dano físico
//     base por segundo por bravura consumida" (o Valor consumido ao plantar) por "8 segundos" × a Duração;
//   - a FLECHA FORJADA COM MANA: os Ataques de Arco suportados são Ativados quando a Mana gasta no custo de OUTROS Ataques de Arco seus (os não suportados por ela)
//     passa de 300% do custo de Mana deles (a conta zera a cada Ativação; a recarga de 0,5 s do suporte); "1% mais Dano com Acertos e Afecções por cada 1 de Custo
//     de Mana" (o custo de Mana do uso suportado);
//   - o COMPANHEIRISMO: enquanto os lacaios da habilidade suportada forem os seus ÚNICOS lacaios (os totens e o mercenário não contam — no PoE não são lacaios),
//     15% do dano dos Ataques que acertam você sai da Vida do mais perto deles antes da sua (o mesmo desvio do "X% do Dano dos Acertos é sofrido pela Vida dos
//     Espectros antes de você") e eles sofrem "−28% de dano" (o "aumentado" negativo, × no dano que chega neles);
//   - o DECAPITAR: o golpe final da Habilidade de Golpe suportada com arma corpo a corpo num Raro dá um dos Modificadores dele por 20 s (o mesmo sorteio do
//     Aprendizado Inspirado — `ModsPoe.aprenderDoRaro`: só os modificadores que têm um equivalente em você; o mesmo modificador renova o tempo).

const N = '(-?\\d+(?:[.,]\\d+)?)';
const num = (x) => parseFloat(String(x).replace(',', '.'));

/** O ROMPIMENTO no alvo (o PoB): 3 s cada acúmulo, até 4. */
export const ROMPIMENTO = Object.freeze({ duracaoMs: 3000, maximo: 4 });
/** As Cargas de INSPIRAÇÃO (o PoB: maximum_righteous_charges). */
export const INSPIRACAO = Object.freeze({ maximo: 5 });

/**
 * As REGRAS do lote (`[regex, (m, texto, ativa) → { chave: valor } | null]`, o formato de `suportes-poe.REGRAS`): entram ANTES das gerais, que pegavam o começo de
 * algumas ("5% mais Dano Elemental por Carga de Inspiração" virava 5% mais em todo o dano).
 */
export const REGRAS_S2A = [
  // o Excomungar
  [new RegExp(`^Habilidades reforçadas excomungam os inimigos ao atingir corpo a corpo por ${N} segundos?$`, 'i'), (m) => ({ excomungarMs: Math.round(num(m[1]) * 1000) })],
  // o Toque Definhador
  [new RegExp(`possuem ${N}% de chance de causar Definhado ao Acertar$`, 'i'), (m) => ({ definharChancePct: num(m[1]) })],
  [new RegExp(`^Definhado dura ${N} segundos?$`, 'i'), (m) => ({ definharMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`recebem ${N}% de Dano Físico como Dano de Caos Extra$`, 'i'), (m) => ({ 'af:phys_as_extra_chaos': num(m[1]) })],
  // a Santificação
  [/^Habilidades reforçadas infligem Chama Santificada ao atingir corpo a corpo$/i, () => ({ chamaSantificada: 1 })],
  [new RegExp(`^Intensidade de Chama Santificada infligida por habilidades reforçadas aumentada em ${N}%$`, 'i'), (m) => ({ chamaEfeitoPct: num(m[1]) })],
  // o Rompimento
  [/^Golpes Críticos com Habilidades Suportadas que infligirem Sangramento também infligem Rompimento$/i, () => ({ rompimento: 1 })],
  [new RegExp(`^Alvos sofrem ${N}% mais Dano do Sangramento por Rompimento`, 'i'), (m) => ({ rompimentoMaisPct: num(m[1]) })],
  [new RegExp(`^Sangramento expira ${N}% mais rápido por Rompimento`, 'i'), (m) => ({ rompimentoRapidoPct: num(m[1]) })],
  // o Traumatismo (o suporte)
  [new RegExp(`têm ${N} a ${N} de Dano de Ataque Físico Adicional por Traumatismo$`, 'i'), (m) => ({ traumaFisicoMin: num(m[1]), traumaFisicoMax: num(m[2]) })],
  [new RegExp(`têm Duração do Atordoamento aumentada em ${N}% por Traumatismo$`, 'i'), (m) => ({ traumaAtordoamentoPct: num(m[1]) })],
  [new RegExp(`^Ganha ${N} Traumatismo na primeira vez que um Ataque Suportado Acertar um Inimigo Sofre ${N} de Dano Físico por Traumatismo quando você ganhar Traumatismo das Habilidades Suportadas Traumatismos duram ${N} segundos?$`, 'i'),
    (m) => ({ traumaGanho: Math.floor(num(m[1])), traumaDano: num(m[2]), traumaMs: Math.round(num(m[3]) * 1000) })],
  // a Inspiração (a cópia da linha com o "\n" literal não soma)
  [/^Ganha uma Carga de Inspiração ao Gastar Mana em Custos Diretos ou Efeitos das Habilidades Suportadas$/i, () => ({ inspiracao: 1 })],
  [/^Ganha uma Carga de Inspiração ao Gastar Mana em\\n/i, () => ({})],
  [new RegExp(`tem Chance de Golpe Crítico aumentada em ${N}% por Carga de Inspiração$`, 'i'), (m) => ({ inspiracaoCritPct: num(m[1]) })],
  [new RegExp(`causam ${N}% mais Dano Elemental por Carga de Inspiração$`, 'i'), (m) => ({ inspiracaoElementalMaisPct: num(m[1]) })],
  [new RegExp(`^Perca todas as Cargas de Inspiração após Gastar um total de ${N} de Mana`, 'i'), (m) => ({ inspiracaoPerdeEm: num(m[1]) })],
  // a Fonte de Vida
  [new RegExp(`^Ganha Fonte de Vida após Gastar um total de ${N} de Vida`, 'i'), (m) => ({ fonteDeVidaApos: num(m[1]) })],
  [new RegExp(`^Fonte de Vida dura \\+?${N} segundos?$`, 'i'), (m) => ({ fonteDeVidaMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`causam ${N}% mais Dano enquanto você tiver Fonte de Vida$`, 'i'), (m) => ({ 'af:mais_dano@buff:fonteDeVida': num(m[1]) })],
  // o Combate Próximo (a cópia com o "\n" literal não soma)
  [new RegExp(`^Habilidades Suportadas concedem Ímpeto de Combate ao Acertar Ímpeto de Combate dura ${N} segundos? ou até que você utilize uma Habilidade de Deslocamento$`, 'i'), (m) => ({ impetoMs: Math.round(num(m[1]) * 1000) })],
  [/^Habilidades Suportadas concedem Ímpeto de Combate ao Acertar\\n/i, () => ({})],
  [new RegExp(`^Adrenalina de Combate concede ${N}% mais Velocidade de Ataque às Habilidades de Deslocamento não Suportadas por Combate Próximo$`, 'i'), (m) => ({ impetoVelPct: num(m[1]) })],
  // as Armadilhas Múltiplas e as Agrupadas
  [new RegExp(`têm Efeito em Área da Ativação de Armadilhas aumentado em ${N}%$`, 'i'), (m) => ({ ativacaoArmadilhaIncPct: num(m[1]) })],
  // o Chamado Abençoado
  [new RegExp(`^Clamores reforçados criam um chão consagrado com duração de ${N} segundos?$`, 'i'), (m) => ({ clamorSoloSagradoMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Clamores reforçados têm ${N}% de área de efeito$`, 'i'), (m) => ({ clamorAreaIncPct: num(m[1]) })],
  [new RegExp(`^Clamores reforçados têm a velocidade de recarga (aumentada|reduzida) em ${N}%$`, 'i'), (m) => ({ recuperacaoRecargaPct: (m[1].toLowerCase() === 'reduzida' ? -1 : 1) * num(m[2]) })],
  // o Marcar ao Acertar (o gatilho é de `suportes-poe.gatilhoDe`)
  [new RegExp(`^Efeito das Marcas de Habilidades Suportadas (aumentado|reduzido) em ${N}%$`, 'i'), (m) => ({ efeitoMaldicaoPct: (m[1].toLowerCase() === 'reduzido' ? -1 : 1) * num(m[2]) })],
  [/^Ativa a Habilidade Suportada quando você Acertar um Inimigo Raro ou Único com um Ataque$/i, () => ({})],
  // o Clamor Corrompedor (a cópia com o "\n" literal não soma)
  [new RegExp(`^Sangue Corrompido infligido por Clamores Suportados causam ${N} de Dano Físico base por segundo$`, 'i'), (m) => ({ sangueClamorPorS: num(m[1]) })],
  [new RegExp(`^Sangue Corrompido infligido por Clamores Suportados tem uma Duração Base de ${N} segundos?$`, 'i'), (m) => ({ sangueClamorMs: Math.round(num(m[1]) * 1000) })],
  [new RegExp(`^Clamores Suportados infligem ${N} Debuffs de Sangue Corrompido no primeiro inimigo Acertado por cada Ataque que Impelirem$`, 'i'), (m) => ({ sangueImpelirN: Math.floor(num(m[1])) })],
  [/^Clamores Suportados infligem \d+ Debuffs de Sangue Corrompido no primeiro\\n/i, () => ({})],
  [new RegExp(`^Clamores Suportados infligem ${N} Debuffs de Sangue Corrompido$`, 'i'), (m) => ({ sangueClamorN: Math.floor(num(m[1])) })],
  // o Estandarte Ensanguentado
  [/^Estandartes reforçados infligem Sangue Corrompido a cada segundo aos inimigos dentro de sua área$/i, () => ({ sangueEstandarte: 1 })],
  [new RegExp(`^Sangue Corrompido infligido por estandartes reforçados causam ${N} de dano físico base por segundo por bravura consumida$`, 'i'), (m) => ({ sangueEstandartePorValor: num(m[1]) })],
  [new RegExp(`^Sangue Corrompido infligido por estandartes reforçados tem uma duração base de ${N} segundos?$`, 'i'), (m) => ({ sangueEstandarteMs: Math.round(num(m[1]) * 1000) })],
  // a Flecha Forjada com Mana (o gatilho é de `suportes-poe.gatilhoDe`; a cópia com o "\n" literal não soma)
  [new RegExp(`causam ${N}% mais Dano com Acertos e Afecções por cada 1 de Custo de Mana$`, 'i'), (m) => ({ maisPorCustoManaPct: num(m[1]) })],
  [/^Habilidades Suportadas Ativam uma vez que o Custo de Mana total em outros Ataques/i, () => ({})],
  // o Companheirismo (a cópia com o "\n" literal não soma)
  [new RegExp(`^Lacaios de habilidades reforçadas sofrem ${N}% do dano de ataque da própria vida antes de você, se eles forem seus únicos lacaios$`, 'i'), (m) => ({ companheirismoAbsorvePct: num(m[1]) })],
  [/^Lacaios de habilidades reforçadas sofrem \d+(?:\.\d+)?% do dano de ataque da própria vida\\n/i, () => ({})],
  [new RegExp(`^Lacaios de habilidades reforçadas sofrem ${N}% de dano, se eles forem seus únicos lacaios$`, 'i'), (m) => ({ companheirismoDanoPct: num(m[1]) })],
  // o Decapitar
  [new RegExp(`^Golpes Finais das Habilidades de Golpe Suportadas com Armas Corpo a Corpo contra Monstros Raros concedem um de seus Modificadores por ${N} segundos?$`, 'i'), (m) => ({ decapitarS: num(m[1]) })],
];

/** O gatilho do Marcar ao Acertar (`suportes-poe.gatilhoDe`): "Ativa a Habilidade Suportada quando você Acertar um Inimigo Raro ou Único com um Ataque". */
export const ehGatilhoDoMarcar = (tudo) => /Ativa a Habilidade Suportada quando você Acertar um Inimigo Raro ou Único com um Ataque/i.test(tudo);

/**
 * O gatilho da Flecha Forjada com Mana ("Ativam uma vez que o Custo de Mana total em outros Ataques de Arco excederem 300% do seu Custo de Mana"): o `limiarPct`, ou
 * null.
 */
export function limiarDaFlechaForjada(tudo) {
  const m = /Ativam uma vez que o Custo de Mana total em outros Ataques (?:\\n)?de Arco excederem (\d+(?:\.\d+)?)% do seu Custo de Mana/i.exec(tudo);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------- as contas puras

/** Os acúmulos de Rompimento vivos no bicho agora. */
export const rompimentosAgora = (m, agora) => (m?.estados?.rompimento?.fins ?? []).filter((t) => t > agora).length;
/**
 * Põe um acúmulo de Rompimento (até 4; cheio, o que acaba primeiro sai), com os números do suporte (`maisPct`, `rapidoPct` — o maior fica). Devolve os acúmulos.
 */
export function porRompimento(m, { maisPct = 0, rapidoPct = 0 } = {}, agora = 0) {
  const e = (m.estados ??= {});
  const r = e.rompimento && (e.rompimento.fins ?? []).some((t) => t > agora) ? e.rompimento : { fins: [], maisPct: 0, rapidoPct: 0 };
  const fins = r.fins.filter((t) => t > agora).sort((a, b) => a - b);
  if (fins.length >= ROMPIMENTO.maximo) fins.shift();
  fins.push(agora + ROMPIMENTO.duracaoMs);
  e.rompimento = { fins, maisPct: Math.max(r.maisPct, maisPct), rapidoPct: Math.max(r.rapidoPct, rapidoPct) };
  return fins.length;
}

/**
 * A INSPIRAÇÃO de um uso que gastou `mana`: `{ n, gasto }` depois do gasto — soma o gasto; no limite ("após Gastar um total de 800"), as cargas zeram e a conta
 * recomeça; senão, ganha uma (até o máximo).
 */
export function inspiracaoAposGastar(atual, mana, perdeEm, maximo = INSPIRACAO.maximo) {
  const a = { n: Math.max(0, atual?.n ?? 0), gasto: Math.max(0, atual?.gasto ?? 0) };
  if (!(mana > 0)) return a;
  const gasto = a.gasto + mana;
  if (perdeEm > 0 && gasto >= perdeEm) return { n: 0, gasto: 0 };
  return { n: Math.min(maximo, a.n + 1), gasto };
}

/** A FONTE DE VIDA de um uso que gastou `vida`: `{ gasto, ganhou }` — no limite, ganha e a conta recomeça (o que passou do limite fica). */
export function fonteAposGastar(gastoAntes, vida, apos) {
  const gasto = Math.max(0, gastoAntes ?? 0) + Math.max(0, vida ?? 0);
  if (!(apos > 0) || gasto < apos) return { gasto, ganhou: false };
  return { gasto: gasto - apos, ganhou: true };
}

/**
 * O COMPANHEIRISMO de agora: os seus lacaios vivos (os totens e o mercenário não são lacaios no PoE) são TODOS da mesma habilidade suportada por ele (o
 * `l.companheirismoS2A` que a invocação põe)? `{ acao, absorvePct, danoPct }`, ou null.
 */
export function companheirismoDe(hunt) {
  const vivos = (hunt?.lacaios ?? []).filter((x) => x && x.hp > 0 && x.tipo !== 'totem' && !x.mercenario);
  const c = vivos[0]?.companheirismoS2A;
  if (!c || !vivos.every((x) => x.companheirismoS2A?.acao === c.acao)) return null;
  return c;
}
/** O dano no lacaio `l` × o "sofrem −X% de dano, se eles forem seus únicos lacaios" do Companheirismo (1 sem ele). */
export function fatorDoCompanheirismo(hunt, l) {
  const c = l?.companheirismoS2A?.danoPct ? companheirismoDe(hunt) : null;
  return c && c.acao === l.companheirismoS2A.acao ? Math.max(0, 1 + c.danoPct / 100) : 1;
}

/** O "mais Velocidade de Ataque" do Ímpeto de Combate neste uso (o fator do tempo: ÷), ou 1. */
export function fatorDoImpeto(impeto, { deslocamento, ataque, suportadoPeloCombate }, agora) {
  if (!impeto || !(impeto.ate > agora) || !deslocamento || !ataque || suportadoPeloCombate) return 1;
  return 1 + Math.max(0, impeto.velPct ?? 0) / 100;
}
