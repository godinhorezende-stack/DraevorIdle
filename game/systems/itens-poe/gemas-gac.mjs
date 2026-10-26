// OS LOTES G-A e G-C das gemas ativas do PoE (dono, 25/10: as maldições, as marcas e os clamores — o plano "ativas 3", as recomendações aceitas). Aqui ficam os
// DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB) e as contas puras, sem a caçada e sem nenhum import (os módulos de base — `reforcos`,
// `estados`, `resistencia`, `golpes-secundarios`, `condicoes-poe` — o leem sem ciclo); quem usa é `gemas-poe.mjs` (o status e o buff no nível), `acoes.mjs` (o uso),
// `skills/reforcos.mjs` (a maldição no monstro) e os leitores no combate.
//
// As decisões do dono (25/10 — as do plano, aceitas):
//   - D2: o IMPELIR restrito como no PoE (o PoB, act_str.lua: SeismicExertedAttacks com SkillType.Slam; AncestralExertedAttacks com SkillType.MeleeSingleTarget): o
//     Clamor Sísmico só Impele as Pancadas (a tag `pancada`), o Ancestral só os Golpes (a tag `golpe` — e o golpe básico corpo a corpo, que no PoB é MeleeSingleTarget);
//     os outros Impelem qualquer ataque, como antes;
//   - D4: os −20% de Redução de Dano Físico da Marca do Caçador entram SOMADOS à armadura do monstro (o PoE) e podem deixar a redução negativa (o monstro sofre mais);
//   - D10: a CORRENTE TEMPORAL — a lentidão é um multiplicador próprio na velocidade de AÇÃO do monstro (o passo e o golpe), separado do `lento` e do `tolhido`; "os
//     outros efeitos expiram 25% mais devagar" = os efeitos no amaldiçoado (os estados, os danos contínuos e as outras maldições) gastam 75% do tempo — duram ×1/0,75 —
//     e o dano por segundo dos contínuos fica o mesmo (o total cresce na mesma proporção);
//   - D11: a DETONAÇÃO DE FEITIÇOS causa dano (antes não causava nenhum): magia de área de Caos; "Enfeitiçado" = com um Feitiço (uma maldição que não é Marca) seu; o
//     acerto consome um Feitiço sorteado do alvo; "Resistido pela Resistência mais baixa" = a menor entre Fogo, Gelo, Raio e Caos (a da Contradição: a maior);
//   - D12: os SOLOS da Marca do Alquimista no tamanho do Solo Ardente do Chicote Ardente (1 casa em volta), sem os seus modificadores de dano;
//   - D13: a RUÍNA (Bane) com os números do PoB que o poedb não traz (a duração-base de 2 s — a da Condenação 1 s +0,01 s por qualidade —, o "+100% de Duração por
//     Maldição", o "−25% final no efeito das maldições ligadas" e a qualidade "+1% de efeito delas"), e ela aplica as maldições Feitiço LIGADAS a ela no mesmo grupo.
// O resto pela regra do PoE (o PoB):
//   - a Detonação de Feitiços (act_int.lua:9084): o alvo Enfeitiçado leva "+200% mais Dano com Acertos" e "+90% mais com Afecções" (a da Contradição: 300% / 120%); a
//     área (3,2 m; a do Caos, 2,8 m) só sai se o ALVO estava Enfeitiçado ("If the enemy was Hexed, also deals area damage to other enemies around the target"); a
//     qualidade dá "0,5% de chance de não consumir o Feitiço" por ponto (hexblast_%_chance_to_not_consume_hex — o poedb veio sem o número); a do Caos nunca consome;
//   - a Ruína (act_int.lua:1460): "dark_ritual_damage_+%_final_per_curse_applied" (o nível — 42% — ou 100% na Condenação, raio 1,2 m) e as maldições ligadas que
//     exigem até o nível 70, até o limite de maldições;
//   - a Punição (act_str.lua:8753): "+X% de Dano sofrido em Vida Baixa" e o Debilitar de 2 s (+0,05 s por qualidade) em quem ACERTAR você;
//   - a Marca do Atirador (act_dex.lua:11648): o "Dano sofrido de Acertos de Projéteis aumentado" e a divisão em 2 (`SelfSplitCount`) — o projétil que acerta o marcado
//     se divide uma vez;
//   - a Marca do Alquimista (act_dex.lua:9): o Solo Ardente com X% do dano por segundo do Incêndio mais forte e o Cáustico com Y% do Veneno mais forte (no acerto que
//     Incendeia / Envenena o marcado), cada um no máximo uma vez por segundo; 1 Carga de Frasco a cada acerto no marcado, no máximo uma vez a cada 3 s;
//   - as Marcas do Senhor da Guerra, do Assassino e do Caçador: a chance de Carga ao ACERTAR o marcado (grant_attacker_X_charge_when_hit_%, o efeito da maldição vale);
//   - o Clamor Intimidador: os provocados por ele ficam Intimidados enquanto provocados; o Ancestral: "Golpes Impelidos focam em 2 Inimigos adicionais"; o Sísmico: o
//     Ponto de Atordoamento por Poder e o "50% mais Área de Efeito" do Impelido (os dois no buff — `gemas-poe`, `POR_PODER` e `LINHAS_FIXAS_DO_CLAMOR`);
//   - a Runa do Armagedom da Volatilidade "Não pode ser Convocada" (brand_cannot_be_recalled: a Convocar Runas a deixa onde está); a Runa Tempestuosa da Indecisão: o
//     feixe vai ao inimigo vinculado (conduit_sigil_number_of_beam_targets 1 — a Ativação sai no lugar dele, como já saía);
//   - a QUALIDADE das guardas e das maldições: "Duração do Efeito de Habilidades aumentada" (a duração do buff da guarda, somada às outras), "Efeito do Buff aumentado"
//     (o efeito do buff — `GemasPoe.adds`), "Efeito de Maldições aumentado" e "Efeito da Marca aumentado" (o efeito da maldição da gema) e "Duração de Maldições
//     aumentada" (a duração dela no monstro).

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/ㅤ/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const somar = (linhas, re, g = 1) => (linhas ?? []).reduce((t, l) => t + (Number(re.exec(norm(l))?.[g]) || 0), 0);
const ativo = (x, agora) => !!x && x.ate > agora;

// ---------------------------------------------------------------- a reclassificação (D11, D13)

/** (D11, D13) A Detonação de Feitiços e a Ruína são MAGIAS DE ÁREA com dano (o tipo Hex do poedb as punha em `maldicao`, um buff sem dano). */
export const ARQUETIPO_GAC = Object.freeze({ Hexblast: 'area', Hexblast_of_Contradiction: 'area', Hexblast_of_Havoc: 'area', Bane: 'area', Bane_of_Condemnation: 'area' });
/** (D13) O raio da Ruína da Condenação pelo PoB (active_skill_base_area_of_effect_radius 12 — o poedb não traz a linha). */
export const RAIO_DO_POB_GAC = Object.freeze({ Bane_of_Condemnation: 1.2 });

// ---------------------------------------------------------------- as maldições: as linhas → os efeitos no amaldiçoado

const LINHA_ACAO = /^Inimigos Normais e Mágicos Amaldiçoados tem ([\d.]+) % menos Velocidade de Ação$/i;
const LINHA_ACAO_RARO = /^Inimigos Raros e Únicos Amaldiçoados tem ([\d.]+) % menos Velocidade de Ação$/i;
const LINHA_EXPIRA = /^Outros efeitos em inimigos Amaldiçoados expiram ([\d.]+) % mais devagar$/i;
const LINHA_VIDA_BAIXA = /^Inimigos Amaldiçoados sofrem Dano aumentado em ([\d.]+) % enquanto em Vida Baixa$/i;
const LINHA_DEBILITAR = /^Inimigos Amaldiçoados são Debilitados por \+?([\d.]+) Segundos quando Acertarem$/i;
const LINHA_PROJETIL = /^Inimigos Amaldiçoados sofrem Dano aumentado em ([\d.]+) % de Acertos de Projéteis$/i;
const LINHA_DIVISAO = /^Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de (\d+) alvos adicionais$/i;
const LINHA_REDUCAO_FISICA = /^Inimigos Amaldiçoados têm -([\d.]+) % de Redu[cç]ão de Dano Físico$/i;
const LINHA_PRECISAO = /^Inimigos Amaldiçoados possuem uma redução de ([\d.]+) % de Precisão$/i;
const LINHA_CARGA = /^Inimigos Amaldiçoados têm ([\d.]+) % de chance de concederem uma Carga de (Tolerância|Frenesi|Poder) quando Acertados$/i;
const LINHA_ALQUIMISTA = /^Solo Ardente causa ([\d.]+) % do Dano de Fogo por Segundo do Incêndio mais forte no Inimigo Solo Cáustico causa ([\d.]+) % do Dano de Caos por Segundo do Envenenamento mais forte no Inimigo Pode criar cada efeito de Solo não mais que uma vez por segundo$/i;
const LINHA_FRASCO = /^Ganha (\d+) Cargas? de Frasco quando você Acertar um Inimigo Amaldiçoado, não mais que uma vez a cada ([\d.]+) segundos$/i;
const CARGA_DO_TEXTO = { Tolerância: 'tolerancia', Frenesi: 'frenesi', Poder: 'poder' };
// (as qualidades da própria gema de maldição)
const LINHA_EFEITO_MALDICAO_Q = /^Efeito de Maldições aumentado em ([\d.]+) %$/i;
const LINHA_EFEITO_MARCA_Q = /^Efeito da Marca aumentado em ([\d.]+) %$/i;
const LINHA_DURACAO_MALDICAO_Q = /^Duração de Maldições aumentada em ([\d.]+) %$/i;
const LINHAS_DA_MALDICAO = [LINHA_ACAO, LINHA_ACAO_RARO, LINHA_EXPIRA, LINHA_VIDA_BAIXA, LINHA_DEBILITAR, LINHA_PROJETIL, LINHA_DIVISAO, LINHA_REDUCAO_FISICA, LINHA_PRECISAO, LINHA_CARGA, LINHA_ALQUIMISTA, LINHA_FRASCO, LINHA_EFEITO_MALDICAO_Q, LINHA_EFEITO_MARCA_Q, LINHA_DURACAO_MALDICAO_Q];
/** A Alquimista: o Solo Ardente e o Cáustico no tamanho do Solo Ardente do Chicote Ardente (D12 — 1 casa em volta do alvo), 4 s. */
export const SOLO_DO_ALQUIMISTA = Object.freeze({ raio: 1, duracaoMs: 4000 });

/**
 * Os EFEITOS da maldição deste lote (`[{ efeito: 'marcaGac', tipo, pct, …, durMarca }]` — o `pct` escala com o efeito da maldição em `acoes.efeitosDaMaldicao`; o resto,
 * com o `escala` que ela põe). `linhas`: as do nível; `daQualidade`: as da qualidade.
 */
export function efeitosDaMaldicaoGAC(linhas = [], daQualidade = [], durMarca = 6000) {
  const todas = [...linhas, ...daQualidade];
  const out = [];
  const por = (tipo, extra) => out.push({ efeito: 'marcaGac', tipo, pct: 0, durMarca, ...extra });
  const acao = achar(todas, LINHA_ACAO);
  if (acao != null) por('acao', { pct: acao, pctRaro: achar(todas, LINHA_ACAO_RARO) ?? acao });
  const expira = achar(todas, LINHA_EXPIRA);
  if (expira != null) por('expira', { pct: expira });
  const vidaBaixa = achar(todas, LINHA_VIDA_BAIXA);
  if (vidaBaixa != null) por('vidaBaixa', { pct: vidaBaixa });
  const deb = somar(todas, LINHA_DEBILITAR);
  if (deb > 0) por('debilitar', { ms: Math.round(deb * 1000) });
  const proj = somar(todas, LINHA_PROJETIL);
  if (proj > 0) por('projetil', { pct: proj });
  const div = achar(todas, LINHA_DIVISAO);
  if (div) por('divisao', { n: div });
  const red = achar(todas, LINHA_REDUCAO_FISICA);
  if (red != null) por('reducaoFisica', { pct: red });
  const prec = achar(todas, LINHA_PRECISAO);
  if (prec != null) por('precisao', { pct: prec });
  const cargas = {};
  for (const l of todas) { const m = LINHA_CARGA.exec(norm(l)); if (m) cargas[CARGA_DO_TEXTO[m[2]]] = (cargas[CARGA_DO_TEXTO[m[2]]] ?? 0) + Number(m[1]); }
  if (Object.keys(cargas).length) por('carga', { cargas });
  for (const l of todas) {
    const m = LINHA_ALQUIMISTA.exec(norm(l));
    if (m) por('alquimista', { incendioPct: Number(m[1]), venenoPct: Number(m[2]), cadaMs: 1000 });
    const f = LINHA_FRASCO.exec(norm(l));
    if (f) por('frasco', { n: Number(f[1]), cadaMs: Math.round(Number(f[2]) * 1000) });
  }
  return out;
}
/** A gema de maldição deste lote tem a lentidão própria (a Corrente Temporal): o motivo "a lentidão da maldição ainda não existe" sai. */
export const temLentidaoGAC = (linhas = []) => achar(linhas, LINHA_ACAO) != null;
/** As QUALIDADES da própria maldição: `{ efeitoPct, duracaoPct }` ("Efeito de Maldições/da Marca aumentado", "Duração de Maldições aumentada"). */
export function qualidadeDaMaldicao(daQualidade = []) {
  return { efeitoPct: somar(daQualidade, LINHA_EFEITO_MALDICAO_Q) + somar(daQualidade, LINHA_EFEITO_MARCA_Q), duracaoPct: somar(daQualidade, LINHA_DURACAO_MALDICAO_Q) };
}

/**
 * O efeito `marcaGac` da gema (já com o efeito da maldição — `escala`) → o que fica na maldição do monstro (`bicho.maldicoes[id].efeitos`), × o `fator` da gema.
 * Null: não é deste lote.
 */
export function efeitoNoBicho(e, fator = 1) {
  if (e?.efeito !== 'marcaGac') return null;
  const k = (Number(e.escala) || 1) * fator;
  const x = { tipo: `gac:${e.tipo}`, pct: (Number(e.pct) || 0) * fator };
  if (e.pctRaro != null) x.pctRaro = e.pctRaro * k;
  if (e.ms) x.ms = e.ms;
  if (e.n) x.n = e.n;
  if (e.cadaMs) x.cadaMs = e.cadaMs;
  if (e.cargas) x.cargas = Object.fromEntries(Object.entries(e.cargas).map(([t, v]) => [t, v * k]));
  if (e.incendioPct != null) { x.incendioPct = e.incendioPct * k; x.venenoPct = (e.venenoPct ?? 0) * k; }
  return x;
}

/** Os efeitos `gac:<tipo>` das maldições ATIVAS no monstro: `[{ id, m, e }]`. */
export function efeitosNoBicho(bicho, agora, tipo) {
  const out = [];
  for (const [id, m] of Object.entries(bicho?.maldicoes ?? {})) {
    if (!m || !(m.ate > agora)) continue;
    for (const e of m.efeitos ?? []) if (e?.tipo === `gac:${tipo}`) out.push({ id, m, e });
  }
  return out;
}
const maior = (lista, f) => lista.reduce((t, x) => Math.max(t, f(x) || 0), 0);
const raroOuUnico = (b) => /raro|unico/.test(b?.raridade ?? b?.raridadePoe ?? '') || !!b?.boss || !!b?.chefe;

/** (D10) A VELOCIDADE DE AÇÃO do monstro pela Corrente Temporal: o fator do passo e do intervalo do golpe (1 = normal) — o Raro/Único leva o valor dele. */
export function fatorDeAcao(bicho, agora) {
  const raro = raroOuUnico(bicho);
  const pct = Math.min(90, maior(efeitosNoBicho(bicho, agora, 'acao'), (x) => (raro ? x.e.pctRaro ?? x.e.pct : x.e.pct)));
  return pct > 0 ? 1 / Math.max(0.1, 1 - pct / 100) : 1;
}

/**
 * (D10) "Outros efeitos em inimigos Amaldiçoados expiram X% mais devagar": desde o último tique do monstro, cada efeito nele (os estados com fim, os danos contínuos e
 * as OUTRAS maldições — a própria Corrente, não) ganha X% do tempo que passou; o contínuo ganha também o dano do tempo a mais (o mesmo dano por segundo). `pulsoDe`:
 * o pulso (ms) de cada tipo de contínuo. Devolve os ms ganhos.
 */
export function expirarMaisDevagar(m, agora, pulsoDe = () => 1000) {
  if (!m) return 0;
  const desde = m.poeExpiraEm ?? agora;
  m.poeExpiraEm = agora;
  const lista = efeitosNoBicho(m, agora, 'expira');
  const pct = Math.min(90, maior(lista, (x) => x.e.pct));
  const dt = agora - desde;
  if (!(pct > 0) || !(dt > 0)) return 0;
  const ext = (dt * pct) / 100;
  const daCorrente = new Set(lista.map((x) => x.id));
  for (const v of Object.values(m.estados ?? {})) {
    if (!v || typeof v !== 'object' || !(Number(v.ate) > agora)) continue;
    v.ate += ext;
    for (const i of Array.isArray(v.lista) ? v.lista : []) if (i?.ate > agora) i.ate += ext;
  }
  for (const [id, c] of Object.entries(m.maldicoes ?? {})) if (!daCorrente.has(id) && c?.ate > agora) c.ate += ext;
  for (const d of m.dots ?? []) {
    if (!(d?.falta > 0) || !(d.ate > agora)) continue;
    d.ate += ext;
    const pulso = Math.max(1, pulsoDe(d.tipo) || 1000);
    if (d.porPulso > 0) d.falta += (d.porPulso * ext) / pulso;
  }
  return ext;
}

/** (a Punição) O "Dano sofrido aumentado em X% enquanto em Vida Baixa": o fator (1 = nada) — `vidaBaixa`: a fração da Vida Baixa (0,5). */
export function fatorDaVidaBaixa(bicho, agora, vidaBaixa = 0.5) {
  if (!(bicho?.maxHp > 0) || bicho.hp > vidaBaixa * bicho.maxHp) return 1;
  return efeitosNoBicho(bicho, agora, 'vidaBaixa').reduce((f, x) => f * (1 + (x.e.pct ?? 0) / 100), 1);
}
/** (a Punição) Quanto o amaldiçoado que acerta você fica Debilitado (ms; 0 = nada). */
export const debilitarAoAcertar = (bicho, agora) => maior(efeitosNoBicho(bicho, agora, 'debilitar'), (x) => x.e.ms);
/** (a Marca do Atirador) O fator do dano dos ACERTOS DE PROJÉTEIS no marcado (1 = nada). */
export const fatorDoProjetil = (bicho, agora) => 1 + efeitosNoBicho(bicho, agora, 'projetil').reduce((t, x) => t + (x.e.pct ?? 0), 0) / 100;
/** (a Marca do Atirador) Em quantos alvos o projétil que acerta o marcado se divide (0 = não se divide). */
export const divisaoDaMarca = (bicho, agora) => Math.round(maior(efeitosNoBicho(bicho, agora, 'divisao'), (x) => x.e.n));
/** (D4, a Marca do Caçador) Os pontos de Redução de Dano Físico a MENOS do marcado. */
export const reducaoFisicaMenos = (bicho, agora) => efeitosNoBicho(bicho, agora, 'reducaoFisica').reduce((t, x) => t + (x.e.pct ?? 0), 0);
/** (o Enfraquecer) O "% de Precisão reduzida" do amaldiçoado (o maior). */
export const precisaoMenos = (bicho, agora) => Math.min(100, maior(efeitosNoBicho(bicho, agora, 'precisao'), (x) => x.e.pct));
/** (a Marca do Alquimista) Os % dos solos no marcado: `{ incendioPct, venenoPct }` (os maiores), ou null. */
export function alquimistaNoBicho(bicho, agora) {
  const l = efeitosNoBicho(bicho, agora, 'alquimista');
  return l.length ? { incendioPct: maior(l, (x) => x.e.incendioPct), venenoPct: maior(l, (x) => x.e.venenoPct), cadaMs: l[0].e.cadaMs ?? 1000 } : null;
}

/**
 * O que um ACERTO SEU no amaldiçoado dá a você (as Marcas): as Cargas pela chance (`{ tipo: n }` sorteado) e as Cargas de Frasco da Alquimista (uma vez a cada N s —
 * o relógio em `hunt.poeFrascoDaMarca`). Devolve `{ cargas: [tipo], frascos }`.
 */
export function noAcertoDoAmaldicoado(hunt, bicho, agora, rng = Math.random) {
  const cargas = [];
  for (const x of efeitosNoBicho(bicho, agora, 'carga')) for (const [t, v] of Object.entries(x.e.cargas ?? {})) if (v > 0 && rng() * 100 < v) cargas.push(t);
  let frascos = 0;
  for (const x of efeitosNoBicho(bicho, agora, 'frasco')) {
    const cd = (hunt.poeFrascoDaMarca ??= {});
    if ((cd[x.id] ?? -Infinity) > agora) continue;
    cd[x.id] = agora + (x.e.cadaMs ?? 3000);
    frascos += x.e.n ?? 1;
  }
  return { cargas, frascos };
}

// ---------------------------------------------------------------- os Feitiços (D11): a Detonação de Feitiços

/** O monstro está ENFEITIÇADO por você agora (uma maldição sua que não é Marca — `Reforcos.marcar`/`amaldicoar`)? */
export const enfeiticado = (bicho, agora) => Object.values(bicho?.maldicoes ?? {}).some((m) => m && m.ate > agora && !m.marca);
/** Os ids dos Feitiços ativos no monstro. */
export const feiticosNoBicho = (bicho, agora) => Object.entries(bicho?.maldicoes ?? {}).filter(([, m]) => m && m.ate > agora && !m.marca).map(([id]) => id);

const LINHA_HEX_ACERTO = /^([\d.]+) % mais Dano com Acertos se o Inimigo estiver Enfeitiçado$/i;
const LINHA_HEX_AFECCAO = /^([\d.]+) % mais Dano com Afecções se o Inimigo estiver Enfeitiçado$/i;
const LINHA_HEX_MENOR = /^Dano de Caos com Acertos é Resistido pela Resistência mais baixa$/i;
const LINHA_HEX_MAIOR = /^Dano de Caos com Acertos é Resistido pela maior Resistência ao invés$/i;
const LINHA_HEX_TODOS = /^Todos os Danos podem Incendiar, Congelar e Eletrizar$/i;
const LINHA_HEX_REMOVER = /^[\d.]* ?% de chance de remover um Feitiço após Causar Dano$/i;
/** A Detonação de Feitiços (o PoB: hexblast_%_chance_to_not_consume_hex 0,5 por qualidade). */
export const DETONACAO = Object.freeze({ naoConsomePorQualidade: 0.5 });
export const ehDetonacao = (slug) => /^Hexblast(_of_(Contradiction|Havoc))?$/.test(String(slug ?? ''));
/**
 * A DETONAÇÃO DE FEITIÇOS da gema no nível: `{ maisAcertoPct, maisAfeccaoPct, resistencia: 'menor'|'maior'|null, todasAfeccoes, consome, naoConsomePct }`, ou null.
 * `consome`: o acerto tira um Feitiço do alvo (a do Caos, não).
 */
export function detonacaoDaGema(slug, linhas = [], qualidade = 0) {
  if (!ehDetonacao(slug)) return null;
  const havoc = slug === 'Hexblast_of_Havoc';
  return {
    maisAcertoPct: achar(linhas, LINHA_HEX_ACERTO) ?? 0, maisAfeccaoPct: achar(linhas, LINHA_HEX_AFECCAO) ?? 0,
    resistencia: linhas.some((l) => LINHA_HEX_MENOR.test(norm(l))) ? 'menor' : linhas.some((l) => LINHA_HEX_MAIOR.test(norm(l))) ? 'maior' : null,
    todasAfeccoes: linhas.some((l) => LINHA_HEX_TODOS.test(norm(l))),
    consome: !havoc, naoConsomePct: havoc ? 100 : Math.min(100, Math.max(0, qualidade) * DETONACAO.naoConsomePorQualidade),
  };
}
/** (D11) As afecções do acerto com o "Todos os Danos podem Incendiar, Congelar e Eletrizar" (o Caos e o Físico também — `afeccoes.pode`). */
export function comTodasAsAfeccoes(afeccoes) {
  if (!afeccoes) return afeccoes;
  const pode = { ...(afeccoes.pode ?? {}) };
  for (const t of ['incendio', 'congelamento', 'resfriamento', 'eletrizacao']) pode[t] = [...new Set([...(pode[t] ?? []), 'physical', 'fire', 'ice', 'energy', 'chaos'])];
  return { ...afeccoes, pode };
}
/**
 * (D11) A RESISTÊNCIA do Caos da Detonação: a menor (ou a maior) entre Fogo, Gelo, Raio e Caos do alvo — `resDe(tipo)` lê a do monstro. Null: o Caos segue a dele.
 */
export function resistenciaDoCaos(modo, resDe) {
  if (!modo) return null;
  const rs = ['fire', 'ice', 'energy', 'chaos'].map((t) => Number(resDe(t)) || 0);
  return modo === 'maior' ? Math.max(...rs) : Math.min(...rs);
}
/** (D11) O Feitiço que a Detonação consome do alvo (sorteado entre os de `antes` — os que já estavam nele antes do acerto), ou null (não consome). */
export function consumirFeitico(bicho, d, antes, agora, rng = Math.random) {
  if (!d?.consome || !antes?.length || rng() * 100 < d.naoConsomePct) return null;
  const vivos = antes.filter((id) => bicho.maldicoes?.[id]?.ate > agora);
  if (!vivos.length) return null;
  const id = vivos[Math.min(vivos.length - 1, Math.floor(rng() * vivos.length))];
  delete bicho.maldicoes[id];
  return id;
}

// ---------------------------------------------------------------- a Ruína (D13)

export const ehRuina = (slug) => /^Bane(_of_Condemnation)?$/.test(String(slug ?? ''));
const LINHA_RUINA_MAIS = /^([\d.]+) % mais Dano por Maldição aplicada$/i;
const LINHA_RUINA_NIVEL = /^Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível (\d+) ou menor$/i;
const LINHA_RUINA_SUPORTA = /^Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível (\d+) ou menos$/i;
/** (D13) Os números do PoB que o poedb não traz: a duração-base, o "+% de Duração por Maldição", o efeito das ligadas (o final e o da qualidade) e o "mais" da Condenação. */
export const RUINA = Object.freeze({
  Bane: { duracaoMs: 2000, duracaoPorMaldicaoPct: 100, efeitoLigadasMaisPct: -25, efeitoLigadasPorQualidade: 1, maisPorMaldicaoPct: null, duracaoPorQualidadeMs: 0 },
  Bane_of_Condemnation: { duracaoMs: 1000, duracaoPorMaldicaoPct: 0, efeitoLigadasMaisPct: -25, efeitoLigadasPorQualidade: 0, maisPorMaldicaoPct: 100, duracaoPorQualidadeMs: 10 },
});
/**
 * A RUÍNA da gema no nível: `{ duracaoMs, duracaoPorMaldicaoPct, maisPorMaldicaoPct, efeitoLigadasPct, efeitoLigadasMaisPct, nivelMax }`, ou null.
 * `efeitoLigadasPct`: o "aumentado" das maldições ligadas (a qualidade); `efeitoLigadasMaisPct`: o "final" (−25% na Ruína).
 */
export function ruinaDaGema(slug, linhas = [], qualidade = 0) {
  const r = RUINA[slug];
  if (!r) return null;
  return {
    duracaoMs: r.duracaoMs + r.duracaoPorQualidadeMs * Math.max(0, qualidade), duracaoPorMaldicaoPct: r.duracaoPorMaldicaoPct,
    maisPorMaldicaoPct: achar(linhas, LINHA_RUINA_MAIS) ?? r.maisPorMaldicaoPct ?? 0,
    efeitoLigadasPct: r.efeitoLigadasPorQualidade * Math.max(0, qualidade), efeitoLigadasMaisPct: r.efeitoLigadasMaisPct,
    nivelMax: achar(linhas, LINHA_RUINA_NIVEL) ?? achar(linhas, LINHA_RUINA_SUPORTA) ?? 70,
  };
}
/**
 * (D13) O dano e a duração da Ruína com `n` maldições aplicadas: `{ fatorDano, duracaoIncPct }`. O "mais" por maldição é UM só "mais" escalado por `n` (o PoB:
 * `MORE` com o Multiplier `CurseApplied` — 1 + v·n/100, sem potência); a duração soma ao "aumentado".
 */
export const ruinaComMaldicoes = (r, n) => ({ fatorDano: 1 + ((r?.maisPorMaldicaoPct ?? 0) * Math.max(0, n)) / 100, duracaoIncPct: (r?.duracaoPorMaldicaoPct ?? 0) * Math.max(0, n) });

// ---------------------------------------------------------------- os clamores (D2)

/** (D2) O que cada Clamor Impele (o PoB): o Sísmico só as Pancadas; o Ancestral só os Golpes. Os outros: qualquer ataque. */
export const IMPELE_SO = Object.freeze({ Seismic_Cry: 'pancada', Ancestral_Cry: 'golpe' });
/**
 * (D2) O Impelir de agora (`hunt.impelidos` — `{ n, ate, so? }`) vale para o ataque com estas `tags`? O golpe básico corpo a corpo (sem a tag `habilidade`) é um Golpe
 * de alvo único (o PoB: MeleeSingleTarget) — o Ancestral o Impele, o Sísmico não.
 */
export function impeleEste(impelidos, tags = []) {
  const so = impelidos?.so;
  if (!so) return true;
  const t = new Set(tags);
  if (t.has(so)) return true;
  return so === 'golpe' && t.has('corpo') && !t.has('habilidade');
}
const LINHA_IMPELE = /^Impele (?:os próximos|o próximo) \d+ Ataques? de .+ que você executar$/i;
const LINHA_ALVOS_DO_IMPELIDO = /^Golpes Impelidos focam em (\d+) Inimigos adicionais$/i;
const LINHA_INTIMIDA = /^Inimigos Provocados por este Clamor são Intimidados$/i;
const LINHA_EMPURRA = /^Empurra e Interrompe Inimigos em uma pequena Área$/i;
const LINHA_DISTANCIA_EMPURRAO = /^([\d.]+) % de aumento da Distância do Empurrão$/i;
/**
 * (o Sísmico — dono, 26/10) "Empurra e Interrompe Inimigos em uma pequena Área": os inimigos a até `raio` casa do alvo do uso (a "pequena Área" = 1 casa — decisão do
 * dono), empurrados 1 casa × (1 + o "% de aumento da Distância do Empurrão") — 3 casas com os +200% — e interrompidos (o próximo golpe deles reinicia). `{ raio, casas }`
 * ou null.
 */
export const EMPURRAO_DO_CLAMOR = Object.freeze({ raio: 1, casasBase: 1 });
export function empurraoDoClamorDasLinhas(linhas = []) {
  if (!linhas.some((l) => LINHA_EMPURRA.test(norm(l)))) return null;
  const inc = achar(linhas, LINHA_DISTANCIA_EMPURRAO) ?? 0;
  return { raio: EMPURRAO_DO_CLAMOR.raio, casas: Math.max(1, Math.round(EMPURRAO_DO_CLAMOR.casasBase * (1 + inc / 100))) };
}
/** (o Ancestral) Os inimigos a mais dos Golpes Impelidos por ele. */
export const alvosDoImpelidoDasLinhas = (linhas = []) => achar(linhas, LINHA_ALVOS_DO_IMPELIDO) ?? 0;
/** (o Intimidador) Os provocados por este Clamor ficam Intimidados. */
export const intimidaDasLinhas = (linhas = []) => linhas.some((l) => LINHA_INTIMIDA.test(norm(l)));

// ---------------------------------------------------------------- as Runas

const LINHA_NAO_CONVOCAVEL = /^Não pode ser Convocada$/i;
/** (a Runa do Armagedom da Volatilidade) "Não pode ser Convocada" — a Convocar Runas a deixa (`runas-vinculadas.daGema` → `naoConvocavel`; a fonte única da linha). */
export const naoConvocavelDasLinhas = (linhas = []) => linhas.some((l) => LINHA_NAO_CONVOCAVEL.test(norm(l)));

// ---------------------------------------------------------------- a qualidade das guardas

const LINHA_DURACAO_DO_EFEITO_Q = /^Duração do Efeito de Habilidades aumentada em ([\d.]+) %$/i;
const LINHA_EFEITO_DO_BUFF_Q = /^Efeito do Buff aumentado em ([\d.]+) %$/i;
/** A QUALIDADE do buff da guarda: `{ duracaoIncPct, efeitoPct }` ("Duração do Efeito de Habilidades aumentada", "Efeito do Buff aumentado"). */
export const qualidadeDoBuff = (daQualidade = []) => ({ duracaoIncPct: somar(daQualidade, LINHA_DURACAO_DO_EFEITO_Q), efeitoPct: somar(daQualidade, LINHA_EFEITO_DO_BUFF_Q) });

// ---------------------------------------------------------------- o status

/** As linhas que estes lotes fazem com leitor próprio (saem de "efeito não simulado"). `arquetipo`: o da gema. */
export function ehLinhaGAC(slug, l, arquetipo = null) {
  const t = norm(l);
  if (arquetipo === 'maldicao' && LINHAS_DA_MALDICAO.some((re) => re.test(t))) return true;
  if (arquetipo === 'clamor' && (LINHA_IMPELE.test(t) || LINHA_ALVOS_DO_IMPELIDO.test(t) || LINHA_INTIMIDA.test(t) || LINHA_EMPURRA.test(t) || LINHA_DISTANCIA_EMPURRAO.test(t))) return true;
  // (revisão G: a linha do feixe da Runa Tempestuosa da Indecisão é do G-D — `GemasGBD.ehLinhaGBD`, com o leitor `feixesDasLinhas`)
  if (arquetipo === 'marca' && LINHA_NAO_CONVOCAVEL.test(t)) return true;
  if (arquetipo === 'guarda' && (LINHA_DURACAO_DO_EFEITO_Q.test(t) || LINHA_EFEITO_DO_BUFF_Q.test(t))) return true;
  if (ehDetonacao(slug) && [LINHA_HEX_ACERTO, LINHA_HEX_AFECCAO, LINHA_HEX_MENOR, LINHA_HEX_MAIOR, LINHA_HEX_TODOS, LINHA_HEX_REMOVER].some((re) => re.test(t))) return true;
  if (ehRuina(slug) && [LINHA_RUINA_MAIS, LINHA_RUINA_NIVEL, LINHA_RUINA_SUPORTA].some((re) => re.test(t))) return true;
  return false;
}
