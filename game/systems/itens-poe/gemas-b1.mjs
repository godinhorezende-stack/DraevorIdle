// O LOTE B1 das gemas ativas do PoE (dono, 20/10: as de área, nova, chuva e orbe que reusam o que já existe — as cargas, a Eletrização, a Exposição, a
// área fria, a Mutilação, os cadáveres e os gêiseres). Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas
// puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no nível e o status) e `acoes.mjs` (o uso).
//
// As decisões do dono (20/10 — as recomendações do plano do grupo área/nova/chuva/orbe, aceitas):
//   - D-B1.3: a Bomba Congelante da Aproximação conta ⌊duração final ÷ 0,1 s⌋, com os modificadores de duração (o PoB: Multiplier:100msFrostBombDuration =
//     floor(duração × DurationMod × 10), act_int.lua:7934-7936): com 2 s, 20 × 10% = 200% mais com Acertos e 20 × 3% = 60% mais com Afecções;
//   - D-B1.6: o Estalo Gélido Vaal segue o TEXTO do jogo (Poder ao matar na área e Frenesi a cada segundo com inimigo na área), não o nome do stat do PoB;
//   - D-B1.7: o chão do Estalo Gélido cresce LINEAR do raio inicial ao final pela duração (o comum: 1,5 m → 3 m em 5 s; o Vaal: 2 m → 3,6 m em 4 s), em casas
//     pela conta de sempre (m × √Área ÷ 2, a fração como a chance de uma casa a mais — sorteada uma vez, na criação).
// O resto pela regra do PoE (o PoB):
//   - a Descarga: o dano de cada elemento × as cargas daquele tipo removidas (Raio × Poder, Fogo × Tolerância, Gelo × Frenesi — os "por Carga removida" do
//     PoB), "X% mais Área de Efeito por Carga removida" (area_of_effect_+%_final_per_removable_…_charge — um "mais" só, X × as cargas) e a chance da qualidade
//     de não remover (discharge_chance_not_to_consume_charges_%); sem carga nenhuma, a gema não sai (não tem o que descarregar);
//   - o Condutor Elétrico dos Céus: "Acerta até N Inimigos" (lightning_conduit_max_num_targets — a do nível + a da qualidade);
//   - a Bomba Congelante: "Regeneração de Vida reduzida em 75%" no debuff (o mesmo dos pulsos — a Exposição, pela duração secundária);
//   - a Cremação: "Dispara Projéteis X% mais rápido" (cremation_fires_projectiles_faster_+%_final — o intervalo do gêiser ÷ (1 + X%));
//   - o Detonar Mortos: "X% de chance de detonar um cadáver adicional" (o mais perto que ainda não explode, ao alcance);
//   - o Estalo Gélido do Poder: o Poder no crítico (o leitor do Golpe Súbito, `movimento-a1b.cargasNoAcertoDasLinhas`);
//   - o Estalo Gélido: o Frenesi (25%) quando um inimigo morre no chão dele; o Vaal: o Poder (100%) e o Frenesi por segundo com inimigo no chão.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- a Descarga

const LINHA_AREA_POR_CARGA = /^([\d.]+) % mais Área de Efeito por Carga removida$/i;
const LINHA_SEM_REMOVER = /^([\d.]+) % de chance de causar Dano sem remover Cargas$/i;
/** O elemento do dano de cada tipo de carga ("Dano de Raio base por Carga de Poder removida" — o PoB: …_per_removable_power_charge). */
export const ELEMENTO_DA_CARGA = Object.freeze({ poder: 'energy', tolerancia: 'fire', frenesi: 'ice' });
/** A Descarga: `{ areaPorCargaPct, semRemoverPct }` ou null. */
export function descargaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Discharge/.test(slug)) return null;
  return { areaPorCargaPct: somar(linhas, LINHA_AREA_POR_CARGA), semRemoverPct: somar([...linhas, ...daQualidade], LINHA_SEM_REMOVER) };
}
/**
 * O uso da Descarga com as cargas de agora (`{ tolerancia, frenesi, poder }`): `{ total, basePor, areaMaisPct }` — `basePor`, o multiplicador do dano BASE de
 * cada elemento da gema (as cargas daquele tipo); `areaMaisPct`, o "mais" da área (X × o total). Null sem carga.
 */
export function usoDaDescarga(d, cargas = {}) {
  if (!d) return null;
  const n = (t) => Math.max(0, Math.floor(Number(cargas[t]) || 0));
  const total = n('poder') + n('tolerancia') + n('frenesi');
  if (!total) return null;
  return { total, basePor: Object.fromEntries(Object.entries(ELEMENTO_DA_CARGA).map(([t, el]) => [el, n(t)])), areaMaisPct: d.areaPorCargaPct * total };
}

// ---------------------------------------------------------------- o Condutor Elétrico dos Céus

const LINHA_ACERTA_ATE = /^Acerta até ([\d.]+) Inimigos$/i;
/** "Acerta até N Inimigos" (o nível + a qualidade — o PoB: lightning_conduit_max_num_targets 15 + 0,2 por ponto): o máximo de alvos do uso, ou null. */
export function maxAlvosDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^Lightning_Conduit_of_the_Heavens$/.test(slug)) return null;
  const n = Math.floor(somar([...linhas, ...daQualidade], LINHA_ACERTA_ATE) + 1e-9);
  return n > 0 ? n : null;
}
/** Os N acertados mais perto do centro da área (o empate fica na ordem de antes). */
export function maisPertoDoCentro(atingidos, centro, n) {
  if (!(n > 0) || !centro || atingidos.length <= n) return atingidos;
  const d = (b) => Math.max(Math.abs(b.x - centro.x), Math.abs(b.y - centro.y));
  return atingidos.map((b, i) => ({ b, i })).sort((a, b) => d(a.b) - d(b.b) || a.i - b.i).slice(0, n).map((x) => x.b);
}

// ---------------------------------------------------------------- as Bombas Congelantes

const LINHA_REGEN_MENOS = /^Regeneração de Vida reduzida em ([\d.]+) %$/i;
/** (a Bomba Congelante) "Regeneração de Vida reduzida em 75%" do debuff: o %, ou null. */
export const regenMenosDasLinhas = (slug, linhas = []) => (/^Frost_Bomb$/.test(slug) ? achar(linhas, LINHA_REGEN_MENOS) : null);

const LINHA_ACERTO_POR_DURACAO = /^Causa ([\d.]+) % mais Dano com Acertos por cada 0\.1 segundos de Duração$/i;
const LINHA_AFECCAO_POR_DURACAO = /^Causa ([\d.]+) % mais Dano com Afecções por cada 0\.1 segundos de Duração$/i;
/** (D-B1.3) A da Aproximação: `{ acertoPct, afeccaoPct }` por 0,1 s de duração, ou null. */
export function porDuracaoDasLinhas(linhas = []) {
  const acertoPct = achar(linhas, LINHA_ACERTO_POR_DURACAO) ?? 0;
  const afeccaoPct = achar(linhas, LINHA_AFECCAO_POR_DURACAO) ?? 0;
  return acertoPct || afeccaoPct ? { acertoPct, afeccaoPct } : null;
}
/** (D-B1.3) Os "mais" do uso com a duração final em segundos: ⌊s × 10⌋ décimos (o PoB arredonda para baixo). `{ decimos, acertoPct, afeccaoPct }`. */
export function maisPelaDuracao(d, segundos) {
  const decimos = Math.max(0, Math.floor((Number(segundos) || 0) * 10 + 1e-9));
  return { decimos, acertoPct: (d?.acertoPct ?? 0) * decimos, afeccaoPct: (d?.afeccaoPct ?? 0) * decimos };
}

// ---------------------------------------------------------------- os Estalos Gélidos

const LINHA_RAIO_INICIAL = /^Raio inicial base de chão congelado é de ([\d.]+) metros?$/i;
const LINHA_RAIO_SECUNDARIO = /^Raio de alcance secundário base é de ([\d.]+) metros?$/i;
const LINHA_RAIO_FINAL = /^Raio Base final do Solo Resfriado igual a ([\d.]+) metros?$/i;
const LINHA_RAIO_TERCIARIO = /^Raio Base terciário igual a ([\d.]+) metros?$/i;
const LINHA_FRENESI_AO_MORRER = /^([\d.]+) % de chance de ganhar uma Carga de Frenesi quando um Inimigo Morrer enquanto na Área dessa Habilidade$/i;
const LINHA_DO_VAAL = /^Ganhe uma Carga de Poder quando um Inimigo Morrer enquanto na Área dessa Habilidade A cada Segundo, receba uma Carga de Frenesi se um Inimigo estiver na Área dessa Habilidade$/i;
/**
 * (D-B1.6/D-B1.7) O CHÃO dos Estalos Gélidos: `{ raioInicialM, raioFinalM, aoMorrer: { tipo, chance } | null, porSegundo: tipo | null }` ou null. O comum: 1,5 m
 * → 3 m (o PoB: radius 15/15/30), 25% de Frenesi; o Vaal: 2 m → 3,6 m (20/36 — o secundário e o terciário), 100% de Poder e o Frenesi por segundo.
 */
export function estaloDasLinhas(slug, linhas = []) {
  if (!/^(Vaal_)?Cold_Snap$/.test(slug)) return null;
  const vaal = slug === 'Vaal_Cold_Snap';
  const raioInicialM = vaal ? achar(linhas, LINHA_RAIO_SECUNDARIO) : achar(linhas, LINHA_RAIO_INICIAL);
  const raioFinalM = vaal ? achar(linhas, LINHA_RAIO_TERCIARIO) : achar(linhas, LINHA_RAIO_FINAL);
  const frenesi = achar(linhas, LINHA_FRENESI_AO_MORRER);
  const doVaal = linhas.some((l) => LINHA_DO_VAAL.test(norm(l)));
  return {
    raioInicialM, raioFinalM,
    aoMorrer: doVaal ? { tipo: 'poder', chance: 100 } : frenesi ? { tipo: 'frenesi', chance: frenesi } : null,
    porSegundo: doVaal ? 'frenesi' : null,
  };
}
/**
 * (D-B1.7) O raio em CASAS do chão que cresce, no instante `agora`: os metros de `deM` a `ateM`, linear, de `inicio` a `inicio + durMs`, × √`fator` ÷ 2; a
 * fração vira a casa a mais pela `sorte` (0–1, sorteada na criação: o raio não pisca a cada tique).
 */
export function raioQueCresce({ deM, ateM, inicio, durMs, fator = 1, sorte = 0 }, agora) {
  const t = durMs > 0 ? Math.min(1, Math.max(0, (agora - inicio) / durMs)) : 1;
  const m = deM + (ateM - deM) * t;
  const c = (m * Math.sqrt(Math.max(0, fator))) / 2;
  return Math.max(0, Math.trunc(c) + (sorte < c % 1 ? 1 : 0));
}

// ---------------------------------------------------------------- os cadáveres e os gêiseres

const LINHA_CADAVER_ADICIONAL = /^([\d.]+) % de chance de detonar um cadáver adicional$/i;
/** (o Detonar Mortos e o Vaal) "X% de chance de detonar um cadáver adicional" (a qualidade): o %. */
export const cadaverAdicionalDasLinhas = (linhas = []) => somar(linhas, LINHA_CADAVER_ADICIONAL);
const LINHA_MAIS_RAPIDO = /^Dispara Projéteis ([\d.]+) % mais rápido$/i;
/** (a Cremação) "Dispara Projéteis X% mais rápido" (a qualidade): o %. */
export const geiserMaisRapidoDasLinhas = (linhas = []) => somar(linhas, LINHA_MAIS_RAPIDO);

// ---------------------------------------------------------------- o Condutor Elétrico

/** "Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada" (o PoB: spell_cast_time_added_to_cooldown_if_triggered). */
export const LINHA_CONJURACAO_NA_RECARGA = /^Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada$/i;

// ---------------------------------------------------------------- o status

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaB1(slug, l) {
  const t = norm(l);
  if (/^Discharge/.test(slug) && (LINHA_AREA_POR_CARGA.test(t) || LINHA_SEM_REMOVER.test(t))) return true;
  if (slug === 'Lightning_Conduit_of_the_Heavens' && LINHA_ACERTA_ATE.test(t)) return true;
  // (o Condutor Elétrico — e toda gema com a linha: `Acoes.dispararSemMarcar` soma o tempo de conjuração à recarga do uso ativado por gatilho)
  if (LINHA_CONJURACAO_NA_RECARGA.test(t)) return true;
  if (slug === 'Frost_Bomb' && LINHA_REGEN_MENOS.test(t)) return true;
  if (slug === 'Frost_Bomb_of_Forthcoming' && (LINHA_ACERTO_POR_DURACAO.test(t) || LINHA_AFECCAO_POR_DURACAO.test(t))) return true;
  if (slug === 'Cold_Snap' && (LINHA_RAIO_INICIAL.test(t) || LINHA_FRENESI_AO_MORRER.test(t))) return true;
  if (slug === 'Vaal_Cold_Snap' && (LINHA_RAIO_TERCIARIO.test(t) || LINHA_DO_VAAL.test(t))) return true;
  if (/^(Vaal_)?Detonate_Dead$/.test(slug) && LINHA_CADAVER_ADICIONAL.test(t)) return true;
  if (slug === 'Cremation' && LINHA_MAIS_RAPIDO.test(t)) return true;
  // (o Estalo Gélido do Poder: o leitor do Golpe Súbito — `GemasPoe.cargasNoAcertoDaGema`)
  if (slug === 'Cold_Snap_of_Power' && /^[\d.]+ % de chance de ganhar uma Carga de Poder em Acertos Críticos$/i.test(t)) return true;
  return false;
}
