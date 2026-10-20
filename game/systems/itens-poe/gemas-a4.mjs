// O LOTE A4 das gemas do PoE (dono, 19/10: as REPETIÇÕES do golpe e os ESTÁGIOS, os ÂNGULOS e a CANALIZAÇÃO). Aqui ficam os DADOS de cada gema —
// o que as linhas dizem no nível e na qualidade, e os números que só o PoB publica — e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs`
// (o status e os leitores no nível) e `acoes.mjs` (o uso, os tiques dos objetos no tempo).
//
// As decisões do dono (19/10):
//   - D1: as repetições seguem o PoE/PoB — o uso dura (1 + r) × o tempo de uso e as repetições saem dentro dele, cada uma com o "mais" dela.
//   - D2: a Procissão — cada repetição anda 1 raio da nova (em casas) na direção do alvo, até o alcance com +50% de distância máxima (EXCEÇÃO DO
//     DONO: o PoE não publica quanto ela anda).
//   - D3: o Golpe Cintilante Vaal — os 25 golpes em alvos sorteados entre os vivos perto; o uso dura 25 × o tempo de ataque; a soma entra no fim.
//   - D4: a Chuva de Lâminas — 1 casa de profundidade por rajada e a largura em casas com a fração como chance (como a Ruptura).
//   - D5: o Estilhaçar a Terra — as estacas: N retas em estrela, que explodem com Impacto ou Clamor; o sinal da explosão é o do PoB (−30%).
//   - D6: o Devastar — o máximo é 8 (o PoB), e os estágios se perdem depois de 2 s sem acertar.
//   - D7: o ângulo atual da forma de cada gema vale 100% e o "Ângulo aumentado em X%" abre o cone, até 360° (`Areas.abrirForma`); o Tiro Gélido
//     ganha o cone dele neste lote.
//   - D8: os dados divergentes seguem o PoB — a Ira Divina com afecção de 105%, a Rajada de Chamas Vaal com raio de 4,5 m.
//   - D9: a Investida Carregada fica para o A1b (segue "efeito não simulado").
//   - D10: o Atirar (Snipe) — a flecha própria e 1 gema suportada ativada por estágio, pelos gatilhos do jogo (`Acoes.ativarGatilhos`).
//
// EXCEÇÕES DO DONO (19/10, as escolhas sem fonte do lote A4, aceitas): (1) a Procissão anda até floor(7 casas × 1,5) = 10 casas, do centro ao alvo (sem alvo, para onde você olha); (2) a Nova de Gelo Vaal sai de um
// acertado vivo sorteado, sem repetir o centro, e o raio −15% vale no raio em casas (a fração como chance); (3) o Golpe Cintilante Vaal: "perto" = até
// 3 casas de onde você pousou, você não se move entre os golpes, as afecções saem a cada golpe (−70%); (4) o Dano Dobrado do Eco Desperto é sorteado
// uma vez na Repetição Final e não dobra o golpe já Dobrado; (5) a Chuva de Lâminas sai a i+1 casas de você no eixo do alvo, a largura é o "radius
// 44+6" do poedb/PoB, e o bônus das Saraivadas é × a ordem desde 0; (6) a Colisão de Gelo: o centro é a casa ao seu lado na direção do alvo, áreas
// quadradas; (7) o Estilhaçar a Terra: a fissura tem o diâmetro da área da gema, as N das 8 direções mais perto do alvo, um acerto da fissura por
// inimigo, a explosão da estaca com 1 casa de raio, o Impacto explode as estacas nas casas dele e o Clamor as do raio dele; (8) a Onda de Choque do
// Vazio sai do primeiro acertado e repete dos outros acertados, o "Dano Corpo a Corpo aumentado" da qualidade dela multiplica; (9) a Tormenta do Vazio:
// 3 m = 2 casas, a explosão acerta todos dentro, o raio sorteado uma vez por estágio; (10) a Ira Divina: os toques nos N mais perto no raio de 3,8 m, o
// feixe de 1 casa até 7 casas, um acerto por inimigo na explosão e no feixe, o toque com o dano cheio; (11) a liberação do Atirar e das Lâminas Velozes
// Vaal no máximo de estágios, as suportadas do Atirar alternadas, um acerto por inimigo no círculo das Lâminas Vaal; (12) os esporos da Flecha
// Flagelante espalhados na linha até o alvo, disparando na hora, em vivos a até 2 casas; (13) o Golpe Duplo do Ímpeto: mover-se = mudar de casa entre
// os usos; (14) o ângulo: cada casa testada por 5 pontos, aberto depois da área do uso; a Laceração comum não muda no raio de 1 casa; (15) o cone do
// Tiro Gélido: o cone de onda dos moldes, a ponta no alvo, 4 lados, o alvo sem o próprio cone, a Vaal com 2,4 m, a parte convertida rola com o
// "aumentado" de Gelo; (16) o alcance adicional do Ciclone é o `alcance_corpo_m` das peças e da árvore; (17) o Orbe Invernal: os alvos sorteados a até
// 4 casas, o impacto de 1,6 m, a Velocidade de Conjuração somada ao +20% por estágio; o decaimento: 1 estágio no fim da duração do estágio; (18) a Maré
// Invernal conta o estágio desde a 1ª Ativação, o Raio Abrasador após o primeiro; a Exposição dura o mesmo que o debuff; (19) o teto de 3 das repetições
// dos suportes e da ficha fica, a da Procissão soma por cima.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- R1: as repetições no tempo

/**
 * (lote A4, dono 19/10: R1) A REPETIÇÃO PRÓPRIA da gema (não a dos suportes): `{ n, deslocaRaios, alcanceMaisPct }` — a Nova Elétrica da Procissão ("Repete
 * 2 vezes", "cada repetição deslocada na direção em que você mira" — o PoB: base_spell_repeat_count 2, spell_maximum_action_distance_+% 50,
 * act_int.lua:16005-16037); `{ deInimigo, raioPorRepPct }` — a Nova de Gelo Vaal ("Causa explosões menores até 5 vezes em acertos inimigos",
 * "Efeito em Área reduzido em 15% a cada repetição" — o PoB: ice_nova_number_of_repeats 5, ice_nova_radius_+%_per_repeat −15, act_int.lua:9718:
 * cada repetição parte de um inimigo acertado, com o RAIO menor — o sinal e o nome do stat do PoB). A da Nova Vaal não é RepeatCount (não gasta
 * tempo — D1 só conta as do RepeatCount). Null sem repetição própria.
 */
export const PROCISSAO = Object.freeze({ deslocaRaios: 1, alcanceMaisPct: 50 });
const LINHA_REPETE = /^Repete (\d+) vezes$/i;
const LINHA_NOVA_VAAL = /^Causa explosões menores até (\d+) vezes em acertos inimigos$/i;
const LINHA_RAIO_POR_REPETICAO = /^Efeito em Área reduzido em ([\d.]+) ?% a cada repetição$/i;
export function repeticoesDasLinhas(slug, linhas = []) {
  if (slug === 'Shock_Nova_of_Procession') {
    const n = achar(linhas, LINHA_REPETE);
    return n ? { n, ...PROCISSAO } : null;
  }
  const deInimigo = achar(linhas, LINHA_NOVA_VAAL);
  if (deInimigo) return { n: 0, deInimigo, raioPorRepPct: -(achar(linhas, LINHA_RAIO_POR_REPETICAO) ?? 0) };
  return null;
}
/** (lote A4, dono 19/10: D3) O Golpe Cintilante Vaal (o PoB, act_dex.lua:8081: base_melee_attack_repeat_count 25, OnlyFinalRepeat, FinalRepeatSumsDamage,
 * active_skill_ailment_damage_+%_final −70). A gema não tem linha disso (a mecânica está na descrição). */
export const GOLPE_CINTILANTE_VAAL = Object.freeze({ golpes: 25, maisAfeccaoPct: -70 });

// ---------------------------------------------------------------- R2: a sequência de áreas num uso

/**
 * (lote A4, dono 19/10: R2) A SEQUÊNCIA DE ÁREAS das gemas além da Ruptura (`GemasPoe.sequenciaDaGema`), pela forma:
 *  - `retangulo` (a Chuva de Lâminas — act_dex.lua:2520-2642, o poedb "AoE Radius: 44+6/stage", o "Volley Width" do PoB): N rajadas ("5 Rajadas",
 *    + a qualidade "+1 Rajada") em sequência à frente, a i-ésima a i+1 casas de você, 1 casa de profundidade (D4) e a largura de 4,4 m + 0,6 m por
 *    rajada; as Saraivadas: "X% mais Dano por Rajada" e "X% de aumento da Chance de Acerto Crítico por Rajada" (× a ordem da rajada, a 1ª sem);
 *  - `concentrica` (a Colisão de Gelo — act_str.lua:6496-6540): os 3 acertos no mesmo centro, raios de 1,1 / 2,1 / 3,1 m, a 2ª com "15% menos" e a
 *    3ª com "30% menos Dano";
 *  - `estrela` (o Estilhaçar a Terra — act_str.lua:3600-3640, D5): N fissuras ("Cria 5 fissuras", + "+1 fissura") em estrela a partir de você, uma
 *    ESTACA na ponta de cada uma ("Máximo de 15 Estacas", + "Máximo de +3 Estacas Cria"), pela duração da gema; a explosão com −30% (o PoB) — a
 *    Fragilidade quebra sozinha no fim da duração.
 */
export const CHUVA_DE_LAMINAS = Object.freeze({ larguraM: 4.4, porAreaM: 0.6 });
export const ESTILHACAR = Object.freeze({ explosaoMaisPct: -30, raioDaExplosao: 1 });
export function sequenciaDasLinhas(slug, linhas = [], daQualidade = []) {
  const todas = [...linhas, ...daQualidade];
  if (/^Bladefall/.test(slug)) {
    const base = achar(linhas, /^(\d+) Rajadas$/i);
    if (!base) return null;
    const extra = Math.floor(somar(daQualidade, /^\+([\d.]+) Rajadas?$/i) + 1e-9);
    return {
      forma: 'retangulo', areas: base + extra, ...CHUVA_DE_LAMINAS,
      maisPorAreaPct: achar(todas, /^([\d.]+) % mais Dano por Rajada$/i) ?? 0,
      critPorAreaPct: achar(todas, /^([\d.]+) % de aumento da Chance de Acerto Crítico por Rajada$/i) ?? 0,
    };
  }
  if (/^Ice_Crash/.test(slug)) {
    const r1 = achar(todas, /^O raio Base é de ([\d.]+) metros?$/i);
    const r2 = achar(todas, /^Raio de alcance secundário base é de ([\d.]+) metros?$/i);
    const r3 = achar(todas, /^Raio Base terciário igual a ([\d.]+) metros?$/i);
    if (!r1 || !r2 || !r3) return null;
    const bonus = somar(todas, /^\+([\d.]+) metros de raio$/i);
    return { forma: 'concentrica', areas: 3, raiosM: [r1 + bonus, r2 + bonus, r3 + bonus], pcts: [100, 100 - (achar(todas, /^Segundo Estágio causa ([\d.]+) % menos Dano$/i) ?? 0), 100 - (achar(todas, /^Terceiro Estágio causa ([\d.]+) % menos Dano$/i) ?? 0)] };
  }
  if (/^Earthshatter/.test(slug)) {
    const fissuras = achar(linhas, /^Cria (\d+) fissuras$/i);
    if (!fissuras) return null;
    return {
      forma: 'estrela', areas: fissuras + Math.floor(somar(daQualidade, /^\+([\d.]+) fissuras?$/i) + 1e-9),
      estacasMax: (achar(linhas, /^Máximo de (\d+) Estacas$/i) ?? 15) + Math.floor(somar(daQualidade, /^Máximo de \+([\d.]+) Estacas Cria$/i) + 1e-9),
      ...ESTILHACAR, quebraSozinha: /_of_Fragility$/.test(slug),
    };
  }
  return null;
}
const LINHAS_DA_SEQUENCIA_A4 = /^\d+ Rajadas$|^\+[\d.]+ Rajadas?$|^[\d.]+ % mais Dano por Rajada$|^[\d.]+ % de aumento da Chance de Acerto Crítico por Rajada$|^(Segundo|Terceiro) Estágio causa [\d.]+ % menos Dano$|^Raio Base terciário igual a [\d.]+ metros?$|^Cria \d+ fissuras$|^\+[\d.]+ fissuras?$|^Máximo de \d+ Estacas$|^Máximo de \+[\d.]+ Estacas Cria$|^Estacas Despedaçadoras causam [\d.]+ % mais dano$/i;
export const ehLinhaDaSequenciaA4 = (l) => LINHAS_DA_SEQUENCIA_A4.test(norm(l));

// ---------------------------------------------------------------- E1/E2: os estágios

/**
 * (lote A4, dono 19/10: E1/E2) O MÁXIMO DE ESTÁGIOS que só o PoB publica (a gema não tem a linha "Máximo de N Estágios" que o compilador lê): a Rajada de
 * Chamas Vaal (`Multiplier:VaalFlameblastMaxStages 15`, act_int.lua:7106), a Ira Divina (`DivineIreMaxStages 10`, act_int.lua:4592/4702/4813), o
 * Atirar (`snipe_max_stacks 6` + 0,05 por ponto de qualidade, act_dex.lua:17606), as Lâminas Velozes Vaal (o círculo de 1 m + 0,5 m por estágio
 * até 9 m: 16 estágios, act_dex.lua:2116) e o Devastar (D6: o `ReaveMaxStages 8` dos baseMods do PoB, act_dex.lua:12702 — + o "+N do máximo").
 */
export const MAX_DO_POB = Object.freeze({
  Vaal_Flameblast: 15, Divine_Ire: 10, Divine_Ire_of_Holy_Lightning: 10, Divine_Ire_of_Disintegration: 10, Snipe: 6, Vaal_Blade_Flurry: 16,
  // (revisão do A4: o Devastar Vaal — ReaveMaxStages 4 nos baseMods + o reave_additional_max_stacks 4 da linha "+ 4 do máximo de Estágios" = 8;
  // antes o 4 contava duas vezes — act_dex.lua:12911/12919)
  Reave: 8, Reave_of_Refraction: 8, Vaal_Reave: 4,
});
/**
 * (revisão do A4, dono 19/10) A Rajada de Chamas Vaal "explode a cada 3 estágios, até atingir um máximo de 15" (a descrição da gema e do PoB,
 * act_int.lua:7106 — a gema não é Channel no PoB): os usos 3, 6, 9, 12 e 15 explodem, com o "mais" do estágio de agora; no 15º o ciclo recomeça. E ela
 * cai no LOCAL MIRADO (o ponto do alvo), como no PoE — não como a onda que sai de você (o dono, 19/10).
 */
export const EXPLODE_CADA = Object.freeze({ Vaal_Flameblast: 3 });
export const NO_LOCAL_MIRADO = Object.freeze({ Vaal_Flameblast: true });
/** (revisão do A4) Os estágios com que o uso começa: o Devastar Vaal — reave_additional_starting_stacks 4 (act_dex.lua:12921). */
export const ESTAGIOS_INICIAIS_DO_POB = Object.freeze({ Vaal_Reave: 4 });
/** O "mais Dano com Afecções por estágio após o primeiro" da Ira Divina pelo PoB (D8: o poedb diz o mesmo número do acerto). */
export const IRA_DIVINA_AFECCAO_DO_POB = Object.freeze({ Divine_Ire: 105, Divine_Ire_of_Holy_Lightning: 90, Divine_Ire_of_Disintegration: 60 });
/**
 * (lote A4, dono 19/10) A IRA DIVINA (act_int.lua:4592-4920): `zaps` — os inimigos perto que cada estágio ganho acerta ("Causa Dano em N Inimigos próximos
 * quando você ganha Estágios", + a qualidade da Luz Sagrada); `explosao` — a liberação em volta de você (radius 38 = 3,8 m; a Desintegração não
 * tem); `feixe` — o feixe à frente (a Luz Sagrada não tem — divine_tempest_no_beam). O feixe tem 1 casa de largura (a largura do PoB, 0,4 m + o
 * "Comprimento do raio aumentado", é menos que uma casa) e vai até o alcance da gema.
 */
export const IRA_DIVINA = Object.freeze({ raioDaExplosaoM: 3.8 });
export function iraDivinaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Divine_Ire/.test(slug)) return null;
  return {
    zaps: somar([...linhas, ...daQualidade], /^Causa Dano em (\d+) Inimigos próximos quando você ganha Estágios$/i),
    explosao: slug !== 'Divine_Ire_of_Disintegration', feixe: slug !== 'Divine_Ire_of_Holy_Lightning', ...IRA_DIVINA,
  };
}
/**
 * (lote A4, dono 19/10) As LÂMINAS VELOZES VAAL: o círculo ("Raio Base do Círculo é de 1 metro +0.5 metros ao Raio do Círculo por Estágio A Canalização é
 * interrompida quando o Raio Total do Círculo atingir 9 metros") e o "X% menos Dano Sofrido enquanto Canalizando".
 */
export function circuloDasLinhas(slug, linhas = []) {
  if (slug !== 'Vaal_Blade_Flurry') return null;
  const m = linhas.map(norm).map((l) => /^Raio Base do Círculo é de ([\d.]+) metros? \+([\d.]+) metros ao Raio do Círculo por Estágio A Canalização é interrompida quando o Raio Total do Círculo atingir ([\d.]+) metros$/i.exec(l)).find(Boolean);
  return { baseM: m ? Number(m[1]) : 1, porEstagioM: m ? Number(m[2]) : 0.5, maxM: m ? Number(m[3]) : 9, menosDanoSofridoPct: achar(linhas, /^([\d.]+) % menos Dano Sofrido enquanto Canalizando$/i) ?? 0 };
}
/** (lote A4, dono 19/10) O ATIRAR: o "X% mais Dano com Acertos/Afecções por Estágio do Tiro" (a flecha própria e as suportadas — as linhas "As Flechas desta
 * Habilidade causam 1% …" são a coluna mal rotulada do poedb: o número é este, o do PoB — snipe_triggered_skill_*_per_stage). */
export function snipeDasLinhas(slug, linhas = []) {
  if (slug !== 'Snipe') return null;
  return { maisAcertoPct: achar(linhas, /^Habilidades Suportadas causam ([\d.]+) % mais Dano com Acertos por Estágio do Tiro$/i) ?? 0, maisAfeccaoPct: achar(linhas, /^Habilidades Suportadas causam ([\d.]+) % mais Dano com Afecções por Estágio do Tiro$/i) ?? 0 };
}
/** (lote A4, dono 19/10) A FLECHA FLAGELANTE: os esporos da liberação ("Deixa 1 Esporo por Estágio", "Cada Esporo dispara 9 Flechas de Espinho" + a
 * qualidade, "Projéteis de Espinhos causam 50% menos Dano"). */
export const ESPOROS = Object.freeze({ raio: 2 });
export function esporosDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Scourge_Arrow/.test(slug)) return null;
  const todas = [...linhas, ...daQualidade];
  const porEstagio = achar(linhas, /^Máximo de \d+ Estágios Deixa (\d+) Esporos? por Estágio$/i);
  if (!porEstagio) return null;
  return { porEstagio, flechas: (achar(linhas, /^Cada Esporo dispara (\d+) Flechas de Espinho$/i) ?? 0) + Math.floor(somar(daQualidade, /^Cada Esporo dispara \+([\d.]+) Flechas de Espinho$/i) + 1e-9), menosPct: achar(todas, /^Projéteis de Espinhos causam ([\d.]+) % menos Dano$/i) ?? 0, ...ESPOROS };
}
/**
 * (lote A4, dono 19/10) As linhas de ESTÁGIO que o lote A4 lê, por cima das do lote G10 (`GemasPoe.LINHAS_DE_ESTAGIO`): o máximo escrito de outro jeito ("4
 * Estágios Máximos", "+ 2 do máximo de Estágios", "+2 Estágios Máximos", o "Máximo de 10 Estágios" dentro da frase do Golpe Duplo), o "mais" no
 * máximo das Lâminas Velozes (a qualidade: "Mais 20% de dano quando em estágios máximos", "+40% ao multiplicador de golpe crítico quando em estágios
 * máximos" — o MultiplierThreshold do PoB), o raio por segundo das Gavinhas da Escalada, o "mais Velocidade de Ataque por cada Estágio" do Golpe
 * Duplo do Ímpeto e o "após o primeiro" da Ira Divina.
 */
export const LINHAS_DE_ESTAGIO_A4 = [
  [/^(\d+) Estágios Máximos$/i, (m, e) => { e.maxEscrito = Number(m[1]); }],
  [/^\+ ?([\d.]+) do máximo de Estágios$/i, (m, e) => { e.maxExtra += Number(m[1]); }],
  [/^\+([\d.]+) Estágios Máximos$/i, (m, e) => { e.maxExtra += Number(m[1]); }],
  [/^Mais ([\d.]+) % de dano quando em estágios máximos$/i, (m, e) => { e.maisNoMax += Number(m[1]); }],
  [/^\+([\d.]+) % ao multiplicador de golpe crítico quando em estágios máximos$/i, (m, e) => { e.critMultNoMax += Number(m[1]); }],
  [/^Ganhe \+([\d.]+) metros? de raio por segundo enquanto Canalizando, máximo de \+([\d.]+) metros$/i, (m, e) => { e.raioM = Number(m[1]); e.raioMaxM = Number(m[2]); e.porMs = 1000; e.maxEscrito = Math.ceil(Number(m[2]) / Math.max(1e-9, Number(m[1]))); }],
  [/^([\d.]+) % mais Velocidade de Ataque por cada Estágio$/i, (m, e) => { e.velMais += Number(m[1]); }],
  [/^Ganhe um Estágio no início de cada ataque par Máximo de (\d+) Estágios$/i, (m, e) => { e.maxEscrito = Number(m[1]); e.cadaUsos = 2; }],
  [/^Feixe causa ([\d.]+) % mais Dano com Acertos por Estágio após o primeiro Feixe causa ([\d.]+) % mais Dano com Afecções por Estágio após o primeiro$/i, (m, e) => { e.maisAcertoAposPrimeiro += Number(m[1]); e.maisAfeccaoAposPrimeiro += Number(m[2]); }],
  [/^Causa Dano em \d+ Inimigos próximos quando você ganha Estágios$/i, () => {}],
  [/^([\d.]+) % menos Velocidade de Movimento por Estágio$/i, (m, e) => { e.menosMovimentoPct += Number(m[1]); }],
  [/^Habilidades Suportadas causam [\d.]+ % mais Dano com (?:Acertos|Afecções) por Estágio do Tiro$/i, () => {}],
  [/^As Flechas desta Habilidade causam [\d.]+ % mais Dano com (?:Acertos|Afecções) por Estágio$/i, () => {}],
  [/^([\d.]+) % mais Área de Efeito por cada estágio$/i, (m, e) => { e.areaMaisPorEstagioPct += Number(m[1]); }],
  [/^Máximo de \d+ Estágios Deixa \d+ Esporos? por Estágio$|^Cada Esporo dispara \+?\d+ Flechas de Espinho$|^Projéteis de Espinhos causam [\d.]+ % menos Dano$/i, () => {}],
  [/^Raio Base do Círculo é de [\d.]+ metros? \+[\d.]+ metros ao Raio do Círculo por Estágio A Canalização é interrompida quando o Raio Total do Círculo atingir [\d.]+ metros$|^[\d.]+ % menos Dano Sofrido enquanto Canalizando$/i, () => {}],
];
export const ehLinhaDeEstagioA4 = (l) => LINHAS_DE_ESTAGIO_A4.some(([re]) => re.test(norm(l)));
/**
 * (lote A4, dono 19/10: E2) Os estágios SEM CANALIZAR: o Devastar ganha 1 a cada uso que acerta ("50% mais Área de Efeito por cada estágio"; D6: perde tudo
 * depois de 2 s sem acertar) e o Golpe Duplo do Ímpeto ganha 1 no começo de cada ataque par (perde tudo ao se mover — o PoB, act_dex.lua:5684-5730).
 */
export const DEVASTAR = Object.freeze({ areaMaisPorEstagioPct: 50, perdeMs: 2000 });
export const modoSemCanalizar = (slug) => (/^(Vaal_)?Reave/.test(slug) ? 'acerto' : slug === 'Double_Strike_of_Momentum' ? 'usos' : null);

// ---------------------------------------------------------------- A: os ângulos

/**
 * (lote A4, dono 19/10: D7) O ÂNGULO da forma da gema no uso: `{ incPct, porEstagioPct, maxPct, soNaAreia }` — "Ângulo aumentado/aumentada em X%" (o Golpe no
 * Chão do Tremor, a Laceração do Abate), "Ângulo aumentada em X% enquanto na Postura da Areia" (a Laceração), "X% de aumento do ângulo por estágio,
 * até Y%" (o Incinerar) e "Ângulo do Efeito em Área aumentado em X%" (o Tiro Gélido, na qualidade). Null sem ângulo.
 */
const LINHAS_DO_ANGULO = [
  [/^Ângulo (?:do Efeito em Área )?aumentad[oa] em ([\d.]+) %$/i, (m, a) => { a.incPct += Number(m[1]); }],
  [/^Ângulo aumentad[oa] em ([\d.]+) % enquanto na Postura da Areia$/i, (m, a) => { a.naAreiaPct += Number(m[1]); }],
  [/^([\d.]+) % de aumento do ângulo por estágio, até ([\d.]+) %$/i, (m, a) => { a.porEstagioPct += Number(m[1]); a.maxPct = Number(m[2]); }],
];
export const ehLinhaDoAngulo = (l) => LINHAS_DO_ANGULO.some(([re]) => re.test(norm(l)));
export function anguloDasLinhas(linhas = []) {
  const a = { incPct: 0, naAreiaPct: 0, porEstagioPct: 0, maxPct: null };
  for (const l of linhas) for (const [re, f] of LINHAS_DO_ANGULO) { const m = re.exec(norm(l)); if (m) f(m, a); }
  return a.incPct || a.naAreiaPct || a.porEstagioPct ? a : null;
}
/** O "aumentado" do ângulo neste uso (o estágio do Incinerar, a Postura da Areia da Laceração). */
export const anguloNoUso = (a, { estagio = 0, areia = false } = {}) => (a ? a.incPct + (areia ? a.naAreiaPct : 0) + Math.min(a.maxPct ?? Infinity, a.porEstagioPct * Math.max(0, estagio)) : 0);
/**
 * (lote A4, dono 19/10: D7) O CONE DO TIRO GÉLIDO (o PoB, act_dex.lua:9531: a parte "Cone", com +40% do Físico convertido em Gelo — 60 + 40 = todo o Físico): no
 * impacto da flecha, um cone sai do alvo na direção do tiro, no raio da gema ("O raio Base é de 2.4 metros"). O "100%" do ângulo é o do cone dos
 * moldes de onda do jogo (spell-ice-wave: a ponta colada e 5 casas no fundo).
 */
export const CONE_DO_TIRO_GELIDO = Object.freeze({
  forma: [[-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [1, -1]],
  raioPadraoM: 2.4, fisicoParaGelo: true,
});
export const temConeDoTiroGelido = (slug) => /^(Vaal_)?Ice_Shot/.test(slug);
/** (revisão do A4) O Tiro Gélido da Penetração: "em dois cones perpendiculares ao alvo" (IceShotAltX, act_dex.lua:9615-9619) — os dois lados do tiro. */
export const conesPerpendiculares = (slug) => slug === 'Ice_Shot_of_Penetration';

// ---------------------------------------------------------------- C: a área do Ciclone pelo alcance

/** (lote A4, dono 19/10: C) "Área de Efeito aumentada em X% por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional" (o Ciclone; o PoB:
 * cyclone_area_of_effect_+%_per_additional_melee_range × AdditionalMeleeRange em décimos de metro, act_dex.lua:4679-4730). */
const LINHA_AREA_POR_ALCANCE = /^Área de Efeito aumentada em ([\d.]+) % por cada 0\.1 metro de Alcance de Golpe Corpo a Corpo adicional$/i;
export const ehLinhaDaAreaPorAlcance = (l) => LINHA_AREA_POR_ALCANCE.test(norm(l));
export const areaPorAlcanceDasLinhas = (linhas = []) => somar(linhas, LINHA_AREA_POR_ALCANCE);
/** "X% menos Velocidade de Movimento" do Ciclone (cyclone_movement_speed_+%_final, só enquanto canaliza o Ciclone — o PoB). */
export const menosMovimentoDasLinhas = (slug, linhas = []) => (/^(Vaal_)?Cyclone/.test(slug) ? achar(linhas, /^([\d.]+) % menos Velocidade de Movimento$/i) ?? 0 : 0);
export const ehLinhaDoMovimentoDoCiclone = (slug, l) => /^(Vaal_)?Cyclone/.test(slug) && /^[\d.]+ % menos Velocidade de Movimento(?: por Estágio)?$/i.test(norm(l));

// ---------------------------------------------------------------- os objetos no tempo

/**
 * (lote A4, dono 19/10) O ORBE INVERNAL (o PoB, act_int.lua:20963): o orbe fica em você pela duração ("Duração base é de 1.6 segundos", "Duração aumentada em 30%
 * por Estágio" — após o primeiro); cada uso de canalização soma 1 estágio (até o máximo: 8 + a qualidade) e renova a duração; ele dispara os N
 * projéteis ("Dispara 3 projéteis") a cada intervalo ("a cada 1.2 segundos"), com a frequência "20% de aumento … por Estágio" (após o primeiro) e
 * a Velocidade de Conjuração somadas (aumentadas), × "80% mais … enquanto Canalizando".
 */
export const ORBE_INVERNAL = Object.freeze({ raio: 4 });
export function orbeDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Winter_Orb/.test(slug)) return null;
  const intervalo = achar(linhas, /^Dispara projéteis a cada ([\d.]+) segundos?$/i);
  if (!intervalo) return null;
  return {
    intervaloMs: Math.round(intervalo * 1000), projeteis: achar(linhas, /^Dispara (\d+) projéteis$/i) ?? 1,
    duracaoPorEstagioPct: achar(linhas, /^Duração aumentada em ([\d.]+) % por Estágio$/i) ?? 0,
    frequenciaPorEstagioPct: achar(linhas, /^([\d.]+) % de aumento da Frequência de Projéteis por Estágio$/i) ?? 0,
    canalizandoMaisPct: achar(linhas, /^([\d.]+) % mais Frequência de Projéteis enquanto Canalizando$/i) ?? 0,
    velocidadeDeConjuracao: linhas.some((l) => /Velocidade de Conjuração se aplicam a Frequência de Projéteis/i.test(norm(l))), ...ORBE_INVERNAL,
    // (o máximo: "Máximo de 8 Estágios" + a qualidade "+2 Estágios Máximos" — frost_fury_max_number_of_stages 0,1 por ponto)
    max: (achar(linhas, /^Máximo de (\d+) Estágios$/i) ?? 8) + Math.floor(somar(daQualidade, /^\+([\d.]+) Estágios Máximos$/i) + 1e-9),
  };
}
const LINHAS_DO_ORBE = /^\+[\d.]+ Estágios Máximos$|^Dispara projéteis a cada [\d.]+ segundos?$|^Duração aumentada em [\d.]+ % por Estágio$|^[\d.]+ % de aumento da Frequência de Projéteis por Estágio$|^[\d.]+ % mais Frequência de Projéteis enquanto Canalizando$/i;
/**
 * (lote A4, dono 19/10) Os DEBUFFS COM ESTÁGIOS no inimigo: a Maré Invernal ("Debuff causa 20% mais Dano por Estágio", "Máximo de 20 Estágios", "Duração Base
 * do Debuff é de 2 segundos" — act_int.lua:21097: +1 estágio a cada Ativação da Marca) e o Raio Abrasador ("Debuff Incendiário pode ter no máximo 8
 * estágios", "Estágios Adicionais do Debuff adicionam 80% de Dano" — fire_beam_additional_stack_damage −20, act_int.lua:15712; no máximo,
 * "Exposição a Fogo aplica −25% de Resistência a Fogo"). `{ max, porEstagioPct, aposPrimeiro, duracaoMs, exposicaoPct }`.
 */
// (revisão do A4: a Exposição do Raio Abrasador na qualidade pelo PoB — base_fire_damage_resistance_% −0,25 por ponto, −5% na 20; a faixa "(-5 — 0)" do
// poedb vem na ordem numérica e invertia o sinal)
export const EXPOSICAO_POR_QUALIDADE = Object.freeze({ Scorching_Ray: -0.25 });
export function debuffDasLinhas(slug, linhas = [], daQualidade = [], qualidade = 0) {
  const todas = [...linhas, ...daQualidade];
  if (/^Wintertide_Brand/.test(slug)) {
    const pct = somar(todas, /^Debuff causa \+?([\d.]+) % mais Dano por Estágio$/i);
    return pct ? { max: achar(linhas, /^Máximo de (\d+) Estágios$/i) ?? 20, porEstagioPct: pct, aposPrimeiro: false, duracaoMs: Math.round((achar(linhas, /^Duração Base do Debuff é de ([\d.]+) segundos?$/i) ?? 2) * 1000), exposicaoPct: 0 } : null;
  }
  if (/^Scorching_Ray/.test(slug)) {
    const max = achar(linhas, /^Debuff Incendiário pode ter no máximo (\d+) estágios$/i);
    if (!max) return null;
    return { max, porEstagioPct: somar(todas, /^Estágios Adicionais do Debuff adicionam \+?([\d.]+) % de Dano$/i), aposPrimeiro: true, duracaoMs: null, exposicaoPct: somar(linhas, /^Exposição a Fogo aplica (-?[\d.]+) % de Resistência a Fogo$/i) + (EXPOSICAO_POR_QUALIDADE[slug] ?? 0) * Math.max(0, Number(qualidade) || 0) };
  }
  return null;
}
const LINHAS_DO_DEBUFF = /^Debuff causa \+?[\d.]+ % mais Dano por Estágio$|^Duração Base do Debuff é de [\d.]+ segundos?$|^Debuff Incendiário pode ter no máximo \d+ estágios$|^Estágios Adicionais do Debuff adicionam \+?[\d.]+ % de Dano$|^Exposição a Fogo aplica -?[\d.]+ % de Resistência a Fogo$/i;

/**
 * (lote A4, dono 19/10) Todas as linhas que o lote A4 faz, pela gema (o status — `GemasPoe.statusNoJogo`). As da sequência, do estágio e do ângulo só valem
 * quando o leitor da gema devolve algo (quem chama confere).
 */
export function ehLinhaA4(slug, l) {
  const t = norm(l);
  if (slug === 'Shock_Nova_of_Procession' && LINHA_REPETE.test(t)) return true;
  if (LINHA_NOVA_VAAL.test(t) || LINHA_RAIO_POR_REPETICAO.test(t)) return true;
  if (/^Winter_Orb/.test(slug) && LINHAS_DO_ORBE.test(t)) return true;
  if (/^(Wintertide_Brand|Scorching_Ray)/.test(slug) && LINHAS_DO_DEBUFF.test(t)) return true;
  if (ehLinhaDaAreaPorAlcance(t) || ehLinhaDoMovimentoDoCiclone(slug, t)) return true;
  if (/^Divine_Ire/.test(slug) && /^Comprimento do raio aumentado em [\d.]+ %$/i.test(t)) return true;
  return false;
}
