// O LOTE A3b das gemas do PoE (dono, 19/10: os projéteis e os objetos que FICAM NO CHÃO ou no TEMPO, pelo PoE). Aqui ficam os DADOS de cada gema —
// o que as linhas dizem e os números que só o PoB publica — e as contas puras (sem a caçada). Quem usa é `gemas-poe.mjs` (o status) e `acoes.mjs`
// (o mecanismo único `hunt.poeObjetos`: criar no uso, o tique, consumir).
//
// O MECANISMO (`hunt.poeObjetos`, JSON puro): cada objeto tem um movimento (`mov`: parado, reta, persegue, orbita, no_dono) e um efeito (`efeito`):
//   - `pulso`: a habilidade da gema acerta todos no raio do objeto a cada intervalo (a Bola Relampejante, o Tornado);
//   - `emitir`: o objeto solta projéteis da gema, em espiral ou em direções aleatórias (a Faísca Vaal, a Bola de Fogo Vaal, o Olho Invernal…);
//   - `solo`: o chão que queima quem está dentro, o dano exato pelo tempo (o Vórtice, a Geada Rastejante — o modelo do Solo Ardente do A1);
//   - `inerte`: fica parado até outra gema o consumir ou o tempo acabar (os Disparos Congelantes, as Lâminas Persistentes, os capturados).
//
// As decisões do dono (19/10):
//   - D1/D2: o Disparo Congelante acerta na hora e deixa um MARCADOR no fim do voo (a 7 casas, ou no terreno) por 2 s ÷ o mod de velocidade de projétil
//     do uso. A Nova Glacial dos Disparos explode de até 2 marcadores perto da mira (até o raio da nova, a partir do alvo), com 50% mais dano, sem os
//     destruir; o Vórtice da Projeção explode de até 5 e os destrói, com 50% mais área e 50% mais dano.
//   - D3: deixam objeto você e o totem (pelo caminho que já passa em `acoes`); o mercenário acerta na hora; a Nova e o Vórtice só usam os seus Disparos.
//   - D4: a Bola Relampejante é uma bola de verdade: anda pela velocidade dela por 2 s e acerta a cada 0,15 s todos no raio (2,0 m + a qualidade); o
//     primeiro golpe aos 0,15 s. A Orbital gira; a Estática fica parada (2,8 m).
//   - D5/D6: o Vórtice e a Geada Rastejante são CHÃO (o dano contínuo só dentro, exato pelo tempo); a Geada persegue: 1 casa a cada 0,5 s até o vivo mais
//     perto num raio de 4 casas (as Banquisas com o "+%" delas); teto de 10 áreas (5 nas Banquisas), saindo as mais velhas.
//   - D7: o Tornado: para a frente 1,5 s e depois persegue por 4 s (1 casa a cada 0,5 s mais o "+%"); acerta a cada 0,25 s; 1 por vez (a Turbulência: 3,
//     só persegue, 4 s); o Tolhimento no raio; absorve até 20 dos seus projéteis na fase inicial, guardando 10% do dano deles, que a perseguição soma a
//     cada golpe.
//   - D8: as Lâminas Persistentes (uma por saraivada da Chuva de Lâminas, no centro dela; 1 a cada N facas das Facas Etéreas, onde a faca parou) ficam 6 s,
//     até 40, sem dano. A Explosão de Lâminas detona as que toca (destruídas; a área da gema no lugar de cada uma; encadeia), até 50 por uso.
//   - D9: a Espiral Venenosa: o projétil que voltou é capturado (até 30 + 0,5 por qualidade, 12 s) e não volta de novo; as Lâminas Giratórias soltam
//     todos do ponto de chegada, em leque de 360° ÷ N, com o dano do projétil de ida e 40% de chance de manter cada um. A Vaal: 50 na hora + 15/s por 6 s.
//   - D10: as espirais: a Faísca Vaal 100 em 3 s (os "+N projéteis" somam ao total); a Bola de Fogo Vaal 32 em 2 s (−720°); o Rasgalma da Espiral 5 em
//     0,8 s (300°); o Arremesso Espectral Vaal 8 em cada uma das duas espirais espelhadas, em 2 s (180°, começando a −15°).
//   - D11: o Olho Invernal não causa dano; solta 1 fragmento a cada 0,1 s durante o voo e 8 / 16 / 12 no fim (as três); a rampa do A3 vale nos fragmentos.
//   - D12: teto de 60 golpes por objeto por tique e de 20 objetos ativos por gema (os inertes têm o teto da gema).
//   - D14: os 6 objetos de antes (Gêiseres, Torres, Tormentas, Orbe, Estacas, Solo Ardente) não entram aqui.
//
// EXCEÇÕES DO DONO (19/10, as escolhas sem fonte do lote A3b, aceitas): (1) a unidade do PoE = 1/10 m (a casa = 20 u); (2) a Orbital gira a 2 casas de você
// (a do totem, dele) na velocidade da bola; (3) a Estática fica no alvo; (4) o raio do Tornado é 1 casa e ele procura até 7 casas; (5) o "+%" do Tornado
// soma a linha da gema e a da qualidade; (6) o raio do chão é o "alcance secundário" da gema × √ da Área do uso; (7) o dano guardado pelo Tornado é o médio
// do acerto do projétil absorvido (antes da resistência), e ele absorve também na casa em que nasceu; (8) o olho voa a 4 casas/s × o mod do uso, até 7
// casas, e os fragmentos do voo giram 36° um do outro; (9) o marcador do Disparo vai a 7 casas no rumo de cada projétil (ele atravessa todos); (10) o
// marcador e a captura são só seus (o totem não os deixa); (11) só a Faísca Vaal soma os "+N projéteis" ao total da espiral; (12) as Lâminas Giratórias
// soltam no rumo do vivo mais perto; (13) a bola e o olho acabam no terreno, o tornado para nele; o objeto de outro andar some; (14) A3b-2: o Tolhimento da
// Esfera do Vazio cai linear com a distância (o máximo colado nela, 0 fora do raio + 1), os impactos da Tormenta Flamejante caem uniformes no quadrado da área
// onde as bolas caem (2,5 m / 2,2 m do PoB); (15) o raio da Esfera e do Vórtice de Lâminas é ao menos 1 casa, e a Vaal do Vórtice anda 1 casa a cada 0,5 s até
// o vivo mais perto a até 7 casas.
//
// A REVISÃO (20/10, a revisão adversarial): o golpe do objeto não passa pelo "bicho por perto" de você; os chãos da mesma gema não somam no mesmo bicho (só o
// mais forte queima); a Orbital do totem gira em volta dele; a instância nova começa sem objetos; o chão e o guardado do Tornado respeitam a Safe Zone; as
// Lâminas Giratórias soltam no máximo 30 (o PoB); o Tolhimento do Tornado é o do PoE (30% — o "-1 %" da linha é a bandeira `tornado_hinder`); o Olho
// Invernal da Transitoriedade solta os 12 durante o voo, sem a espiral do fim; a tela recebe o FIM (`ate`) e só os da tela, também os dos aliados.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

/** (D12) Os tetos do mecanismo: golpes por objeto por tique, objetos ativos (pulso, emitir, solo) por gema. */
export const TETOS = Object.freeze({ golpesPorTique: 60, ativosPorGema: 20 });
/** A unidade do PoE (1/10 m) em casas (1 casa = 2 m): 20 unidades. */
export const UNIDADES_POR_CASA = 20;
/** O alcance do projétil do jogo (7 casas — `acoes.velocidadeDoProjetil`, o alcance não muda). */
export const ALCANCE = 7;

// ---------------------------------------------------------------- D4: a Bola Relampejante

/**
 * (D4) A BOLA RELAMPEJANTE (o PoB, act_int.lua:1069-1407): `strikeInterval 0.15`, `duration 2`, `projectileSpeed 40` (unidades por segundo) e o
 * "ball_lightning_projectile_speed_and_hit_frequency_+%_final 33" (a velocidade × 1,33); a Orbital (AltX) gira; a Estática (AltY) fica parada. O raio é o
 * da gema ("O raio Base é de 2 metros" + "+0.1 metros de raio" por qualidade — `GemasPoe.areaNoNivel`).
 */
export const BOLA = Object.freeze({ intervaloMs: 150, duracaoMs: 2000, velUnidades: 40, velMaisPct: 33, orbitaCasas: 2 });
const BOLAS = { Ball_Lightning: 'reta', Ball_Lightning_of_Orbiting: 'orbita', Ball_Lightning_of_Static: 'parado' };

// ---------------------------------------------------------------- D7: o Tornado

/**
 * (D7) O TORNADO (o PoB, act_dex.lua:18021-18179): "Causa Dano a cada 0.25 segundos" (tornado_base_damage_interval_ms 250), "Duração base é de 1.5
 * segundos" (a fase para a frente) e "Duração Base Secundária é de 4 segundos" (a perseguição); "Pela Duração Inicial, pode ser acertado pelos seus
 * Projéteis até 20 vezes" e "Durante a Duração Secundária, Reflete 10 % do Dano Sofrido" (tornado_damage_absorbed_% 10); "Máximo de N Tornados"; o
 * Tolhimento ("Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em X %"); a Turbulência (AltY) só persegue, 4 s.
 */
// (revisão do A3b: o "-1 %" da linha do Tolhimento é a bandeira `tornado_hinder` do PoB, sem valor — o Tolhimento é o do PoE: 30% menos Velocidade de
// Movimento, `tolhePct`; a qualidade do Tornado é só a velocidade dele)
export const TORNADO = Object.freeze({ passoMs: 500, raio: 1, buscaCasas: 7, velCasasS: 2, tolhePct: 30 });

// ---------------------------------------------------------------- D5/D6: o chão

/** (D5/D6) A GEADA RASTEJANTE persegue: 1 casa a cada 0,5 s até o vivo mais perto num raio de 4 casas; o Vórtice fica parado. */
export const GEADA = Object.freeze({ passoMs: 500, buscaCasas: 4 });
const CHAOS = { Vortex: { persegue: false }, Vortex_of_Projection: { persegue: false }, Creeping_Frost: { persegue: true }, Creeping_Frost_of_Floes: { persegue: true } };
/** O degenerativo da gema vai para o CHÃO (não no acertado): o Vórtice e a Geada Rastejante. */
export const ehChao = (slug) => !!CHAOS[slug];

// ---------------------------------------------------------------- D1/D2: o Disparo Congelante

export const DISPARO_CONGELANTE = Object.freeze({ slug: 'Frostbolt', vidaMs: 2000 });
/** (D2) As gemas que explodem dos seus Disparos Congelantes: `{ max, destruir, maisDanoPct, maisAreaPct }` (pelas linhas). */
export function consomeDisparos(slug, linhas = []) {
  if (slug === 'Ice_Nova_of_Frostbolts') {
    const max = achar(linhas, /^Pode se expandir de até (\d+) Projéteis de Disparo Congelante$/i);
    return max ? { max, destruir: false, maisDanoPct: achar(linhas, /^Causa ([\d.]+) % mais Dano com Acertos e Afecções quando conjurada em um Disparo Congelante$/i) ?? 0, maisAreaPct: 0 } : null;
  }
  if (slug === 'Vortex_of_Projection') {
    const max = achar(linhas, /^Pode explor de até (\d+) Projéteis de Disparo Congelante$/i);
    return max ? { max, destruir: true, maisDanoPct: achar(linhas, /^([\d.]+) % mais Dano quando Conjurado com Disparo Congelante$/i) ?? 0, maisAreaPct: achar(linhas, /^([\d.]+) % mais Área de Efeito quando Conjurada em um Disparo Congelante$/i) ?? 0 } : null;
  }
  return null;
}

// ---------------------------------------------------------------- D8: as Lâminas Persistentes

export const EXPLOSAO_DE_LAMINAS = Object.freeze({ maxPorUso: 50 });
/** As gemas que detonam as Lâminas Persistentes (D8: a Explosão de Lâminas e a da Detonação de Adagas; a do Descarrego é a do Vórtice de Lâminas — A3b-2). */
export const detonaLaminas = (slug) => slug === 'Blade_Blast' || slug === 'Blade_Blast_of_Dagger_Detonation';
/** (D8) As Lâminas Persistentes que o uso deixa: `{ por: 'saraivada'|'faca', cada, max }` (pelas linhas), ou null. */
export function laminasDasLinhas(slug, linhas = []) {
  const max = achar(linhas, /^Máxim[n]?o de (\d+) Lâminas Persistentes podem ser deixadas no chão por vez$/i) ?? 40;
  const porSaraivada = achar(linhas, /^Deixa uma Lâmina Persistente no solo para cada (\d+) Saraivadas?$/i);
  if (porSaraivada) return { por: 'saraivada', cada: porSaraivada, max };
  const porFaca = achar(linhas, /^Um a cada (\d+) Projéteis disparados permanece no solo como Lâmina Persistente$/i);
  if (porFaca) return { por: 'faca', cada: porFaca, max };
  return null;
}

// ---------------------------------------------------------------- D9: a Espiral Venenosa

/** (D9) O teto da soltura das Lâminas Giratórias (`snapping_adder_maximum_projectiles_released 30`, act_dex.lua:16313/16394). */
export const ESPIRAL_VENENOSA = Object.freeze({ maxSoltos: 30 });
/** (D9) A captura: `{ max, manterPct, iniciais, porS, emitirMs }` (pelas linhas e pela qualidade), ou null. */
export function capturaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/Venom_Gyre/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  const manterPct = achar(todas, /^([\d.]+) % de chance de manter cada Projétil capturado disparado com Lâminas Giratórias$/i) ?? 40;
  const vaal = /^Máximo de (\d+) Projéteis capturados Cria até (\d+) Projéteis capturados imediatamente Cria (\d+) Projéteis capturados por segundo$/i;
  for (const l of linhas) {
    const m = vaal.exec(norm(l));
    if (m) return { max: Number(m[1]), iniciais: Number(m[2]), porS: Number(m[3]), manterPct, vaal: true };
  }
  const base = achar(linhas, /^Máximo de (\d+) Projét(?:il|eis) capturados?$/i);
  if (!base) return null;
  return { max: Math.floor(base + somar(daQualidade, /^Máximo de \+([\d.]+) Projéteis capturados$/i) + 1e-9), manterPct, iniciais: 0, porS: 0 };
}

// ---------------------------------------------------------------- D10/D11: as espirais e o Olho Invernal

/**
 * (D10) As ESPIRAIS do PoB (`base_number_of_projectiles_in_spiral_nova`, `projectile_spiral_nova_time_ms`, `projectile_spiral_nova_angle`,
 * `projectile_spiral_nova_starting_angle_offset`, `projectile_spiral_nova_both_directions`): a Faísca Vaal (act_int.lua:16994, sem ângulo — as
 * direções aleatórias da gema), a Bola de Fogo Vaal (act_int.lua:5900), o Rasgalma da Espiral (act_int.lua:16644), o Arremesso Espectral Vaal
 * (act_dex.lua:14862). O número da espiral sai da linha da gema quando ela tem ("Dispara 32 Projéteis em uma espiral").
 */
export const ESPIRAIS = Object.freeze({
  Vaal_Spark: Object.freeze({ n: 100, ms: 3000, angulo: null, ini: 0, espelhado: false }),
  Vaal_Fireball: Object.freeze({ n: 32, ms: 2000, angulo: -720, ini: 0, espelhado: false }),
  Soulrend_of_the_Spiral: Object.freeze({ n: 5, ms: 800, angulo: 300, ini: 0, espelhado: false }),
  Vaal_Spectral_Throw: Object.freeze({ n: 8, ms: 2000, angulo: 180, ini: -15, espelhado: true }),
});
export function espiralDasLinhas(slug, linhas = []) {
  const e = ESPIRAIS[slug];
  if (!e) return null;
  const n = achar(linhas, /^Dispara (\d+) Projéteis em (?:uma espiral|cada uma das duas espirais espelhadas)$/i) ?? e.n;
  return { ...e, n };
}
/**
 * (D11) O OLHO INVERNAL (o PoB, act_int.lua:5508-5760: "The eye cannot damage enemies"; `eye_of_winter_base_explosion_shards 8` + 0,1 por qualidade):
 * `fragmentoMs` — 1 fragmento a cada 0,1 s durante o voo (a escolha do dono, sem fonte); `fim` — os do fim ("Dispara 8 / 16 Fragmentos … quando o
 * Projétil terminar", "Dispara 12 … enquanto vôa, e então termina"); `extrasNoFim` — os "Modificadores a quantidade de Projéteis" valem só na espiral do
 * fim (os da Transitoriedade, "só aos Fragmentos": também no fim — os do voo saem 1 a 1).
 */
export const OLHO = Object.freeze({ fragmentoMs: 100, velCasasS: 4, passoGraus: 36 });
export function olhoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Eye_of_Winter/.test(slug)) return null;
  const fim = achar(linhas, /^Dispara (\d+) Fragmentos de Projéteis em uma Espiral/i);
  if (!fim) return null;
  // (revisão do A3b: a da Transitoriedade solta os N DURANTE o voo, no lugar da espiral do fim — `eye_of_winter_count_shards_while_flying_instead`, a linha
  // "Dispara 12 Fragmentos … enquanto vôa, e então termina")
  const noVoo = linhas.some((l) => /^Dispara \d+ Fragmentos de Projéteis em uma Espiral enquanto vôa/i.test(norm(l)));
  return { ...OLHO, noVoo, fim: Math.floor(fim + somar(daQualidade, /^Dispara \+([\d.]+) Fragmentos de Projéteis em uma Espiral/i) + 1e-9) };
}

// ---------------------------------------------------------------- A3b-2: a Esfera do Vazio, a Tormenta Flamejante, o Vórtice de Lâminas

/**
 * (lote A3b-2) A ESFERA DO VAZIO (o PoB, act_int.lua:20257: "Can only have one Void Sphere at a time"; `blackhole_hinder_%`): parada no lugar mirado, pulsa a cada
 * intervalo ("Pulsa a cada 0.4 segundos") todos no raio, e tolhe quem está no alcance — "até X%, com base na distância" (o máximo colado nela, caindo até a borda).
 */
export const ESFERA = Object.freeze({ max: 1 });
/**
 * (lote A3b-2) A TORMENTA FLAMEJANTE (o PoB, act_int.lua:5960-6161): "Um impacto a cada 0.15 segundos" (fire_storm_fireball_delay_ms 150) pela duração, cada um
 * num ponto sorteado da área onde as bolas caem (`radiusSecondary` 25 = 2,5 m; a das Saraivadas — AltY —, 22), a explosão no raio da gema; o primeiro impacto com
 * o "mais Dano" e o "mais Área" dele; "Máximo de N Tempestade de Fogo por vez" (+ a qualidade das Saraivadas). A Vaal (o Solo Ardente) e a dos Meteoros (um
 * impacto só) ficam de fora.
 */
export const TORMENTA_FLAMEJANTE = Object.freeze({ Firestorm: Object.freeze({ areaM: 2.5 }), Firestorm_of_Pelting: Object.freeze({ areaM: 2.2 }) });
/**
 * (lote A3b-2) O VÓRTICE DE LÂMINAS (o PoB, act_dex.lua:2199-2470): as lâminas giram em volta de você (cada uso põe uma, pela duração, até o máximo — "Pode ter até
 * 10 lâminas giratórias ativas"); a cada 0,6 s ÷ (1 + "Taxa de Acerto aumentada em X% por cada lâmina" × as lâminas) todos no raio levam um acerto, com o "X% mais
 * dano por lâmina" × as lâminas (o MORE do PoB pelo Multiplier: um "mais" só). A da Foice: 1 lâmina, 0,8 s. A Vaal: um vórtice próprio, com 10 lâminas, que anda
 * até os inimigos perto ("Acerta Inimigos a cada 0.2 Segundos").
 */
export const VORTICE_DE_LAMINAS = Object.freeze({ baseMs: 600, passoMs: 500, buscaCasas: 7 });

// ---------------------------------------------------------------- o objeto do uso (o resumo do que a gema deixa)

/**
 * O que o USO da gema deixa (`acoes.criarObjetosDoUso`): `{ tipo, … }` ou null. `semAcerto`: o uso não acerta na hora (o dano é o do objeto).
 * `linhas`/`daQualidade`: as da gema no nível e as da qualidade; `stats`: a compilada (duracao, duracao2, maximo).
 */
export function objetoDaGema(slug, linhas = [], daQualidade = [], stats = {}) {
  const todas = [...linhas, ...daQualidade];
  if (BOLAS[slug]) return { tipo: 'bola', mov: BOLAS[slug], semAcerto: true, ...BOLA };
  if (/^Tornado(_of_Elemental_Turbulence)?$/.test(slug)) {
    const turbulencia = slug !== 'Tornado';
    const intervaloMs = Math.round((achar(linhas, /^Causa Dano a cada ([\d.]+) segundos?$/i) ?? 0.25) * 1000);
    return {
      tipo: 'tornado', semAcerto: true, intervaloMs, ...TORNADO,
      fase1Ms: turbulencia ? 0 : Math.round((stats.duracao ?? 1.5) * 1000), fase2Ms: Math.round(((turbulencia ? stats.duracao : stats.duracao2) ?? 4) * 1000),
      velIncPct: somar(todas, /^Tornado tem Velocidade de Movimento aumentada em ([\d.]+) ?%$/i),
      max: Math.max(1, achar(linhas, /^Máximo de (\d+) Tornados?$/i) ?? stats.maximo ?? 1),
      lentidaoPct: todas.some((l) => /^Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em/i.test(norm(l))) ? TORNADO.tolhePct : 0,
      absorve: turbulencia ? null : { max: achar(linhas, /^Pela Duração Inicial, pode ser acertado pelos seus Projéteis até (\d+) vezes$/i) ?? 20, pct: achar(linhas, /^Durante a Duração Secundária, Reflete ([\d.]+) ?% do Dano Sofrido aos Inimigos$/i) ?? 10 },
    };
  }
  if (ESPIRAIS[slug]) return { tipo: 'espiral', semAcerto: true, ...espiralDasLinhas(slug, linhas) };
  if (/^Void_Sphere/.test(slug)) {
    const s = achar(linhas, /^Pulsa a cada ([\d.]+) segundos?$/i);
    return s ? { tipo: 'esfera', semAcerto: true, intervaloMs: Math.round(s * 1000), tolhePct: achar(todas, /^Inimigos ao alcance são tolhidos, com velocidade de movimento reduzida em até ([\d.]+) ?%/i) ?? 0, ...ESFERA } : null;
  }
  if (TORMENTA_FLAMEJANTE[slug]) {
    const s = achar(linhas, /^Um impacto a cada ([\d.]+) segundos?$/i);
    if (!s) return null;
    return {
      tipo: 'tempestade', semAcerto: true, intervaloMs: Math.round(s * 1000), ...TORMENTA_FLAMEJANTE[slug],
      primeiroMaisPct: achar(todas, /^Primeiro Impacto causa ([\d.]+) % mais Dano com Acertos e Afecções$/i) ?? 0,
      primeiroAreaPct: achar(todas, /^Primeiro Impacto tem ([\d.]+) % mais efeito em área$/i) ?? 0,
      max: (achar(linhas, /^Máximo de (\d+) Tempestade de Fogo por vez$/i) ?? 3) + Math.floor(somar(daQualidade, /^Máximo de \+?([\d.]+) Tempestade de Fogo por vez$/i) + 1e-9),
    };
  }
  if (/^(Vaal_)?Blade_Vortex/.test(slug)) {
    const vaal = slug === 'Vaal_Blade_Vortex';
    const fixas = vaal ? achar(linhas, /^Possui (\d+) lâminas$/i) ?? 10 : 0;
    return {
      tipo: 'vortice', semAcerto: true, vaal, fixas, ...VORTICE_DE_LAMINAS,
      baseMs: Math.round((achar(linhas, /^Acerta Inimigos a cada ([\d.]+) Segundos?$/i) ?? VORTICE_DE_LAMINAS.baseMs / 1000) * 1000),
      incPorLaminaPct: somar(todas, /^Taxa de Acerto aumentada em \+?([\d.]+) ?% por cada lâmina$/i),
      maisPorLaminaPct: achar(todas, /^([\d.]+) % mais dano por lâmina$/i) ?? 0,
      max: vaal ? fixas : achar(linhas, /^Pode ter até (\d+) lâminas giratórias ativas$/i) ?? 10,
      duracaoMs: Math.round((stats.duracao ?? 4) * 1000),
    };
  }
  const olho = olhoDasLinhas(slug, linhas, daQualidade);
  if (olho) return { tipo: 'olho', semAcerto: true, ...olho };
  if (slug === DISPARO_CONGELANTE.slug) return { tipo: 'marcador', ...DISPARO_CONGELANTE };
  if (CHAOS[slug]) {
    const raioM = achar(todas, /^Raio de alcance secundário base é de ([\d.]+) metros?$/i);
    const max = achar(linhas, /^Pode ter até (\d+) Áreas Resfriadas$/i);
    return { tipo: 'chao', raioM: raioM ?? 2, max: max ?? 10, persegue: CHAOS[slug].persegue ? { ...GEADA, velIncPct: somar(todas, /^Área Resfriada possui Velocidade de Movimento aumentada em ([\d.]+) ?%$/i) } : null };
  }
  const laminas = laminasDasLinhas(slug, linhas);
  if (laminas) return { tipo: 'laminas', ...laminas, duracaoMs: Math.round((stats.duracao ?? 6) * 1000) };
  const captura = capturaDasLinhas(slug, linhas, daQualidade);
  if (captura) return { tipo: 'captura', semAcerto: !!captura.vaal, ...captura, duracaoMs: Math.round((stats.duracao ?? 12) * 1000), emitirMs: Math.round((stats.duracao2 ?? 6) * 1000) };
  return null;
}

// ---------------------------------------------------------------- as contas puras do movimento

/** O ângulo (rad) do k-ésimo de N projéteis da espiral de `anguloTotal` graus (null: aleatório), a partir de `a0` (rad) + `iniGraus`. */
export function anguloDaEspiral(k, n, a0, anguloTotal, iniGraus = 0, espelho = false) {
  if (anguloTotal == null) return null;
  const passo = n > 0 ? (anguloTotal * k) / n : 0;
  const graus = iniGraus + passo;
  return a0 + ((espelho ? -graus : graus) * Math.PI) / 180;
}
/** (A3b-2) O intervalo do Vórtice de Lâminas com `n` lâminas: a base ÷ (1 + o "Taxa de Acerto aumentada em X% por cada lâmina" × n). */
export const intervaloDoVortice = (baseMs, incPorLaminaPct, n) => Math.max(50, Math.round(baseMs / Math.max(0.1, 1 + ((incPorLaminaPct || 0) * Math.max(0, n)) / 100)));
/** Um passo (1 casa, as 8 direções) de `de` para `para` — o caminho reto de Chebyshev. */
export const passoPara = (de, para) => ({ x: de.x + Math.sign(para.x - de.x), y: de.y + Math.sign(para.y - de.y) });
/** O intervalo de um passo (ms) com o "+X% de Velocidade de Movimento". */
export const passoComVelocidade = (passoMs, incPct = 0) => Math.max(50, Math.round(passoMs / Math.max(0.1, 1 + (incPct || 0) / 100)));

// ---------------------------------------------------------------- o status

/** As linhas de cada gema que o lote A3b faz agora (saem de "não simulado"). */
const LINHAS_A3B = [
  [/^Deixa uma Lâmina Persistente no solo para cada \d+ Saraivadas?$|^Máxim[n]?o de \d+ Lâminas Persistentes podem ser deixadas no chão por vez$|^Um a cada \d+ Projéteis disparados permanece no solo como Lâmina Persistente$/i, /^(Bladefall|Ethereal_Knives_of_Lingering_Blades)$/],
  [/^Máximo de \d+ Projét(?:il|eis) capturados?|^Máximo de \+[\d.]+ Projéteis capturados$|^[\d.]+ % de chance de manter cada Projétil capturado disparado com Lâminas Giratórias$|^Duração Base Secundária é de [\d.]+ segundos?$/i, /Venom_Gyre$/],
  [/^Dispara \d+ Projéteis em (?:uma espiral|cada uma das duas espirais espelhadas)$/i, /^(Vaal_Fireball|Soulrend_of_the_Spiral|Vaal_Spectral_Throw)$/],
  [/^Dispara \+?\d+ Fragmentos de Projéteis em uma Espiral|^Modificadores a quantidade de Projéteis só se aplicam/i, /^Eye_of_Winter/],
  [/^Pode ter até \d+ Áreas Resfriadas$|^Área Resfriada possui Velocidade de Movimento aumentada em [\d.]+ ?%$/i, /^Creeping_Frost/],
  [/^Causa [\d.]+ % mais Dano com Acertos e Afecções quando conjurada em um Disparo Congelante$|^Pode se expandir de até \d+ Projéteis de Disparo Congelante$/i, /^Ice_Nova_of_Frostbolts$/],
  [/^[\d.]+ % mais Área de Efeito quando Conjurada em um Disparo Congelante$|^[\d.]+ % mais Dano quando Conjurado com Disparo Congelante$|^Pode explor de até \d+ Projéteis de Disparo Congelante$/i, /^Vortex_of_Projection$/],
  [/^Pulsa a cada [\d.]+ segundos?$|^Inimigos ao alcance são tolhidos, com velocidade de movimento reduzida em até [\d.]+ ?%/i, /^Void_Sphere/],
  [/^Um impacto a cada [\d.]+ segundos?$|^Primeiro Impacto tem [\d.]+ % mais efeito em área$|^Primeiro Impacto causa [\d.]+ % mais Dano com Acertos e Afecções$|^Máximo de \+?\d+ Tempestade de Fogo por vez$/i, /^Firestorm(_of_Pelting)?$/],
  [/^Taxa de Acerto aumentada em \+?[\d.]+ ?% por cada lâmina$|^[\d.]+ % mais dano por lâmina$|^Pode ter até \d+ lâminas giratórias ativas$|^Acerta Inimigos a cada [\d.]+ Segundos?$|^Possui \d+ lâminas$/i, /^(Vaal_)?Blade_Vortex/],
  [/^Causa Dano a cada [\d.]+ segundos?$|^Pela Duração Inicial, pode ser acertado pelos seus Projéteis até \d+ vezes$|^Durante a Duração Secundária, Reflete [\d.]+ ?% do Dano Sofrido aos Inimigos$|^Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em -?[\d.]+ ?%$|^Tornado tem Velocidade de Movimento aumentada em [\d.]+ ?%$|^Máximo de \d+ Tornados?$|^Duração Base Secundária é de [\d.]+ segundos?$/i, /^Tornado/],
];
export const ehLinhaA3b = (slug, l) => LINHAS_A3B.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
/** O que o lote ainda simplifica, sem linha (o status não o vê). Uma gema sem nada aqui segue o PoE pelas linhas. */
// (revisão do A3b, com o aval do dono: a Espiral Venenosa Vaal é "funciona" — o G16 a confere seguida das Lâminas Giratórias)
export const MOTIVOS_A3B = Object.freeze({});
