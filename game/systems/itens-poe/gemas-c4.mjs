// O LOTE C4 das gemas ativas do PoE (dono, 21/10: as de corpo a corpo, impacto e canalização — os debuffs canalizados e as afecções específicas). Aqui ficam os
// DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o
// status), `acoes.mjs` (o uso e a morte), `afeccoes.mjs` (o Veneno) e `combate/dot.mjs` (as camadas no pulso).
//
// As decisões do dono (21/10 — as recomendações do plano do grupo corpo a corpo/impacto/canalização, aceitas):
//   - D4.1: o TOLHIMENTO é o `lento` do jogo com a porcentagem do PoE, e vale o mais forte (o PoE: "A creature can only be affected by one Hinder at a time; …
//     only the strongest Hinder takes effect" — o poedb). O teto do `lento` (`gamedata/gemas/config.json` → `estados.lento.maximo`, 40%) e a metade no chefe
//     seguem como estão: o PoE não tem esse teto no Tolhimento (pendência levada ao dono — ver docs/gemas-poe-progresso.md, seção C4);
//   - D4.2: as CAMADAS da Praga — cada uso canalizado soma uma camada, cada uma com a sua duração; o dano é o de uma camada × as camadas vivas no pulso (o PoB:
//     Damage MORE 100 × (estágios − 1), act_int.lua:1897 — "+100% mais por camada depois da primeira"); no máximo, a nova entra no lugar da mais antiga;
//   - D4.3: o raio da explosão da Golpe Pestilento é o da gema (radius 27 — 2,7 m);
//   - D4.4: os clones do Golpe Duplo Vaal não andam no jogo (a sessão dos lacaios) — o "+X% de Velocidade de Movimento" deles é limitação do idle.
// O resto pela regra do PoE (o PoB):
//   - a Praga (act_int.lua:1897-2240): base_secondary_skill_effect_duration (1 s; a da Atrofia 3 s, +50 ms por qualidade), base_movement_velocity_+% −80,
//     display_max_blight_stacks 20 (a do Contágio, 6); "Enemies who aren't already debuffed by Blight are also hindered" — só quem não tem uma camada da Praga;
//     a da Atrofia: enemies_you_hinder_have_life_regeneration_rate_+% −80 (o Tolhido por ela); a Vaal (não canaliza): Tolhe sempre, 3 s, e
//     hinder_enemy_chaos_damage_taken_+% 30 (ChaosDamageTaken INC no Tolhido — no acerto e no pulso do dano contínuo);
//   - o Definhar (act_int.lua:21232): active_skill_withered_base_duration_ms 2000 (o Definhamento — o `definhado` do jogo, +6% de Caos sofrido por acúmulo,
//     até 15), base_skill_effect_duration 500 (o Tolhimento), base_movement_velocity_+% do nível; as duas durações × a Duração da Habilidade;
//   - o Golpe Pestilento (act_dex.lua:11238): active_skill_poison_duration_+%_final 30 (+1 por qualidade — o mesmo stat, somado); o debuff no acertado
//     (base_skill_effect_duration 1 s); "If a debuffed enemy dies while poisoned, Pestilent Strike inflicts a secondary chaos damage over time debuff on enemies
//     around them, based on the poisons on the slain enemy. This damage is not affected by your damage modifiers": mamba_strike_deal_%_of_all_poison_total_
//     damage_per_minute 3000 (50%/s do que falta de todos os Venenos no morto) por base_secondary_skill_effect_duration (1 s × a Duração);
//   - o Golpe da Víbora da Mamba (act_dex.lua:16543): cannot_inflict_additional_poisons (um Veneno por ataque: os "envenenamentos adicionais" não valem) e
//     cannot_poison_poisoned_enemies (o inimigo já Envenenado, por quem for, não recebe o desta gema).
//
// (Sem dependência da caçada: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/ㅤ/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- a Praga

export const PRAGA = /^(Vaal_)?Blight(_of_(Contagion|Atrophy))?$/;
const LINHA_TOLHE = /^Velocidade de Movimento reduzida em ([\d.]+) %$/i;
const LINHA_CAMADAS = /^Debuff pode ter até (\d+) camadas de Dano$/i;
const LINHA_REGEN_DO_TOLHIDO = /^Regeneração de Vida reduzida em ([\d.]+) %$/i;
const LINHA_CAOS_DO_TOLHIDO = /^Inimigos Desacelerados sofrem Dano de Caos aumentado em ([\d.]+) %$/i;
const LINHA_SECUNDARIA = /^Duração Base Secundária é de ([\d.]+) segundos?$/i;
/**
 * A Praga (`{ max, tolhePct, tolheMs, regenMenosPct, caosSofridoPct, soSemPraga }`), ou null. `tolheMs`: a Duração Secundária (o nível + a qualidade da Atrofia),
 * antes da Duração da Habilidade; `soSemPraga`: o Tolhimento só em quem ainda não tem uma camada da Praga (as canalizadas — a Vaal Tolhe sempre).
 */
export function pragaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!PRAGA.test(slug)) return null;
  const max = achar(linhas, LINHA_CAMADAS);
  if (!max) return null;
  return {
    max, tolhePct: achar(linhas, LINHA_TOLHE) ?? 0, tolheMs: Math.round(((achar(linhas, LINHA_SECUNDARIA) ?? 0) + somar(daQualidade, LINHA_SECUNDARIA)) * 1000),
    regenMenosPct: achar(linhas, LINHA_REGEN_DO_TOLHIDO) ?? 0, caosSofridoPct: achar(linhas, LINHA_CAOS_DO_TOLHIDO) ?? 0, soSemPraga: !/^Vaal_/.test(slug),
  };
}
/** O inimigo já tem uma camada viva de alguma Praga (o "already debuffed by Blight")? */
export const temPraga = (bicho, agora) => (bicho?.dots ?? []).some((d) => PRAGA.test(d.chave ?? '') && d.falta > 0 && (d.camadas ?? [d.ate]).some((a) => a >= agora));
/**
 * (D4.2) As CAMADAS no dano contínuo `d` da Praga, depois de mais uma (que acaba em `ate`): as vivas (as que acabam depois de agora) + a nova; cheia (`max`), a mais
 * antiga sai. O pulso passa a ser o de uma camada (`porPulsoCamada`) × as camadas vivas naquele pulso (`Dot.tique`); `falta` é a soma do que cada camada ainda
 * paga nos pulsos que lhe restam, e `ate`, o fim da última. Devolve as camadas de agora.
 */
export function porCamada(d, { ate, max, porPulsoCamada, pulsoMs, agora }) {
  const vivas = (d.camadas ?? []).filter((a) => a > agora).sort((a, b) => a - b);
  while (vivas.length >= Math.max(1, max)) vivas.shift();
  vivas.push(ate);
  d.camadas = vivas;
  d.porPulsoCamada = porPulsoCamada;
  d.ate = Math.max(...vivas);
  d.falta = faltaDasCamadas(d, pulsoMs);
  d.porPulso = porPulsoCamada * vivas.length;
  return vivas.length;
}
/** O que as camadas ainda pagam: cada uma, o seu dano por pulso em cada pulso que cai até o fim dela (do próximo pulso do dano contínuo em diante). */
export function faltaDasCamadas(d, pulsoMs) {
  let t = 0;
  for (const a of d.camadas ?? []) {
    const pulsos = a >= d.proximo ? Math.floor((a - d.proximo) / Math.max(1, pulsoMs)) + 1 : 0;
    t += pulsos * (d.porPulsoCamada ?? 0);
  }
  return t;
}
/** As camadas vivas no pulso `quando` (as que acabam nele ou depois). */
export const camadasNoPulso = (d, quando) => (d.camadas ?? []).filter((a) => a >= quando).length;

// ---------------------------------------------------------------- o Definhar

const LINHA_DEFINHADO = /^Definhado dura ([\d.]+) segundos?$/i;
const LINHA_CAOS_SOFRIDO = /^Dano de Caos sofrido aumentado em ([\d.]+) %$/i;
const LINHA_DURACAO_BASE = /^Duração base é de ([\d.]+) segundos?$/i;
/** O Definhar (`{ definhadoMs, tolhePct, tolheMs, caosPorDefinhamentoPct }`), ou null — as durações antes da Duração da Habilidade. */
export function definharDasLinhas(slug, linhas = []) {
  if (slug !== 'Wither') return null;
  const s = achar(linhas, LINHA_DEFINHADO);
  if (s == null) return null;
  return { definhadoMs: Math.round(s * 1000), tolhePct: achar(linhas, LINHA_TOLHE) ?? 0, tolheMs: Math.round((achar(linhas, LINHA_DURACAO_BASE) ?? 0.5) * 1000), caosPorDefinhamentoPct: achar(linhas, LINHA_CAOS_SOFRIDO) ?? 6 };
}

// ---------------------------------------------------------------- o Golpe Pestilento

const LINHA_DURACAO_DO_VENENO = /^\+?([\d.]+) % mais Duração do Veneno$/i;
const LINHA_SECUNDARIO = /^Debuff Secundário causa ([\d.]+) % do total restante do Dano Venenoso Esperado de todos os Venenos no Inimigo morto por segundo como Dano de Caos$/i;
/** O raio da explosão (o da gema — D4.3: radius 27 no PoB, 2,7 m). */
export const PESTILENTO = Object.freeze({ raioM: 2.7 });
/** O Golpe Pestilento (`{ venenoDuracaoMaisPct, debuffMs, porSegundoPct, secundarioMs, raioM }`), ou null. */
export function pestilentoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Pestilent_Strike') return null;
  const porSegundoPct = achar(linhas, LINHA_SECUNDARIO);
  if (porSegundoPct == null) return null;
  return {
    venenoDuracaoMaisPct: somar([...linhas, ...daQualidade], LINHA_DURACAO_DO_VENENO), debuffMs: Math.round((achar(linhas, LINHA_DURACAO_BASE) ?? 1) * 1000), porSegundoPct,
    secundarioMs: Math.round((achar(linhas, LINHA_SECUNDARIA) ?? 1) * 1000), raioM: PESTILENTO.raioM,
  };
}
/** O total do debuff secundário: X%/s do que falta de todos os Venenos no morto × a duração (em s) — sem os seus modificadores de dano. */
export function totalDoSecundario(morto, p, duracaoMs) {
  const veneno = (morto?.dots ?? []).filter((d) => (d.tipo === 'venenoPoe' || d.tipo === 'veneno') && d.falta > 0).reduce((t, d) => t + d.falta, 0);
  return (veneno * (p?.porSegundoPct ?? 0) * (Math.max(0, duracaoMs) / 1000)) / 100;
}

// ---------------------------------------------------------------- o Golpe da Víbora da Mamba

const LINHA_UM_VENENO = /^Não pode infligir múltiplos envenenamentos com o mesmo ataque$/i;
const LINHA_NAO_ENVENENA_ENVENENADO = /^Não pode infligir Envenenamento em Inimigos Envenenados$/i;
/** As regras do Veneno da gema (`{ venenoUnico, naoEnvenenaEnvenenado, venenoDuracaoMaisPct }`) — as que o `AfeccoesPoe.aoAcertar` lê —, ou null. */
export function venenoDasLinhas(slug, linhas = [], daQualidade = []) {
  const venenoUnico = linhas.some((l) => LINHA_UM_VENENO.test(norm(l)));
  const naoEnvenenaEnvenenado = linhas.some((l) => LINHA_NAO_ENVENENA_ENVENENADO.test(norm(l)));
  const venenoDuracaoMaisPct = slug === 'Pestilent_Strike' ? somar([...linhas, ...daQualidade], LINHA_DURACAO_DO_VENENO) : 0;
  return venenoUnico || naoEnvenenaEnvenenado || venenoDuracaoMaisPct ? { venenoUnico, naoEnvenenaEnvenenado, venenoDuracaoMaisPct } : null;
}
/** As afecções do uso com as regras do Veneno da gema. */
export function comOVenenoDaGema(afeccoes, v) {
  if (!afeccoes || !v) return afeccoes;
  return {
    ...afeccoes,
    ...(v.venenoUnico ? { venenoUnico: true } : {}), ...(v.naoEnvenenaEnvenenado ? { naoEnvenenaEnvenenado: true } : {}),
    ...(v.venenoDuracaoMaisPct ? { venenoDuracaoMais: (afeccoes.venenoDuracaoMais ?? 0) + v.venenoDuracaoMaisPct } : {}),
  };
}

// ---------------------------------------------------------------- o status

const LINHA_CLONES = /^Clones possuem [\d.]+ % de aumento da Velocidade de Movimento$/i;
/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaC4(slug, l) {
  const t = norm(l);
  if (PRAGA.test(slug) && [LINHA_TOLHE, LINHA_CAMADAS, LINHA_REGEN_DO_TOLHIDO, LINHA_CAOS_DO_TOLHIDO].some((re) => re.test(t))) return true;
  if (slug === 'Wither' && [LINHA_DEFINHADO, LINHA_TOLHE, LINHA_CAOS_SOFRIDO].some((re) => re.test(t))) return true;
  if (slug === 'Pestilent_Strike' && (LINHA_DURACAO_DO_VENENO.test(t) || LINHA_SECUNDARIO.test(t))) return true;
  if (LINHA_UM_VENENO.test(t) || LINHA_NAO_ENVENENA_ENVENENADO.test(t)) return true;
  // (D4.4) a do clone vai como limitação do idle (`MOTIVOS_C4`)
  if (slug === 'Vaal_Double_Strike' && LINHA_CLONES.test(t)) return true;
  return false;
}
/** A gema sem dano direto que tem o efeito dela no jogo (o Definhar: o Definhamento e o Tolhimento). */
export const EFEITO_SEM_DANO = Object.freeze(new Set(['Wither']));

/**
 * O que a mecânica do lote ainda não faz, ou o que é limitação do idle — sem linha (o status não a vê). Uma gema sem nada aqui segue o PoE pelas linhas.
 */
export const MOTIVOS_C4 = Object.freeze({
  // (D4.4) o "limitação do idle:" é lido pelo relatório (`tools/relatorio-gemas-poe.mjs` — LIMITACAO_IDLE)
  Vaal_Double_Strike: ['limitação do idle: os clones do Golpe Duplo Vaal não andam no jogo — o "Clones possuem X% de aumento da Velocidade de Movimento" não tem onde valer (D4.4)'],
  // (decisão do dono pendente) "Then applies two additional layers in a larger area, growing greatly in size each time": o PoE não publica o crescimento, e o PoB
  // não conta as duas camadas a mais (VaalBlight sem o Damage MORE por estágio)
  Vaal_Blight: ['efeito não simulado: as duas camadas adicionais da Praga Vaal (em áreas cada vez maiores) — o PoE não publica o crescimento da área e o PoB não as conta; o uso põe uma camada (decisão do dono pendente)'],
});
