// O LOTE B4 das gemas ativas do PoE (dono, 25/10: os FEIXES e os OBJETOS QUE REAGEM — a Chuva Tempestuosa e as duas alternativas, a Esfera/Orbe Trovejante e a das
// Borrascas, o Campo Galvânico e o da Intensidade, a Lança Crepitante e a da Ramificação, a Hidroesfera, a Parede Flamejante e as Paredes de Gelo). Aqui ficam os
// DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o
// status) e `acoes.mjs` (o uso, os objetos de `hunt.poeObjetos` e o tique).
//
// As decisões do dono (25/10 — as recomendações do plano aceitas, com as três confirmações):
//   - D-B4.1: o FEIXE no idle é um segmento de casas (Bresenham) com a largura arredondada em casas (os metros ÷ 2 × √ da Área, quando a Área vale; a fração é a
//     chance de uma casa a mais; ao menos 1); cada feixe acerta cada bicho uma vez por pulso;
//   - D-B4.2: a CHUVA TEMPESTUOSA — cada flecha no chão se liga à flecha viva mais perto (sem repetir o par no mesmo instante); o pulso sai a cada "Flecha dispara
//     Raios a cada X s" ÷ (1 + a frequência); os N feixes são o total de pulsos de cada flecha (o PoB: storm_rain_pulse_count);
//   - D-B4.3: a ESFERA/ORBE TROVEJANTE — "canalizando" é qualquer gema canalizada de Raio sua, com você a até o raio do orbe (2,8 m); sozinho, o orbe golpeia a cada
//     2,55 s ÷ (1 + a Velocidade de Conjuração), como o PoB (confirmado pelo dono, 25/10); a divisão vai até N alvos no raio de 3,5 m (3,8 m) a partir do atingido;
//   - D-B4.4: a HIDROESFERA — como o PoE (confirmado pelo dono, 25/10): um objeto que as suas áreas e os seus projéteis acertam, no máximo 1 vez por segundo; ela
//     recebe as suas afecções de Gelo e de Raio (sorteadas como num bicho com a vida fixa do PoB — `hydrosphere_ailment_threshold`) e converte o Físico em Gelo ou em
//     Raio pela afecção dela; o pulso põe Encharcado (a Exposição a Gelo e a Raio, −10%) em quem ele acerta;
//   - D-B4.5: as PAREDES — perpendiculares à direção do alvo, centradas no alvo, as casas aparecendo do centro para fora; a de Gelo bloqueia como terreno até
//     expirar e empurra quem está nas casas dela; a Flamejante não bloqueia e dá os 78–117 de Fogo ao projétil seu que a cruza (uma vez por projétil); a linha
//     "[DNT]" da Invasão vale (confirmado pelo dono, 25/10): 10% mais dano por parede ativa da gema;
//   - D-B4.6: a INTENSIDADE — 1 por uso, até 3; perde 1 a cada 0,5 s andando e todas no teleporte; zera na troca de instância — pelo mecanismo do Intensificar
//     que já existe (`acoes.intensidadeAgora`/`ganharIntensidade`: o tempo desde a última conjuração conta como andando se você andou depois dela). A ramificação
//     (dono, 25/10 — o PoB não publica o ângulo base): o feixe de 7 casas e as 2 laterais a 45°, que fecham 33% por Intensidade; a da Ramificação, 67,5°.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));
/** O inteiro de uma soma da qualidade ("+1 Feixe" a 0,05 por ponto — 20% dá 1): a folga contra o arredondamento. */
const inteiro = (v) => Math.floor(v + 1e-9);

// ---------------------------------------------------------------- o FEIXE (D-B4.1)

/** A largura do feixe em casas: os metros ÷ 2 × √ do fator da Área (quando vale), a fração como a chance de uma casa a mais; ao menos 1 casa. */
export function larguraDoFeixe(larguraM, fatorDaArea = 1, rng = Math.random) {
  const v = (Math.max(0, larguraM) / 2) * Math.sqrt(Math.max(0, fatorDaArea));
  return Math.max(1, Math.trunc(v) + (rng() < v % 1 ? 1 : 0));
}
/**
 * As casas do FEIXE de `de` a `para` (as duas pontas incluídas; a reta de Bresenham) com `largura` casas: as laterais saem para os dois lados da perpendicular ao
 * eixo dominante (⌊(largura − 1) ÷ 2⌋ de um lado, ⌊largura ÷ 2⌋ do outro). Sem repetir casa.
 */
export function casasDoFeixe(de, para, largura = 1) {
  const casas = new Map();
  const por = (x, y) => casas.set(`${x},${y}`, { x, y });
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const passos = Math.max(Math.abs(dx), Math.abs(dy));
  const [px, py] = Math.abs(dx) >= Math.abs(dy) ? [0, 1] : [1, 0];
  // (revisão: a largura PAR vale — a casa a mais de um lado só; antes a 2 dava o mesmo que a 1, e a fração da D-B4.1 só contava a partir de 3 casas)
  const w = Math.max(1, Math.trunc(largura) || 1);
  const de0 = -Math.floor((w - 1) / 2);
  const ate = Math.floor(w / 2);
  for (let i = 0; i <= passos; i++) {
    const x = passos ? Math.round(de.x + (dx * i) / passos) : de.x;
    const y = passos ? Math.round(de.y + (dy * i) / passos) : de.y;
    for (let k = de0; k <= ate; k++) por(x + px * k, y + py * k);
  }
  return [...casas.values()];
}
/** A reta de `de` a `para` (Bresenham, sem as pontas) passa por alguma casa de `chaves` (um Set de "x,y")? (a diagonal entre duas casas também cruza) */
export function cruza(de, para, chaves) {
  if (!de || !para || !chaves?.size) return false;
  let x = de.x;
  let y = de.y;
  const dx = Math.abs(para.x - x);
  const dy = -Math.abs(para.y - y);
  const sx = x < para.x ? 1 : -1;
  const sy = y < para.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 64 && (x !== para.x || y !== para.y); i++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if ((x !== para.x || y !== para.y) && chaves.has(`${x},${y}`)) return true;
    if (chaves.has(`${x - sx},${y}`) && chaves.has(`${x},${y - sy}`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- a CHUVA TEMPESTUOSA (D-B4.2)

const LINHA_RAIOS_A_CADA = /^Flecha dispara Raios a cada ([\d.]+) segundos?$/i;
const LINHA_FEIXES = /^Cada Flecha pode disparar (\d+) Feixes?$/i;
const LINHA_FEIXES_Q = /^Cada Flecha pode disparar \+([\d.]+) Feixes?$/i;
const LINHA_MAX_FLECHAS = /^Máximo de (\d+) Flechas no solo$/i;
/**
 * (o PoB, act_dex.lua:11726 — StormRain e as alternativas: o feixe de largura `radiusSecondary` 12 = 1,2 m, "Beam Width"; prismatic_rain_beam_base_frequency_ms;
 * storm_rain_pulse_count + 0,05 por qualidade; number_of_allowed_storm_arrows)
 */
export const CHUVA_TEMPESTUOSA = Object.freeze({ larguraM: 1.2 });
/** `{ tipo: 'flechaTempestade', semAcerto: false, intervaloMs, feixes, max, larguraM, semQuantidade }` ou null. */
export function chuvaTempestuosaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Storm_Rain(_of_the_Conduit|_of_the_Fence)?$/.test(slug)) return null;
  const cada = achar(linhas, LINHA_RAIOS_A_CADA);
  const feixes = achar(linhas, LINHA_FEIXES);
  if (!cada || !feixes) return null;
  return {
    tipo: 'flechaTempestade', semAcerto: false, intervaloMs: Math.round(cada * 1000), feixes: feixes + inteiro(somar(daQualidade, LINHA_FEIXES_Q)), max: achar(linhas, LINHA_MAX_FLECHAS) ?? 100, larguraM: CHUVA_TEMPESTUOSA.larguraM,
    // (a da Barreira: "Modificadores à quantidade de Projéteis não se aplicam nesta Habilidade" — uma flecha por uso)
    semQuantidade: tem(linhas, /^Modificadores à quantidade de Projéteis não se aplicam/i),
  };
}
/**
 * Os PARES de feixe do pulso (D-B4.2): cada flecha de `pulsando` se liga à flecha viva mais perto de `todas` (outra que não ela), sem repetir o par no mesmo instante.
 * Devolve `[[a, b], …]` (as flechas, na ordem do pulso).
 */
export function paresDoPulso(pulsando, todas) {
  const vistos = new Set();
  const pares = [];
  for (const a of pulsando) {
    let b = null;
    let d0 = Infinity;
    for (const x of todas) {
      if (x === a) continue;
      const d = Math.max(Math.abs(x.x - a.x), Math.abs(x.y - a.y));
      if (d < d0) { d0 = d; b = x; }
    }
    if (!b) continue;
    const k = [a.id, b.id].sort().join('|');
    if (vistos.has(k)) continue;
    vistos.add(k);
    pares.push([a, b]);
  }
  return pares;
}

// ---------------------------------------------------------------- a ESFERA/ORBE TROVEJANTE (D-B4.3)

const LINHA_ATACA_A_CADA = /^Ataca a cada ([\d.]+) segundos, e quando você usar uma Habilidade de Raio próximo do Orbe$/i;
const LINHA_CANALIZANDO = /^Golpeia a cada ([\d.]+) segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe$/i;
const LINHA_RAIO_DA_DIVISAO = /^Feixes se dividem em direção a alvos dentro de um raio base de ([\d.]+) metros$/i;
const LINHA_GOLPES = /^Orbes desaparecem após (\d+) Golpes$/i;
const LINHA_DIVIDE = /^O feixe se divide em direção a (\d+) alvos adicionais$/i;
const LINHA_DIVIDE_Q = /^O feixe se divide em direção a \+([\d.]+) alvos adicionais$/i;
/**
 * (o PoB, act_int.lua:13612 — OrbOfStorms e OrbOfStormsAltX: o raio 28 — o da das Borrascas, 38 —, o secundário 35 — 38 — da divisão, projectile_number_to_split 3 —
 * 5 — + 0,1 por qualidade, orb_of_storms_base_bolt_frequency_ms 2550 ÷ a Velocidade de Conjuração — `hitTimeOverride = hitFrequency / calcLib.mod(Speed)` —,
 * orb_of_storms_base_channelling_bolt_frequency_ms 500, orb_of_storms_maximum_number_of_hits; a das Borrascas não golpeia sozinha e "teleporta para um inimigo
 * atingido aleatório" ao golpear)
 * `{ tipo: 'orbeTempestade', semAcerto: true, intervaloMs | null, canalMs, raioM, raioDivisaoM, golpes, divide, teleporta }` ou null.
 */
export function orbeTempestadeDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Orb_of_Storms(_of_Squalls)?$/.test(slug)) return null;
  const canal = achar(linhas, LINHA_CANALIZANDO);
  const golpes = achar(linhas, LINHA_GOLPES);
  if (!canal || !golpes) return null;
  const cada = achar(linhas, LINHA_ATACA_A_CADA);
  return {
    tipo: 'orbeTempestade', semAcerto: true, intervaloMs: cada ? Math.round(cada * 1000) : null, canalMs: Math.round(canal * 1000), raioM: stats.raioFinal ?? stats.raio ?? 2.8,
    raioDivisaoM: achar(linhas, LINHA_RAIO_DA_DIVISAO) ?? 3.5, golpes, divide: (achar(linhas, LINHA_DIVIDE) ?? 0) + inteiro(somar(daQualidade, LINHA_DIVIDE_Q)), teleporta: slug === 'Orb_of_Storms_of_Squalls',
  };
}
/**
 * Os ATINGIDOS de um golpe do orbe: o primeiro (`primeiro`) e a divisão — até `divide` outros vivos de `vivos` a até `raio` casas DELE (os mais perto primeiro).
 */
export function atingidosDoOrbe(primeiro, vivos, divide, raio) {
  if (!primeiro) return [];
  const outros = vivos.filter((m) => m !== primeiro && Math.max(Math.abs(m.x - primeiro.x), Math.abs(m.y - primeiro.y)) <= raio)
    .sort((a, b) => Math.max(Math.abs(a.x - primeiro.x), Math.abs(a.y - primeiro.y)) - Math.max(Math.abs(b.x - primeiro.x), Math.abs(b.y - primeiro.y)));
  return [primeiro, ...outros.slice(0, Math.max(0, divide))];
}

// ---------------------------------------------------------------- o CAMPO GALVÂNICO

const LINHA_FEIXE_A_CADA = /^Dispara um feixe a cada ([\d.]+) segundos?$/i;
const LINHA_FOCO = /^Pode focar em cada inimigo apenas uma vez a cada ([\d.]+) segundos?$/i;
const LINHA_MAIS_POR_ELETRIZACAO = /^Campo ganha ([\d.]+) % mais Dano com Ataques por cada 5 ?% de Efeito de Eletrização no Inimigo quando criado$/i;
const LINHA_RAIO_POR_ELETRIZACAO = /^Campo ganha \+([\d.]+) metros ao raio por cada 10 ?% de Efeito de Eletrização no Inimigo quando criado$/i;
const LINHA_BUFF_CHANCE = /^Buff Concede ([\d.]+) % de chance de Eletrizar inimigos$/i;
const LINHA_BUFF_CHANCE_Q = /^Buff concede \+([\d.]+) % de chance de Eletrizar inimigos$/i;
const LINHA_MAX_CAMPOS = /^Máximo de (\d+) Campos?$/i;
/**
 * (o PoB, act_int.lua:8534 — GalvanicField e GalvanicFieldAltX: SkillType.Buff; "When you shock an enemy while you have this buff, creates a spherical field of energy
 * attached to the shocked enemy for a duration"; o raio 19 = 1,9 m; base_galvanic_field_beam_delay_ms 100 — 200 —; galvanic_field_retargeting_delay_ms;
 * galvanic_field_damage_+%_final_per_5%_increased_damage_taken_from_shock — ModFlag.Hit —; galvanic_field_radius_+_per_10%… 1 = +0,1 m; base_chance_to_shock_%_from_skill
 * 50 + 1 por qualidade; galvanic_field_maximum_number_of_spheres 1; never_shock)
 */
export const CAMPO_GALVANICO = Object.freeze({ raioM: 1.9 });
/** `{ feixeMs, focoMs, maisPor5Pct, raioPor10M, raioM, duracaoMs, max, chancePct }` ou null. */
export function campoGalvanicoDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  if (!/^Galvanic_Field(_of_Intensity)?$/.test(slug)) return null;
  const feixe = achar(linhas, LINHA_FEIXE_A_CADA);
  const foco = achar(linhas, LINHA_FOCO);
  if (!feixe || !foco) return null;
  return {
    feixeMs: Math.round(feixe * 1000), focoMs: Math.round(foco * 1000), maisPor5Pct: achar(linhas, LINHA_MAIS_POR_ELETRIZACAO) ?? 0, raioPor10M: achar(linhas, LINHA_RAIO_POR_ELETRIZACAO) ?? 0,
    raioM: CAMPO_GALVANICO.raioM + (stats.raioBonus ?? 0), duracaoMs: Math.round((stats.duracao ?? 6) * 1000), max: achar(linhas, LINHA_MAX_CAMPOS) ?? 1,
    chancePct: (achar(linhas, LINHA_BUFF_CHANCE) ?? 0) + somar(daQualidade, LINHA_BUFF_CHANCE_Q),
  };
}
/** O campo criado num inimigo com a Eletrização de `pct`% (medida ao criar): `{ raioM, maisPct }` — +X% por cada 5% inteiro e +Y m por cada 10% inteiro. */
export function campoPelaEletrizacao(c, pct = 0) {
  const p = Math.max(0, pct);
  return { raioM: c.raioM + c.raioPor10M * inteiro(p / 10), maisPct: c.maisPor5Pct * inteiro(p / 5) };
}
/** O alvo do feixe do campo: dos vivos no raio, os que ele não focou nos últimos `focoMs` (o mais antigo primeiro; o nunca focado antes de todos). */
export function alvoDoCampo(vivosNoRaio, focados = {}, agora, focoMs) {
  const livres = vivosNoRaio.filter((m) => !((focados[m.uid] ?? -Infinity) + focoMs > agora));
  if (!livres.length) return null;
  return livres.reduce((a, b) => ((focados[b.uid] ?? -Infinity) < (focados[a.uid] ?? -Infinity) ? b : a));
}

// ---------------------------------------------------------------- a LANÇA CREPITANTE (a Intensidade — D-B4.6)

const LINHA_PERDE_INTENSIDADE = /^Esta Magia perde (\d+) de Intensidade a cada ([\d.]+) segundos enquanto se movendo, ou imediatamente ao teleportar$/i;
const LINHA_GANHA_INTENSIDADE = /^Esta Magia ganha Intensidade quando você Conjurá-la, máximo de (\d+)$/i;
const LINHA_MAIS_POR_INTENSIDADE = /^([\d.]+) % mais Dano com Acertos e Afecções por Intensidade$/i;
const LINHA_MAIS_POR_INTENSIDADE_Q = /^\+([\d.]+) % mais Dano com Acertos e Afecções por Intensidade$/i;
/**
 * (o PoB, act_int.lua:3456 — CracklingLance: SkillType.GainsIntensity; disintegrate_damage_+%_final_per_intensity 35 + 0,5 por qualidade — Damage MORE, Multiplier
 * Intensity —; o poedb/Community Wiki: "the caster cannot gain a stack of Intensity when this spell is repeated, triggered, or cast by a totem")
 * `{ max, perde, perdeMs, maisPorPct }` ou null.
 */
export function intensidadeDasLinhas(linhas = [], daQualidade = []) {
  const max = achar(linhas, LINHA_GANHA_INTENSIDADE);
  if (!max) return null;
  let perde = 1;
  let perdeMs = 500;
  for (const l of linhas) { const m = LINHA_PERDE_INTENSIDADE.exec(norm(l)); if (m) { perde = Number(m[1]); perdeMs = Math.round(Number(m[2]) * 1000); } }
  return { max, perde, perdeMs, maisPorPct: (achar(linhas, LINHA_MAIS_POR_INTENSIDADE) ?? 0) + somar(daQualidade, LINHA_MAIS_POR_INTENSIDADE_Q) };
}
/**
 * (dono, 25/10 — a ramificação da Lança Crepitante, a opção (a)) o FEIXE da Lança: o principal de 1 m de largura (+0,3 m por Intensidade) e 7 casas, como o da Ira
 * Divina do A4 — × √ do fator da Área de qualquer fonte nos dois (dono, 25/10, a revisão: como o PoB, act_int.lua:3456/3557, a Área muda o `radius` do feixe; o Community
 * Wiki, "Neither the beam itself nor the branches have an area to modify", deixou de valer; `casasDaLancaNoUso`); as 2 laterais saem do meio dele a 45°
 * (a decisão do dono: o PoB não publica o ângulo base), 33% menos por Intensidade (multiplicado: 45° × 0,67³ ≈ 13,5° com 3), e a da Ramificação com o "+50%" (67,5°).
 * `{ comprimento, meio, larguraM, porIntensidadeM, anguloGraus, menosPorIntensidadePct }` ou null.
 */
export const LANCA = Object.freeze({ comprimento: 7, meio: 3, larguraM: 1, anguloGraus: 45 });
const LINHA_LARGURA_POR_INTENSIDADE = /^\+([\d.]+) metros à Largura do Feixe Por Intensidade ([\d.]+) ?% menos ângulo de ramificação por Intensidade$/i;
const LINHA_ANGULO_INC = /^Ângulo da ramificação aumentado em ([\d.]+) ?%$/i;
const LINHA_MAIS_AREA_Q = /^([\d.]+) ?% mais Área de Efeito$/i;
/**
 * (+ revisão B4/PR4/C3) `fatorDaArea`: o da QUALIDADE da própria gema (a da Ramificação: "(0 — 20) % mais Área de Efeito" — o PoB, act_int.lua:3557,
 * `active_skill_area_of_effect_+%_final` no `radius` do feixe; o efeito do uso não a traz), que multiplica a Área das outras fontes no uso (`casasDaLancaNoUso`).
 */
export function lancaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Crackling_Lance(_of_Branching)?$/.test(slug)) return null;
  let porIntensidadeM = 0;
  let menosPorIntensidadePct = 0;
  for (const l of linhas) { const m = LINHA_LARGURA_POR_INTENSIDADE.exec(norm(l)); if (m) { porIntensidadeM = Number(m[1]); menosPorIntensidadePct = Number(m[2]); } }
  const fatorDaArea = slug === 'Crackling_Lance_of_Branching' ? 1 + somar(daQualidade, LINHA_MAIS_AREA_Q) / 100 : 1;
  return { ...LANCA, porIntensidadeM, menosPorIntensidadePct, anguloGraus: LANCA.anguloGraus * (1 + (achar(linhas, LINHA_ANGULO_INC) ?? 0) / 100), ...(fatorDaArea > 1 ? { fatorDaArea } : {}) };
}
/**
 * As casas da Lança no USO com a Intensidade `n` e o fator da Área do uso `fatorDoUso` (toda a Área — dono, 25/10, como o PoB), × o da qualidade da gema: a largura
 * (os metros ÷ 2 × √ do fator, a fração como a chance de uma casa a mais — D-B4.1) e, com o fator ≠ 1, o comprimento (7 casas × √ do fator, idem; ao menos o meio + 1);
 * o mesmo `casasDaLanca`.
 */
export function casasDaLancaNoUso(de, para, l, n = 0, rng = Math.random, fatorDoUso = 1) {
  const fator = (l.fatorDaArea ?? 1) * Math.max(0, fatorDoUso);
  const largura = larguraDoFeixe(l.larguraM + l.porIntensidadeM * n, fator, rng);
  const comprimento = Math.abs(fator - 1) > 1e-9 ? Math.max(l.meio + 1, casasDoComprimento(l.comprimento * 2, fator, rng)) : l.comprimento;
  return casasDaLanca(de, para, { ...l, comprimento }, anguloDaLanca(l, n), largura);
}
/** O ângulo das laterais (graus) com a Intensidade `n`: o da gema × (1 − X%)ⁿ. */
export const anguloDaLanca = (l, n = 0) => l.anguloGraus * Math.pow(Math.max(0, 1 - l.menosPorIntensidadePct / 100), Math.max(0, n));
/**
 * As casas da Lança de `de` na direção de `para`: o feixe principal (sem a casa de quem usa) até `comprimento` casas e as 2 laterais, do meio dele, a ±`anguloGraus`, até
 * a mesma distância de quem usa; a largura em casas (`largura`). Sem repetir casa.
 */
export function casasDaLanca(de, para, l, anguloGraus, largura = 1) {
  const th = para && (para.x !== de.x || para.y !== de.y) ? Math.atan2(para.y - de.y, para.x - de.x) : 0;
  const ponta = (o, a, d) => ({ x: Math.round(o.x + Math.cos(a) * d), y: Math.round(o.y + Math.sin(a) * d) });
  const meio = ponta(de, th, l.meio);
  const casas = new Map();
  const por = (lista) => { for (const c of lista) if (c.x !== de.x || c.y !== de.y) casas.set(`${c.x},${c.y}`, c); };
  por(casasDoFeixe(de, ponta(de, th, l.comprimento), largura));
  const a = (anguloGraus * Math.PI) / 180;
  for (const s of [1, -1]) por(casasDoFeixe(meio, ponta(meio, th + s * a, l.comprimento - l.meio), largura));
  return [...casas.values()];
}

// ---------------------------------------------------------------- a HIDROESFERA (D-B4.4)

const LINHA_PULSA = /^Pulsa a cada ([\d.]+) enquanto Congelada, Eletrizada, Enfraquecida ou Exaurida$/i;
const LINHA_SO_ACERTADA = /^Só pode ser Acertado uma vez a cada ([\d.]+) segundos?$/i;
const LINHA_ENCHARCADO = /^Inimigos Encharcados têm Exposição a Gelo e Raio, aplicando -([\d.]+) % às Resistências$/i;
const LINHA_CONVERSAO_DA_ESFERA = /^100 ?% do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera não possuir Afeções/i;
const LINHA_FREQUENCIA_DO_PULSO = /^Frequência do Pulso aumentada em \+?([\d.]+) ?%$/i;
/**
 * (o PoB, act_int.lua:8940 — Hydrosphere: o raio 23 = 2,3 m; hydro_sphere_base_pulse_frequency_ms 400 ÷ (1 + HydroSphereFrequency — a qualidade, 0,5 por ponto);
 * hydrosphere_hit_cooldown_ms 1000; water_sphere_cold_lightning_exposure_% −10; base_secondary_skill_effect_duration 4000 — o Encharcado —; base_skill_effect_duration
 * 8000; as 7 partes da conversão; "Create a sphere of water, or move an existing sphere and reset its duration … The sphere pulses when created, at regular intervals
 * while afflicted by an Ailment, and after moving"; `hydrosphere_ailment_threshold` — o limiar das afecções nela, a coluna de cada nível, abaixo)
 */
export const HIDROESFERA = Object.freeze({ raioM: 2.3 });
/** O `hydrosphere_ailment_threshold` do PoB por nível (1 a 40) — a "vida" com que as afecções são sorteadas na esfera. */
export const LIMIAR_DA_HIDROESFERA = Object.freeze([1500, 1811, 2228, 2708, 3276, 3956, 4758, 5711, 6846, 8178, 9720, 11555, 13704, 17375, 21981, 28534, 39339, 56804, 81482, 103048,
  117720, 128197, 139010, 151382, 164208, 178841, 193959, 210689, 227952, 245233, 260395, 270000, 279745, 289629, 299653, 310830, 322166, 333662, 345316, 357494]);
/** `{ tipo: 'hidroesfera', semAcerto: true, pulsoMs, acertoMs, exposicaoPct, encharcadoMs, duracaoMs, raioM, limiar }` ou null. */
export function hidroesferaDasLinhas(slug, linhas = [], daQualidade = [], stats = {}, nivel = 1) {
  if (slug !== 'Hydrosphere') return null;
  const pulsa = achar(linhas, LINHA_PULSA);
  if (!pulsa) return null;
  const inc = somar(daQualidade, LINHA_FREQUENCIA_DO_PULSO);
  return {
    tipo: 'hidroesfera', semAcerto: true, pulsoMs: (pulsa * 1000) / Math.max(0.1, 1 + inc / 100), acertoMs: Math.round((achar(linhas, LINHA_SO_ACERTADA) ?? 1) * 1000),
    exposicaoPct: achar(linhas, LINHA_ENCHARCADO) ?? 10, encharcadoMs: Math.round((stats.duracao2 ?? 4) * 1000), duracaoMs: Math.round((stats.duracao ?? 8) * 1000),
    raioM: HIDROESFERA.raioM + (stats.raioBonus ?? 0), limiar: LIMIAR_DA_HIDROESFERA[Math.max(1, Math.min(LIMIAR_DA_HIDROESFERA.length, nivel | 0 || 1)) - 1],
  };
}
const ativo = (x, agora) => !!x && (x.ate ?? -Infinity) > agora;
/** As afecções da esfera agora (`estados` dela): `{ frio, raio }` — Congelada ou Enfraquecida (frio); Eletrizada ou Exaurida (raio). */
export function afeccoesDaEsfera(estados = {}, agora = 0) {
  return { frio: ativo(estados.congelado, agora) || ativo(estados.fragilizado, agora), raio: ativo(estados.chocado, agora) || ativo(estados.exaurido, agora) };
}
/**
 * A CONVERSÃO do Físico pela esfera (`af:conv_hab_physical_<el>` do uso): sem afecção, 100% em Gelo; Eletrizada/Exaurida, 100% em Raio; Congelada/Enfraquecida,
 * 100% em Gelo; as duas, 50% em cada ("Se ambas conversões forem aplicadas, cada uma converterá 50%" — o poedb; o PoB: a parte 7, as duas conversões de 100%).
 */
export function conversaoDaEsfera(estados = {}, agora = 0) {
  const a = afeccoesDaEsfera(estados, agora);
  if (a.frio && a.raio) return { ice: 50, energy: 50 };
  if (a.raio) return { ice: 0, energy: 100 };
  return { ice: 100, energy: 0 };
}

// ---------------------------------------------------------------- as PAREDES (D-B4.5)

const LINHA_COMPRIMENTO = /^Parede terá ([\d.]+) metros$/i;
const LINHA_SECOES = /^([\d.]+) segundos entre o aparecimento de seções da Parede$/i;
const LINHA_POR_PAREDE_ATIVA = /^\[DNT\] Deals ([\d.]+) ?% more Damage per active wall$/i;
const LINHA_PROJETEIS_PELA_PAREDE = /^Projéteis que passam pela parede causam ([\d.]+) a ([\d.]+) de Dano de Fogo Adicional$/i;
const LINHA_MAX_PAREDES = /^Máximo de (\d+) Paredes Flamejantes por vez$/i;
const LINHA_MAX_PAREDES_Q = /^Máximo de \+([\d.]+) Paredes Flamejantes por vez$/i;
/**
 * A PAREDE de Gelo (o PoB, act_int.lua:8111 — FrostWall: wall_expand_delay_ms 150, wall_maximum_length; "holds back enemies. Targets under the wall are damaged and
 * pushed back"; sem a tag Área — o comprimento não muda com a Área) e a Flamejante (act_int.lua:6480 — FlameWall: wall_maximum_length é o `radius` — a Área vale —;
 * o degenerativo primário na área e o secundário de 2 s em quem entra; flame_wall_minimum/maximum_added_fire_damage — ModFlag.Projectile —; number_of_allowed_firewalls
 * 3 + 0,1 por qualidade).
 * Gelo: `{ tipo: 'paredeGelo', semAcerto: true, comprimentoM, secaoMs, duracaoMs, porParedePct, comArea: false }`;
 * Fogo: `{ tipo: 'paredeFogo', semAcerto: true, comprimentoM, duracaoMs, secundarioMs, adicional: [min, max], max, comArea: true }`; null fora delas.
 */
export function paredeDasLinhas(slug, linhas = [], daQualidade = [], stats = {}) {
  const comprimentoM = achar(linhas, LINHA_COMPRIMENTO);
  if (!comprimentoM) return null;
  if (/^Frost_Wall(_of_Encroachment)?$/.test(slug)) {
    return { tipo: 'paredeGelo', semAcerto: true, comprimentoM, secaoMs: Math.round((achar(linhas, LINHA_SECOES) ?? 0.15) * 1000), duracaoMs: Math.round((stats.duracao ?? 3) * 1000), porParedePct: achar(linhas, LINHA_POR_PAREDE_ATIVA) ?? 0, comArea: false };
  }
  if (slug === 'Flame_Wall') {
    let adicional = null;
    for (const l of linhas) { const m = LINHA_PROJETEIS_PELA_PAREDE.exec(norm(l)); if (m) adicional = [Number(m[1]), Number(m[2])]; }
    return { tipo: 'paredeFogo', semAcerto: true, comprimentoM, duracaoMs: Math.round((stats.duracao ?? 3) * 1000), secundarioMs: Math.round((stats.duracao2 ?? 1) * 1000), adicional, max: (achar(linhas, LINHA_MAX_PAREDES) ?? stats.maximo ?? 3) + inteiro(somar(daQualidade, LINHA_MAX_PAREDES_Q)), comArea: true };
  }
  return null;
}
/**
 * As casas da parede de `n` casas centrada em `centro`, perpendicular à direção de `de` para o centro (na diagonal, a outra diagonal — como a Parede de Força do A2),
 * na ORDEM em que aparecem: o centro, depois as dos dois lados, de dentro para fora.
 */
export function casasDaParede(centro, de, n) {
  const dx = centro.x - (de?.x ?? centro.x);
  const dy = centro.y - (de?.y ?? centro.y);
  const [px, py] = dx || dy ? [-Math.sign(dy), Math.sign(dx)] : [0, 1];
  const lista = [{ x: centro.x, y: centro.y }];
  for (let k = 1; lista.length < Math.max(1, n); k++) {
    lista.push({ x: centro.x + px * k, y: centro.y + py * k });
    if (lista.length < n) lista.push({ x: centro.x - px * k, y: centro.y - py * k });
  }
  return lista;
}
/** O número de casas da parede de `metros` (÷ 2, × √ do fator da Área se ela vale): a fração é a chance de uma casa a mais; ao menos 1. */
export function casasDoComprimento(metros, fatorDaArea = 1, rng = Math.random) {
  const v = (Math.max(0, metros) / 2) * Math.sqrt(Math.max(0, fatorDaArea));
  return Math.max(1, Math.trunc(v) + (rng() < v % 1 ? 1 : 0));
}

// ---------------------------------------------------------------- o objeto do uso

/** O objeto que o uso da gema deixa neste lote (`acoes.criarObjetosDoUso`), ou null. */
export function objetoDaGema(slug, linhas = [], daQualidade = [], stats = {}, nivel = 1) {
  return chuvaTempestuosaDasLinhas(slug, linhas, daQualidade) ?? orbeTempestadeDasLinhas(slug, linhas, daQualidade, stats) ?? hidroesferaDasLinhas(slug, linhas, daQualidade, stats, nivel) ?? paredeDasLinhas(slug, linhas, daQualidade, stats);
}
/** O que o BUFF da gema dá (os atributos do buff — `GemasPoe.buffNoNivel`): o Campo Galvânico, a chance de Eletrizar. */
export function afDoBuff(slug, linhas = [], daQualidade = []) {
  if (!/^Galvanic_Field(_of_Intensity)?$/.test(slug)) return null;
  const chance = (achar(linhas, LINHA_BUFF_CHANCE) ?? 0) + somar(daQualidade, LINHA_BUFF_CHANCE_Q);
  return chance > 0 ? { chance_shock: chance } : null;
}
/** As gemas que são buff no PoE (SkillType.Buff) e o arquétipo daqui as tratava como uso: o Campo Galvânico (o buff; o dano é o do campo). */
export const ARQUETIPO_B4 = Object.freeze({ Galvanic_Field: 'guarda', Galvanic_Field_of_Intensity: 'guarda' });

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaB4(slug, l) {
  const t = norm(l);
  if (/^Storm_Rain(_of_the_Conduit|_of_the_Fence)?$/.test(slug) && (LINHA_RAIOS_A_CADA.test(t) || LINHA_FEIXES.test(t) || LINHA_FEIXES_Q.test(t) || LINHA_MAX_FLECHAS.test(t))) return true;
  if (/^Orb_of_Storms(_of_Squalls)?$/.test(slug) && (LINHA_ATACA_A_CADA.test(t) || LINHA_CANALIZANDO.test(t) || LINHA_RAIO_DA_DIVISAO.test(t) || LINHA_GOLPES.test(t) || LINHA_DIVIDE.test(t) || LINHA_DIVIDE_Q.test(t))) return true;
  if (/^Galvanic_Field(_of_Intensity)?$/.test(slug) && (LINHA_FEIXE_A_CADA.test(t) || LINHA_FOCO.test(t) || LINHA_MAIS_POR_ELETRIZACAO.test(t) || LINHA_RAIO_POR_ELETRIZACAO.test(t) || LINHA_BUFF_CHANCE.test(t) || LINHA_BUFF_CHANCE_Q.test(t) || LINHA_MAX_CAMPOS.test(t) || /^Não Pode aplicar Eletrizar$/i.test(t) || /^Causa [\d.]+ a [\d.]+ de Dano de Raio$/i.test(t) || /^Duração base é de [\d.]+ segundos?$/i.test(t))) return true;
  if (/^Crackling_Lance(_of_Branching)?$/.test(slug) && (LINHA_LARGURA_POR_INTENSIDADE.test(t) || LINHA_ANGULO_INC.test(t))) return true;
  if (slug === 'Crackling_Lance' && (LINHA_PERDE_INTENSIDADE.test(t) || LINHA_GANHA_INTENSIDADE.test(t) || LINHA_MAIS_POR_INTENSIDADE.test(t) || LINHA_MAIS_POR_INTENSIDADE_Q.test(t))) return true;
  if (slug === 'Hydrosphere' && (LINHA_PULSA.test(t) || LINHA_SO_ACERTADA.test(t) || LINHA_ENCHARCADO.test(t) || LINHA_CONVERSAO_DA_ESFERA.test(t) || LINHA_FREQUENCIA_DO_PULSO.test(t))) return true;
  if (/^Frost_Wall(_of_Encroachment)?$/.test(slug) && (LINHA_COMPRIMENTO.test(t) || LINHA_SECOES.test(t) || LINHA_POR_PAREDE_ATIVA.test(t))) return true;
  if (slug === 'Flame_Wall' && (LINHA_COMPRIMENTO.test(t) || LINHA_PROJETEIS_PELA_PAREDE.test(t) || LINHA_MAX_PAREDES.test(t) || LINHA_MAX_PAREDES_Q.test(t))) return true;
  return false;
}
