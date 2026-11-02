// O LOTE T1 das gemas do PoE (rodada 4, 27/10: as "implementadas, sem teste próprio" — o teste de cada uma mostrou o que o status dizia e o jogo não fazia). Aqui ficam
// os DADOS e as contas PURAS (sem a caçada); quem usa é gemas-poe.mjs (a gema compilada) e acoes.mjs (o uso).
//
// O que o lote corrige (o PoB, /home/deploy/referencias-poe/pob; o poedb salvo):
//   - a LEGIÃO CONGELADA e a do AGRUPAMENTO (act_str.lua FrozenSweep / FrozenSweepAltX — o ataque Arrastão Congelante das Estátuas): o dano-base do golpe é o do
//     Arrastão, a ÚLTIMA parte da célula "Base Damage" do poedb ("100%, 100%, 100%, 184.9%" — o PoB: baseMultiplier 1,849 no nível 20; 3,329 na base); antes o
//     jogo tomava a primeira (100%). E o Arrastão converte 100% do Físico em Gelo (skill_physical_damage_%_to_convert_to_cold), ataca a 70% da velocidade
//     (attackSpeedMultiplier −30) e acerta numa área de 2,5 m (radius 25);
//   - o CICLONE VAAL (act_dex.lua VaalCyclone — "Duração base é de 5 segundos"): o uso gira pela duração (× os modificadores de Duração), um acerto a cada tempo de
//     ataque dele (300% da velocidade-base); antes o uso era UM acerto e a duração não fazia nada. O idle faz o giro como os N acertos do uso, que ocupa os N tempos
//     de ataque — o mesmo modelo do Golpe Cintilante Vaal;
//   - o ARCO ELÉTRICO VAAL (act_int.lua VaalArc — "Also grants a buff making your Arc damage lucky for a short duration"; base_skill_effect_duration 4000,
//     Condition:CanBeLucky como buff): o uso liga o buff por 4 s (× a Duração) e, com ele, o dano dos Arcos Elétricos (o comum, as alternativas e o Vaal) é
//     Sortudo — rola duas vezes e fica o maior; antes a linha "Duração base é de 4 segundos" não fazia nada;
//   - o DETONAR MORTO DA REAÇÃO EM CADEIA (act_dex.lua DetonateDeadAltX — "This will continue to target other corpses in the area … until it runs out of corpses
//     or has destroyed 8 corpses"): depois do primeiro, o uso explode os outros cadáveres em cadeia — o mais perto de um cadáver que já explodiu, dentro da área da
//     explosão dele —, até 8; antes explodia um.

/** As gemas da Legião Congelada (a base e a do Agrupamento): o Arrastão Congelante das Estátuas. */
const LEGIAO = /^Frozen_Legion(?:_of_Rallying)?$/;
export const ARRASTAO = Object.freeze({ conversaoGeloPct: 100, velAtaqueBase: 70, raioM: 2.5, castTimeS: 0.7 });
/** O tempo de UM Arrastão Congelante da Estátua (ms): o intervalo do seu ataque com a arma (`intervaloMs`, já com a sua Velocidade de Ataque) ÷ os 70% dele. */
export const atrasoDoArrastaoMs = (intervaloMs, velPct = ARRASTAO.velAtaqueBase) => Math.max(1, Math.round((Number(intervaloMs) || 0) / ((Number(velPct) || 100) / 100)));
/** O dano-base do Arrastão na célula "Base Damage" do poedb (a última parte, em fração); null se não houver. */
export function efetividadeDoArrastao(celula) {
  const partes = String(celula ?? '').split(',').map((t) => parseFloat(t)).filter((v) => Number.isFinite(v));
  return partes.length > 1 ? partes.at(-1) / 100 : null;
}
/**
 * A gema compilada com as correções do lote (`GemasPoe.compilada`): devolve a nova, ou a mesma. `celulaDoDano`: a célula "Base Damage" do nível (o poedb).
 */
export function corrigirCompilada(slug, h, celulaDoDano) {
  if (!h || !LEGIAO.test(String(slug ?? ''))) return h;
  const ef = efetividadeDoArrastao(celulaDoDano);
  // (C1, dono 28/10) os 70% da velocidade são do ATAQUE da Estátua (`velArrastao`), não do SEU uso (o PoB: FrozenSweep attackSpeedMultiplier −30 é da Estátua).
  // O CONFLITO T1 × T3: o T1 punha `velAtaqueBase: 70` na gema, e o seu uso virava o ataque da arma ÷ 0,7 (a Clava de Madeira: 769 → 1099 ms), mais longo que a
  // recarga de 0,8 s — o uso seguinte das Estátuas (lote T3) ficava "Ainda recarregando" pelo relógio do grupo. (No PoB o seu uso é uma magia de 0,7 s — castTime
  // 0.7 —; o jogo segue com o tempo do ataque da arma, como antes do T1.)
  // (rodada 4, correções finais — achado C) o SEU uso é a MAGIA do PoB: castTime 0,7 pela Velocidade de Conjuração (`usoComoMagia` — `Acoes.temposDaGemaPoe`); o golpe
  // segue o ataque da arma (as Estátuas). Os 70% são do Arrastão de cada Estátua: ela acerta depois do tempo de UM ataque dela — o da arma, com a sua Velocidade de
  // Ataque, ÷ 0,7 (`Acoes.criarObjetoT3`, `GemasT1.atrasoDoArrastaoMs`).
  const st = { ...h.stats, conversao: [{ para: 'gelo', pct: ARRASTAO.conversaoGeloPct }], velArrastao: ARRASTAO.velAtaqueBase, raio: ARRASTAO.raioM, raioFinal: ARRASTAO.raioM, tempoUso: ARRASTAO.castTimeS, usoComoMagia: true, ...(ef ? { efetividade: ef } : {}) };
  return { ...h, stats: st };
}

/** O Ciclone Vaal: quantos acertos o giro dá — a duração (ms, já com os modificadores) ÷ o tempo de um ataque dele (ms), pelo menos 1. */
export const CICLONE_VAAL = 'Vaal_Cyclone';
export function acertosDoCicloneVaal(duracaoMs, ataqueMs) {
  if (!(duracaoMs > 0) || !(ataqueMs > 0)) return 1;
  return Math.max(1, Math.round(duracaoMs / ataqueMs));
}

/** O Arco Elétrico Vaal: o buff "dano dos Arcos Elétricos Sortudo" (`hunt.poeArcoSortudo`, o fim em ms). */
export const ARCO_VAAL = 'Vaal_Arc';
const ARCOS = /^(?:Vaal_)?Arc(?:_of_[A-Za-z_]+)?$/;
export const ehArco = (slug) => ARCOS.test(String(slug ?? ''));
export function ligarArcoSortudo(hunt, ate) {
  if (!hunt || !(ate > 0)) return;
  hunt.poeArcoSortudo = Math.max(Number(hunt.poeArcoSortudo) || 0, ate);
}
/** O acerto deste Arco é Sortudo agora? (o buff ainda vale; depois dele o campo sai) */
export function arcoSortudo(hunt, slug, agora) {
  if (!hunt?.poeArcoSortudo) return false;
  if (hunt.poeArcoSortudo <= agora) { delete hunt.poeArcoSortudo; return false; }
  return ehArco(slug);
}

/** O Detonar Morto da Reação em Cadeia: até quantos cadáveres o uso explode (null nas outras). */
export const cadeiaDeCadaveres = (slug) => (slug === 'Detonate_Dead_of_Chain_Reaction' ? 8 : null);
/**
 * A CADEIA: a partir dos cadáveres do uso, os outros de `podem` — o mais perto de um que já explodiu, a até `raioCasas` dele —, até `maximo` no total.
 */
export function encadearCadaveres(escolhidos, podem, raioCasas, maximo) {
  const lista = [...escolhidos];
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  while (lista.length < maximo) {
    let melhor = null;
    let d0 = Infinity;
    for (const c of podem) {
      if (lista.includes(c)) continue;
      const d = Math.min(...lista.map((x) => dist(x, c)));
      if (d <= raioCasas && d < d0) { melhor = c; d0 = d; }
    }
    if (!melhor) break;
    lista.push(melhor);
  }
  return lista;
}
