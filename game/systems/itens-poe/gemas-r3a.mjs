/*
 * (lote R3A, 27/10) O ATAQUE ATIVADO COMPLETO e as HABILIDADES CONCEDIDAS POR SUPORTE, como no PoE 1.
 *
 * No PoE, a Onda de Choque (o suporte comum e a Excepcional do Vazio), a explosão das torres da Torre Óssea, a explosão da Tormenta do Vazio, o Cristal em Queda, a
 * Fenda, o Chamado da Fogueira (a Pira) e a Rajada de Vento são ATAQUES concedidos pelo suporte: o golpe da ARMA (o dano da base com os modificadores locais — o Físico
 * e o elemental da própria peça), × o "Dano de Ataque: X% de base" da habilidade concedida, + o dano ADICIONADO aos ataques (as peças, as passivas, as auras, os
 * suportes) × a "Eficácia do Dano Adicionado: X%" dela (o poedb: nas oito, a eficácia é igual ao "Dano de Ataque"), o CRÍTICO da arma (a chance da ficha do golpe, com
 * os "aumentados" das tags dela), a precisão (o acerto pela fórmula) e os modificadores de ataque da ficha (o "aumentado" de cada tipo, as conversões). Antes o jogo
 * usava o "acerto sem golpe" (só o Físico da arma × X%, o adicionado × 1, sem o crítico da arma).
 *
 * Este módulo é DADO PURO + contas (não importa os mods, as ações nem a caçada): quem chama passa o que precisar. O estado vive em `hunt.poeR3A` (só números e listas
 * curtas, podadas): `vento` (a distância percorrida desde a última Rajada de Vento), `rajadas` (os projéteis vivos da Rajada), `cristal`/`pira`/`fenda` (as recargas).
 * A fonte é o poedb salvo (`gamedata/itens-poe/suportes-poe.json`) — o PoB desta máquina não tem os `sup_str`/`sup_dex` nem as habilidades concedidas.
 */

const N = '(-?\\d+(?:[.,]\\d+)?)';
const num = (x) => parseFloat(String(x).replace(',', '.'));
const ms = (s) => Math.round(num(s) * 1000);

/**
 * As linhas dos suportes que são da HABILIDADE CONCEDIDA (as regras gerais as leriam como da suportada): o "Dano de Ataque", a eficácia, a recarga, o raio, a
 * quantidade, a conversão e a qualidade dela (o "Dano Corpo a Corpo aumentado" sem "Habilidades Suportadas"). As outras linhas (o custo, a restrição de arma, a qualidade
 * da suportada) seguem as regras gerais (`suportes-poe.efeitoNoNivel`).
 */
export const PROPRIAS_R3A = {
  // o CRISTAL EM QUEDA: "Habilidades reforçadas ativam Cristal em Queda ao atingir" — a recarga com os usos ("Recarga: 1.00 seg (3 Times)"), o raio
  Crystalfall_Support: [
    [/^Habilidades reforçadas ativam Cristal em Queda ao atingir$/i, (m, e) => { e.cristal = 1; }],
    [new RegExp(`^Recarga: ${N} seg(?:\\s*\\((\\d+) Times\\))?`, 'i'), (m, e) => { e.cristalRecargaMs = ms(m[1]); e.cristalUsos = m[2] ? Number(m[2]) : 1; }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.cristalDanoPct = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.cristalEficaciaPct = num(m[1]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.cristalRaioM = num(m[1]); }],
    [new RegExp(`^Dano Corpo a Corpo aumentado em ${N}%$`, 'i'), (m, e) => { e.cristalIncPct = (e.cristalIncPct ?? 0) + num(m[1]); }],
  ],
  // a FENDA: "Habilidades reforçadas ativam uma fenda no impacto da pancada", "Cria 3 fendas" (+ a qualidade), "60% do Dano Físico Convertido para Dano de Fogo" (da fenda)
  Fissure_Support: [
    [/^Habilidades reforçadas ativam uma fenda no impacto da pancada$/i, (m, e) => { e.fenda = 1; }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.fendaRecargaMs = ms(m[1]); }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.fendaDanoPct = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.fendaEficaciaPct = num(m[1]); }],
    [new RegExp(`^Velocidade de Projétil: ${N} metres per Second$`, 'i'), (m, e) => { e.fendaVelM = num(m[1]); }],
    [new RegExp(`^${N}% do Dano Físico Convertido para Dano de Fogo$`, 'i'), (m, e) => { e.fendaConvFogoPct = num(m[1]); }],
    [new RegExp(`^Cria \\+?${N} fendas?$`, 'i'), (m, e) => { e.fendas = (e.fendas ?? 0) + Math.floor(num(m[1])); }],
  ],
  // a PIRA: "Habilidades reforçadas têm 50% de chance de ativar Chamado da Fogueira ao atingir inimigos incendiados corpo a corpo"; o Chamado: os Pilares de Cinzas
  // ("Cria 3 Pilares", + a qualidade), o raio de cada um, "100% do Dano Físico Convertido para Dano de Fogo", "Cobre Inimigos em Cinzas ao Acertar"
  Pyre_Support: [
    [new RegExp(`^Habilidades reforçadas têm ${N}% de chance de ativar Chamado da Fogueira ao atingir inimigos incendiados corpo a corpo$`, 'i'), (m, e) => { e.piraChancePct = num(m[1]); }],
    [new RegExp(`^Recarga: ${N} seg`, 'i'), (m, e) => { e.piraRecargaMs = ms(m[1]); }],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.piraDanoPct = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.piraEficaciaPct = num(m[1]); }],
    [new RegExp(`^${N}% do Dano Físico Convertido para Dano de Fogo$`, 'i'), (m, e) => { e.piraConvFogoPct = num(m[1]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.piraRaioM = num(m[1]); }],
    [/^Cobre Inimigos em Cinzas ao Acertar$/i, (m, e) => { e.piraCinzas = 1; }],
    [new RegExp(`^Cria \\+?${N} Pilar(?:es)? de Cinzas$`, 'i'), (m, e) => { e.pilares = (e.pilares ?? 0) + Math.floor(num(m[1])); }],
  ],
  // a RAJADA DE VENTO: "Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada 10 metros percorridos"; os projéteis dela ("Dispara 3
  // projéteis", "Projéteis Perfuram todos Alvos", a velocidade, a duração) e a explosão (o raio, "40% mais Dano em Área")
  Windburst_Support: [
    [new RegExp(`^Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada ${N} metros percorridos$`, 'i'), (m, e) => { e.vento = 1; e.ventoMetros = num(m[1]); }],
    [/^Esta habilidade é ativada por habilidades de ataque reforçadas$/i, () => {}],
    [new RegExp(`^Dano de Ataque: ${N}% de base$`, 'i'), (m, e) => { e.ventoDanoPct = num(m[1]); }],
    [new RegExp(`^Eficácia do Dano Adicionado: ${N}%$`, 'i'), (m, e) => { e.ventoEficaciaPct = num(m[1]); }],
    [new RegExp(`^Velocidade de Projétil: ${N} metres per Second$`, 'i'), (m, e) => { e.ventoVelM = num(m[1]); }],
    [/^Projéteis Perfuram todos Alvos$/i, (m, e) => { e.ventoPerfura = 1; }],
    [new RegExp(`^Duração base é de ${N} segundos?$`, 'i'), (m, e) => { e.ventoMs = ms(m[1]); }],
    [new RegExp(`^Dispara ${N} projéteis$`, 'i'), (m, e) => { e.ventoProjeteis = Math.floor(num(m[1])); }],
    [new RegExp(`^${N}% mais Dano em Área$`, 'i'), (m, e) => { e.ventoAreaMaisPct = num(m[1]); }],
    [new RegExp(`^O raio Base é de ${N} metros?$`, 'i'), (m, e) => { e.ventoRaioM = num(m[1]); }],
  ],
};

/**
 * As PARTES de um acerto do ataque ativado (`{ elemento: valor }`, sorteadas uma vez por acerto): o golpe da arma (`arma`: o Físico da base com os locais — o da ficha
 * sem o Físico adicionado global) × `basePct`; o Físico adicionado global (`fisicoAdicionado`), o adicionado aos ataques de cada tipo (`danoSomado` — o elemental da
 * própria arma também: o jogo o leva com o das peças; nestas habilidades a eficácia é igual ao "Dano de Ataque", então tudo sai × o mesmo) e o dos suportes
 * (`somadoDoSuporte`) × `eficaciaPct`; e a conversão PRÓPRIA da habilidade (`conversao`: `{ fire: 60 }` — a da Fenda, a da Pira), sobre o Físico, antes das outras
 * (quem chama passa as da ficha depois — `ModsPoe.transformarPartes`).
 */
// (correções R3, achado 1 — como o golpe normal, `GemasPoe.partesDoAtaque`) + `conversoesExtras` — a conversão do Físico dos SUPORTES (`[{ para: 'fire', pct }]`, já no
// elemento do jogo): é da habilidade, junto com a própria, no Físico todo; e `outras(fisico, tetoPct)` — `ModsPoe.extrasDoFisico` com a ficha: as conversões das peças e
// das auras só no Físico que a habilidade deixou (proporcionais se passarem dele) e o "Físico como Extra" sobre o Físico de ANTES da conversão. Antes o Físico das peças,
// das auras (o Ódio) e dos suportes nunca convertia nos ataques ativados.
export function partesDoAtivado({ arma, fisicoAdicionado = null, danoSomado = null, somadoDoSuporte = null, basePct = 100, eficaciaPct = null, conversao = null, conversoesExtras = [], outras = null, rng = Math.random }) {
  const rolar = ([a, b]) => (Number(a) || 0) + rng() * Math.max(0, (Number(b) || 0) - (Number(a) || 0));
  const fb = Math.max(0, Number(basePct) || 0) / 100;
  const fe = Math.max(0, Number(eficaciaPct ?? basePct) || 0) / 100;
  const p = {};
  const somar = (el, v) => { if (v > 0) p[el] = (p[el] ?? 0) + v; };
  if (arma) somar('physical', rolar([arma.min, arma.max]) * fb);
  if (fisicoAdicionado) somar('physical', rolar(fisicoAdicionado) * fe);
  for (const [el, faixa] of Object.entries(danoSomado ?? {})) somar(el, rolar(faixa) * fe);
  for (const [el, faixa] of Object.entries(somadoDoSuporte ?? {})) somar(el, rolar(faixa) * fe);
  const fis = p.physical ?? 0;
  if (!(fis > 0)) return p;
  let resta = 1;
  for (const { para, pct } of [...Object.entries(conversao ?? {}).map(([para, pct]) => ({ para, pct })), ...(conversoesExtras ?? [])]) {
    const f = Math.min(resta, Math.max(0, Number(pct) || 0) / 100);
    if (!(f > 0)) continue;
    somar(para, fis * f);
    resta -= f;
  }
  if (outras) {
    const o = outras([fis, fis], resta * 100);
    for (const [el, [a]] of Object.entries(o?.extras ?? {})) somar(el, a);
    resta = Math.max(0, resta - (Number(o?.convertidoPct) || 0) / 100);
  }
  p.physical = fis * resta;
  if (!(p.physical > 1e-9)) delete p.physical;
  return p;
}

/** O "adicionado dos suportes" da habilidade suportada (`somadoMin:<el>` / `somadoMax:<el>` do efeito) como `{ elemento: [min, max] }`. */
export function somadoDoEfeito(ef) {
  const out = {};
  for (const k of Object.keys(ef ?? {})) { const x = /^somadoMin:(\w+)$/.exec(k); if (x) out[x[1]] = [ef[k], ef[`somadoMax:${x[1]}`] ?? ef[k]]; }
  return out;
}

/** A chance de crítico do ataque ativado: a da ficha do golpe (a da arma, com os "aumentados" das tags) + o crítico dos suportes ligados (`ef.critChance`, em pontos). */
export const chanceDoAtivado = (f, ef) => Math.min(f?.critTeto ?? 1, Math.max(0, (Number(f?.critChance) || 0) + (Number(ef?.critChance) || 0) / 100));

/**
 * O RAIO em casas de uma área de `raioM` metros: o raio × √(o fator da Área de Efeito), ÷ 2 (1 casa = 2 m); a fração é a chance de uma casa a mais.
 */
export function casasDoRaio(raioM, fatorDaArea = 1, rng = Math.random) {
  const casas = (Math.max(0, Number(raioM) || 0) * Math.sqrt(Math.max(0, Number(fatorDaArea) || 0))) / 2;
  return Math.floor(casas) + (rng() < casas % 1 ? 1 : 0);
}

/**
 * Uma RECARGA com usos (`lista`: os instantes em que cada uso volta, recuperados um de cada vez — como a da Onda de Choque): `null` se não há uso agora; senão a lista nova.
 */
export function usarRecarga(lista, agora, recargaMs, usos = 1) {
  const l = (lista ?? []).filter((t) => t > agora);
  if (l.length >= Math.max(1, Math.floor(usos))) return null;
  l.push(Math.max(agora, l.at(-1) ?? agora) + Math.max(0, recargaMs));
  return l;
}

/** O estado do lote na caçada. */
export const estado = (hunt) => (hunt.poeR3A ??= {});

// ---------------------------------------------------------------- a RAJADA DE VENTO

/**
 * A distância PERCORRIDA (em metros — 1 casa = 2 m, a diagonal √2 casas): soma o passo de `de` até `para` (no mesmo andar; noutro andar, recomeça dali sem contar).
 */
export function andar(vento, para) {
  if (!vento || !para) return vento;
  if ((vento.z ?? 0) !== (para.z ?? 0)) { vento.x = para.x; vento.y = para.y; vento.z = para.z ?? 0; return vento; }
  const d = Math.hypot(para.x - vento.x, para.y - vento.y) * 2;
  if (d > 0) { vento.andadoM = Math.min(1e6, (vento.andadoM ?? 0) + d); vento.x = para.x; vento.y = para.y; }
  return vento;
}

/** "limitado a uma vez a cada 10 metros percorridos": a primeira vale; depois, só com os metros andados desde a última. */
export const ventoPode = (vento, metros = 10) => !vento || (vento.andadoM ?? 0) >= metros;

/** As 8 direções (em casas). */
export const DIRECOES = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * O passo ALEATÓRIO do projétil da Rajada ("projéteis que se movem aleatoriamente"): metade das vezes segue a direção, a outra metade vira 45° para um lado ou o outro.
 * Devolve o índice da direção nova (em `DIRECOES`).
 */
export function virar(dir, rng = Math.random) {
  const r = rng();
  if (r < 0.5) return dir;
  return (dir + (r < 0.75 ? 1 : 7)) % 8;
}

// ---------------------------------------------------------------- a FENDA

/**
 * As direções das N fendas a partir do impacto: as N das 8 direções mais perto da direção do golpe (de você ao impacto; parado em cima, a direção do alvo), como as
 * fissuras do Estilhaçar a Terra. A partir de 8, todas (as a mais repetem a volta).
 */
export function direcoesDasFendas(de, impacto, n) {
  const ang = de && impacto && (de.x !== impacto.x || de.y !== impacto.y) ? Math.atan2(impacto.y - de.y, impacto.x - de.x) : 0;
  const dif = (a) => { const d = Math.abs(a - ang) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  const ordem = [...DIRECOES].sort((a, b) => dif(Math.atan2(a[1], a[0])) - dif(Math.atan2(b[1], b[0])));
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => ordem[i % 8]);
}
/** O comprimento da fenda: a velocidade dela (6 m/s) × 1 s de viagem (a escolha sem fonte do lote — o poedb não dá a duração), em casas (a fração é a chance). */
export const FENDA_VIAGEM_S = 1;
export const casasDaFenda = (velM, rng = Math.random) => casasDoRaio(Math.max(0, Number(velM) || 6) * FENDA_VIAGEM_S, 1, rng);

// ---------------------------------------------------------------- a PIRA

/** O Chamado da Fogueira: os pilares nascem no acertado e em volta dele, a até `PIRA_ALCANCE_CASAS` casas (a escolha sem fonte do lote). */
export const PIRA_ALCANCE_CASAS = 2;
/** "Cobre Inimigos em Cinzas": a duração (a mesma do Coberto de Cinzas do jogo — 4 s). */
export const CINZAS_MS = 4000;
/** A Cegueira dentro da Tormenta do Vazio: renovada a cada tique enquanto o inimigo está nela (some 0,5 s depois de sair). */
export const CEGUEIRA_DA_TORMENTA_MS = 500;

/** As casas dos N pilares: o primeiro no acertado; os outros sorteados nas casas `livres` (sem repetir enquanto houver). */
export function casasDosPilares(alvo, livres, n, rng = Math.random) {
  const out = [];
  if (!alvo || !(n > 0)) return out;
  out.push({ x: alvo.x, y: alvo.y });
  const resto = [...(livres ?? [])].filter((c) => c.x !== alvo.x || c.y !== alvo.y);
  for (let i = 1; i < n; i++) {
    if (!resto.length) { out.push({ x: alvo.x, y: alvo.y }); continue; }
    const [c] = resto.splice(Math.min(resto.length - 1, Math.floor(rng() * resto.length)), 1);
    out.push(c);
  }
  return out;
}
