// O VOO DE VERDADE DOS PROJÉTEIS (lote "projetil", dono 02/11: "tem que estar tudo 100%"). Antes o projétil do jogo acertava no tique em que saía; agora todo
// projétil VIAJA: sai de quem lança com a velocidade do PoE e acerta o primeiro que encontra no caminho — ou bate no terreno, ou se perde no fim do alcance.
// Aqui ficam só as CONTAS PURAS (sem a caçada): a velocidade base de cada gema, o perfil da velocidade pelo caminho (a 2ª forma da Lança de Gelo, a
// desaceleração do Arremesso Espectral), o desenho do caminho (o ziguezague do Raio Cinético, a espiral da Hélice Espectral), o tempo até uma distância e a
// distância num tempo. Quem voa os projéteis é `hunt/voos.mjs` (o registro, os passos por tique e os tetos); quem lança, `acoes.mjs` (o seu uso, o do totem, o
// das plantadas), `hunt/combate.mjs` (o golpe básico de arco e varinha), `cacadas.mjs` (os lacaios, o mercenário) e `poderes.mjs` (os monstros).
//
// AS FONTES:
//   - a VELOCIDADE BASE de cada gema: a linha "Projectile Speed: X metres per Second" do poedb (a coleção do jogo traz em `props`: "Velocidade de Projétil: 10.4
//     metres per Second" — a Bola de Fogo; as flechas 32.6; a Faísca 4.2; o Disparo Congelante 3.75; a Bola Relampejante 4, que é o `projectileSpeed 40` do PoB,
//     act_int.lua:1179, em décimos de metro). O PoB não traz a velocidade das outras (só a da Bola Relampejante); o poedb não publica a de 69 gemas de projétil
//     (baixadas de novo em 02/11: só a Tempestade de Raios, 3, e o Pacto de Ghorr, 8) — a escolha sem fonte (D1): os ATAQUES sem número voam a 32.6 m/s (a das
//     flechas, das varinhas e da Explosão Cinética no poedb — a maioria dos ataques de projétil publicados) e as MAGIAS a 10.4 m/s (a da Bola de Fogo);
//   - a 2ª forma da Lança de Gelo: "A Segunda forma possui 300% mais Velocidade de Projétil" (ice_spear_second_form_projectile_speed_+%_final 300, act_int.lua:9847)
//     a partir de onde a 2ª forma começa (`GemasPR3.SEGUNDA_FORMA`: 2 casas);
//   - a desaceleração do Arremesso Espectral: "Desaceleração do Projétil reduzida em 30%" (spectral_throw_projectile_deceleration_+% −30, act_dex.lua:14690); o PoB
//     não publica a desaceleração base (D2: o projétil para no fim do alcance — a velocidade cai pela raiz até lá —, e volta acelerando do mesmo jeito; a redução de
//     X% estica a distância de parada em 1 ÷ (1 − X%));
//   - o ziguezague do Raio Cinético: "Projéteis mudam de direção N vezes" (kinetic_wand_base_number_of_zig_zags, act_int.lua:10938) — D3: N mudanças no alcance,
//     alternando os lados, cada trecho a 45° da reta mas sem se afastar mais de meia casa (1 m) dela — mais mudanças, mais caminho (5 mudanças: 1,24× a reta; 3:
//     1,09×) —, e o projétil acerta quem está no ziguezague;
//   - a espiral da Hélice Espectral: "Gira por 4.25 rotações" (spectral_helix_rotations_% 425, act_dex.lua:15236) — D4: a espiral vista de cima é uma onda de
//     0,5 casa (1 m) de cada lado da reta, com as N rotações no alcance;
//   - o orbe do Morto Volátil: "Velocidade de Movimento do Orbe aumentada em X%" (a qualidade) — D5: o orbe parte do cadáver a 10.4 m/s × (1 + X%) até o inimigo;
//   - a Velocidade de Projétil da ficha (a "aumentada" das peças, da árvore e dos suportes e a "mais/menos" — o ProjectileSpeedMod do PoB: (1 + aumentada) × mais,
//     `Acoes.velocidadeDoProjetil`); o alcance não muda (7 casas);
//   - a GRADE: 1 casa = 2 m. O caminho é medido em casas de verdade (a diagonal é √2 casas — o projétil que vai na diagonal demora mais, como no PoE); o
//     alcance do jogo segue em Chebyshev (7 casas na reta e na diagonal).
//
// O LEQUE e a DIFUSÃO (D7, D7b — sem fonte): os projéteis a mais saem a 10° um do outro, alternando os lados do rumo do principal, e acertam o primeiro do caminho
// (antes iam "nos mais perto de você", em qualquer direção — 01/10); os dois filhos da difusão saem a ±30° da reta do projétil (o "Ângulo da Difusão de Projéteis
// aumentado/reduzido em X%" da árvore muda os 30°), cada um no primeiro do caminho até o alcance (antes: os mais perto do ponto, a até 4 casas).
//
// O TIQUE (D6, a escolha sem fonte): o servidor anda em tiques de ~250 ms; o golpe cai no tique mais perto da chegada — o projétil que chega a até meio tique
// (125 ms) do instante do uso acerta no mesmo tique (`VOO.meioTiqueMs`); os outros, no tique em que chegam.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas e as contas.)
import * as GemasPR3 from './gemas-pr3.mjs';

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

/** As constantes do voo (as escolhas sem fonte D1–D7 estão no cabeçalho). */
export const VOO = Object.freeze({
  /** D6: o golpe que chega a até meio tique do instante cai nesse tique */
  meioTiqueMs: 125,
  /** D1: os sem número no poedb */
  padraoAtaqueM: 32.6,
  padraoMagiaM: 10.4,
  /** 1 casa = 2 m */
  casaM: 2,
  /** os tetos: projéteis vivos por caçada (os de você, dos lacaios, do totem e dos monstros) e golpes adiados à espera */
  maxVivos: 300,
  maxAdiados: 600,
  /** o passo da conta pelo caminho (em casas) e o máximo de casas que um projétil anda num tique */
  passo: 0.05,
  maxCasasPorTique: 64,
  /** D3/D4 */
  zigueZagueGraus: 45,
  zigueZagueMaxCasas: 0.5,
  heliceRaioCasas: 0.5,
  /** D5 */
  orbeM: 10.4,
  /** D7: o ângulo total da difusão (os dois filhos a ± metade da reta do projétil) — o PoE não publica; o "Ângulo da Difusão aumentado/reduzido" multiplica */
  difusaoGraus: 60,
  /** D7b: o ângulo entre dois projéteis vizinhos do leque (os a mais do uso) — o PoE não publica; sem passar da volta inteira (360° ÷ o total) */
  lequeGraus: 10,
});

// ---------------------------------------------------------------- a velocidade base

const LINHA_DA_VELOCIDADE = /^Velocidade de Projétil: ([\d.]+) metres per Second$/i;
/** A velocidade base da gema (m/s) nas `props` da coleção (o poedb), ou null. */
export function metrosDasProps(props = []) {
  for (const p of props ?? []) { const m = LINHA_DA_VELOCIDADE.exec(norm(p)); if (m) return Number(m[1]); }
  return null;
}
/** A velocidade base (m/s): a da gema; sem ela, a do ataque ou a da magia (D1). */
export function metrosBase({ props = null, ataque = false } = {}) {
  return metrosDasProps(props) ?? (ataque ? VOO.padraoAtaqueM : VOO.padraoMagiaM);
}
/** Em casas por segundo, × o ProjectileSpeedMod do uso. */
export const casasPorSegundo = (metros, mod = 1) => Math.max(0.01, (Number(metros) || VOO.padraoMagiaM) / VOO.casaM * Math.max(0.05, Number(mod) || 1));

// ---------------------------------------------------------------- o perfil do voo (pelas linhas da gema)

const LINHA_SEGUNDA_FORMA = /^A Segunda forma possui ([\d.]+) % mais Velocidade de Projétil$/i;
const LINHA_DESACELERACAO = /^Desaceleração do Projétil reduzida em ([\d.]+) %$/i;
const LINHA_ZIGUEZAGUE = /^Projéteis mudam de direção (\d+) vezes$/i;
const LINHA_ZIGUEZAGUE_QUALIDADE = /^Projéteis mudam de direção \+?(\d+) vezes$/i;
const LINHA_ROTACOES = /^Gira por ([\d.]+) rotações$/i;
const LINHA_ORBE = /^Velocidade de Movimento do Orbe aumentada em ([\d.]+) %$/i;
/** As gemas que desaceleram no voo (o Arremesso Espectral: "decelerates as it travels", o PoB `spectral_throw_projectile_deceleration`). */
const DESACELERA = /^(Vaal_)?Spectral_Throw/;

/** As linhas do voo que o jogo faz agora (saem de "não se aplica" — `GemasPoe.ehLinhaFeita`). */
export const ehLinhaDoVoo = (slug, l) => [LINHA_SEGUNDA_FORMA, LINHA_DESACELERACAO, LINHA_ROTACOES, LINHA_ORBE].some((re) => re.test(norm(l))) || (LINHA_ZIGUEZAGUE.test(norm(l)) && !/Vaal_Lightning_Arrow/.test(slug));

/**
 * O PERFIL do voo da gema (`slug`) pelas linhas do nível (`linhas`) e as da qualidade (`daQualidade`): `{ segundaForma, desacelera, zigueZague, rotacoes,
 * orbeMaisPct }` — o que não tem fica 0/null.
 */
export function perfilDaGema(slug, linhas = [], daQualidade = []) {
  const p = { segundaForma: null, desacelera: null, zigueZague: 0, rotacoes: 0, orbeMaisPct: 0 };
  const mais = achar(linhas, LINHA_SEGUNDA_FORMA);
  if (mais != null) p.segundaForma = { casas: GemasPR3.SEGUNDA_FORMA.casas, maisPct: mais };
  if (DESACELERA.test(String(slug ?? ''))) p.desacelera = { reducaoPct: (achar(linhas, LINHA_DESACELERACAO) ?? 0) + somar(daQualidade, LINHA_DESACELERACAO) };
  if (!/Vaal_Lightning_Arrow/.test(String(slug ?? ''))) p.zigueZague = Math.max(0, Math.round((achar(linhas, LINHA_ZIGUEZAGUE) ?? 0) + somar(daQualidade, LINHA_ZIGUEZAGUE_QUALIDADE)));
  p.rotacoes = achar(linhas, LINHA_ROTACOES) ?? 0;
  p.orbeMaisPct = (achar(linhas, LINHA_ORBE) ?? 0) + somar(daQualidade, LINHA_ORBE);
  return p;
}
const vazio = (p) => !p || (!p.segundaForma && !p.desacelera && !(p.zigueZague > 0) && !(p.rotacoes > 0));

// ---------------------------------------------------------------- o caminho

/** O passo de `de` para `para` na distância do jogo (Chebyshev): o vetor por casa andada. */
function rumo(de, para, anguloPadrao = 0) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  if (!n) return { sx: Math.cos(anguloPadrao) / Math.max(Math.abs(Math.cos(anguloPadrao)), Math.abs(Math.sin(anguloPadrao))), sy: Math.sin(anguloPadrao) / Math.max(Math.abs(Math.cos(anguloPadrao)), Math.abs(Math.sin(anguloPadrao))) };
  return { sx: dx / n, sy: dy / n };
}

/**
 * O CAMINHO do projétil (uma linha quebrada, em casas, com números reais): de `de` na direção de `para` até `alcance` casas (Chebyshev) — reto; no ziguezague (D3)
 * os N trechos a 45°; na espiral (D4) a onda de 0,5 casa. `{ pontos: [{x, y, s, f}], comprimento, avanco }`: `s` é o comprimento andado até o ponto, `f` o
 * avanço na reta.
 */
export function caminho(de, para, { alcance = 7, perfil = null, angulo = null } = {}) {
  const { sx, sy } = angulo != null ? rumo({ x: 0, y: 0 }, { x: Math.cos(angulo) * 1000, y: Math.sin(angulo) * 1000 }) : rumo(de, para);
  // a perpendicular (unitária, no plano)
  const nrm = Math.hypot(sx, sy) || 1;
  const px = -sy / nrm;
  const py = sx / nrm;
  const L = Math.max(0, Number(alcance) || 0);
  const pontos = [{ x: de.x, y: de.y, s: 0, f: 0 }];
  const lateralEm = (f) => {
    if (perfil?.zigueZague > 0) {
      // a onda em triângulo (N picos — as N mudanças de direção — no alcance): sobe até +h na metade do 1º trecho, desce até −h…; os trechos a 45° da reta, mas
      // sem sair mais que meia casa (1 m) dela — o projétil passa pelo meio do bicho que está na reta
      const seg = L / perfil.zigueZague;
      const h = Math.min(VOO.zigueZagueMaxCasas, (seg / 2) * Math.tan((VOO.zigueZagueGraus * Math.PI) / 180));
      return h * (2 / Math.PI) * Math.asin(Math.sin((Math.PI * f) / Math.max(1e-9, seg)));
    }
    if (perfil?.rotacoes > 0) return VOO.heliceRaioCasas * Math.sin((2 * Math.PI * perfil.rotacoes * f) / Math.max(1e-9, L));
    return 0;
  };
  const curvo = perfil?.zigueZague > 0 || perfil?.rotacoes > 0;
  const passoF = curvo ? 0.1 : L;
  let s = 0;
  let anterior = pontos[0];
  for (let f = passoF; f <= L + 1e-9; f += passoF) {
    const ff = Math.min(L, f);
    const lat = lateralEm(ff);
    const p = { x: de.x + sx * ff + px * lat, y: de.y + sy * ff + py * lat, f: ff };
    s += Math.hypot(p.x - anterior.x, p.y - anterior.y);
    p.s = s;
    pontos.push(p);
    anterior = p;
  }
  return { pontos, comprimento: s, avanco: L };
}
/** O ponto do caminho a `s` casas andadas. */
export function pontoEm(c, s) {
  const ps = c.pontos;
  if (s <= 0 || ps.length < 2) return { x: ps[0].x, y: ps[0].y, f: 0 };
  for (let i = 1; i < ps.length; i++) {
    if (ps[i].s >= s) {
      const a = ps[i - 1];
      const b = ps[i];
      const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 1;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, f: a.f + (b.f - a.f) * t };
    }
  }
  const u = ps[ps.length - 1];
  return { x: u.x, y: u.y, f: u.f };
}
/**
 * (03/11) As CASAS do caminho de `de` até o alcance (o ziguezague, a espiral — `caminho` com o `perfil`), na ordem, sem a casa de onde sai. `angulo` (radianos): o
 * rumo EXATO do projétil (o do leque, `Secundarios.resolver`); sem ele, a direção de `de` a `fim` — com alcance curto o fim arredondado juntava ângulos
 * diferentes do leque (revisão do raio contínuo, 03/11).
 */
export function casasDoCaminho(de, fim, { alcance = 7, perfil = null, angulo = null } = {}) {
  const c = caminho(de, fim, { alcance, perfil, angulo: Number.isFinite(angulo) ? angulo : null });
  const saida = [];
  const vistas = new Set([`${Math.round(de.x)},${Math.round(de.y)}`]);
  for (let s = 0.25; s <= c.comprimento + 1e-9; s += 0.25) {
    const p = pontoEm(c, s);
    const casa = { x: Math.round(p.x), y: Math.round(p.y) };
    const k = `${casa.x},${casa.y}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    saida.push(casa);
  }
  return saida;
}
/** Quanto o caminho anda por casa de reta (1 no reto; √2 no ziguezague; a espiral pela onda) — para os saltos que o resolvedor mede em reta. */
export function fatorDoCaminho(perfil, alcance = 7) {
  if (!(perfil?.zigueZague > 0) && !(perfil?.rotacoes > 0)) return 1;
  const c = caminho({ x: 0, y: 0 }, { x: 1, y: 0 }, { alcance, perfil });
  return c.avanco > 0 ? c.comprimento / c.avanco : 1;
}

// ---------------------------------------------------------------- a velocidade pelo caminho, o tempo e a distância

/**
 * A velocidade (casas/s) a `s` casas andadas: `v0` × a 2ª forma (D: a partir das casas dela, em reta × o fator do caminho) e a desaceleração (D2: para em
 * `alcance` ÷ (1 − redução) e volta acelerando a partir de `volta`). Nunca abaixo de 20% de `v0` (o projétil que desacelera não para no ar).
 */
export function velocidadeEm(s, v0, perfil = null, { alcance = 7, volta = null, fator = 1 } = {}) {
  let v = v0;
  if (perfil?.segundaForma && s >= perfil.segundaForma.casas * fator) v *= Math.max(0.01, 1 + perfil.segundaForma.maisPct / 100);
  if (perfil?.desacelera) {
    const parada = (alcance * fator) / Math.max(0.05, 1 - (perfil.desacelera.reducaoPct ?? 0) / 100);
    // (a virada: onde ele para — no máximo o fim do alcance; dali volta acelerando, o espelho da ida)
    const virada = volta ?? Math.min(parada, alcance * fator);
    const sEfetivo = s > virada ? Math.max(0, 2 * virada - s) : s;
    v = Math.max(0.2 * v0, v0 * Math.sqrt(Math.max(0, 1 - sEfetivo / Math.max(1e-9, parada))));
  }
  return v;
}
/** O tempo (ms) para andar `s` casas pelo caminho. */
export function tempoAte(s, v0, perfil = null, opcoes = {}) {
  if (!(s > 0)) return 0;
  if (vazio(perfil) || (!perfil.segundaForma && !perfil.desacelera)) return (1000 * s) / Math.max(0.01, v0);
  let t = 0;
  for (let x = 0; x < s - 1e-12; x += VOO.passo) {
    const ds = Math.min(VOO.passo, s - x);
    t += ds / Math.max(0.01, velocidadeEm(x + ds / 2, v0, perfil, opcoes));
  }
  return 1000 * t;
}
/** As casas andadas pelo caminho em `ms` (o inverso de `tempoAte`), a partir de `s0` casas e `t0` ms já andados. */
export function distanciaNoTempo(ms, v0, perfil = null, opcoes = {}, { s0 = 0, t0 = 0, max = Infinity } = {}) {
  if (!(ms > t0)) return s0;
  if (vazio(perfil) || (!perfil.segundaForma && !perfil.desacelera)) return Math.min(max, s0 + (Math.max(0.01, v0) * (ms - t0)) / 1000);
  let s = s0;
  let t = t0 / 1000;
  const fim = ms / 1000;
  while (t < fim && s < max) {
    const v = Math.max(0.01, velocidadeEm(s + VOO.passo / 2, v0, perfil, opcoes));
    const dt = VOO.passo / v;
    if (t + dt > fim) { s += v * (fim - t); break; }
    t += dt;
    s += VOO.passo;
  }
  return Math.min(max, s);
}

/** (D7) O meio-ângulo da difusão (radianos), × o "Ângulo da Difusão de Projéteis aumentado/reduzido em X%" (`incPct`). */
export const meioAnguloDaDifusao = (incPct = 0) => ((VOO.difusaoGraus / 2) * Math.max(0, 1 + (Number(incPct) || 0) / 100) * Math.PI) / 180;
