// O LOTE C1 das gemas ativas do PoE (dono, 20/10: as de corpo a corpo, impacto e canalização — a forma do golpe, o raio condicional e os buffs da gema). Aqui
// ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (os leitores no
// nível e o status) e `acoes.mjs` (o uso).
//
// As decisões do dono (20/10 — as recomendações do plano do grupo corpo a corpo/impacto/canalização, aceitas):
//   - D1.1: o "inimigo próximo" da Cutilada e da Cutilada Vaal é o mesmo "perto" do `inimigosPertoMin` (os vivos a até 2 casas de você), contado no uso;
//   - D1.2: a Corrente de Anzol para Pesca acerta os N mais perto dentro do alcance (o da Corrente com Gancho, 6 m, + o "Alcance aumentado" da qualidade);
//   - D1.3: o Escudo de Luz — "aliado" é quem está na party e os seus lacaios, a até 2 casas (4 m) do primeiro atingido, no máximo 4;
//   - D1.4: o Castigo do Julgamento Divino — os 3 inimigos mais perto a até 5 m (+2 m da qualidade), um acerto cada, como os toques da Ira Divina;
//   - D1.5: a Pancada de Gelo da Cadência alterna as mãos a cada uso, começando pela principal (o revezamento do golpe básico); sem segunda arma, a principal;
//   - D1.6: o Esmagar Escudos do Chefe Guerreiro — a Onda Central é o terço do meio do cone.
// O resto pela regra do PoE (o PoB):
//   - a Cutilada: cleave_+1_base_radius_per_nearby_enemy_up_to_10 (0,05 por ponto de qualidade: +0,1 m por inimigo na 20, até 10 inimigos — act_str.lua:1789);
//   - a Cutilada Vaal: o golpe final num Raro ou Único dá o buff de 20 s (× a Duração) que melhora a Cutilada e as transfiguradas — Golpe de Misericórdia
//     (CullPercent 10), 60% mais Área e 60% mais Dano com Acertos e Afecções contra quem está em Vida Baixa (act_str.lua:1961-2000);
//   - o Acerto Elemental: o elemento é escolhido no uso, sem repetir o anterior (a descrição), e o raio cresce 80% contra o alvo com a afecção daquele elemento
//     (o texto do 3.29 — o nome do stat no PoB é o "+100%" antigo);
//   - o Frenesi da Agressividade: no acerto com o máximo de Frenesi, consome todas e dá 1 s de Agressividade por carga (frenzy_consume_charges_to_onslaught_for_ms_
//     per_charge 1000, act_dex.lua:8269); fora do máximo, o acerto dá a Carga de Frenesi da gema (a descrição do Frenesi e da transfigurada);
//   - a Tormenta de Espadas: swordstorm_num_hits 8 (act_str.lua:10852) — oito acertos em cada inimigo da área, cada um com as duas armas (doubleHitsWhenDualWielding);
//   - a Evisceração: a onda de 10 m de extensão (radius 100) e a largura da linha ("Circunferência base"), retangular, à frente (a largura em casas com a fração como
//     chance, como a Chuva de Lâminas);
//   - o Escudo de Luz: radius 55 do cone, secondary 40 (4 m) em volta do primeiro atingido, maximum_number_of_additional_shields_of_light 4 (act_str.lua:10039);
//   - o Castigo do Julgamento Divino: base_smite_number_of_targets 3, smite_lightning_target_range 50 + 1 por ponto de qualidade; o "38% mais Dano em Área" é do
//     raio (a parte "Area Hit" do PoB — o golpe corpo a corpo não tem área), e cada alvo só é acertado uma vez pela habilidade (act_str.lua:10419);
//   - o Esmagar Escudos do Chefe Guerreiro: o raio do cone é o radius 29 do PoB (2,9 m) e a Onda Central soma o "mais" do nível e o da qualidade
//     (shield_crush_helmet_enchantment_aoe_+%_final, 2 por ponto — act_str.lua:9950);
//   - a Pancada de Gelo da Cadência: radius 11 na principal e 31 na secundária (act_str.lua:6609), o "80% mais Dano com a Arma Principal" pela tag da mão.
//
// (Sem dependência da caçada: só as linhas e a geometria da grade.)
import * as Areas from '../../engine/areas.mjs';

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- a Cutilada e a Cutilada Vaal

const LINHA_RAIO_POR_INIMIGO = /^\+([\d.]+) metros de raio por inimigo próximo, até \+[\d.]+ metros?$/i;
/** O limite de inimigos do PoB (`limit = 10, limitTotal = true`). */
export const CUTILADA = Object.freeze({ inimigosMax: 10, pertoCasas: 2 });
/** (D1.1) "+X metros de raio por inimigo próximo" (a qualidade): os metros por inimigo, ou 0. */
export const raioPorInimigoDasLinhas = (slug, daQualidade = []) => (/^(Vaal_)?Cleave$/.test(slug) ? somar(daQualidade, LINHA_RAIO_POR_INIMIGO) : 0);
/** Os metros a mais no uso com `n` inimigos perto (até 10). */
export const raioPelosInimigos = (porM, n) => (porM > 0 ? porM * Math.min(CUTILADA.inimigosMax, Math.max(0, Math.floor(Number(n) || 0))) : 0);

const LINHA_DO_BUFF_DA_VAAL = /^Buff concede Golpe Abatedor com Cutilada Buff concede ([\d.]+) % mais Área de Efeito da Cutilada Buff concede ([\d.]+) % mais Dano com Cutilada com Acertos e Afecções aos Inimigos que estão em Vida Baixo$/i;
/** O buff da Cutilada Vaal (`{ areaMaisPct, maisVidaBaixaPct, culling }`), ou null. */
export function buffDaCutiladaVaalDasLinhas(slug, linhas = []) {
  if (slug !== 'Vaal_Cleave') return null;
  for (const l of linhas) { const m = LINHA_DO_BUFF_DA_VAAL.exec(norm(l)); if (m) return { areaMaisPct: Number(m[1]), maisVidaBaixaPct: Number(m[2]), culling: true }; }
  return null;
}
/** Quem o buff da Cutilada Vaal melhora: a Cutilada e as transfiguradas (o PoB: SkillName "Cleave", includeTransfigured). */
export const melhoradaPelaCutiladaVaal = (slug) => /^Cleave(_of_.+)?$/.test(String(slug ?? ''));
/** O alvo que dá o buff: Raro ou Único (o chefe conta como Único). */
export const raroOuUnico = (b) => /raro|unico/.test(b?.raridade ?? b?.raridadePoe ?? '') || !!b?.boss || !!b?.chefe;

// ---------------------------------------------------------------- o Acerto Elemental

const LINHA_RAIO_CONTRA_AFECCAO = /^([\d.]+) % mais Raio de Área contra Inimigos afetados por uma Afecção do Elemento escolhido$/i;
/** O "X% mais Raio de Área contra Inimigos afetados por uma Afecção do Elemento escolhido": o %, ou 0. */
export const raioContraAfeccaoDasLinhas = (linhas = []) => achar(linhas, LINHA_RAIO_CONTRA_AFECCAO) ?? 0;
/** O elemento do uso, sem repetir o anterior ("Ela evitará escolher o mesmo elemento duas vezes seguidas"). */
export function escolherElemento(anterior, rng = Math.random) {
  const els = ['fire', 'ice', 'energy'].filter((e) => e !== anterior);
  return els[Math.min(els.length - 1, Math.floor(rng() * els.length))];
}
/** O bicho tem uma afecção do elemento agora? (Fogo: o Incêndio; Gelo: o Resfriamento ou o Congelamento; Raio: a Eletrização.) */
export function temAfeccaoDoElemento(bicho, el, agora) {
  const e = bicho?.estados ?? {};
  const vale = (s) => !!s && s.ate > agora;
  if (el === 'fire') return (bicho?.dots ?? []).some((d) => d.tipo === 'queimadura' && d.ate > agora);
  if (el === 'ice') return vale(e.lento) || vale(e.congelado);
  if (el === 'energy') return vale(e.chocado);
  return false;
}

// ---------------------------------------------------------------- a Corrente de Anzol para Pesca

/** (D1.2) O alcance-base da Corrente com Gancho (6 m — o `Deslocamento.DESLOCAMENTO.Chain_Hook`; a Trarthus do PoB: chain_hook_range 60). */
export const ANZOL = Object.freeze({ alcanceM: 6 });
const LINHA_ANZOL = /^Lança uma corrente em até (\d+) inimigos$/i;
const LINHA_ALCANCE = /^Alcance aumentado em ([\d.]+) %$/i;
/** `{ n, alcanceM }` (o alcance com o "aumentado" da qualidade), ou null. */
export function anzolDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Chain_Hook_of_Angling') return null;
  const n = achar(linhas, LINHA_ANZOL);
  return n ? { n, alcanceM: ANZOL.alcanceM * (1 + somar(daQualidade, LINHA_ALCANCE) / 100) } : null;
}

// ---------------------------------------------------------------- o Frenesi

const LINHA_DA_AGRESSIVIDADE = /^Consome todas as Carga de Frenesi quando você Acertar um inimigo enquanto no máximo de Cargas de Frenesi para ganhar Agressividade por ([\d.]+) segundos? por Carga consumida$/i;
/** `{ frenesiNoAcerto, agressividadePorCargaS }` do Frenesi e do da Agressividade, ou null. */
export function frenesiDasLinhas(slug, linhas = []) {
  if (!/^Frenzy(_of_.+)?$/.test(slug)) return null;
  return { frenesiNoAcerto: true, agressividadePorCargaS: achar(linhas, LINHA_DA_AGRESSIVIDADE) ?? 0 };
}

// ---------------------------------------------------------------- a Tormenta de Espadas

const LINHA_GOLPES = /^Causa Dano nos Inimigos (\d+) vezes$/i;
/** "Causa Dano nos Inimigos N vezes": os acertos em cada inimigo da área (1 sem a linha). */
export const golpesPorAlvoDasLinhas = (linhas = []) => Math.max(1, achar(linhas, LINHA_GOLPES) ?? 1);

// ---------------------------------------------------------------- a Evisceração

const LINHA_EXTENSAO = /^Extensão da onda é de ([\d.]+) metros?$/i;
const LINHA_CIRCUNFERENCIA = /^Circunferência base da onda é de ([\d.]+) metros?$/i;
/** `{ comprimentoM, larguraM }` da onda, ou null. */
export function ondaDasLinhas(slug, linhas = []) {
  if (slug !== 'Eviscerate') return null;
  const comprimentoM = achar(linhas, LINHA_EXTENSAO);
  const larguraM = achar(linhas, LINHA_CIRCUNFERENCIA);
  return comprimentoM && larguraM ? { comprimentoM, larguraM } : null;
}
/** A onda retangular para o NORTE: `comprimento` casas à frente (1..c) e `meia` casas de cada lado. */
export function formaRetangular(comprimento, meia) {
  const f = [];
  for (let d = 1; d <= Math.max(1, comprimento); d++) for (let l = -Math.max(0, meia); l <= Math.max(0, meia); l++) f.push([l, -d]);
  return f;
}

// ---------------------------------------------------------------- o Esmagar Escudos do Chefe Guerreiro

const LINHA_ONDA_CENTRAL = /^Onda Central tem \+?([\d.]+) % mais Área de Efeito$/i;
/** O "mais" da Onda Central (o do nível + o da qualidade), ou 0. */
export const ondaCentralDasLinhas = (slug, linhas = [], daQualidade = []) => (slug === 'Shield_Crush_of_the_Chieftain' ? somar([...linhas, ...daQualidade], LINHA_ONDA_CENTRAL) : 0);
/**
 * (D1.6) O cone com a ONDA CENTRAL: o terço do meio do ângulo (`Areas.abrirForma` × 1/3) esticado até `raioCentral` casas, somado ao cone inteiro (as casas que
 * os dois têm valem uma vez).
 */
export function formaComOndaCentral(forma, raioCentral) {
  const r = Areas.raioDaForma(forma);
  const centro = Areas.escalarForma(Areas.abrirForma(forma, 1 / 3), Math.max(r, raioCentral));
  const m = new Map();
  for (const c of [...forma, ...centro]) m.set(`${c[0]},${c[1]}`, c);
  return [...m.values()];
}

// ---------------------------------------------------------------- o Escudo de Luz

const LINHA_ESCUDOS = /^Ondas adicionais serão criadas a partir dos aliados dentro de um raio base de ([\d.]+) metros do primeiro inimigo atingido$/i;
const LINHA_MAX_ESCUDOS = /^Máximo de (\d+) ondas adicionais$/i;
/** `{ raioM, max }` das ondas dos aliados, ou null. */
export function escudosDeLuzDasLinhas(slug, linhas = []) {
  if (slug !== 'Shield_of_Light') return null;
  const raioM = achar(linhas, LINHA_ESCUDOS);
  return raioM ? { raioM, max: achar(linhas, LINHA_MAX_ESCUDOS) ?? 4 } : null;
}

// ---------------------------------------------------------------- o Castigo do Julgamento Divino

const LINHA_RAIO_ALVOS = /^Raio acerta (\d+) alvos dentro de ([\d.]+) metros$/i;
const LINHA_RAIO_MAIS_M = /^Raio acerta alvos dentro de \+([\d.]+) metros$/i;
const LINHA_DANO_EM_AREA = /^([\d.]+) % mais Dano em Área$/i;
/** `{ alvos, alcanceM, maisAreaPct }` do raio do Castigo do Julgamento Divino, ou null. */
export function raioDoCastigoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Smite_of_Divine_Judgement') return null;
  for (const l of linhas) {
    const m = LINHA_RAIO_ALVOS.exec(norm(l));
    if (m) return { alvos: Number(m[1]), alcanceM: Number(m[2]) + somar(daQualidade, LINHA_RAIO_MAIS_M), maisAreaPct: achar(linhas, LINHA_DANO_EM_AREA) ?? 0 };
  }
  return null;
}

// ---------------------------------------------------------------- a Pancada de Gelo da Cadência

const LINHA_RAIO_PRINCIPAL = /^Raio Base da Mão Principal é de ([\d.]+) metros?$/i;
const LINHA_RAIO_SECUNDARIA = /^Raio de alcance base da mão secundária é de ([\d.]+) metros?$/i;
/** `{ principalM, secundariaM }`, ou null. */
export function maosDasLinhas(slug, linhas = []) {
  if (slug !== 'Ice_Crash_of_Cadence') return null;
  const principalM = achar(linhas, LINHA_RAIO_PRINCIPAL);
  const secundariaM = achar(linhas, LINHA_RAIO_SECUNDARIA);
  return principalM && secundariaM ? { principalM, secundariaM } : null;
}

// ---------------------------------------------------------------- o status

/** "Este Ataque pode ser Impelido como se não fosse uma Habilidade Vaal": no jogo todo ataque pode ser Impelido pelo Clamor (`hunt.impelidos`). */
const LINHA_IMPELIDO_VAAL = /^Este Ataque pode ser Impelido como se não fosse uma Habilidade Vaal$/i;

/** As linhas que este lote faz com leitor próprio (saem de "efeito não simulado"). */
export function ehLinhaC1(slug, l) {
  const t = norm(l);
  if (/^(Vaal_)?Cleave$/.test(slug) && LINHA_RAIO_POR_INIMIGO.test(t)) return true;
  if (slug === 'Vaal_Cleave' && LINHA_DO_BUFF_DA_VAAL.test(t)) return true;
  if (slug === 'Cleave_of_Rage' && /^\+[\d.]+ metros? ao Raio por \d+ de Fúria$/i.test(t)) return true;
  if (slug === 'Elemental_Hit' && LINHA_RAIO_CONTRA_AFECCAO.test(t)) return true;
  if (slug === 'Chain_Hook_of_Angling' && (LINHA_ANZOL.test(t) || LINHA_ALCANCE.test(t))) return true;
  if (slug === 'Vaal_Ground_Slam' && LINHA_IMPELIDO_VAAL.test(t)) return true;
  if (slug === 'Frenzy_of_Onslaught' && LINHA_DA_AGRESSIVIDADE.test(t)) return true;
  if (slug === 'Swordstorm' && LINHA_GOLPES.test(t)) return true;
  if (slug === 'Eviscerate' && (LINHA_EXTENSAO.test(t) || LINHA_CIRCUNFERENCIA.test(t))) return true;
  if (slug === 'Shield_Crush_of_the_Chieftain' && LINHA_ONDA_CENTRAL.test(t)) return true;
  if (slug === 'Shield_of_Light' && LINHA_ESCUDOS.test(t)) return true;
  if (slug === 'Smite_of_Divine_Judgement' && (LINHA_RAIO_ALVOS.test(t) || LINHA_RAIO_MAIS_M.test(t) || LINHA_DANO_EM_AREA.test(t))) return true;
  if (slug === 'Ice_Crash_of_Cadence' && (LINHA_RAIO_PRINCIPAL.test(t) || LINHA_RAIO_SECUNDARIA.test(t))) return true;
  return false;
}
