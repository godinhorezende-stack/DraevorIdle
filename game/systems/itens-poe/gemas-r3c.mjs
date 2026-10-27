/*
 * (lote R3C, 27/10) AS PARCIAIS MAIS DIFÍCEIS QUE SOBRARAM — Bênçãos, recursos e mecânicas de buff —, como no PoE 1. A fonte é o PoB (`Skills/other.lua`
 * SupportDivineBlessing; `Skills/sup_int.lua` SupportEldritchBlasphemy, SupportFoulgrasp/TriggeredSupportFoulgrasp, SupportKineticInstability/
 * TriggeredSupportKineticInstability, SupportGreaterKineticInstability, SupportFrigidBond; `Modules/CalcSetup.lua` (a Insanidade Perversa);
 * `Modules/CalcPerform.lua` (o resfriamento sem acerto: `data.nonDamagingAilment.Chill.default` = 10%)); na falta, o poedb salvo
 * (`gamedata/itens-poe/suportes-poe.json`).
 *
 * Este módulo é DADO PURO + regras (não importa os mods, as ações nem a caçada): quem chama (`suportes-poe.mjs`, `acoes.mjs`, `condicoes-poe.mjs`,
 * `gemas-gac.mjs`, `armas-plantadas.mjs`, `runas-vinculadas.mjs`) passa a caçada e o que precisar. O estado vive em `hunt.poeR3c` (vai para o JSON do banco: só
 * números e listas curtas, com teto) e, nos monstros, em `m.poeR3cAura` / `m.estados.insanidadeR3c`.
 *
 * - as BÊNÇÃOS (a Divina, a Eterna, a do Guardião): a aura suportada não reserva; a Divina vira temporária (a duração base do suporte × a Duração) e custa "+N de
 *   Mana"; a Eterna e a do Guardião ficam ligadas sem reserva. "Você só pode ter uma Aura de suas Habilidades Bênção" (a nova tira a velha). A Eterna desabilita as
 *   suas habilidades não-Bênção que reservam Mana enquanto a aura dela está em você. A do Guardião só se aplica em você com lacaios vivos de uma habilidade do mesmo
 *   grupo, e esses lacaios sofrem X% da Vida + Escudo de Energia máximos por segundo como Físico enquanto a aura está em você; o "Efeito das Auras" dela vai de
 *   −30% (nível 1) a +27% (nível 20), 3% por nível (o poedb perde o sinal: a coluna é 30, 27 … 3, vazio no 11, 3 … 27);
 * - a MINA LOCAL: as minas caem em você ("sempre focam na sua localização"), em arco à sua frente, e não detonam enquanto você está a até 3 m delas;
 * - a BLASFÊMIA SOBRENATURAL: os inimigos sob a aura da maldição suportada por mais de 5 s ganham a Insanidade Perversa (o PoB, CalcSetup: 10% menos Dano e 10% de
 *   Velocidade de Ação reduzida);
 * - a CONSTRIÇÃO PÉRFIDA: +2 Runas; convocar as Runas suportadas cria as mãos (2 por Runa + as da qualidade, até 30, por 8 s × a Duração) em volta de você;
 *   cada mão detona quando um inimigo chega perto (o raio secundário, 1,5 m) — a magia de Raio do suporte (6% de crítico, eficácia 110%), recarga 1 s;
 * - as INSTABILIDADES CINÉTICAS: o golpe fatal (a comum) / o golpe crítico (a Maior: recarga 0,15 s com 6 usos) do ataque de varinha suportado cria uma anomalia
 *   no lugar do alvo (até 20, por 6 s × a Duração); a anomalia explode quando um inimigo chega perto (1,2 m × √ da Área): o dano da varinha × o "Dano de Ataque: X%
 *   de base", a eficácia, e 150% de Poder Arcano;
 * - o VÍNCULO FRÍGIDO: o feixe entre você e cada alvo vinculado causa o Gelo degenerativo da gema (por segundo, com os modificadores de Dano Mágico) e Resfria
 *   (10% × o Efeito do Resfriamento) os inimigos nele; os dois perduram 3 s (+ a qualidade) × a Duração.
 */

const N = '(-?\\d+(?:[.,]\\d+)?)';
const num = (x) => parseFloat(String(x).replace(',', '.')) || 0;
const nada = () => {};
const est = (hunt) => (hunt.poeR3c ??= {});
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const mesmoAndar = (a, z) => (a?.z ?? z ?? 0) === (z ?? 0);
/** O raio em casas de `m` metros × √`fator` (1 casa = 2 m), com a fração como a chance de uma casa a mais (sorteada). */
export function casasDe(m, fator = 1, rng = Math.random) {
  const c = (Math.max(0, num(m)) / 2) * Math.sqrt(Math.max(0, fator));
  return Math.trunc(c) + (rng() < c % 1 ? 1 : 0);
}

// ---------------------------------------------------------------- as linhas dos suportes do lote (`suportes-poe.efeitoNoNivel`)

const BENCAO = /também contam como Habilidades Bênção/i;
/** As linhas próprias de cada suporte do lote: `[regex, (m, efeito) → void]` (mudam o efeito). Vêm antes das regras gerais. */
export const PROPRIAS_R3C = {
  Divine_Blessing_Support: [
    [BENCAO, (m, e) => { e.bencaoR3c = 1; }],
    [new RegExp(`^Habilidades Suportadas Custam \\+${N} de Mana$`, 'i'), (m, e) => { e.bencaoCustoMana = Math.max(e.bencaoCustoMana ?? 0, num(m[1])); }],
    [new RegExp(`^Auras das Habilidades Suportadas têm uma duração base de ${N} segundos?$`, 'i'), (m, e) => { e.bencaoDuracaoMs = Math.round(num(m[1]) * 1000); }],
  ],
  Eternal_Blessing_Support: [
    [BENCAO, (m, e) => { e.bencaoR3c = 1; }],
    [/^Habilidades Suportadas não tem Reserva$/i, (m, e) => { e.semReservaR3c = 1; }],
    [/^Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você$/i, (m, e) => { e.bencaoEternaR3c = 1; }],
  ],
  Guardians_Blessing_Support: [
    [BENCAO, (m, e) => { e.bencaoR3c = 1; }],
    [/^Habilidades de Aura Suportadas não tem Reserva$/i, (m, e) => { e.semReservaR3c = 1; }],
    // (o sinal sai do nível em `ajustarEfeitoR3c`: o poedb mostra "reduzido em 27%" no 20, que é +27%)
    [new RegExp(`^Habilidades Suportadas têm Efeito das Auras reduzido em ${N}%$`, 'i'), (m, e) => { e.guardiaoEfeitoN = Math.abs(num(m[1])); }],
    [/^Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada$/i, (m, e) => { e.bencaoGuardiaoR3c = 1; }],
    [new RegExp(`^Lacaios das Habilidades Suportadas sofrem ${N}% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você$`, 'i'),
      (m, e) => { e.guardiaoDegenPct = num(m[1]); }],
  ],
  Locus_Mine_Support: [
    [new RegExp(`^Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de ${N} metros? de você$`, 'i'), (m, e) => { e.minaSemDetonarPertoM = num(m[1]); }],
    [/^Minas usando Habilidades Suportadas sempre focam na sua localização$/i, (m, e) => { e.minaEmVoceR3c = 1; }],
    [/^Habilidades Suportadas arremessam Minas em um Arco$/i, (m, e) => { e.minaEmArcoR3c = 1; }],
  ],
  Eldritch_Blasphemy_Support: [
    [new RegExp(`^Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de ${N} segundos?$`, 'i'), (m, e) => { e.insanidadeAposMs = Math.round(num(m[1]) * 1000); }],
  ],
  Foulgrasp_Support: [
    [new RegExp(`^Habilidades reforçadas podem conjurar ${N} glifos adicionais$`, 'i'), (m, e) => { e.runasExtrasR3c = Math.max(e.runasExtrasR3c ?? 0, Math.round(num(m[1]))); }],
    [/^Glifos reforçados ativam Constrição Pérfida ao serem recuperados$/i, (m, e) => { e.maosR3c = 1; }],
    [new RegExp(`^Causa ${N} a ${N} de Dano de Raio$`, 'i'), (m, e) => { e.maosMin = num(m[1]); e.maosMax = num(m[2]); }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.maosDuracaoMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.maosRaioM = num(m[1]); }],
    [new RegExp(`^Raio de alcance secundário base é de ${N} metros?$`, 'i'), (m, e) => { e.maosRaio2M = num(m[1]); }],
    [new RegExp(`^Máximo de ${N} mãos$`, 'i'), (m, e) => { e.maosTeto = Math.round(num(m[1])); }],
    [new RegExp(`^Cria ${N} mãos por glifo$`, 'i'), (m, e) => { e.maosPorRuna = Math.round(num(m[1])); }],
    // (a qualidade: "Cria (0—2) mãos adicionais" — a fração é a chance de uma a mais)
    [new RegExp(`^Cria ${N} mãos adicionais$`, 'i'), (m, e) => { e.maosExtras = num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.maosRecargaMs = Math.round(num(m[1]) * 1000); }],
    [new RegExp(`^Chance de Crítico: ${N}%$`, 'i'), (m, e) => { e.maosCrit = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.maosEficacia = num(m[1]) / 100; }],
    [/^Tempo de Conjuração:/i, nada],
  ],
  Kinetic_Instability_Support: null,
  Greater_Kinetic_Instability_Support: null,
  Frigid_Bond_Support: [
    [/^Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados$/i, (m, e) => { e.frigidoR3c = 1; }],
    [new RegExp(`^Habilidades Suportadas causam ${N} Dano Base de Gelo por segundo$`, 'i'), (m, e) => { e.frigidoDps = num(m[1]); }],
    [new RegExp(`^Dano e Resfriamentos Perduram por uma Duração Base de \\+?${N} segundos?$`, 'i'), (m, e) => { e.frigidoMs = (e.frigidoMs ?? 0) + Math.round(num(m[1]) * 1000); }],
    [/^Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas$/i, (m, e) => { e.frigidoMagico = 1; }],
  ],
};
// as duas Instabilidades Cinéticas: as linhas do Fluxo Cinético (a habilidade ativada — antes "não feitas", `NAO_FEITAS_S2B_DO`)
const LINHAS_DO_FLUXO = [
  [/^Habilidades reforçadas ativam Fluxo Cinético no golpe fatal$/i, (m, e) => { e.fluxoAoMatar = 1; }],
  [/^Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico$/i, (m, e) => { e.fluxoAoCritico = 1; }],
  [new RegExp(`^${N}% de Poder Arcano$`, 'i'), (m, e) => { e.fluxoArcanoPct = num(m[1]); }],
  [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.fluxoDanoPct = num(m[1]); }],
  [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.fluxoEficacia = num(m[1]) / 100; }],
  [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.fluxoDuracaoMs = Math.round(num(m[1]) * 1000); }],
  [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.fluxoRaioM = num(m[1]); }],
  [new RegExp(`^Máximo de ${N} anomalias$`, 'i'), (m, e) => { e.fluxoTeto = Math.round(num(m[1])); }],
  [new RegExp(`^Recarga: ${N} seg(?:\\s*\\((\\d+) Times\\))?`, 'i'), (m, e) => { e.fluxoRecargaMs = Math.round(num(m[1]) * 1000); e.fluxoUsos = m[2] ? Number(m[2]) : 1; }],
  [/^Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética$/i, nada],
];
PROPRIAS_R3C.Kinetic_Instability_Support = LINHAS_DO_FLUXO;
PROPRIAS_R3C.Greater_Kinetic_Instability_Support = LINHAS_DO_FLUXO;

/** O que o lote acerta no efeito depois das linhas (o nível): o sinal do "Efeito das Auras" da Bênção do Guardião (−30% no 1, 0 no 11, +27% no 20). */
export function ajustarEfeitoR3c(slug, nivel, e) {
  if (e?.guardiaoEfeitoN != null) {
    e.efeitoAuraPct = (e.efeitoAuraPct ?? 0) + (Number(nivel) <= 10 ? -1 : 1) * e.guardiaoEfeitoN;
    delete e.guardiaoEfeitoN;
  }
  return e;
}

// ---------------------------------------------------------------- as BÊNÇÃOS

/**
 * A Bênção da aura suportada (`ef`: o efeito dos suportes na gema), ou null: `{ tipo: 'divina' | 'eterna' | 'guardiao', duracaoMs?, custoMana? }`. Só a AURA
 * permanente (o arquétipo `aura`: "Suporta habilidades de aura que criam auras permanentes ao seu redor" — sem Estandarte nem Postura).
 */
export function bencaoDaAura(arquetipo, slug, ef) {
  if (!ef?.bencaoR3c || arquetipo !== 'aura' || /_Banner$/.test(String(slug ?? ''))) return null;
  if (ef.bencaoGuardiaoR3c > 0) return { tipo: 'guardiao' };
  if (ef.bencaoEternaR3c > 0) return { tipo: 'eterna' };
  if (ef.bencaoDuracaoMs > 0) return { tipo: 'divina', duracaoMs: ef.bencaoDuracaoMs, custoMana: ef.bencaoCustoMana ?? 0 };
  return null;
}
/** As auras de Bênção ligadas agora: `[[id, buff]]`. */
export const bencoesLigadas = (hunt, agora = hunt?.clock ?? 0) => Object.entries(hunt?.buffs ?? {}).filter(([, b]) => b?.bencaoR3c && b.ate > agora);
/** A aura da Bênção Eterna está em você agora? (a do Guardião sem lacaios não está — `soAliados`) */
export const eternaEmVoce = (hunt, agora = hunt?.clock ?? 0) => bencoesLigadas(hunt, agora).some(([, b]) => b.bencaoR3c === 'eterna' && !b.soAliados);
/** A habilidade `id` com o buff/reserva `r` é "não-Bênção que reserva Mana"? (a reserva da aura, da Blasfêmia e a da Mina que reserva o custo) */
export const reservaManaNaoBencao = (b) => !!b && !b.bencaoR3c && b.reserva && b.reserva.recurso !== 'vida';
/**
 * Liga a Bênção no buff recém-criado (`b`, da aura `id`): a duração (a Divina: a base do suporte × `fatorDur`; as outras ficam ligadas — `ligadaAte`), a marca, e
 * tira as outras auras de Bênção ("Você só pode ter uma Aura de suas Habilidades Bênção"). A Eterna desliga as suas não-Bênção que reservam Mana. Devolve os ids
 * que saíram.
 */
export function aplicarBencao(hunt, id, b, bencao, agora, fatorDur = 1, ligadaAte = Number.MAX_SAFE_INTEGER) {
  if (!hunt || !b || !bencao) return [];
  b.bencaoR3c = bencao.tipo;
  b.ate = bencao.tipo === 'divina' ? agora + Math.max(1, Math.round(bencao.duracaoMs * Math.max(0, fatorDur))) : ligadaAte;
  delete b.reserva;
  const sairam = [];
  for (const [outro, x] of Object.entries(hunt.buffs ?? {})) {
    if (outro === id || !x) continue;
    if (x.bencaoR3c || (bencao.tipo === 'eterna' && reservaManaNaoBencao(x))) { delete hunt.buffs[outro]; sairam.push(outro); }
  }
  return sairam;
}
/**
 * A Bênção do Guardião no tique: a aura `id` só vale em você com um lacaio vivo de uma habilidade do mesmo grupo (`acoesDoGrupo`: os ids das outras gemas ativas do
 * grupo) — `b.soAliados` (a soma da ficha pula a aura; nos companheiros vale). Devolve true se mudou (quem chama refaz a ficha).
 */
export function guardiaoEmVoce(hunt, b, acoesDoGrupo, agora = hunt?.clock ?? 0) {
  if (!b || b.bencaoR3c !== 'guardiao') return false;
  const grupo = new Set(acoesDoGrupo ?? []);
  const tem = (hunt?.lacaios ?? []).some((l) => l && l.hp > 0 && grupo.has(l.acao) && !(l.ate && agora >= l.ate));
  const so = !tem;
  if (!!b.soAliados === so) return false;
  if (so) b.soAliados = true;
  else delete b.soAliados;
  return true;
}
/**
 * O dano por segundo da Bênção do Guardião nos lacaios das habilidades do grupo (`pct` da Vida + Escudo de Energia máximos, Físico) por `ms`, enquanto a aura está em
 * você: tira do Escudo de Energia primeiro, depois da Vida. Devolve `[{ l, dano }]`.
 */
export function degenDoGuardiao(lacaios, acoesDoGrupo, pct, ms, agora = 0) {
  const grupo = new Set(acoesDoGrupo ?? []);
  const saida = [];
  if (!(pct > 0) || !(ms > 0)) return saida;
  for (const l of lacaios ?? []) {
    if (!l || !(l.hp > 0) || !grupo.has(l.acao) || l.tipo === 'totem' || (l.ate && agora >= l.ate)) continue;
    const total = ((Math.max(0, l.maxHp ?? l.hp) + Math.max(0, l.maxEs ?? 0)) * pct * ms) / 100000;
    if (!(total > 0)) continue;
    let resto = total;
    if ((l.es ?? 0) > 0) { const d = Math.min(l.es, resto); l.es -= d; resto -= d; }
    l.hp -= resto;
    saida.push({ l, dano: total });
  }
  return saida;
}

// ---------------------------------------------------------------- a MINA LOCAL

/** Para onde a Mina Local vai: a sua casa ("sempre focam na sua localização"), ou o lugar mirado. */
export const lugarDaMina = (ef, mirado, pos) => (ef?.minaEmVoceR3c > 0 && pos ? { x: pos.x, y: pos.y } : mirado);
/**
 * As casas do arremesso EM ARCO (a Mina Local): a primeira no centro; as outras no arco à frente (`dir`: 0 norte, 1 leste, 2 sul, 3 oeste), a 1 casa, do meio para os
 * lados, depois a 2 casas. `n` casas.
 */
export function casasDoArco(centro, dir = 2, n = 1) {
  const frente = [[0, -1], [1, 0], [0, 1], [-1, 0]][((dir | 0) % 4 + 4) % 4];
  const lado = [-frente[1], frente[0]];
  const saida = [{ x: centro.x, y: centro.y }];
  for (let d = 1; saida.length < n && d <= 4; d++) {
    for (const k of [0, 1, -1, 2, -2]) {
      if (saida.length >= n) break;
      if (Math.abs(k) > d) continue;
      saida.push({ x: centro.x + frente[0] * d + lado[0] * k, y: centro.y + frente[1] * d + lado[1] * k });
    }
  }
  return saida.slice(0, Math.max(1, n));
}
/** O raio (casas) em que a Mina Local não detona perto de você: 3 m = 1,5 casa (a fração, a chance de uma casa a mais — sorteada ao plantar). */
export const raioSemDetonar = (ef, rng = Math.random) => (ef?.minaSemDetonarPertoM > 0 ? casasDe(ef.minaSemDetonarPertoM, 1, rng) : null);
/** A Mina `p` está perto demais de você para detonar? */
export const minaPertoDeVoce = (p, pos, z) => p?.semDetonarCasas != null && !!pos && (p.z ?? z ?? 0) === (z ?? 0) && cheb(p, pos) <= p.semDetonarCasas;

// ---------------------------------------------------------------- a INSANIDADE PERVERSA (a Blasfêmia Sobrenatural)

/** O PoB (CalcSetup.lua:70-71): "Deal 10% less Damage", "10% reduced Action Speed". */
export const INSANIDADE = Object.freeze({ menosDanoPct: 10, acaoReduzidaPct: 10, margemMs: 500 });
/**
 * O tique da aura da maldição suportada (a Blasfêmia Sobrenatural): quem está no raio (`casas`: os metros ÷ 2 × √ da Área — a fração sorteada uma vez por monstro, quando
 * entra) em volta de `pos` conta o tempo (`m.poeR3cAura[id]`); passou de `aposMs`, a Insanidade Perversa (`m.estados.insanidadeR3c`, renovada a cada tique). Quem sai
 * perde a conta. Devolve quantos estão com a Insanidade.
 */
export function tiqueDaInsanidade(monstros, pos, z, id, casas, aposMs, agora, rng = Math.random) {
  let n = 0;
  for (const m of monstros ?? []) {
    if (!m || m.dummy) continue;
    const reg = m.poeR3cAura?.[id];
    if (!(m.hp > 0) || !pos || !mesmoAndar(m, z)) { if (reg) delete m.poeR3cAura[id]; continue; }
    const raio = reg?.raio ?? Math.trunc(casas) + (rng() < casas % 1 ? 1 : 0);
    if (cheb(m, pos) > raio) { if (reg) delete m.poeR3cAura[id]; continue; }
    const r = reg ?? ((m.poeR3cAura ??= {})[id] = { desde: agora, raio });
    if (agora - r.desde >= aposMs) {
      (m.estados ??= {}).insanidadeR3c = { ate: agora + INSANIDADE.margemMs };
      n++;
    }
  }
  return n;
}
/** Limpa a conta da aura `id` em todos (a aura desligou). */
export function esquecerAura(monstros, id) {
  for (const m of monstros ?? []) if (m?.poeR3cAura?.[id]) delete m.poeR3cAura[id];
}
/** O monstro está com a Insanidade Perversa agora? */
export const comInsanidade = (m, agora) => (m?.estados?.insanidadeR3c?.ate ?? 0) > agora;
/** O fator do dano do monstro (10% menos com a Insanidade). */
export const fatorDaInsanidade = (m, agora) => (comInsanidade(m, agora) ? 1 - INSANIDADE.menosDanoPct / 100 : 1);
/** A Velocidade de Ação reduzida do monstro pela Insanidade (%). */
export const acaoReduzidaDaInsanidade = (m, agora) => (comInsanidade(m, agora) ? INSANIDADE.acaoReduzidaPct : 0);

// ---------------------------------------------------------------- a recarga com usos

/** O uso da recarga com usos ("Recarga: 0.15 seg (6 Times)"): os usos guardados recarregam um a um. Devolve se pode (e gasta um). */
export function gastarUso(hunt, chave, recargaMs, usos = 1, agora = hunt?.clock ?? 0) {
  const s = est(hunt);
  const lista = (s.recargas ??= {});
  const r = lista[chave] ?? { n: usos, em: agora };
  if (r.n < usos && recargaMs > 0) {
    const ganhos = Math.floor((agora - r.em) / recargaMs);
    if (ganhos > 0) { r.n = Math.min(usos, r.n + ganhos); r.em = r.n >= usos ? agora : r.em + ganhos * recargaMs; }
  }
  if (r.n < 1) { lista[chave] = r; return false; }
  if (r.n >= usos) r.em = agora;
  r.n -= 1;
  lista[chave] = r;
  // (teto: as chaves são as habilidades — poucas; as velhas saem)
  const chaves = Object.keys(lista);
  if (chaves.length > 20) delete lista[chaves[0]];
  return true;
}

// ---------------------------------------------------------------- as ANOMALIAS do Fluxo Cinético

/**
 * Cria a anomalia no lugar `c` (a habilidade `acao`, o raio em casas já sorteado, a duração em ms): o teto (`teto`, 20) tira a mais velha. Devolve a anomalia.
 */
export function criarAnomalia(hunt, { acao, c, z, raio, ms, teto = 20, maior = false }, agora = hunt?.clock ?? 0) {
  if (!hunt || !c || !(ms > 0)) return null;
  const s = est(hunt);
  s.n = (s.n ?? 0) + 1;
  const a = { id: s.n, acao, x: c.x, y: c.y, z: z ?? hunt.z ?? 0, raio: Math.max(0, raio | 0), ate: agora + ms, ...(maior ? { maior: true } : {}) };
  const lista = (s.anomalias ?? []).filter((x) => x.ate > agora);
  lista.push(a);
  while (lista.length > Math.max(1, teto)) lista.shift();
  s.anomalias = lista;
  return a;
}
/** As anomalias que explodem agora (um inimigo vivo a até o raio — o mesmo andar) — saem da lista; as vencidas também. Devolve as que explodem. */
export function anomaliasQueExplodem(hunt, agora = hunt?.clock ?? 0) {
  const s = hunt?.poeR3c;
  if (!s?.anomalias?.length) return [];
  const explodem = [];
  const ficam = [];
  for (const a of s.anomalias) {
    if (!(a.ate > agora)) continue;
    const perto = (hunt.monstros ?? []).some((m) => m.hp > 0 && !m.dummy && mesmoAndar(m, a.z) && cheb(m, a) <= a.raio);
    (perto ? explodem : ficam).push(a);
  }
  s.anomalias = ficam;
  return explodem;
}

// ---------------------------------------------------------------- as MÃOS da Constrição Pérfida

/**
 * As mãos que a convocação cria: `n` (2 por Runa convocada + as da qualidade — a fração é a chance de uma a mais), em casas sorteadas a até `raio` casas de `centro`,
 * até o teto de mãos vivas (30). Devolve as criadas.
 */
export function criarMaos(hunt, { acao, centro, z, raio, raio2, n, ms, teto = 30 }, agora = hunt?.clock ?? 0, rng = Math.random) {
  if (!hunt || !centro || !(n > 0) || !(ms > 0)) return [];
  const s = est(hunt);
  const vivas = (s.maos ?? []).filter((x) => x.ate > agora);
  const quantas = Math.max(0, Math.min(Math.max(1, teto) - vivas.length, Math.trunc(n) + (rng() < n % 1 ? 1 : 0)));
  const r = Math.max(0, raio | 0);
  const novas = [];
  for (let i = 0; i < quantas; i++) {
    const dx = Math.round((rng() * 2 - 1) * r);
    const dy = Math.round((rng() * 2 - 1) * r);
    s.n = (s.n ?? 0) + 1;
    novas.push({ id: s.n, acao, x: centro.x + dx, y: centro.y + dy, z: z ?? hunt.z ?? 0, raio2: Math.max(0, raio2 | 0), ate: agora + ms });
  }
  s.maos = [...vivas, ...novas];
  return novas;
}
/** As mãos que detonam agora (um inimigo vivo a até o raio secundário) — saem; as vencidas também. */
export function maosQueDetonam(hunt, agora = hunt?.clock ?? 0) {
  const s = hunt?.poeR3c;
  if (!s?.maos?.length) return [];
  const detonam = [];
  const ficam = [];
  for (const h of s.maos) {
    if (!(h.ate > agora)) continue;
    const perto = (hunt.monstros ?? []).some((m) => m.hp > 0 && !m.dummy && mesmoAndar(m, h.z) && cheb(m, h) <= h.raio2);
    (perto ? detonam : ficam).push(h);
  }
  s.maos = ficam;
  return detonam;
}

// ---------------------------------------------------------------- o VÍNCULO FRÍGIDO

/** O resfriamento sem acerto do PoE: 10% (o PoB, `data.nonDamagingAilment.Chill.default`) × o Efeito do Resfriamento. */
export const RESFRIAMENTO_SEM_ACERTO_PCT = 10;
export const FRIGIDO_PULSO_MS = 500;
/** As casas do feixe entre `a` e `b` (a reta de Bresenham, as pontas incluídas). */
export function casasDoFeixe(a, b) {
  const r = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 200; i++) {
    r.push(`${x},${y}`);
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return r;
}
/** Os inimigos vivos nas casas do feixe (o mesmo andar). */
export function inimigosNoFeixe(monstros, casas, z) {
  const set = casas instanceof Set ? casas : new Set(casas);
  return (monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && mesmoAndar(m, z) && set.has(`${m.x},${m.y}`));
}

// ---------------------------------------------------------------- o status (as linhas que o lote faz)

/** As gemas do lote (para o relatório e o teste). */
export const SUPORTES_R3C = Object.freeze(Object.keys(PROPRIAS_R3C));
