/*
 * (lote S2B, 27/10) OS SUPORTES DA SEGUNDA METADE DA FILA (as parciais difíceis), como no PoE 1 — a fonte é o PoB (`Skills/sup_int.lua`, `Modules/CalcPerform.lua`,
 * `Modules/ConfigOptions.lua`); na falta, o poedb salvo (`gamedata/itens-poe/suportes-poe.json`).
 *
 * Este módulo é DADO PURO + regras (não importa os mods, as ações nem a caçada): quem chama passa a caçada e o que precisar. O estado vive em `hunt.poeS2B`
 * (vai para o JSON do banco: só números e listas curtas, podadas).
 *
 * - LACAIOS: a Velocidade do Lacaio (ataque e conjuração), o crítico da qualidade do Exemplar e da Carne Fresca, o Exemplar (o crítico "toda vez que você causar um
 *   golpe crítico recentemente com um ataque"), a Carne Fresca (a Fúria Desperta e a Adrenalina ao nascer), o Exército Elemental (as resistências, o máximo delas, o "mais
 *   Dano Elemental" e a Exposição no acerto), o Escudo de Carne (o "menos Dano" recebido, a Provocação, o "mais Dano" contra os inimigos perto de você) e o Frenesi Faminto
 *   (o buff em você, dado pelo acerto dos lacaios, e os Agressivos);
 * - VOCÊ: a Fúria Arcana (a mana gasta no custo), a Inervação (ao matar um Eletrizado), a Trindade e a Tríade Profana (as Ressonâncias), a Gula (a Regurgitação), a
 *   Intensidade Sobrecarregada (a Intensidade perdida);
 * - FEITIÇOS: o Passe Enfeitiçado e o Toque Maldito Desperto (os imunes a Feitiços — o "Anti-Maldições" dos monstros), "não podem causar golpes críticos", o Propagar
 *   Feitiço (a transferência na morte) e a Destruição Iminente (a Explosão Destruidora quando o Feitiço termina);
 * - a Explosão Prismática (o elemento sorteado pelos atributos).
 */

/** "Recentemente" do PoE (4 s). */
export const RECENTE_MS = 4000;
const est = (hunt) => (hunt.poeS2B ??= {});
const num = (x) => Number(x) || 0;

// ---------------------------------------------------------------- RESSONÂNCIA (a Trindade e a Tríade Profana)

/**
 * O PoB (sup_int.lua: SupportTrinity) e o poedb: "Acertos … para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe 25 de Ressonância de outros Elementos
 * [por segundo] por 2 segundos; Perde 5 de Ressonância por segundo para cada Elemento que não estiver ganhando" (a Tríade: "25 … por segundo durante 2 segundos"); o máximo
 * é 50 de cada. O "mais" e a penetração contam a MENOR das três (o PoB: `Multiplier:ResonanceCount`, `div = 5` — para baixo).
 */
export const RESSONANCIA = Object.freeze({ ganhoPorS: 25, perdaPorS: 5, max: 50, ganhoMs: 2000 });
export const TIPOS = Object.freeze({ trindade: ['fire', 'ice', 'energy'], profana: ['chaos', 'energy', 'physical'] });
const ressonanciaDe = (hunt, qual) => {
  const s = est(hunt);
  const chave = qual === 'profana' ? 'profana' : 'trindade';
  return (s[chave] ??= { n: Object.fromEntries(TIPOS[chave].map((t) => [t, 0])), ganha: {}, em: null });
};
/** Corre a Ressonância até `agora`: ganha 25/s enquanto "ganhando" (até 2 s depois do último acerto que a deu), perde 5/s depois; entre 0 e 50. */
function correr(r, agora) {
  const de = r.em ?? agora;
  if (agora > de) {
    for (const t of Object.keys(r.n)) {
      let n = r.n[t];
      const ate = r.ganha[t] ?? -Infinity;
      const fimDoGanho = Math.min(agora, ate);
      if (fimDoGanho > de) n = Math.min(RESSONANCIA.max, n + (RESSONANCIA.ganhoPorS * (fimDoGanho - de)) / 1000);
      const comecoDaPerda = Math.max(de, ate);
      if (agora > comecoDaPerda) n = Math.max(0, n - (RESSONANCIA.perdaPorS * (agora - comecoDaPerda)) / 1000);
      r.n[t] = n;
    }
  }
  r.em = agora;
  for (const t of Object.keys(r.ganha)) if (r.ganha[t] <= agora) delete r.ganha[t];
}
/** A Ressonância agora: `{ n: { tipo: valor }, menor }`. */
export function ressonancia(hunt, qual, agora = hunt?.clock ?? 0) {
  if (!hunt) return { n: {}, menor: 0 };
  const r = ressonanciaDe(hunt, qual);
  correr(r, agora);
  return { n: { ...r.n }, menor: Math.min(...Object.values(r.n)) };
}
/**
 * O ACERTO do uso suportado (`partes`: `[{ elemento, dano }]`, antes da resistência): o maior tipo de dano do acerto; se ele é um dos três da Ressonância, os outros dois
 * passam a "ganhar" por 2 s (o acerto renova). Devolve o tipo maior que valeu (ou null).
 */
export function noAcerto(hunt, qual, partes, agora = hunt?.clock ?? 0) {
  if (!hunt || !partes?.length) return null;
  const porTipo = {};
  for (const p of partes) if (p && p.dano > 0) porTipo[p.elemento] = (porTipo[p.elemento] ?? 0) + p.dano;
  const maior = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const tipos = TIPOS[qual === 'profana' ? 'profana' : 'trindade'];
  if (!maior || !tipos.includes(maior)) return null;
  const r = ressonanciaDe(hunt, qual);
  correr(r, agora);
  for (const t of tipos) if (t !== maior) r.ganha[t] = agora + RESSONANCIA.ganhoMs;
  return maior;
}

// ---------------------------------------------------------------- o USO suportado (os "agora" do uso)

const vezes = (a, b) => ((1 + num(a) / 100) * (1 + num(b) / 100) - 1) * 100;
/**
 * O efeito do USO suportado com o que depende de agora (`ctx`: `{ furiaArcana, perdaDeIntensidade, magia, projetil }`): a Fúria Arcana ("35% mais Dano Mágico enquanto você
 * possuir Fúria Arcana"), as Ressonâncias (a Trindade: "3% mais Dano Elemental por cada 5 da menor", "penetram 16% … enquanto cada Ressonância estiver em ao menos 25"; a
 * Tríade Profana: "+7% de dano por 10 da menor", "90% de chance de ignorar a resistência a caos e elétrico / a redução de dano físico … se cada uma for de, no mínimo,
 * 25"), a Gula (a Regurgitação: os projéteis em círculo e os 7 a mais — e o ganho de Gula do uso) e a Intensidade Sobrecarregada (o crítico por instância). Devolve o efeito.
 */
export function doUso(hunt, entryId, ef, ctx = {}, agora = hunt?.clock ?? 0) {
  if (!hunt || !ef) return ef;
  let e = ef;
  const mudar = (o) => { e = { ...e, ...o }; };
  const af = (k, v) => { if (v) mudar({ [`af:${k}`]: num(e[`af:${k}`]) + v }); };
  // (como o "mais Dano Mágico" dos suportes em `Gemas.efeitoNaSkill`: × o fator do acerto, e à parte para a afecção e o degenerativo mágico)
  if (e.furiaArcanaMaisMagicoPct && ctx.furiaArcana && ctx.magia) mudar({ fatorDeDano: (e.fatorDeDano ?? 1) * (1 + e.furiaArcanaMaisMagicoPct / 100), maisDanoAcertoPct: vezes(e.maisDanoAcertoPct, e.furiaArcanaMaisMagicoPct), maisDanoMagicoPct: vezes(e.maisDanoMagicoPct, e.furiaArcanaMaisMagicoPct) });
  if (e.trindade) {
    const { menor } = ressonancia(hunt, 'trindade', agora);
    af('mais_dano_elemental', num(e.trindadeMaisPor5) * Math.floor(menor / 5));
    if (menor >= 25) af('elem_pen', num(e.trindadePen));
  }
  if (e.profana) {
    const { menor } = ressonancia(hunt, 'profana', agora);
    const mais = num(e.profanaMaisPor10) * Math.floor(menor / 10);
    // (o "mais Dano" geral dos suportes é o `fatorDeDano` — `Gemas.efeitoNaSkill`: o acerto e as afecções)
    if (mais) mudar({ fatorDeDano: (e.fatorDeDano ?? 1) * (1 + mais / 100) });
    if (menor >= 25) { af('ignora_reducao_fisica', num(e.profanaIgnoraFisicoPct)); af('s2b_ignora_res_caos_raio', num(e.profanaIgnoraResPct)); }
  }
  // (a Gula: a magia conjurada com a Regurgitação ativa dispara em círculo, com os projéteis a mais; o ganho de Gula é do uso que sai — `aposPagar`)
  if (e.gulaLimite > 0 && ctx.magia && ctx.projetil && (est(hunt).regurgitaAte ?? 0) > agora) mudar({ emCirculo: 1, alvosExtras: num(e.alvosExtras) + num(e.regurgitaProjeteis) });
  // (a Intensidade Sobrecarregada: as instâncias ativas + as que a Intensidade perdida desde o último uso já deu — elas valem neste)
  if (e.sobrecargaPerda > 0) {
    const s = est(hunt);
    const ja = (s.sobrecarga ?? []).filter((t) => t > agora).length;
    const novas = Math.floor((num(s.intensidadePerdida?.[entryId]) + Math.max(0, num(ctx.perdaDeIntensidade))) / e.sobrecargaPerda);
    const n = ja + novas;
    if (n) { af('crit_chance', num(e.sobrecargaCritPor) * n); af('crit_dmg', num(e.sobrecargaMultPor) * n); }
  }
  return e;
}
/**
 * Depois que o uso SAIU (pagou): a Gula ganha (em 10, perde toda e ganha a Regurgitação) e a Intensidade perdida desde o último uso entra na conta (a cada 6, uma
 * instância de Intensidade Sobrecarregada por 10 s).
 */
export function aposPagar(hunt, entryId, ef, ctx = {}, agora = hunt?.clock ?? 0) {
  if (!hunt || !ef) return;
  const s = est(hunt);
  if (ef.gulaLimite > 0 && ctx.magia && ctx.projetil) {
    s.gula = num(s.gula) + (num(ef.gulaPorUso) || 1);
    if (s.gula >= ef.gulaLimite) { s.gula = 0; s.regurgitaAte = agora + num(ef.regurgitaMs); }
  }
  if (ef.sobrecargaPerda > 0) {
    const perdida = (s.intensidadePerdida ??= {});
    perdida[entryId] = num(perdida[entryId]) + Math.max(0, num(ctx.perdaDeIntensidade));
    s.sobrecarga = (s.sobrecarga ?? []).filter((t) => t > agora);
    while (perdida[entryId] >= ef.sobrecargaPerda) { perdida[entryId] -= ef.sobrecargaPerda; s.sobrecarga.push(agora + num(ef.sobrecargaMs)); }
    s.sobrecarga = s.sobrecarga.slice(-50);
  }
}
/** As instâncias de Intensidade Sobrecarregada ativas agora. */
export const sobrecargaAgora = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeS2B?.sobrecarga ?? []).filter((t) => t > agora).length;
/** A Gula e a Regurgitação agora: `{ gula, regurgitando }`. */
export const gulaAgora = (hunt, agora = hunt?.clock ?? 0) => ({ gula: num(hunt?.poeS2B?.gula), regurgitando: (hunt?.poeS2B?.regurgitaAte ?? 0) > agora });

// ---------------------------------------------------------------- a FÚRIA ARCANA e a INERVAÇÃO (os buffs em você)

/**
 * A FÚRIA ARCANA do suporte: "Ganha Fúria Arcana após Gastar um total de N de Mana em Custos … de uma Habilidade Suportada" — a mana que você pagou no custo, por
 * habilidade; ao chegar no total, o buff (o que sobra conta para o próximo). Devolve `null` ou `{ ms, castPct, regenPct }` (o que o buff dá: o PoB toma o MAIOR entre o do
 * suporte e o da Fúria Arcana comum — `ArcaneSurgeCastSpeed`/`ArcaneSurgeManaRegen` MAX, CalcPerform.lua:690-692).
 */
export function gastarManaArcana(hunt, entryId, mana, ef) {
  const limiar = num(ef?.furiaArcanaLimiar);
  if (!hunt || !(limiar > 0) || !(mana > 0)) return null;
  const g = (est(hunt).arcana ??= {});
  g[entryId] = num(g[entryId]) + mana;
  if (g[entryId] < limiar) return null;
  g[entryId] %= limiar;
  return { ms: num(ef.furiaArcanaMs) || 4000, castPct: num(ef.furiaArcanaCastPct), regenPct: num(ef.furiaArcanaRegenPct) };
}
/**
 * A INERVAÇÃO: "Ganha Inervação ao Matar um Inimigo Eletrizado com Habilidades Suportadas"; "Inervação concede X a Y de Dano de Raio" (o PoB: LightningMin/Max BASE,
 * GlobalEffect Buff — o dano adicionado aos ataques e às magias) por 8 s (+ a qualidade). Devolve `null` ou os bônus temporários (`hunt.poeTemporarios`).
 */
export function inervacaoAoMatar(ef, mortos, agora) {
  if (!(ef?.inervacao > 0) || !(num(ef.inervacaoMax) > 0)) return null;
  const eletrizado = (mortos ?? []).some((b) => (b?.estados?.chocado?.ate ?? 0) > agora);
  if (!eletrizado) return null;
  const ate = agora + (num(ef.inervacaoMs) || 8000);
  const [min, max] = [num(ef.inervacaoMin), num(ef.inervacaoMax)];
  return {
    's2b:inervacao:a:min': { stat: 'added_energy_dmg_min', valor: min, ate }, 's2b:inervacao:a:max': { stat: 'added_energy_dmg_max', valor: max, ate },
    's2b:inervacao:m:min': { stat: 'spell_added_energy_dmg_min', valor: min, ate }, 's2b:inervacao:m:max': { stat: 'spell_added_energy_dmg_max', valor: max, ate },
  };
}

// ---------------------------------------------------------------- os LACAIOS

/** Os seus acertos CRÍTICOS de ataque (o Exemplar — o PoB: `Multiplier:CritRecently`, "# of times your Attacks have Crit Recently"). */
export function notarCriticoDeAtaque(hunt, agora = hunt?.clock ?? 0) {
  if (!hunt) return;
  const s = est(hunt);
  s.critsDeAtaque = [...(s.critsDeAtaque ?? []).filter((t) => agora - t <= RECENTE_MS), agora].slice(-60);
}
export const critsDeAtaqueRecentes = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeS2B?.critsDeAtaque ?? []).filter((t) => agora - t <= RECENTE_MS).length;

/** O que os suportes do lote dão ao LACAIO na invocação (`LacaiosPoe.oQueInvoca` → `l.poe.s2b`), ou null. */
export function doLacaio(efeito) {
  if (!efeito) return null;
  const o = {};
  if (efeito.exemplarCritIncPor) Object.assign(o, { exemplar: { incPor: efeito.exemplarCritIncPor, incMax: efeito.exemplarCritIncMax ?? Infinity, multPor: efeito.exemplarMultPor ?? 0, multMax: efeito.exemplarMultMax ?? Infinity } });
  if (efeito.carneFrescaPct) o.carneFresca = { pct: efeito.carneFrescaPct, maxMs: efeito.carneFrescaMaxMs ?? 10000, crit: efeito.furiaDespertaCrit ?? 0, mult: efeito.furiaDespertaMult ?? 0 };
  if (efeito.lacaioMaisElementalPct) o.maisElementalPct = efeito.lacaioMaisElementalPct;
  if (efeito.lacaioExposicaoPct) o.exposicaoPct = efeito.lacaioExposicaoPct;
  if (efeito.lacaioMenosDanoRecebidoPct) o.menosDanoRecebidoPct = efeito.lacaioMenosDanoRecebidoPct;
  if (efeito.lacaioMaisPertoDeVocePct) o.maisPertoDeVocePct = efeito.lacaioMaisPertoDeVocePct;
  if (efeito.frenesiFamintoPct) o.frenesiFaminto = { pct: efeito.frenesiFamintoPct, ms: efeito.frenesiFamintoMs ?? 4000 };
  // (lote D3, dono 27/10) o Escudo de Carne ("são Defensivos"), o Predador (o foco e o "mais Dano … às suas Presas") e a Legião Infernal (a queima e o dano no lacaio)
  if (efeito.lacaioDefensivo > 0) o.defensivo = true;
  if (efeito.lacaioPredador > 0 || efeito.lacaioMaisPresaPct) o.predador = { maisPct: num(efeito.lacaioMaisPresaPct), foca: efeito.lacaioPredador > 0, ms: num(efeito.presaMs) || PRESA.ms, recargaMs: num(efeito.presaRecargaMs) || PRESA.recargaMs };
  if (efeito.legiaoDps > 0 || efeito.legiaoDegenPct > 0) o.legiao = { dps: num(efeito.legiaoDps), raioM: LEGIAO.raioBaseM + num(efeito.legiaoRaioM), degenPct: num(efeito.legiaoDegenPct) };
  return Object.keys(o).length ? o : null;
}
/**
 * A CARNE FRESCA: "Lacaios criados por Habilidades Suportadas ganham Fúria Desperta e Adrenalina por 10% de sua Duração, máximo de 10 segundos" — o lacaio com duração; o
 * permanente (sem duração) não ganha: 10% de nenhuma duração = 0 s (decisão do dono 27/10, lote D3). Grava `l.s2bCarneFrescaAte` (o relógio da caçada).
 * (lote D3, dono 27/10) + a LEGIÃO INFERNAL: o raio da queima em casas (2 m + o "metros ao Raio" ÷ 2; a fração é a chance de 1 casa a mais — sorteada ao nascer, como a
 * área do jogo) em `l.s2bLegiaoRaio`.
 */
export function aoInvocar(l, agora, rng = Math.random) {
  const g = l?.poe?.s2b?.legiao;
  if (g?.dps > 0) {
    const casas = g.raioM / 2;
    l.s2bLegiaoRaio = Math.trunc(casas) + (rng() < casas % 1 ? 1 : 0);
  }
  const c = l?.poe?.s2b?.carneFresca;
  if (!c || !(l.duracaoMs > 0)) return;
  l.s2bCarneFrescaAte = agora + Math.min(c.maxMs, (l.duracaoMs * c.pct) / 100);
}
/** A LEGIÃO INFERNAL (o PoB: `SupportInfernalLegion` — o `InfernalLegion` do lacaio é uma área de Fogo degenerativa; "40% de sua Vida Máxima como Dano de Fogo por segundo"
 * no próprio lacaio — `FireDegen` pela Vida, que a resistência a Fogo dele reduz). O raio de base é 2 m (1 casa, a decisão do dono). */
export const LEGIAO = Object.freeze({ raioBaseM: 2 });
/**
 * A queima da Legião Infernal neste tique (`ms`): `{ porInimigo, raio, noLacaio }` — o dano de Fogo por inimigo a até `raio` casas do lacaio (o dano por segundo × o
 * "aumentado" e o "mais" do dano do lacaio — `poe.fatorDoDano` — × o multiplicador degenerativo dele), antes da resistência do inimigo; e o dano no lacaio, já com a
 * resistência a Fogo dele (`resFogo`, no teto). Ou null.
 */
export function queimaDaLegiao(l, ms, resFogo = 0) {
  const g = l?.poe?.s2b?.legiao;
  if (!g || !(l.hp > 0)) return null;
  const s = ms / 1000;
  const porInimigo = g.dps > 0 ? g.dps * Math.max(0, num(l.poe.fatorDoFogo ?? l.poe.fatorDoDano) || 1) * Math.max(0, 1 + num(l.poe.dotMulti) / 100) * s : 0;
  const noLacaio = g.degenPct > 0 ? ((num(l.maxHp) * g.degenPct) / 100) * s * Math.max(0, 1 - Math.min(100, num(resFogo)) / 100) : 0;
  return { porInimigo, raio: l.s2bLegiaoRaio ?? Math.max(1, Math.round(g.raioM / 2)), noLacaio };
}

// ---------------------------------------------------------------- a PRESA do Predador (lote D3, decisão do dono 27/10)

/** A "Sinalizar Presa" do Predador (o PoB, `SignalPrey`): recarga 0,8 s, instantânea; a Presa dura 8 s; uma Presa por vez. */
export const PRESA = Object.freeze({ recargaMs: 800, ms: 8000 });
const raroOuUnico = (b) => /raro|unico/.test(String(b?.raridade ?? b?.raridadePoe ?? '')) || !!b?.boss || !!b?.chefe;
/**
 * A Presa é marcada SOZINHA a cada 0,8 s (a recarga dela) enquanto um lacaio seu tem o Predador: no Raro ou Único vivo mais perto de você; sem nenhum, no seu alvo atual
 * (`alvoAtual`); sem alvo, nada. Grava `hunt.poeS2B.presa = { uid, ate }` (a nova tira a velha). Devolve a Presa (o monstro) ou null.
 */
export function tiqueDaPresa(hunt, lacaios, alvoAtual = null, agora = hunt?.clock ?? 0) {
  const pred = (lacaios ?? []).map((l) => (l?.hp > 0 ? l.poe?.s2b?.predador : null)).find(Boolean);
  if (!hunt || !pred) return null;
  const s = est(hunt);
  if ((s.presaProxima ?? -Infinity) > agora) return presaDe(hunt, agora);
  const pos = hunt.pos ?? { x: 0, y: 0 };
  const z = hunt.z ?? 0;
  let melhor = null;
  let menor = Infinity;
  for (const b of hunt.monstros ?? []) {
    if (!(b?.hp > 0) || b.dummy || (b.z ?? z) !== z || !raroOuUnico(b)) continue;
    const d = Math.max(Math.abs(b.x - pos.x), Math.abs(b.y - pos.y));
    if (d < menor) { menor = d; melhor = b; }
  }
  const presa = melhor ?? (alvoAtual?.hp > 0 && !alvoAtual.dummy ? alvoAtual : null);
  if (!presa) return null;
  s.presaProxima = agora + pred.recargaMs;
  s.presa = { uid: presa.uid, ate: agora + pred.ms };
  return presa;
}
/** A Presa viva agora (o monstro), ou null. */
export function presaDe(hunt, agora = hunt?.clock ?? 0) {
  const p = hunt?.poeS2B?.presa;
  if (!p || !(p.ate > agora)) return null;
  return (hunt.monstros ?? []).find((b) => b.uid === p.uid && b.hp > 0) ?? null;
}
/** O monstro é a Presa agora? */
export const ehPresa = (hunt, b, agora = hunt?.clock ?? 0) => !!b && hunt?.poeS2B?.presa?.uid === b.uid && hunt.poeS2B.presa.ate > agora;
/** A Adrenalina do lacaio (a Carne Fresca) agora? */
export const adrenalinaDoLacaio = (l, agora) => (l?.s2bCarneFrescaAte ?? 0) > agora;
/** A ADRENALINA do PoE (o lembrete: 100% de Dano aumentado, 25% de Velocidade de Ataque, Conjuração e Movimento, 10% de Redução de Dano Físico adicional). */
export const ADRENALINA = Object.freeze({ danoIncPct: 100, velPct: 25, movPct: 25, reducaoFisicaPct: 10 });
/**
 * O FRENESI FAMINTO (o PoB, ConfigOptions.lua:436: "10% more Minion Damage, 10% increased Minion Movement Speed, 10% increased Minion Attack and Cast Speed") — o buff em
 * VOCÊ: vale nos seus lacaios enquanto durar.
 */
export const FRENESI_FAMINTO = Object.freeze({ maisDanoPct: 10, movPct: 10, velPct: 10 });
export const frenesiFamintoAtivo = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeS2B?.frenesiFamintoAte ?? 0) > agora;
/** A velocidade de ataque/conjuração a mais do lacaio agora (%): a Adrenalina da Carne Fresca e o Frenesi Faminto. */
export const velDoLacaio = (hunt, l, agora = hunt?.clock ?? 0) => (adrenalinaDoLacaio(l, agora) ? ADRENALINA.velPct : 0) + (l?.tipo !== 'totem' && frenesiFamintoAtivo(hunt, agora) ? FRENESI_FAMINTO.velPct : 0);
/** O movimento a mais do lacaio agora (% — a chance do passo a mais). */
export const movDoLacaio = (hunt, l, agora = hunt?.clock ?? 0) => (adrenalinaDoLacaio(l, agora) ? ADRENALINA.movPct : 0) + (l?.tipo !== 'totem' && frenesiFamintoAtivo(hunt, agora) ? FRENESI_FAMINTO.movPct : 0);
/** "Inimigos Próximos a você": a até 3 casas (a regra das auras "Inimigos Próximos" do jogo — `mods-poe.aurasProximas`). */
export const CASAS_PERTO_DE_VOCE = 3;
/**
 * O golpe do lacaio no `alvo` (`hunt` para você e o seu buff): `{ fator, critInc, critBase, critMult }` — a Adrenalina (100% de Dano aumentado, somado aos aumentos do
 * lacaio — `poe.danoIncPct`), o Frenesi Faminto (10% mais), o Escudo de Carne ("30% mais Dano com Acertos e Afecções aos Inimigos Próximos a você"), o Exemplar (o crítico
 * por crítico de ataque seu recente, com os tetos) e a Fúria Desperta (o crítico e o multiplicador de base).
 */
export function noGolpeDoLacaio(hunt, l, alvo, agora = hunt?.clock ?? 0, { incExtra = 0 } = {}) {
  const s = l?.poe?.s2b;
  // (correções F3: `incExtra` — o aumentado que já entrou por fora, o das suas auras de aliado: os aumentados SOMAM numa conta só, então a Adrenalina normaliza sobre
  // a base com ele; antes, cada um sobre a mesma base, e o produto dava 1,5 × 2 = 3 em vez de 1 + 0,5 + 1 = 2,5)
  const inc = num(l?.poe?.danoIncPct) + num(incExtra);
  let fator = 1;
  if (adrenalinaDoLacaio(l, agora)) fator *= (1 + (inc + ADRENALINA.danoIncPct) / 100) / Math.max(0.01, 1 + inc / 100);
  if (l?.tipo !== 'totem' && frenesiFamintoAtivo(hunt, agora)) fator *= 1 + FRENESI_FAMINTO.maisDanoPct / 100;
  if (s?.maisPertoDeVocePct && alvo && hunt?.pos && Math.max(Math.abs(alvo.x - hunt.pos.x), Math.abs(alvo.y - hunt.pos.y)) <= CASAS_PERTO_DE_VOCE) fator *= 1 + s.maisPertoDeVocePct / 100;
  // (lote D3, dono 27/10) o Predador: "X% mais Dano com Acertos e Afecções às suas Presas" — só contra a Presa
  if (s?.predador?.maisPct && ehPresa(hunt, alvo, agora)) fator *= 1 + s.predador.maisPct / 100;
  let critInc = 0;
  let critMult = 0;
  let critBase = 0;
  if (s?.exemplar) {
    const n = critsDeAtaqueRecentes(hunt, agora);
    critInc += Math.min(s.exemplar.incMax, s.exemplar.incPor * n);
    critMult += Math.min(s.exemplar.multMax, s.exemplar.multPor * n);
  }
  if (s?.carneFresca && adrenalinaDoLacaio(l, agora)) { critBase += s.carneFresca.crit; critMult += s.carneFresca.mult; }
  return { fator, critInc, critBase, critMult };
}
/**
 * (correções F3) O ALVO de quem o lacaio escolhe sozinho (as magias do espectro, as habilidades com recarga): dos `candidatos` (em ordem de preferência), o Escudo de Carne
 * ("Defensivos") deixa só os a até 3 casas de VOCÊ e o Predador ("sempre focam em Presas se possível") pega a Presa se ela está entre eles — como `alvoDoFamiliar`. Ou null.
 */
export function alvoDoLacaio(hunt, l, candidatos, agora = hunt?.clock ?? 0) {
  const s = l?.poe?.s2b;
  let c = candidatos ?? [];
  if (s?.defensivo && hunt?.pos) c = c.filter((b) => Math.max(Math.abs(b.x - hunt.pos.x), Math.abs(b.y - hunt.pos.y)) <= CASAS_PERTO_DE_VOCE);
  if (s?.predador?.foca) { const presa = presaDe(hunt, agora); if (presa && c.includes(presa)) return presa; }
  return c[0] ?? null;
}
/** O crítico do lacaio com os do lote (`c`: o de `LacaiosPoe.criticoDoLacaio`; `x`: o de `noGolpeDoLacaio`). */
export function comCriticoDoLote(l, c, x) {
  if (!x || (!x.critInc && !x.critBase && !x.critMult)) return c;
  const base = num(l?.critChanceBase ?? l?.critChance ?? 5);
  // (a chance do lacaio já é base × (1 + os aumentados); o aumentado do Exemplar soma a eles; a base da Fúria Desperta soma à base)
  const fatorAntes = base > 0 ? c.chance / base : 1;
  const chance = Math.min(100, (base + x.critBase) * (fatorAntes + x.critInc / 100));
  return { chance, mult: c.mult + x.critMult / 100 };
}
/** As PARTES do golpe do lacaio com o "X% mais Dano Elemental" do Exército Elemental (só nas partes de Fogo, Gelo e Raio). */
export function partesDoLacaio(l, partes) {
  const m = num(l?.poe?.s2b?.maisElementalPct);
  if (!m || !partes?.length) return partes;
  return partes.map((p) => (['fire', 'ice', 'energy'].includes(p.tipo) ? { ...p, f: p.f * (1 + m / 100) } : p));
}
/** O dano que o lacaio sofre × (o Escudo de Carne: "sofrem X% menos Dano" — o MORE do PoB; a Adrenalina: 10% de Redução de Dano Físico adicional, na parte física). */
export function fatorDoDanoNoLacaio(l, agora, parteFisica = 0) {
  const menos = num(l?.poe?.s2b?.menosDanoRecebidoPct);
  const adr = adrenalinaDoLacaio(l, agora) ? 1 - (ADRENALINA.reducaoFisicaPct / 100) * Math.max(0, Math.min(1, parteFisica)) : 1;
  return Math.max(0, 1 - menos / 100) * adr;
}
/**
 * O ACERTO do lacaio (depois do dano): a Exposição do Exército Elemental (−X% na resistência do elemento do golpe — o maior tipo dele —, 4 s; o físico e o caos não
 * expõem) e o Frenesi Faminto ("X% de chance de conceder Frenesi Faminto à você no Acerto"). `porExposicao`: a de `condicoes-poe`. Devolve os eventos.
 */
export const EXPOSICAO_MS = 4000;
export function aoAcertarDoLacaio(hunt, l, alvo, tipo, agora, { porExposicao, rng = Math.random } = {}) {
  const s = l?.poe?.s2b;
  const eventos = [];
  if (!s || !alvo) return eventos;
  if (s.exposicaoPct && alvo.hp > 0 && ['fire', 'ice', 'energy'].includes(tipo) && porExposicao?.(alvo, tipo, s.exposicaoPct, EXPOSICAO_MS, agora)) eventos.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: 'exposto' });
  if (s.frenesiFaminto && rng() * 100 < s.frenesiFaminto.pct) {
    const e = est(hunt);
    e.frenesiFamintoAte = Math.max(num(e.frenesiFamintoAte), agora + s.frenesiFaminto.ms);
  }
  return eventos;
}

// ---------------------------------------------------------------- os FEITIÇOS (as maldições Hex)

/**
 * As regras dos suportes do lote no Feitiço (`acoes.efeitosDaMaldicao` → `maldicaoRegras.s2b` → `Reforcos.marcar` grava na maldição do monstro): `afetaAProva` (o Passe
 * Enfeitiçado: "afetam inimigos imunes a feitiços"), `afetaAProvaPct` (o Toque Maldito Desperto: "34% de chance"), `semCritico` ("não podem causar golpes críticos"),
 * `transfereCasas` (o Propagar Feitiço: "se Transferem para todos os Inimigos dentro de 3 metros quando o Inimigo Enfeitiçado morrer", × o alcance aumentado — em casas,
 * 1 casa = 2 m, a fração como chance) e `doom` (a Destruição Iminente). Ou null.
 */
export function regrasDoFeitico(ef) {
  if (!ef) return null;
  const o = {};
  if (ef.feiticoAfetaAProva > 0) o.afetaAProva = true;
  if (ef.feiticoAfetaAProvaPct > 0) o.afetaAProvaPct = ef.feiticoAfetaAProvaPct;
  if (ef.amaldicoadoSemCritico > 0) o.semCritico = true;
  if (ef.feiticoTransfereM > 0) o.transfereCasas = (ef.feiticoTransfereM * (1 + num(ef.feiticoTransfereIncPct) / 100)) / 2;
  // (correções F3) a Destruição Iminente e o Solo Maldito não suportam a maldição aplicada como AURA (a Blasfêmia) — o PoB: SupportImpendingDoom e SupportCursedGround,
  // `excludeSkillTypes` Aura ("Cannot support curse skills which are … applied as an aura", "Supports non-aura hex curse skills")
  const emAura = num(ef.maldicaoEmAura) > 0;
  if (ef.doomBlast > 0 && !emAura) o.doom = true;
  // (lote D3, dono 27/10) o Solo Maldito / o Sapo Enfeitiçado: o Feitiço não pega no acerto — só no solo (`criarSoloMaldito`)
  if (ef.soloMalditoMs > 0 && !emAura) o.soloMaldito = true;
  return Object.keys(o).length ? o : null;
}
/** O monstro tem um Feitiço seu com "não podem causar golpes críticos" ativo? */
export const semCriticoPeloFeitico = (bicho, agora) => Object.values(bicho?.maldicoes ?? {}).some((m) => m?.s2b?.semCritico && m.ate > agora);
/**
 * O PROPAGAR FEITIÇO na morte do `morto`: cada Feitiço dele (não Marca, não aura) com `transfereCasas` passa a todos os vivos no raio (a cópia, com o tempo que faltava; o
 * limite do PoE — a nova tira a mais antiga do grupo dos Feitiços; o à prova de maldições só com o "afeta"). Devolve os monstros que ganharam.
 */
export function transferirFeiticos(hunt, morto, agora = hunt?.clock ?? 0, rng = Math.random) {
  const lista = Object.entries(morto?.maldicoes ?? {}).filter(([, m]) => m && m.ate > agora && !m.marca && !m.aura && m.s2b?.transfereCasas > 0);
  if (!hunt || !lista.length) return [];
  const ganharam = new Set();
  for (const [id, m] of lista) {
    const casas = m.s2b.transfereCasas;
    const raio = Math.trunc(casas) + (rng() < casas % 1 ? 1 : 0);
    for (const b of hunt.monstros ?? []) {
      if (b === morto || !(b.hp > 0) || b.dummy || (b.z ?? 0) !== (morto.z ?? 0) || Math.max(Math.abs(b.x - morto.x), Math.abs(b.y - morto.y)) > raio) continue;
      if (b.aProvaDeMaldicoes && !m.s2b.afetaAProva && !(m.s2b.afetaAProvaPct > 0 && rng() * 100 < m.s2b.afetaAProvaPct)) continue;
      const mal = (b.maldicoes ??= {});
      for (const [k, x] of Object.entries(mal)) if (!(x?.ate > agora)) { antesDeApagar(hunt, b, k, x, agora); delete mal[k]; }
      if (mal[id]) continue;
      const limite = Math.max(1, num(m.s2b.limite) || 1);
      const feiticos = () => Object.entries(mal).filter(([, x]) => !x.marca).sort((a, c) => (a[1].lancada ?? 0) - (c[1].lancada ?? 0));
      while (feiticos().length >= limite) delete mal[feiticos()[0][0]];
      mal[id] = { ...m, efeitos: (m.efeitos ?? []).map((x) => ({ ...x })), s2b: { ...m.s2b }, transferida: true };
      ganharam.add(b);
    }
  }
  return [...ganharam];
}
/**
 * A DESTRUIÇÃO IMINENTE: o Feitiço com `doom` que venceu e vai ser apagado da lista do monstro (o próximo acerto apaga os vencidos — `Reforcos.marcar`): fica pendente para
 * o tique (`hunt.poeS2B.doomPendentes`), uma vez só.
 */
export function antesDeApagar(hunt, bicho, id, m, agora) {
  if (!hunt || !m?.s2b?.doom || m.aura || m.doomFeito || !(m.ate <= agora) || !(bicho?.hp > 0)) return;
  m.doomFeito = true;
  const s = est(hunt);
  s.doomPendentes = [...(s.doomPendentes ?? []), { id, uid: bicho.uid, x: bicho.x, y: bicho.y, z: bicho.z ?? hunt.z ?? 0, ate: m.ate }].slice(-30);
}
/**
 * Os Feitiços seus com `doom` que TERMINARAM (a duração acabou) desde a última volta — `[{ bicho, id }]` (`bicho`: o monstro vivo, ou o lugar dele): cada um sai uma vez só
 * (`doomFeito`). O monstro morto entra pelos pendentes (`feiticosNaMorte` — decisão do dono 27/10); o Feitiço trocado pelo limite não sai.
 */
export function feiticosQueTerminaram(hunt, agora = hunt?.clock ?? 0) {
  const saida = [];
  for (const b of hunt?.monstros ?? []) {
    if (!(b?.hp > 0) || b.dummy || !b.maldicoes) continue;
    for (const [id, m] of Object.entries(b.maldicoes)) if (m?.s2b?.doom && !m.aura && !m.doomFeito && m.ate <= agora) { m.doomFeito = true; saida.push({ bicho: b, id }); }
  }
  const s = hunt?.poeS2B;
  if (s?.doomPendentes?.length) {
    // (lote D3: o do morto vale no tique da morte — um segundo depois, a sala já mudou)
    for (const p of s.doomPendentes.filter((x) => !x.morto || agora - x.ate <= 1000)) saida.push({ bicho: (hunt.monstros ?? []).find((b) => b.uid === p.uid && b.hp > 0) ?? { uid: p.uid, x: p.x, y: p.y, z: p.z }, id: p.id });
    s.doomPendentes = [];
  }
  return saida;
}
/**
 * (lote D3, decisão do dono 27/10) A DESTRUIÇÃO IMINENTE também quando o amaldiçoado MORRE com o Feitiço nele (ativo): fica pendente para o tique, no lugar dele, uma vez
 * só. O Feitiço que outro tira pelo limite de maldições NÃO a ativa (o `Reforcos.marcar` apaga sem passar por aqui). Devolve quantos ficaram pendentes.
 */
export function feiticosNaMorte(hunt, morto, agora = hunt?.clock ?? 0) {
  if (!hunt || !morto?.maldicoes) return 0;
  let n = 0;
  for (const [id, m] of Object.entries(morto.maldicoes)) {
    if (!m?.s2b?.doom || m.doomFeito || m.marca || m.aura || !(m.ate > agora)) continue;
    m.doomFeito = true;
    const s = est(hunt);
    s.doomPendentes = [...(s.doomPendentes ?? []), { id, uid: morto.uid, x: morto.x, y: morto.y, z: morto.z ?? hunt.z ?? 0, ate: agora, morto: true }].slice(-30);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- o SOLO MALDITO (e o do Sapo Enfeitiçado) — lote D3, decisão do dono 27/10

/**
 * "Habilidades suportadas criam Solo Maldito com uma Duração base de 34 segundos; Feitiços de Habilidades Suportadas não tem Duração; Inimigos em Solo Maldito … são
 * Amaldiçoados com tal Feitiço; Limite de 1 área de Solo Maldito" (o PoB: `base_hex_zone_skill_duration_ms`). Ao ligar o buff do Feitiço, o solo nasce no `centro` (o
 * alvo atual; sem alvo, o inimigo mais perto) com o raio da maldição (`casas`; a fração é a chance de 1 casa a mais, sorteada ao nascer); o novo tira o velho (o `n`).
 * `efeitos`: os do buff do Feitiço (`efeitosPoe`, com as regras). `sapoMs`: o Sapo Enfeitiçado (o primeiro Sapo Explosivo sai um intervalo depois). Devolve o solo.
 */
export function criarSoloMaldito(hunt, { id, centro, casas = 0, ms, efeitos, fator = 1, lancado, sapoMs = 0 }, agora = hunt?.clock ?? 0, rng = Math.random) {
  if (!hunt || !centro || !(ms > 0)) return null;
  const s = est(hunt);
  s.soloN = num(s.soloN) + 1;
  const c = Math.max(0, num(casas));
  const raio = Math.trunc(c) + (rng() < c % 1 ? 1 : 0);
  s.solo = { id, n: s.soloN, x: centro.x, y: centro.y, z: centro.z ?? hunt.z ?? 0, raio, ate: agora + ms, efeitos: efeitos ?? [], fator, lancado: lancado ?? agora, ...(sapoMs > 0 ? { sapoMs, sapoEm: agora + sapoMs } : {}) };
  return s.solo;
}
/** O Solo Maldito ativo agora, ou null. */
export const soloAgora = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeS2B?.solo?.ate > agora ? hunt.poeS2B.solo : null);
/** O monstro está dentro do solo? (o mesmo andar, a até o raio em casas — Chebyshev) */
export const noSolo = (solo, b) => !!solo && !!b && (b.z ?? solo.z) === solo.z && Math.max(Math.abs(b.x - solo.x), Math.abs(b.y - solo.y)) <= solo.raio;
/** A duração do Feitiço posto pelo solo ("não tem Duração"): sem fim — só sai quando o inimigo sai do solo ou o solo acaba. */
export const SEM_DURACAO_MS = 1e12;

/** O uso da recarga com usos ("Recarga: 0.15 seg (3 Times)"): os usos guardados recarregam um a um. `chave` no estado. Devolve se pode (e gasta um). */
export function gastarUso(hunt, chave, recargaMs, usos = 1, agora = hunt?.clock ?? 0) {
  const s = est(hunt);
  const r = (s.recargas ??= {})[chave] ?? { n: usos, em: agora };
  if (r.n < usos && recargaMs > 0) {
    const ganhos = Math.floor((agora - r.em) / recargaMs);
    if (ganhos > 0) { r.n = Math.min(usos, r.n + ganhos); r.em = r.n >= usos ? agora : r.em + ganhos * recargaMs; }
  }
  if (r.n < 1) { s.recargas[chave] = r; return false; }
  if (r.n >= usos) r.em = agora;
  r.n -= 1;
  s.recargas[chave] = r;
  return true;
}

// ---------------------------------------------------------------- a EXPLOSÃO PRISMÁTICA

/**
 * O elemento da Explosão Prismática: "Ter maior força faz com que seja mais provável que ele escolha fogo, maior destreza … gelo e maior inteligência … raio" — a chance de
 * cada um proporcional ao atributo (Força : Destreza : Inteligência); sem atributos, um terço cada.
 */
export function elementoDoPrisma(forca, destreza, inteligencia, rng = Math.random) {
  const pesos = [['fire', Math.max(0, num(forca))], ['ice', Math.max(0, num(destreza))], ['energy', Math.max(0, num(inteligencia))]];
  const total = pesos.reduce((t, [, p]) => t + p, 0);
  if (!(total > 0)) return pesos[Math.min(2, Math.floor(rng() * 3))][0];
  let r = rng() * total;
  for (const [el, p] of pesos) { if (r < p) return el; r -= p; }
  return 'energy';
}
