// O LOTE PR3 das gemas do PoE (dono, 21/10: as gemas ATIVAS de projétil que GERAM outros golpes — os projéteis secundários, a segunda forma, as explosões em
// volta do impacto, as erupções a mais e o Pacto que fortalece as magias seguintes). Aqui ficam os DADOS das linhas e as contas puras (sem a caçada); quem
// usa é `gemas-poe.mjs` (o status e os leitores no nível), `acoes.mjs` (o uso: `comOsAlvosDaGema`, o acerto, os esporos, as erupções, o Pacto) e
// `skills/golpes-secundarios.mjs` (o Tiro Tornado, as explosões da Explosão Cinética, o rodízio do Aço Perfurador).
//
// O que o lote faz, pelo PoE 1 (o PoB e o poedb), com as decisões do dono (21/10, as recomendações do plano aceitas):
//   - o TIRO TORNADO: "Fires a piercing shot that travels until it reaches the targeted location. It will then fire projectiles out in all directions from that
//     point" (o PoB, act_dex.lua:16029 — tornado_shot_num_of_secondary_projectiles 3): o tiro atravessa todos até o local mirado (o alvo) e lá solta os N
//     projéteis secundários, cada um com os modificadores do projétil (perfurar, ricochetear, difundir…). Os projéteis adicionais são mais tiros (o PoB conta
//     ProjectileCount × os secundários — act_dex.lua:16050), cada um solta os seus no fim. D2 do dono: os rumos sorteados no leque (a exceção 3 abaixo);
//   - a LANÇA GÉLIDA: "Segunda forma possui um aumento de 600% de Chance de Crítico" e "+49% ao Multiplicador" (+2 por qualidade) — o PoB, a parte "Second Form"
//     (ice_spear_second_form_critical_strike_chance_+% INC, …_multiplier_+ BASE, act_int.lua:9825-9833). D3 do dono: a 2ª forma começa a 2 casas (≈ 4 m) de você;
//   - a EXPLOSÃO CINÉTICA (as duas): "causes a series of area explosions in a secondary radius around its point of impact" (act_int.lua:10665) — a explosão no
//     ponto do impacto e as N adicionais (cluster_burst_spawn_amount 4, + 0,05 por qualidade; a da Ramificação 3) em pontos sorteados no raio secundário (2 m; 2,8
//     m), cada uma de raio 1,4 m (1,9 m) × √ da Área; "40% menos Dano em Área" (active_skill_area_damage_+%_final −40, ModFlag.Area) só nas explosões — a parte
//     "Projectile" do PoB não é área. A da Ramificação: "Modificadores da quantidade de Projéteis se aplicam a quantidade de Explosões" (NoAdditionalProjectiles)
//     e o Físico adicional igual a 15% da Mana Máxima (`linhas-das-gemas.mjs`). D6 do dono: o ponto sorteado no quadrado do raio secundário, a área em quadrado
//     (a exceção 1 do A3c);
//   - o AÇO PERFURADOR (as duas): "The cluster will fire a number of projectiles in sequence, aiming at enemies in front of or close to it" (act_dex.lua:10216) e
//     "Acertos após o primeiro em cada Inimigo causam 60% menos Dano" (lancing_steel_damage_+%_final_after_first_hit_on_target −60; a da Pulverização −90). D4 do
//     dono: os projéteis miram o alvo e os vizinhos dele (como no PoE), não "um bicho cada"; o "menos" a partir do 2º acerto no mesmo inimigo, no uso;
//   - a FLECHA VIRULENTA DA AMEAÇA: "Fire an arrow that leaves a spore pod in its wake … Modifiers that cause additional projectiles to be fired will only apply to
//     the initial arrows, each of which leaves its own spore pod" (act_dex.lua:13078 — scourge_arrow_X_pods_per_projectile 1, virulent_arrow_number_of_pod_projectiles
//     4 + 0,05 por qualidade, virulent_arrow_pod_projectile_damage_+%_final −50): os esporos da Flecha Flagelante (o A4), um por flecha, na hora do uso;
//   - a FISSURA VULCÂNICA VAAL: "After erupting, the fissure continues moving towards enemies to cause further eruptions" (act_str.lua:12748). D5 do dono: as 2
//     erupções a mais do poedb e do texto da gema (a constante do PoB, vaal_volcanic_fissure_crack_repeat_count, diz 5);
//   - o PACTO DE BEIDAT: "Empowering non-channelling spells that either fire projectiles, apply an effect to an area around a targeted location or fire chaining
//     beams" (other.lua:2773 — skill_empowers_next_x_spells_cast 6 + 0,1 por qualidade; pact_skill_damage_+%_final_with_hits_and_ailments_to_grant: MORE com Hit e
//     Ailment; …_grant_x_cascades_to_do_in_spiral; …_additional_beam_only_chains; …_grant_x_additional_projectiles_fired_in_nova). D7 do dono: conta por uso de
//     magia não canalizada sua (o totem não conta), e a espiral e o círculo reaproveitam o círculo dos projéteis (o A3) e o ângulo das espirais do A3b.
//
// EXCEÇÕES DO DONO (as escolhas sem fonte do lote, para o aval): (1) o Tiro Tornado: o tiro atravessa só até o alvo (não passa do local mirado); (2) os secundários
// saem do alvo e voam até o alcance da habilidade; não acertam o próprio alvo do tiro (nascem nele — a exceção 1 do PR1); (3) o leque dos secundários: o círculo
// dividido em N fatias iguais a partir do rumo do tiro, cada secundário num ângulo sorteado dentro da sua fatia (o "em todas as direções" do PoB); (4) a 2ª forma
// da Lança Gélida: o acerto a ≥ 2 casas (Chebyshev) de você — os perfurados também; (5) a Explosão Cinética explode em todo impacto que acerta e no fim do voo do
// projétil que erra; o atingido leva o acerto do projétil E o das explosões que o pegam (o PoB separa as partes); as explosões sobrepostas acumulam; (6) os
// raios em casas (o principal e o secundário) são sorteados uma vez por uso, como o A3c; (7) o Aço Perfurador: o rodízio — o 1º projétil no alvo, os seguintes nos
// vizinhos dele a até 1 casa (os mais perto primeiro) e de volta ao alvo, em ordem; o "após o primeiro" conta os acertos do uso (o erro não conta como acerto: no
// motor o golpe do projétil já sai com o "menos" — o PoB faz a média); (8) os esporos da Ameaça: no meio do caminho de cada flecha (de você até onde ela acertou
// ou parou), e as Flechas de Espinho como as da Flecha Flagelante (sorteadas nos vivos a até 2 casas do esporo); (9) a Fissura Vaal: cada erupção a mais é o
// acerto do uso no inimigo vivo mais perto da erupção anterior (o mesmo, se for o único), a até o alcance da habilidade; (10) o Pacto: só contam (e gastam) as
// magias suas que fortalece — projétil, área no local mirado ou feixe com ricochete (a cadeia); a armadilha e a mina também não contam; o Pacto não se fortalece;
// (11) a espiral: as N áreas a mais em volta do local mirado, cada uma com a forma do uso, o centro no ângulo da espiral de 360° (o A3b) a raio × (1 + k/N) casas
// dele; o inimigo em várias áreas leva um acerto de cada; (12) o Pacto fica até gastar (o PoE não publica duração), e some ao sair da caçada.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const inteiro = (x) => Math.floor(x + 1e-9);

// ---------------------------------------------------------------- o Tiro Tornado

const LINHA_DO_TORNADO = /^Dispara (\d+) Projéteis secundários$/i;
/** Os projéteis secundários do Tiro Tornado: `{ n }`, ou null. */
export function tornadoDasLinhas(slug, linhas = []) {
  if (slug !== 'Tornado_Shot') return null;
  const n = achar(linhas, LINHA_DO_TORNADO);
  return n ? { n } : null;
}
/** O ângulo (rad) do k-ésimo de N secundários: a fatia k do círculo a partir de `a0`, num ponto sorteado dentro dela (a exceção 3). */
export const anguloDoSecundario = (k, n, a0, rng = Math.random) => a0 + ((2 * Math.PI) / Math.max(1, n)) * (k + rng());

// ---------------------------------------------------------------- a Lança Gélida

/** (D3 do dono) a 2ª forma da Lança Gélida começa a 2 casas de você. */
export const SEGUNDA_FORMA = Object.freeze({ casas: 2 });
const LINHA_CRIT_DA_SEGUNDA = /^Segunda forma possui um aumento de ([\d.]+) % de Chance de Crítico$/i;
const LINHA_MULT_DA_SEGUNDA = /^A Segunda forma possui \+([\d.]+) % ao Multiplicador de Acerto Crítico$/i;
/** A 2ª forma da Lança Gélida: `{ casas, critIncPct, critMultPct }` (o multiplicador com o da qualidade), ou null. */
export function segundaFormaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Ice_Spear') return null;
  const critIncPct = achar(linhas, LINHA_CRIT_DA_SEGUNDA) ?? 0;
  const critMultPct = somar([...linhas, ...daQualidade], LINHA_MULT_DA_SEGUNDA);
  return critIncPct || critMultPct ? { ...SEGUNDA_FORMA, critIncPct, critMultPct } : null;
}
/** O acerto em `bicho` é da 2ª forma (a ≥ `casas` de `origem`, Chebyshev). */
export const naSegundaForma = (sf, origem, bicho) => !!sf && !!origem && !!bicho && Math.max(Math.abs(bicho.x - origem.x), Math.abs(bicho.y - origem.y)) >= sf.casas;

// ---------------------------------------------------------------- a Explosão Cinética

const LINHA_DAS_EXPLOSOES = /^Explosão Cinética cria (\d+) explosões adicionais$/i;
const LINHA_MENOS_AREA = /^([\d.]+) % menos Dano em Área$/i;
const LINHA_RAIO_DA_EXPLOSAO = /^Raio Base da explosao igual a ([\d.]+) metros$/i;
const LINHA_RAIO_SECUNDARIO = /^Raio de alcance secundário base é de ([\d.]+) metros$/i;
const LINHA_EXTRAS_NAS_EXPLOSOES = /^Modificadores da quantidade de Projéteis se aplicam a quantidade de Explosões ao invés$/i;
/**
 * As explosões da Explosão Cinética: `{ n, menosAreaPct, raioM, raioSecM, extrasNasExplosoes }` — as adicionais (com as da qualidade, para baixo), o "menos Dano em
 * Área", os raios-base em metros (o da explosão e o secundário) e a da Ramificação (os projéteis a mais viram explosões) —, ou null.
 */
export function cineticaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Kinetic_Blast/.test(slug)) return null;
  const base = achar(linhas, LINHA_DAS_EXPLOSOES);
  if (base == null) return null;
  return {
    n: base + inteiro(somar(daQualidade, LINHA_DAS_EXPLOSOES)),
    menosAreaPct: achar(linhas, LINHA_MENOS_AREA) ?? 0,
    raioM: achar(linhas, LINHA_RAIO_DA_EXPLOSAO) ?? 1.4,
    raioSecM: achar(linhas, LINHA_RAIO_SECUNDARIO) ?? 2,
    extrasNasExplosoes: linhas.some((l) => LINHA_EXTRAS_NAS_EXPLOSOES.test(norm(l))),
  };
}
/** O uso com as explosões: na da Ramificação os projéteis adicionais viram explosões (`alvosExtras` → `n`). */
export function cineticaNoUso(e, k) {
  if (!e || !k) return e;
  if (!k.extrasNasExplosoes) return { ...e, cinetica: { n: k.n, menosAreaPct: k.menosAreaPct, raioM: k.raioM, raioSecM: k.raioSecM } };
  const extras = Math.max(0, Math.round(Number(e.alvosExtras) || 0));
  return { ...e, alvosExtras: 0, cinetica: { n: k.n + extras, menosAreaPct: k.menosAreaPct, raioM: k.raioM, raioSecM: k.raioSecM } };
}
/**
 * O ponto de uma explosão adicional: sorteado no quadrado de `raioSec` casas em volta de `centro` (D6 do dono).
 * (dono, 21/10) `pode(c)`: a casa vale (a andável com a linha livre até o impacto — `Secundarios`); a sorteada que não vale é trocada por uma sorteada entre as
 * que valem (sem nenhuma, o próprio centro).
 */
export function pontoDaExplosao(centro, raioSec, rng = Math.random, pode = null) {
  const c = { x: centro.x + Math.round((2 * rng() - 1) * raioSec), y: centro.y + Math.round((2 * rng() - 1) * raioSec) };
  if (!pode || pode(c)) return c;
  const validas = [];
  for (let dx = -raioSec; dx <= raioSec; dx++) for (let dy = -raioSec; dy <= raioSec; dy++) { const q = { x: centro.x + dx, y: centro.y + dy }; if (pode(q)) validas.push(q); }
  return validas.length ? validas[Math.min(validas.length - 1, Math.floor(rng() * validas.length))] : { x: centro.x, y: centro.y };
}

// ---------------------------------------------------------------- o Aço Perfurador

const LINHA_DO_ACO = /^Acertos a[óo]?s o primeiro em cada Inimigo causam ([\d.]+) % menos Dano$|^Acertos após o primeiro em cada Inimigo causam ([\d.]+) % menos Dano$/i;
/** O raio (casas) dos vizinhos do alvo que o Aço Perfurador mira (a exceção 7). */
export const VIZINHOS_DO_ACO = 1;
/** O Aço Perfurador: `{ menosPct, raio }` — o "menos Dano" dos acertos após o primeiro em cada inimigo e o raio dos vizinhos —, ou null. */
export function lancaDasLinhas(slug, linhas = []) {
  if (!/^Lancing_Steel/.test(slug)) return null;
  for (const l of linhas) {
    const m = LINHA_DO_ACO.exec(norm(l));
    if (m) return { menosPct: Number(m[1] ?? m[2]), raio: VIZINHOS_DO_ACO };
  }
  return null;
}
/** Os golpes do uso com o "menos" a partir do 2º acerto em cada inimigo (`ja`: os que o golpe direto já acertou). Muda os `pct` no lugar. */
export function menosAposOPrimeiro(golpes, menosPct, ja = []) {
  const vistos = new Set(ja);
  const f = Math.max(0, 1 - (Number(menosPct) || 0) / 100);
  for (const g of golpes) {
    if (!g?.bicho) continue;
    if (vistos.has(g.bicho)) g.pct *= f;
    else vistos.add(g.bicho);
  }
  return golpes;
}

// ---------------------------------------------------------------- a Flecha Virulenta da Ameaça

const LINHA_ESPOROS_POR_FLECHA = /^Cada Flecha deixa (\d+) Esporos?$/i;
const LINHA_FLECHAS_DE_ESPINHO = /^Cada Esporo dispara (\d+) Flechas? de Espinho$/i;
const LINHA_FLECHAS_DA_QUALIDADE = /^Cada Esporo dispara \+([\d.]+) Flechas? de Espinho$/i;
const LINHA_MENOS_DOS_ESPINHOS = /^Projéteis de Espinhos causam ([\d.]+) % menos Dano$/i;
/** Os esporos da Ameaça (um por flecha, na hora do uso): `{ porFlecha, flechas, menosPct, raio }`, ou null. */
export function esporosPorFlechaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Scourge_Arrow_of_Menace') return null;
  const porFlecha = achar(linhas, LINHA_ESPOROS_POR_FLECHA);
  if (!porFlecha) return null;
  const flechas = (achar(linhas, LINHA_FLECHAS_DE_ESPINHO) ?? 0) + inteiro(somar(daQualidade, LINHA_FLECHAS_DA_QUALIDADE));
  return { porFlecha, flechas, menosPct: achar([...linhas, ...daQualidade], LINHA_MENOS_DOS_ESPINHOS) ?? 0, raio: 2 };
}
/** Os pontos dos `n` esporos no caminho de `de` a `para` (o meio, ou espalhados em partes iguais — a exceção 8). */
export function pontosDosEsporos(de, para, n) {
  const r = [];
  for (let i = 1; i <= n; i++) r.push({ x: Math.round(de.x + ((para.x - de.x) * i) / (n + 1)), y: Math.round(de.y + ((para.y - de.y) * i) / (n + 1)) });
  return r;
}

// ---------------------------------------------------------------- a Fissura Vulcânica Vaal

const LINHA_DAS_ERUPCOES = /^Fissuras irrompem (\d+) vezes adicionais$/i;
/** As erupções a mais da Fissura Vulcânica Vaal (D5 do dono: as 2 do poedb), ou 0. */
export const erupcoesDasLinhas = (slug, linhas = []) => (slug === 'Vaal_Volcanic_Fissure' ? achar(linhas, LINHA_DAS_ERUPCOES) ?? 0 : 0);

// ---------------------------------------------------------------- o Pacto de Beidat

const LINHA_DO_PACTO = /^\[Empowered\|Fortalece\] as próximas \+?(\d+) magias que você conjurar$/i;
const LINHA_DANO_DO_PACTO = /^Habilidades fortalecidas causam \+ ?([\d.]+) % de dano com ataques e afecções$/i;
const LINHA_ESPIRAL_DO_PACTO = /^Habilidades fortalecidas também afetam (\d+) áreas adicionais em espiral ao redor da área-alvo$/i;
const LINHA_FEIXES_DO_PACTO = /^Feixes de habilidades fortalecidas se propagam mais (\d+) vezes$/i;
const LINHA_PROJETEIS_DO_PACTO = /^Habilidades fortalecidas disparam (\d+) projéteis adicionais Habilidades fortalecidas disparam projéteis em círculo$/i;
/** O Pacto de Beidat: `{ magias, maisPct, espiral, feixes, projeteis }` (as magias com as da qualidade, para baixo), ou null. */
export function pactoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Pact_of_Beidat') return null;
  const base = achar(linhas, LINHA_DO_PACTO);
  if (!base) return null;
  return {
    magias: base + inteiro(somar(daQualidade, LINHA_DO_PACTO)),
    maisPct: achar(linhas, LINHA_DANO_DO_PACTO) ?? 0,
    espiral: achar(linhas, LINHA_ESPIRAL_DO_PACTO) ?? 0,
    feixes: achar(linhas, LINHA_FEIXES_DO_PACTO) ?? 0,
    projeteis: achar(linhas, LINHA_PROJETEIS_DO_PACTO) ?? 0,
  };
}
/** A gema é o Pacto de Beidat (o uso é o buff — sem golpe). */
export const ehPactoDeBeidat = (slug) => slug === 'Pact_of_Beidat';
/**
 * O que o Pacto faz neste uso (`tags`: as do PoE da habilidade; `cadeia`: a magia tem feixe com ricochete; `noLocal`: a área cai no local mirado): `{ projeteis,
 * espiral, feixes }` — o que vale (0 o que não) —, ou null (a magia não se fortalece: não é magia, é canalizada, não tem nenhum dos três).
 */
export function pactoNoUso(p, { tags = [], cadeia = false, noLocal = false } = {}) {
  if (!p || !(p.restantes > 0)) return null;
  const t = new Set(tags);
  if (!t.has('magia') || t.has('canalizar') || t.has('pacto')) return null;
  const projeteis = t.has('projetil') && !cadeia ? p.projeteis : 0;
  const espiral = t.has('area') && noLocal ? p.espiral : 0;
  const feixes = cadeia ? p.feixes : 0;
  if (!projeteis && !espiral && !feixes) return null;
  return { projeteis, espiral, feixes, maisPct: p.maisPct };
}
/** Os centros das `n` áreas da espiral em volta de `centro` (a exceção 11): o ângulo de 360° ÷ N a partir de `a0`, a `raio` × (1 + k/N) casas. */
export function centrosDaEspiral(centro, n, raio, a0 = 0) {
  const r = [];
  for (let k = 1; k <= n; k++) {
    const a = a0 + (2 * Math.PI * k) / n;
    const d = Math.max(1, raio) * (1 + k / n);
    r.push({ x: Math.round(centro.x + Math.cos(a) * d) + 0, y: Math.round(centro.y + Math.sin(a) * d) + 0 });
  }
  return r;
}

// ---------------------------------------------------------------- o status

const LINHAS_PR3 = [
  [LINHA_DO_TORNADO, /^Tornado_Shot$/],
  [LINHA_CRIT_DA_SEGUNDA, /^Ice_Spear$/], [LINHA_MULT_DA_SEGUNDA, /^Ice_Spear$/],
  [LINHA_DAS_EXPLOSOES, /^Kinetic_Blast/], [LINHA_MENOS_AREA, /^Kinetic_Blast$/],
  [LINHA_DO_ACO, /^Lancing_Steel/],
  [LINHA_ESPOROS_POR_FLECHA, /^Scourge_Arrow_of_Menace$/], [LINHA_FLECHAS_DE_ESPINHO, /^Scourge_Arrow_of_Menace$/], [LINHA_FLECHAS_DA_QUALIDADE, /^Scourge_Arrow_of_Menace$/], [LINHA_MENOS_DOS_ESPINHOS, /^Scourge_Arrow_of_Menace$/],
  [LINHA_DAS_ERUPCOES, /^Vaal_Volcanic_Fissure$/],
  [LINHA_DO_PACTO, /^Pact_of_Beidat$/], [LINHA_DANO_DO_PACTO, /^Pact_of_Beidat$/], [LINHA_ESPIRAL_DO_PACTO, /^Pact_of_Beidat$/], [LINHA_FEIXES_DO_PACTO, /^Pact_of_Beidat$/], [LINHA_PROJETEIS_DO_PACTO, /^Pact_of_Beidat$/],
];
/** A linha da gema é uma das que este lote faz (sai de "efeito não simulado"). */
export const ehLinhaPR3 = (slug, l) => LINHAS_PR3.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
