// O LOTE C3 das gemas ativas do PoE (dono, 25/10: as de corpo a corpo, impacto e canalização — a POSTURA e os OBJETOS NO TEMPO). Aqui ficam os DADOS (o que as
// linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o status),
// `condicoes-poe.mjs` (a Postura e a Tempestade de Lâminas Sangrenta) e `acoes.mjs` (o uso, os objetos de `hunt.poeObjetos` e o tique).
//
// As decisões do dono (25/10 — as recomendações do plano do grupo corpo a corpo/impacto/canalização, aceitas):
//   - D3.1: "mudou de Postura Recentemente" = os últimos 4 s desde a TROCA do buff do Sangue e Areia (`trocarPostura`); sem o buff, Postura de Sangue (o padrão
//     do PoE: "Você fica automaticamente em Postura de Sangue"). O SANGUE E AREIA como o PoE (o PoB, act_str.lua:1228 — BloodAndSand): ligar a gema põe o buff na
//     Postura de SANGUE (com os bônus de Sangue); usar de novo, com ele ligado, ALTERNA para a de Areia (e de volta). Antes o jogo tinha o sinal invertido: o buff
//     ligado era a Areia e os bônus de Sangue nunca valiam;
//   - D3.2: o RITMO dos pulsos — a Tempestade de Lâminas acerta a cada tempo de ataque da gema; a Tempestade Furiosa, a cada tempo de ataque ÷ 3,5 (o "250% mais
//     Frequência" — rage_slash_vortex_attack_speed_+%_final 250);
//   - D3.3: as ESTACAS da Perfuração na Postura de Sangue (e sempre na da Carnificina) caem nas casas da área em volta do alvo, uma em cada 3 no próprio alvo; cada
//     estaca acerta quem está no raio dela (0,8 m na de Sangue, 1,1 m na da Carnificina — o PoB), e o mesmo inimigo pode levar de mais de uma;
//   - D3.4: o ABALO SECUNDÁRIO do Terremoto é um objeto parado no ponto do impacto que estoura uma vez ao fim da duração (1 s × a Duração; o da Amplificação, 2,5 s);
//     o Terremoto Vaal deixa um abalo no uso e, por 12 s × a Duração, um a cada ataque seu (só quando o anterior já estourou — "cracking the earth if the previous
//     cracks have erupted"), até 9 no total;
//   - D3.5: a TORMENTA EXPLOSIVA — 1 orbe por uso canalizado, que acerta ao nascer e salta para o vivo mais perto a cada 0,4 s até a duração acabar; ao parar de
//     canalizar, cada orbe explode com max(0, 75 × saltos restantes − 100)% mais dano (o PoB: storm_burst_new_damage_+%_final_per_remaining_teleport_zap 75, a
//     conta do preDamageFunc), no raio secundário (2,2 m).
// O resto pela regra do PoE (o PoB):
//   - a Dilaceração (act_dex.lua:9946): o "mais Dano com Sangramento" e o "25% de chance de Sangrar" só na Postura de Sangue; a qualidade, "Velocidade de Ataque
//     aumentada em X% caso tenha mudado de Postura Recentemente" (`linhas-das-gemas` — a condição `mudouPosturaRecente`);
//   - a Perfuração (act_str.lua:8227): blood_spears_base_number_of_spears 7 (+0,1 por qualidade), −75% na de Sangue, a área de Areia (1,1 m, 76% mais); a da
//     Dualidade: 5 estacas, +10 "se mudou de Postura Recentemente", o "+0,25% mais Dano na Postura de Sangue" por qualidade (no mesmo −75%); a da Carnificina: 6
//     estacas sempre em sequência (raio 1,1 m);
//   - a Tempestade de Lâminas (act_str.lua:1007): bladestorm_storm_damage_+%_final −50 (a tempestade, nos acertos e nas afecções), o máximo de 3 (+0,05 por
//     qualidade), 3 s, o raio da tempestade 2 m (radiusSecondary 20); a de Sangue fica parada e Sangra (BleedChance 100 na parte da tempestade, em Postura de
//     Sangue), a de Areia Cega; "12% mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas" (a condição `emTempestadeSangrenta`);
//     a da Incerteza: 50% de chance de criar a da outra Postura (bladestorm_create_alternate_stance_storm_%_chance), sem o Sangrar da tempestade;
//   - o Vórtice Furioso (act_str.lua:9005): rage_slash_sacrifice_rage_% 20 (+0,25 por qualidade) com ao menos 10 de Fúria, 10% mais dano por Fúria sacrificada,
//     +1 u (0,1 m) de raio por 2 sacrificadas, 1 tempestade, 3 s; a tempestade vai para a frente atrás dos inimigos (persegue); a do Berserker (act_str.lua:9130):
//     presa em você, sem duração — perde 3 de Fúria por segundo (rage_storm_scaling_rage_hundred_times_base_cost 300), 20% mais a cada segundo
//     (rage_storm_scaling_rage_loss_+%_per_second 20), e acaba quando a Fúria acaba;
//   - o Terremoto (act_str.lua:3282): quake_slam_fully_charged_explosion_damage_+%_final 150 (+1,5 por qualidade) — Hit e Ailment —, o abalo no raio 2,8 m (radius 28
//     da parte 2); a Amplificação: 15% / 5% / 2% mais (acerto / afecção / área) por 0,1 s de duração (⌊duração × 10⌋, a do PoB); o Vaal: 407% (+1,5 por qualidade),
//     base_secondary_skill_effect_duration 12 s, vaal_earthquake_maximum_aftershocks 9;
//   - a Varrida Sagrada (act_str.lua:6303): o raio da varrida é o "O raio Base é de N metros" (2,4–2,8 m; o 1,2 m é o do martelo — antes a varrida usava o do
//     martelo), holy_sweep_hammerfall_damage_+%_final −35, holy_sweep_number_of_holy_bolts_to_create 5 (+0,15 por qualidade) entre os atingidos, o martelo no
//     raio 1,2 m, CannotBeEvaded; a dos Martelos Cadentes: −50%, a cada 0,7 s (÷ a Velocidade de Ataque aumentada), 3 martelos por queda, pela duração (3 s +
//     25 ms por qualidade), nos inimigos no raio da varrida em volta de você;
//   - a Fissura Vulcânica do Serpenteado (act_str.lua:12673): vaal_volcanic_fissure_crack_repeat_count 2 (+0,05 por qualidade) — depois de irromper, a fissura
//     segue até o inimigo vivo mais perto e irrompe de novo, a mesma área;
//   - a Tormenta Explosiva (act_int.lua:18016): display_storm_burst_jump_time_ms 400, 1,2 s (+20 ms por qualidade; a da Repulsão, 0,8 s), o raio do salto 1,6 m +
//     o "+N metros de raio" do nível, a explosão no raio secundário 2,2 m.
//
// (Sem dependência da caçada: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/ㅤ/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const piso = (x) => Math.floor(x + 1e-9);

// ---------------------------------------------------------------- D3.1: a Postura

/** (D3.1) O "Recentemente" da troca de Postura (o PoE: 4 s) e a gema que a troca. */
export const POSTURA = Object.freeze({ slug: 'Blood_and_Sand', recenteMs: 4000 });
export const ehGemaDePostura = (slug) => slug === POSTURA.slug;
/**
 * (D3.1) A TROCA de Postura no buff `b` do Sangue e Areia (ligado): Sangue → Areia → Sangue. Guarda o instante (`trocouEm`). Devolve a Postura nova.
 * (O buff novo — `acoes`, ao ligar — começa na de Sangue, sem troca: no PoE, "Changing Stance occurs by activating a Stance skill while it's toggled on".)
 */
export function trocarPostura(b, agora) {
  if (!b) return null;
  b.postura = b.postura === 'areia' ? 'sangue' : 'areia';
  b.trocouEm = agora;
  return b.postura;
}

// ---------------------------------------------------------------- a Dilaceração e a Tempestade de Lâminas: o Sangramento na Postura de Sangue

const LINHA_SANGRA_NA_SANGUE = /^([\d.]+) % mais Dano com Sangramento enquanto na Postura de Sangue$/i;
/** "X% mais Dano com Sangramento enquanto na Postura de Sangue" (a Dilaceração, a Tempestade de Lâminas): o X, ou 0. */
export const sangramentoNaSangueDasLinhas = (linhas = []) => achar(linhas, LINHA_SANGRA_NA_SANGUE) ?? 0;

// ---------------------------------------------------------------- D3.3: a Perfuração

export const PERFURAR = /^Perforate(_of_(Duality|Bloodshed))?$/;
/** Os raios das estacas (o PoB: radius 8 na Postura de Sangue, 11 na de Areia e na da Carnificina) e a estaca no alvo (uma em cada 3 — D3.3). */
export const ESTACAS = Object.freeze({ raioSangueM: 0.8, raioCarnificinaM: 1.1, noAlvoACada: 3 });
const LINHA_ESTACAS = /^Cria (\d+) Estacas?$/i;
const LINHA_ESTACAS_Q = /^Cria \+([\d.]+) Estacas$/i;
const LINHA_ESTACAS_MUDOU = /^Cria (\d+) Estacas adicionais se você mudou de Postura Recentemente$/i;
/** As ESTACAS da Perfuração (`{ n, seMudou, sempre, raioM }`), ou null. `sempre`: a da Carnificina — as estacas em qualquer Postura. */
export function estacasDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!PERFURAR.test(slug)) return null;
  const n = achar(linhas, LINHA_ESTACAS);
  if (!n) return null;
  const sempre = slug === 'Perforate_of_Bloodshed';
  return { n: piso(n + somar(daQualidade, LINHA_ESTACAS_Q)), seMudou: achar(linhas, LINHA_ESTACAS_MUDOU) ?? 0, sempre, raioM: sempre ? ESTACAS.raioCarnificinaM : ESTACAS.raioSangueM };
}
/** Quantas estacas saem neste uso: as da gema + as "adicionais se mudou de Postura Recentemente". */
export const estacasNoUso = (e, mudouRecente) => (e ? e.n + (mudouRecente ? e.seMudou : 0) : 0);
/**
 * (D3.3) ONDE cai cada estaca: a k-ésima (k = 0, 1, …) no alvo quando k é múltiplo de 3, senão numa casa sorteada da área (`casas`). `rng` para os sorteios.
 */
export function casasDasEstacas(n, alvo, casas, rng = Math.random) {
  const out = [];
  for (let k = 0; k < n; k++) {
    if (k % ESTACAS.noAlvoACada === 0 || !casas?.length) out.push({ x: alvo.x, y: alvo.y });
    else { const c = casas[Math.min(casas.length - 1, Math.floor(rng() * casas.length))]; out.push({ x: c.x, y: c.y }); }
  }
  return out;
}

// ---------------------------------------------------------------- a Tempestade de Lâminas

export const TEMPESTADE_DE_LAMINAS = Object.freeze({ raioM: 2, outraPosturaPadraoPct: 50 });
/** A Tempestade de Lâminas (`{ tipo: 'tempestadeDeLaminas', max, menosPct, duracaoMs, raioM, outraPosturaPct, sangra }`), ou null. */
export function tempestadeDeLaminasDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Bladestorm(_of_Uncertainty)?$/.test(slug)) return null;
  const max = achar(linhas, /^Máximo de (\d+) Tempestades de Lâminas por vez$/i);
  if (!max) return null;
  const incerteza = slug === 'Bladestorm_of_Uncertainty';
  return {
    tipo: 'tempestadeDeLaminas', max: piso(max + somar(daQualidade, /^\+([\d.]+) ao número Máximo de Tempestades de Lâminas por vez$/i)),
    menosPct: achar(linhas, /^Tempestades de Lâminas causam ([\d.]+) % menos Dano com Acertos e Afecções$/i) ?? 0,
    duracaoMs: Math.round((stats.duracao ?? 3) * 1000), raioM: TEMPESTADE_DE_LAMINAS.raioM,
    // (a da Incerteza: "creating a random bladestorm" — 50% de chance da outra Postura; o Sangrar da tempestade é só o da comum, em Postura de Sangue)
    outraPosturaPct: incerteza ? TEMPESTADE_DE_LAMINAS.outraPosturaPadraoPct : 0, sangra: !incerteza,
  };
}
/** A Postura da tempestade deste uso: a sua; na da Incerteza, a outra na chance dela. */
export const posturaDaTempestade = (t, postura, rng = Math.random) => (t?.outraPosturaPct > 0 && rng() * 100 < t.outraPosturaPct ? (postura === 'areia' ? 'sangue' : 'areia') : postura);
/** A Cegueira da Tempestade de Areia (o PoE: a duração-base da Cegueira, 4 s). */
export const CEGUEIRA_DA_AREIA_MS = 4000;

// ---------------------------------------------------------------- a Tempestade Furiosa (o Vórtice Furioso)

export const TEMPESTADE_FURIOSA = Object.freeze({ furiaMin: 10, frequenciaMaisPadraoPct: 250, passoMs: 500, buscaCasas: 7 });
/**
 * A Tempestade Furiosa (`{ tipo: 'tempestadeFuriosa', sacrificaPct, maisPorFuriaPct, raioPorFuria: { m, cada }, frequenciaMaisPct, max, duracaoMs, presa,
 * perdaPorS, perdaMaisPorSPct }`), ou null.
 */
export function tempestadeFuriosaDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Rage_Vortex(_of_Berserking)?$/.test(slug)) return null;
  const freq = achar(linhas, /^Tempestade Furiosa Acerta com ([\d.]+) % mais Frequência$/i);
  if (freq == null) return null;
  const berserker = slug === 'Rage_Vortex_of_Berserking';
  const sac = berserker ? 0 : (achar(linhas, /^Sacrifica \+?([\d.]+) % de Fúria ao criar uma Tempestade Furiosa, se você tiver ao menos \d+ de Fúria$/i) ?? 0) + somar(daQualidade, /^Sacrifica \+([\d.]+) % de Fúria ao criar uma Tempestade Furiosa$/i);
  return {
    tipo: 'tempestadeFuriosa', furiaMin: achar(linhas, /se você tiver ao menos (\d+) de Fúria$/i) ?? TEMPESTADE_FURIOSA.furiaMin, sacrificaPct: sac,
    maisPorFuriaPct: achar(linhas, /^Tempestade Furiosa causa ([\d.]+) % mais Dano por cada 1 de Fúria Sacrificada$/i) ?? 0,
    raioPorFuria: { m: achar(linhas, /^Tormenta Furiosa tem \+([\d.]+) metros ao raio por cada \d+ de Fúria sacrificada$/i) ?? 0, cada: achar(linhas, /^Tormenta Furiosa tem \+[\d.]+ metros ao raio por cada (\d+) de Fúria sacrificada$/i) ?? 1 },
    frequenciaMaisPct: freq, max: achar(linhas, /^Máximo de (\d+) Tempestades Furiosas$/i) ?? 1,
    duracaoMs: berserker ? null : Math.round((stats.duracao ?? 3) * 1000), presa: berserker,
    perdaPorS: berserker ? achar(linhas, /^Perca ([\d.]+) de Fúria por segundo$/i) ?? 0 : 0,
    perdaMaisPorSPct: berserker ? achar(linhas, /^A ?cada segundo ([\d.]+) % mais Fúria perdida$/i) ?? 0 : 0,
  };
}
/** A Fúria sacrificada: ⌊a Fúria de agora × X%⌋ — com ao menos o mínimo (10); senão 0 (e não há tempestade). */
export const furiaSacrificada = (t, furia) => (t && furia >= t.furiaMin ? Math.floor((furia * t.sacrificaPct) / 100 + 1e-9) : 0);
/** O raio da tempestade em metros: o da gema + 0,1 m por cada 2 de Fúria sacrificada. */
export const raioDaTempestadeFuriosaM = (t, raioM, sacrificada) => raioM + (t?.raioPorFuria?.m ?? 0) * Math.floor(sacrificada / Math.max(1, t?.raioPorFuria?.cada ?? 1));
/** (D3.2) O intervalo dos acertos da tempestade: o tempo de ataque ÷ (1 + 250%). */
export const intervaloDaTempestadeFuriosa = (t, usoMs) => Math.max(50, Math.round(usoMs / Math.max(0.1, 1 + (t?.frequenciaMaisPct ?? 0) / 100)));
/** A perda de Fúria por segundo do Berserker `s` segundos depois de criada: 3 × 1,2^⌊s⌋ ("A cada segundo 20% mais Fúria perdida"). */
export const perdaDoBerserker = (t, s) => (t?.perdaPorS ?? 0) * (1 + (t?.perdaMaisPorSPct ?? 0) / 100) ** Math.max(0, Math.floor(s));
/** A Fúria perdida pelo Berserker de `de` a `ate` ms depois de criada (a soma, segundo a segundo). */
export function furiaPerdidaNoBerserker(t, de, ate) {
  let total = 0;
  for (let a = Math.max(0, de); a < ate - 1e-9;) {
    const fimDoSegundo = (Math.floor(a / 1000 + 1e-9) + 1) * 1000;
    const b = Math.min(ate, fimDoSegundo);
    total += (perdaDoBerserker(t, a / 1000) * (b - a)) / 1000;
    a = b;
  }
  return total;
}

// ---------------------------------------------------------------- D3.4: o Terremoto

export const TERREMOTO = Object.freeze({ raioDoAbaloM: 2.8 });
/**
 * O ABALO SECUNDÁRIO do Terremoto (`{ tipo: 'abalo', atrasoMs, raioM, maisPct, porDecimo, vaal }`), ou null. `porDecimo` (a Amplificação): `{ acertoPct, afeccaoPct,
 * areaPct }` por 0,1 s de duração; `vaal`: `{ secundariaMs, max }`.
 */
export function abaloDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^(Vaal_)?Earthquake(_of_Amplification)?$/.test(slug)) return null;
  const mais = achar(linhas, /^Abalo Secundário causa ([\d.]+) % mais Dano com Acertos e Afecções$/i);
  const porAcerto = achar(linhas, /^Abalo Secundário causa ([\d.]+) % mais Dano com Acertos por cada 0\.1 segundos de Duração$/i);
  if (mais == null && porAcerto == null) return null;
  const vaal = /^Vaal_/.test(slug);
  return {
    tipo: 'abalo', atrasoMs: Math.round((stats.duracao ?? 1) * 1000), raioM: TERREMOTO.raioDoAbaloM,
    maisPct: (mais ?? 0) + somar(daQualidade, /^Abalo Secundário causa \+([\d.]+) % mais Dano com Acertos e Afecções$/i),
    porDecimo: porAcerto != null ? { acertoPct: porAcerto, afeccaoPct: achar(linhas, /^Abalo Secundário causa ([\d.]+) % mais Dano com Afecções por cada 0\.1 segundos de Duração$/i) ?? 0, areaPct: achar(linhas, /^Abalo Secundário tem ([\d.]+) % mais Área de Efeito por cada 0\.1 segundos de Duração$/i) ?? 0 } : null,
    vaal: vaal ? { secundariaMs: Math.round((achar(linhas, /^Duração Base Secundária é de ([\d.]+) segundos?$/i) ?? 12) * 1000), max: achar(linhas, /^O efeito atual é finalizado após (\d+) Abalos Secundários$/i) ?? 9 } : null,
  };
}
/**
 * O "mais" do abalo com a duração final `durMs`: `{ acertoPct, afeccaoPct, areaPct }` — o fixo (o comum, o Vaal) nos dois; o da Amplificação, ⌊durMs ÷ 100⌋ décimos
 * (o PoB: floor(duration × DurationMod × 10)).
 */
export function maisDoAbalo(a, durMs) {
  if (!a) return { acertoPct: 0, afeccaoPct: 0, areaPct: 0 };
  if (!a.porDecimo) return { acertoPct: a.maisPct, afeccaoPct: a.maisPct, areaPct: 0 };
  const n = Math.floor(durMs / 100 + 1e-9);
  return { acertoPct: a.porDecimo.acertoPct * n, afeccaoPct: a.porDecimo.afeccaoPct * n, areaPct: a.porDecimo.areaPct * n };
}

// ---------------------------------------------------------------- a Varrida Sagrada

/** Os martelos da Varrida Sagrada (`{ alvos, menosPct, raioM, varridaM, cadaMs, porQueda, duracaoMs }`), ou null. A comum: nos atingidos; a dos Cadentes: no tempo. */
export function martelosDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Holy_Sweep(_of_Hammerfalls)?$/.test(slug)) return null;
  const menos = achar(linhas, /^Martelos causam - ?([\d.]+) % de dano$/i);
  if (menos == null) return null;
  const cadentes = slug === 'Holy_Sweep_of_Hammerfalls';
  const cada = achar(linhas, /^Martelos Cadentes ocorrem a cada ([\d.]+) segundos/i);
  return {
    menosPct: menos, raioM: achar(linhas, /^Raio de alcance base do impacto do martelo é de ([\d.]+) metros?$/i) ?? 1.2, varridaM: achar(linhas, /^O raio Base é de ([\d.]+) metros?$/i),
    alvos: cadentes ? 0 : piso((achar(linhas, /^Convoca Martelos Sagrados em até (\d+) inimigos atingidos$/i) ?? 0) + somar(daQualidade, /^Convoca Martelos Sagrados em até ([\d.]+) inimigos atingidos$/i)),
    ...(cadentes ? { tipo: 'martelosCadentes', cadaMs: Math.round((cada ?? 0.7) * 1000), porQueda: achar(linhas, /^Convoca (\d+) Martelos Sagrados por Martelo Cadente$/i) ?? 3, duracaoMs: Math.round((stats.duracao ?? 3) * 1000) } : {}),
  };
}
/** Sorteia até `n` dos `quem` (sem repetir) — os inimigos que levam um martelo. */
export function sortearAlvos(quem, n, rng = Math.random) {
  const resto = [...quem];
  const out = [];
  while (out.length < n && resto.length) out.push(resto.splice(Math.min(resto.length - 1, Math.floor(rng() * resto.length)), 1)[0]);
  return out;
}

// ---------------------------------------------------------------- a Fissura Vulcânica do Serpenteado

/** As erupções a mais da fissura ("Fissuras irrompem N vezes adicionais" + a qualidade), ou 0. O alcance até o próximo inimigo: o do projétil do jogo (7 casas). */
export const SERPENTEADO = Object.freeze({ alcanceCasas: 7 });
export function erupcoesExtrasDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Volcanic_Fissure_of_Snaking') return 0;
  return piso((achar(linhas, /^Fissuras irrompem (\d+) vezes adicionais$/i) ?? 0) + somar(daQualidade, /^Fissuras irrompem ([\d.]+) vezes adicionais$/i));
}

// ---------------------------------------------------------------- D3.5: a Tormenta Explosiva

export const TORMENTA_EXPLOSIVA = Object.freeze({ raioDoSaltoM: 1.6, raioDaExplosaoM: 2.2, buscaCasas: 7, folgaDoCanalMs: 250 });
/** O orbe da Tormenta Explosiva (`{ tipo: 'orbeTempestade', semAcerto, saltoMs, duracaoMs, porRestantePct, raioM, explosaoM }`), ou null. */
export function orbeDasLinhas(slug, linhas = [], stats = {}) {
  if (!/^Storm_Burst(_of_Repulsion)?$/.test(slug)) return null;
  const salto = achar(linhas, /^Orbes saltam a cada ([\d.]+) segundos?$/i);
  if (!salto) return null;
  return {
    tipo: 'orbeTempestade', semAcerto: true, saltoMs: Math.round(salto * 1000), duracaoMs: Math.round((stats.duracao ?? 1.2) * 1000),
    porRestantePct: achar(linhas, /^Orbes Explosivas causam ([\d.]+) % do Dano da Habilidade para cada [\d.]+ segundos de Duração restante$/i) ?? 0,
    raioM: TORMENTA_EXPLOSIVA.raioDoSaltoM + (achar(linhas, /^([\d.]+) metros de raio$/i) ?? 0), explosaoM: TORMENTA_EXPLOSIVA.raioDaExplosaoM,
    // (dono, 25/10) a da Repulsão: os orbes se afastam do local mirado (`saltoDaRepulsao`)
    ...(orbeSeAfasta(slug) ? { afasta: true } : {}),
  };
}
/**
 * (dono, 25/10) o salto do orbe da REPULSÃO: "repeatedly jump away from the targeted location" (o PoB) — no passo de 0,4 s, o orbe vai para o inimigo vivo mais perto
 * dele, a até 7 casas, que fique MAIS LONGE do local mirado (`longeDe`) do que o orbe está; sem um, anda 1 casa para longe do local mirado. `vivos`: `[{ x, y }]`.
 */
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export function saltoDaRepulsao(orbe, longeDe, vivos = [], busca = TORMENTA_EXPLOSIVA.buscaCasas) {
  const d0 = cheb(orbe, longeDe);
  const alvo = vivos.filter((m) => cheb(m, longeDe) > d0 && cheb(m, orbe) <= busca).sort((a, b) => cheb(a, orbe) - cheb(b, orbe))[0];
  if (alvo) return { x: alvo.x, y: alvo.y };
  const sx = Math.sign(orbe.x - longeDe.x);
  const sy = Math.sign(orbe.y - longeDe.y);
  return sx || sy ? { x: orbe.x + sx, y: orbe.y + sy } : { x: orbe.x + 1, y: orbe.y };
}
/** O orbe se afasta do local mirado (a Repulsão)? */
export const orbeSeAfasta = (slug) => slug === 'Storm_Burst_of_Repulsion';
/** (D3.5) O "mais" da explosão do orbe com `restanteMs` de duração: max(0, 75 × ⌊restante ÷ 0,4 s⌋ − 100)% (o PoB). */
export const maisDaExplosaoDoOrbe = (o, restanteMs) => Math.max(0, (o?.porRestantePct ?? 0) * Math.floor((Math.max(0, restanteMs) + 1) / Math.max(1, o?.saltoMs ?? 400)) - 100);

// ---------------------------------------------------------------- o objeto do uso e o resumo

/** O OBJETO que o uso deixa (o mecanismo de `hunt.poeObjetos` do A3b): a Tempestade de Lâminas, a Furiosa, o Abalo, os Martelos Cadentes, o orbe — ou null. */
export function objetoDaGema(slug, linhas = [], daQualidade = [], stats = {}) {
  const m = martelosDasLinhas(slug, linhas, daQualidade, stats);
  return tempestadeDeLaminasDasLinhas(slug, linhas, daQualidade, stats) ?? tempestadeFuriosaDasLinhas(slug, linhas, daQualidade, stats) ?? abaloDasLinhas(slug, linhas, daQualidade, stats)
    ?? (m?.tipo === 'martelosCadentes' ? m : null) ?? orbeDasLinhas(slug, linhas, stats);
}
/** Os tipos de objeto deste lote (`acoes.criarObjetosDoUso` / `pulsarObjeto`). */
export const TIPOS = new Set(['tempestadeDeLaminas', 'tempestadeFuriosa', 'abalo', 'martelosCadentes', 'martelo', 'orbeTempestade']);

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
const LINHAS_C3 = [
  [LINHA_SANGRA_NA_SANGUE, /^(Lacerate|Bladestorm)$/],
  [/^Cria \d+ Estacas?$|^Cria \+[\d.]+ Estacas$|^Cria \d+ Estacas adicionais se você mudou de Postura Recentemente$/i, PERFURAR],
  [/^Máximo de \d+ Tempestades de Lâminas por vez$|^\+[\d.]+ ao número Máximo de Tempestades de Lâminas por vez$|^Tempestades de Lâminas causam [\d.]+ % menos Dano com Acertos e Afecções$/i, /^Bladestorm/],
  [/^Sacrifica \+?[\d.]+ % de Fúria ao criar uma Tempestade Furiosa|^Tempestade Furiosa causa [\d.]+ % mais Dano por cada 1 de Fúria Sacrificada$|^Tormenta Furiosa tem \+[\d.]+ metros ao raio por cada \d+ de Fúria sacrificada$|^Tempestade Furiosa Acerta com [\d.]+ % mais Frequência$|^Máximo de \d+ Tempestades Furiosas$|^Perca [\d.]+ de Fúria por segundo$|^A ?cada segundo [\d.]+ % mais Fúria perdida$/i, /^Rage_Vortex/],
  [/^Abalo Secundário causa \+?[\d.]+ % mais Dano com (?:Acertos e Afecções|Acertos por cada 0\.1 segundos de Duração|Afecções por cada 0\.1 segundos de Duração)$|^Abalo Secundário tem [\d.]+ % mais Área de Efeito por cada 0\.1 segundos de Duração$|^O efeito atual é finalizado após \d+ Abalos Secundários$|^Duração Base Secundária é de [\d.]+ segundos?$/i, /Earthquake/],
  [/^Martelos causam - ?[\d.]+ % de dano$|^Convoca Martelos Sagrados em até [\d.]+ inimigos atingidos$|^Martelos Cadentes ocorrem a cada [\d.]+ segundos|^Convoca \d+ Martelos Sagrados por Martelo Cadente$/i, /^Holy_Sweep/],
  [/^Fissuras irrompem [\d.]+ vezes adicionais$/i, /^Volcanic_Fissure_of_Snaking$/],
  [/^Orbes saltam a cada [\d.]+ segundos?$|^Orbes Explosivas causam [\d.]+ % do Dano da Habilidade para cada [\d.]+ segundos de Duração restante$/i, /^Storm_Burst/],
];
export const ehLinhaC3 = (slug, l) => LINHAS_C3.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
