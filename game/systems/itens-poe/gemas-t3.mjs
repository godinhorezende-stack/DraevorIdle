// O LOTE T3 das gemas ATIVAS do PoE (rodada 4 — dono 27/10: "quero resolver"): as gemas que estavam "implementada, sem teste próprio" e que os testes do lote acharam
// sem a mecânica que a descrição e o PoB dão. Aqui ficam os DADOS (os números do PoB e do poedb salvo) e as contas puras (sem a caçada); quem usa é gemas-poe.mjs (a
// compilada, o objeto do uso e o status) e acoes.mjs (os objetos no tique, os usos da recarga, o Atirador Ilusório).
//
//   - a LEGIÃO CONGELADA (o PoB, act_str.lua FrozenLegion + FrozenSweep): é uma MAGIA de recarga com 6 usos guardados que "consome várias recargas para invocar Estátuas
//     de gelo em um anel; cada Estátua usa o Arrastão Congelante uma vez". O Arrastão é o ataque: baseMultiplier 3,329 no nível 20 (o 4º número da célula "Base Damage"
//     do poedb — o 1º, 100%, é o da magia), "skill_physical_damage_%_to_convert_to_cold" 100 e o raio 25 (2,5 m). Antes o uso era um golpe da arma (100%, Físico, na
//     frente) e gastava 1 uso. Agora: o uso gasta TODOS os usos prontos e cada um vira uma Estátua (o PoB: averageBurstHits = as Estátuas), que bate uma vez em volta do
//     alvo (2,5 m × √ da Área) com 332,9% e todo o Físico em Gelo;
//   - os MORTOS VOLÁTEIS DO CONFINAMENTO (o PoB, act_dex.lua VolatileDeadAltX): cada cadáver consumido explode (como antes) e cria um ORBE que "detona depois de uma
//     duração" (1,5 s × a Duração) no lugar do cadáver, na área maior (2,8 m, + 0,3 m na qualidade 20). Antes o orbe batia na hora, no inimigo mais perto, × os cadáveres;
//   - a INVOCAR TORMENTA DE TRARTHUS (o PoB, act_int.lua StormCallAltX): o marcador como o da comum (o raio cai depois da duração, 2 s; os outros marcadores caem junto) e
//     a POÇA de sangue fervente no impacto, pela duração SECUNDÁRIA (4 s, + 1 s na qualidade 20), com o dano degenerativo da gema em quem está nela (o chão — antes o
//     degenerativo grudava no acertado pela duração primária, 2 s, e o raio caía na hora);
//   - a TEMPESTADE RELAMPEJANTE (o PoB, act_dex.lua Thunderstorm + ThunderstormMiniTornados): a flecha cai no alvo (a área, 60% do Físico em Raio — a conversão faltava);
//     a tempestade fica lá (10 s × a Duração, até 3) e Cega quem está nela; com você dentro, ganha 1 estágio a cada 0,25 s (até 4); sair dela a dissipa — no máximo, ela
//     EXPLODE (300% mais Dano, 30% mais Área por estágio — 120% mais nos 4) e Ativa a Rajada Relampejante (5 projéteis que perfuram, saindo da tempestade em direções
//     sorteadas, eficácia 1,39 e 60% em Raio; cada um explode no fim, 3 s depois, a 1,5 m com 40% mais Dano em Área). A janela "perfeita": sair até 1,5 s depois do máximo
//     (windstorm_storm_perfect_timing_window_escape_time_ms 1500) — depois disso ela se dissipa sem explodir;
//   - o TIRO GÉLIDO VAAL: "Convoca 6 Atiradores de Elite Ilusórios … que disparam no local do seu alvo quando você usa Tiro de Gelo" — por 6 s × a Duração, cada uso seu
//     de um Tiro de Gelo faz cada Atirador usar o Tiro Gélido Vaal no alvo, sem custo, sem recarga e sem os modificadores da quantidade de projéteis (a linha da gema);
//   - o ARCO ELÉTRICO DA OSCILAÇÃO (o PoB: arc_enhanced_behaviour — "Cada vez que o arco ricochetear, ele também ricocheteará um segundo arco para outro inimigo, mas este
//     segundo arco não pode ricochetear"): cada salto solta um arco secundário num outro inimigo perto do saltado (o alcance do ricochete), sem ricochetes restantes;
//   - a ARMADILHA DE LÂMINAS DA ESPADA GRANDE (o PoB, act_dex.lua BladeTrapAltX: "brande duas cópias da sua Espada de Duas Mãos em círculos POR UMA DURAÇÃO"): gira pela
//     duração (3,5 s × a Duração, + 0,5 s na qualidade 20), um giro a cada 0,25 s (o tempo do giro que o dono decidiu para a Armadilha de Lâminas, 27/10); cada giro acerta
//     uma vez cada inimigo na área — antes ela só batia na ativação;
//   - a ARMADILHA DE TORRE ELÉTRICA (todas — o PoB: radiusSecondary 10, "Impact Area"): cada área golpeia o inimigo sorteado e quem está a 1 m dele (× √ da Área); antes
//     cada área era a forma inteira da gema em volta da torre, e todos perto dela levavam todas as áreas (8 por golpe na da Sobrecarga);
//   - a MINA DE GELO (todas — o PoB, IcicleMine: projectile, sem área de dano): a detonação dispara os projéteis nos inimigos (3, + 1 a cada 2 Minas anteriores na
//     Sequência de Detonação na da Ventilação); antes era uma área de 3 casas que acertava todos (`GemasPoe`, FORMATO_PROPRIO);
//   - a RAJADA DE CHAMAS (todas — o PoB: FlameblastStageAfterFirst): o "+X metros ao raio por Estágio" conta depois do primeiro (`GemasPoe.estagiosDaGema`);
//   - as MALDIÇÕES que reduzem resistência (a Fraqueza Elemental e todas as outras: o PoB, "ElementalResist BASE −X" no inimigo): o −X sai da RESISTÊNCIA do bicho
//     (`resMenosDasMaldicoes`, lido por `Resistencia.resistenciaDe`); antes virava "sofre X% mais dano" — igual só contra resistência 0 (contra 50%, × 1,3 em vez de × 1,6).

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re, g = 1) => (linhas ?? []).reduce((t, l) => { const m = re.exec(norm(l)); return t + (m ? Number(m[g]) || 0 : 0); }, 0);

// ---------------------------------------------------------------- a Legião Congelada

export const LEGIAO = Object.freeze({ re: /^Frozen_Legion/, raioM: 2.5, conversaoGeloPct: 100 });
/** A eficácia do Arrastão Congelante no nível: o ÚLTIMO número da célula "Base Damage" (o 1º é o da magia — 100%). null fora da Legião. */
export function eficaciaDaLegiao(slug, celulaBase) {
  if (!LEGIAO.re.test(String(slug ?? ''))) return null;
  const nums = String(celulaBase ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? nums[nums.length - 1] / 100 : null;
}
/** O que a compilada da gema ganha do lote: `{ efetividade, conversao }` (a Legião e a Tempestade Relampejante), ou null. */
export function correcaoDaCompilada(slug, celulaBase) {
  const s = String(slug ?? '');
  if (LEGIAO.re.test(s)) return { efetividade: eficaciaDaLegiao(s, celulaBase), conversao: [{ para: 'gelo', pct: LEGIAO.conversaoGeloPct }] };
  if (s === TEMPESTADE.slug) return { conversao: [{ para: 'raio', pct: TEMPESTADE.conversaoRaioPct }] };
  return null;
}
/** Quantos usos da recarga este uso gasta: a Legião, todos os prontos (`livres`, ao menos 1); as outras, 1. */
export const usosNoUso = (slug, livres) => (LEGIAO.re.test(String(slug ?? '')) ? Math.max(1, Math.floor(Number(livres) || 0)) : 1);

// ---------------------------------------------------------------- os Mortos Voláteis do Confinamento

export const CONFINAMENTO = Object.freeze({ slug: 'Volatile_Dead_of_Confinement', atrasoMs: 1500, raioM: 2.8 });
const LINHA_RAIO_BASE = /^O raio Base é de ([\d.]+) metros?$/i;
const LINHA_RAIO_Q = /^\+([\d.]+) metros de raio$/i;

// ---------------------------------------------------------------- a Invocar Tormenta de Trarthus

export const TRARTHUS = Object.freeze({ slug: 'Storm_Call_of_Trarthus', poçaMs: 4000 });
/** O degenerativo da gema é o do CHÃO (a poça de sangue fervente — o PoB: dotIsArea), não vem no acerto. */
export const degenNoChaoT3 = (slug) => slug === TRARTHUS.slug;

// ---------------------------------------------------------------- a Tempestade Relampejante

export const TEMPESTADE = Object.freeze({
  slug: 'Thunderstorm', conversaoRaioPct: 60, duracaoMs: 10_000, limite: 3, estagios: 4, estagioMs: 250, janelaMs: 1500, detonacaoMaisPct: 300, areaMaisPorEstagioPct: 30, cegaMs: 500,
  rajada: { projeteis: 5, eficacia: 1.39, eficaciaDaFlecha: 1.25, duracaoMs: 3000, raioM: 1.5, areaMaisDanoPct: 40 },
});
/** O "mais" de dano da Rajada Relampejante em relação à flecha (a eficácia dela ÷ a da flecha — o golpe da arma e o adicionado escalam igual), em %. */
export const maisDaRajadaPct = (explosao = false) => ((TEMPESTADE.rajada.eficacia / TEMPESTADE.rajada.eficaciaDaFlecha) * (explosao ? 1 + TEMPESTADE.rajada.areaMaisDanoPct / 100 : 1) - 1) * 100;
/** O fator do raio da explosão da tempestade nos `estagios` (o "30% mais Área por estágio": um "mais" só, 30 × os estágios, no raio pela √). */
export const raioDaExplosaoFator = (estagios) => Math.sqrt(1 + (TEMPESTADE.areaMaisPorEstagioPct * Math.max(0, estagios)) / 100);
/**
 * O passo da tempestade `t` no instante `agora` com você `dentro` (ou não): ganha os estágios do tempo dentro (1 a cada 0,25 s, até 4); fora, com estágio, acaba — e
 * explode se estava no máximo há no máximo `janelaMs`. Muda `t` (`estagios`, `desdeDentro`, `noMaxDesde`) e devolve 'explode', 'dissipa' ou null.
 */
export function passoDaTempestade(t, dentro, agora) {
  if (dentro) {
    if (t.desdeDentro == null) t.desdeDentro = agora;
    const n = Math.min(TEMPESTADE.estagios, Math.floor((agora - t.desdeDentro) / TEMPESTADE.estagioMs));
    if (n > (t.estagios ?? 0)) t.estagios = n;
    if (t.estagios >= TEMPESTADE.estagios && t.noMaxDesde == null) t.noMaxDesde = t.desdeDentro + TEMPESTADE.estagios * TEMPESTADE.estagioMs;
    return null;
  }
  if (t.desdeDentro == null) return null;
  if ((t.estagios ?? 0) >= TEMPESTADE.estagios && agora - (t.noMaxDesde ?? agora) <= TEMPESTADE.janelaMs) return 'explode';
  return 'dissipa';
}

// ---------------------------------------------------------------- o Tiro Gélido Vaal

export const ATIRADORES = Object.freeze({ slug: 'Vaal_Ice_Shot', usaCom: /^Ice_Shot(?:_of_|$)/ });
const LINHA_ATIRADORES = /^Máximo de (\d+) Atiradores de Elite Ilusórios Convocados/i;
/** Os Atiradores Ilusórios do Tiro Gélido Vaal no nível: `{ n, duracaoMs }` (o máximo e a duração base da gema), ou null. */
export function atiradoresDasLinhas(slug, linhas = [], stats = {}) {
  if (slug !== ATIRADORES.slug) return null;
  const n = achar(linhas, LINHA_ATIRADORES);
  return n ? { n, duracaoMs: Math.round((stats.duracao ?? 6) * 1000) } : null;
}

// ---------------------------------------------------------------- o Arco Elétrico da Oscilação

export const ARCO_SECUNDARIO = /^Arc_of_Oscillating$/;

// ---------------------------------------------------------------- a Armadilha de Lâminas da Espada Grande

export const ESPADAS_GRANDES = /^Blade_Trap_of_Greatswords$/;
/** O tempo de um giro (o da Armadilha de Lâminas — decisão do dono 27/10, `GemasD1.GIRO.ms`). */
export const GIRO_MS = 250;
/** Os giros da Espada Grande pela duração (ms, já × a Duração): `{ giros, chanceDeMais, intervaloMs }` — a fração de um giro é a chance de mais um. */
export function girosDaEspadaGrande(duracaoMs) {
  const g = Math.max(0, Number(duracaoMs) || 0) / GIRO_MS;
  const giros = Math.floor(g + 1e-9);
  return { giros, chanceDeMais: Math.max(0, g - giros), intervaloMs: GIRO_MS };
}

// ---------------------------------------------------------------- a resistência reduzida das maldições

/**
 * A RESISTÊNCIA ao `tipo` que as maldições ativas no bicho tiram (os efeitos `vulneravel` com `res` — a Fraqueza Elemental, a Inflamabilidade, a Condutividade, o
 * Desespero…), com o "Efeito aumentado se Y% da Duração expirou" de cada uma (`expirou`) e o `fator` de fora (o Solo Profano). O mesmo registro de `Reforcos.marcar`
 * (`bicho.maldicoes[id] = { ate, desde, dur, efeitos, expirou }`); sem importar o reforço (a resistência é lida em todo golpe).
 */
export function resMenosDasMaldicoes(bicho, tipo, agora, fator = 1) {
  let t = 0;
  for (const m of Object.values(bicho?.maldicoes ?? {})) {
    if (!m || !(m.ate > agora)) continue;
    const expirou = 1 + (m.expirou ?? []).reduce((s, x) => s + ((agora - m.desde) >= x.apos * m.dur ? x.pct : 0), 0) / 100;
    for (const e of m.efeitos ?? []) if (e.tipo === 'vulneravel' && e.res && e.tipos?.includes(tipo)) t += (Number(e.pct) || 0) * expirou * fator;
  }
  return t;
}

// ---------------------------------------------------------------- a Armadilha de Torre Elétrica

/**
 * (o PoB, LightningSpireTrap/AltX/AltY: radius 24 — "Targeting Area" — e radiusSecondary 10 — "Impact Area") a área de IMPACTO de cada golpe da torre: 1 m (a de mirar,
 * 2,4 m, é onde caem). Em metros, ou null fora da Torre Elétrica.
 */
export const impactoDaTorreM = (slug) => (/^Lightning_Spire_Trap/.test(String(slug ?? '')) ? 1 : null);

// ---------------------------------------------------------------- os objetos do uso

export const TIPOS = new Set(['estatuas', 'orbeConfinado', 'tempestadeT3', 'explosaoRajadaT3']);
/**
 * O OBJETO do uso das gemas do lote (`GemasPoe.objetoDaGema`): a Legião (as Estátuas — `semAcerto`: o uso só as invoca), o Confinamento (os orbes nos cadáveres) e a
 * Tempestade Relampejante (a tempestade; a flecha acerta no uso). null nas outras.
 */
export function objetoDaGemaT3(slug, linhas = [], daQualidade = [], stats = {}) {
  const s = String(slug ?? '');
  if (LEGIAO.re.test(s)) return { tipo: 'estatuas', semAcerto: true, raioM: LEGIAO.raioM };
  if (s === CONFINAMENTO.slug) return { tipo: 'orbeConfinado', semAcerto: true, atrasoMs: Math.round((stats.duracao ?? 1.5) * 1000), raioM: (achar(linhas, LINHA_RAIO_BASE) ?? CONFINAMENTO.raioM) + somar(daQualidade, LINHA_RAIO_Q) };
  if (s === TEMPESTADE.slug) return { tipo: 'tempestadeT3', semAcerto: false, raioM: achar(linhas, LINHA_RAIO_BASE) ?? 2.3 };
  return null;
}

// ---------------------------------------------------------------- o status

/**
 * O que a gema faz só na DESCRIÇÃO e o lote não fez por falta do número (fica "parcial" até o dono decidir): a Chuva de Flechas da Artilharia — "as flechas caem em
 * sequência, começando na sua frente e seguindo em linha na direção do alvo; cada flecha causa dano numa área em volta dela" (o PoB: radius 10 — 1 m — e as 22 flechas;
 * nem o PoB nem o poedb dão o comprimento da linha nem o espaçamento). No jogo ela segue como as outras Chuvas: a área de 2,4 m no alvo, um acerto em cada inimigo.
 */
// (lote C2 da rodada 4, dono 28/10: a linha da Artilharia decidida — da casa à sua frente até o alvo, as 22 flechas distribuídas igualmente, cada uma com 1 m —
// `gemas-r4c2.sequenciaDaArtilharia`, a forma `linhaDeFlechas` em `acoes`; a gema sai de parcial)
export const MOTIVOS_T3 = Object.freeze({});

/** As linhas que o lote faz (saem de "efeito não simulado"). */
export function ehLinhaT3(slug, l) {
  const t = norm(l);
  if (slug === ATIRADORES.slug && (LINHA_ATIRADORES.test(t) || /^Modificadores à quantidade de Projéteis não se aplicam a esta Habilidade quando usada por Atiradores/i.test(t))) return true;
  if (slug === CONFINAMENTO.slug && LINHA_RAIO_BASE.test(t)) return true;
  return false;
}
