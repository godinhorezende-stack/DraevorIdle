// O LOTE T2 das gemas do PoE (rodada 4, 27/10 — "quero resolver": as gemas que estavam "implementada, sem teste próprio"). Os testes (testes/gemas-t2*.test.mjs) usaram
// cada uma numa caçada e acharam o que o jogo fazia diferente do PoE; aqui ficam os DADOS e as contas puras das correções (sem a caçada). Quem usa: gemas-poe.mjs (a
// gema compilada e os alvos), acoes.mjs (o uso e o acerto), afeccoes.mjs (o Sangramento) e suportes-poe.mjs (as linhas dos suportes). Este arquivo não importa nada.
//
// A fonte é o PoB (Skills/act_dex.lua, act_int.lua, other.lua) e o poedb salvo (gamedata/itens-poe/gemas-poe.json):
//   - o GOLPE RELAMPEJANTE (act_dex.lua LightningStrike, LightningStrikeAltX, VaalLightningStrike): "skill_physical_damage_%_to_convert_to_lightning" 50 nos três (o poedb
//     não lista a linha — o golpe saía todo Físico); o do ARCO: "skill_damage_+%_final_per_chain_from_skill_specific_stat" 10 (Damage MORE 10% por ricochete da gema —
//     7 no 20: 70% mais), "active_skill_hit_ailment_damage_with_projectile_+%_final" −50 (o projétil — os acertos que ricocheteiam — causa 50% menos com acertos e
//     afecções; o golpe corpo a corpo, no alvo, não) e a qualidade "number_of_chains" 0,1 por ponto;
//   - a PUNCTURA e a do ESTILHAÇO (act_dex.lua Puncture, PunctureAltX): "bleed_duration_is_skill_duration" — o Sangramento dura a duração da habilidade (8 s e 6 s, com os
//     modificadores de duração da habilidade somados aos do Sangramento), não os 5 s do Sangramento comum.

// ---------------------------------------------------------------- as correções da gema compilada

/** As correções pelo PoB do que o poedb não traz (a conversão dos constantStats, os ricochetes da qualidade) — `GemasPoe.compilada`, `GemasPoe.alvosNoNivel`. */
export const CORRECAO_DO_POB_T2 = {
  Lightning_Strike: { conversao: [{ para: 'raio', pct: 50 }] },
  Vaal_Lightning_Strike: { conversao: [{ para: 'raio', pct: 50 }] },
  Lightning_Strike_of_Arcing: { conversao: [{ para: 'raio', pct: 50 }], saltosPorQualidade: 0.1 },
};

// ---------------------------------------------------------------- a Chuva Cinética

/*
 * A CHUVA CINÉTICA (o PoB, act_int.lua:11427 KineticRain + KineticRainKineticInstability): o poedb salvo não traz as linhas dela (a tabela de níveis é a da Anomalia — o
 * "25%, …, 150%" — e os mods vêm vazios): no jogo ela saía como um tiro de varinha de 25% num alvo só. Pelo PoB: "base_number_of_projectiles" 8 (+0,1 por qualidade), a
 * área à sua frente no modo 8 (o retângulo da Chuva Cinética do Impacto: radius 90 / secondary 45 — 9 m × 4,5 m), cada projétil explode no raio terciário (12 — 1,2 m),
 * "active_skill_additive_spell_damage_modifiers_apply_to_attack_damage_at_%_value" 200 (o Poder Arcano de 200%, como no Raio Cinético e na do Impacto); e cada projétil
 * "dealing area damage and triggering Kinetic Anomaly": a ANOMALIA no lugar da queda (baseMultiplier 1,5 no 20 — o "150%" da coluna —, raio 12 — 1,2 m —, 6 s, até 30)
 * explode quando um inimigo chega perto, com o dano da varinha e o mesmo Poder Arcano de 200% (`acoes`, a explosão das anomalias do lote R3C).
 */
export const CHUVA_CINETICA = 'Kinetic_Rain';
/** O arquétipo (a chuva, como a do Impacto: o poedb trouxe os tipos da Anomalia, sem o "Rain") — `GemasPoe.compilada`. */
export const ARQUETIPO_T2 = { Kinetic_Rain: 'chuva' };
const MODS_DO_POB_T2 = {
  Kinetic_Rain: ['200 % de Poder Arcano', 'Dispara 8 projéteis', 'A área alvejada base mede 9 metros de comprimento', 'Circunferência base da área-alvo é de 4.5 metros', 'Raio Base da explosao igual a 1.2 metros'],
};
const QUALIDADE_DO_POB_T2 = { Kinetic_Rain: ['Dispara +(0 — 2) projéteis'] };
/** Completa as gemas que o poedb salvo trouxe sem as linhas (a Chuva Cinética) — como `GemasGBD.completarPeloPoB`. Muda e devolve a lista. */
export function completarPeloPoBT2(gemas = []) {
  for (const g of gemas) {
    if (MODS_DO_POB_T2[g.slug] && !(g.mods ?? []).length) g.mods = [...MODS_DO_POB_T2[g.slug]];
    if (QUALIDADE_DO_POB_T2[g.slug] && !(g.qualidade ?? []).length) g.qualidade = [...QUALIDADE_DO_POB_T2[g.slug]];
  }
  return gemas;
}
/** A Anomalia Cinética da Chuva Cinética no nível (o PoB): `{ danoPct, raioM, duracaoMs, teto, arcanoPct }`. */
const ANOMALIA_POR_NIVEL = [1.32, 1.329, 1.339, 1.348, 1.358, 1.367, 1.377, 1.386, 1.396, 1.405, 1.415, 1.424, 1.434, 1.443, 1.453, 1.462, 1.472, 1.481, 1.491, 1.5, 1.509, 1.519, 1.528, 1.538, 1.547, 1.557, 1.566, 1.576, 1.585, 1.595, 1.599, 1.604, 1.609, 1.614, 1.618, 1.623, 1.628, 1.633, 1.637, 1.642];
export function anomaliaDaChuva(slug, nivel = 1) {
  if (slug !== CHUVA_CINETICA) return null;
  const n = Math.max(1, Math.min(ANOMALIA_POR_NIVEL.length, nivel | 0 || 1));
  return { danoPct: Math.round(ANOMALIA_POR_NIVEL[n - 1] * 1000) / 10, raioM: 1.2, duracaoMs: 6000, teto: 30, arcanoPct: 200 };
}
const LINHA_COMPRIMENTO = /^A área alvejada base mede ([\d.]+) metros de comprimento$/i;
const LINHA_LARGURA = /^Circunferência base da área-alvo é de ([\d.]+) metros$/i;
/** A sequência da Chuva Cinética — o retângulo à sua frente (`acoes`, `chuvaRetangular`, a mesma da do Impacto) —, ou null. */
export function chuvaDasLinhas(slug, linhas = []) {
  if (slug !== CHUVA_CINETICA) return null;
  let comprimentoM = null;
  let larguraM = null;
  for (const l of linhas) { const a = LINHA_COMPRIMENTO.exec(l); if (a) comprimentoM = Number(a[1]); const b = LINHA_LARGURA.exec(l); if (b) larguraM = Number(b[1]); }
  return comprimentoM && larguraM ? { forma: 'chuvaRetangular', comprimentoM, larguraM } : null;
}
/** As linhas que o lote faz (o status — `GemasPoe.ehLinhaFeita`). */
export const ehLinhaT2 = (slug, l) => slug === CHUVA_CINETICA && (LINHA_COMPRIMENTO.test(l) || LINHA_LARGURA.test(l));

// ---------------------------------------------------------------- o Pacto de Lycia (a decisão do dono)

/*
 * O PACTO DE LYCIA: no jogo ele saía como uma CANALIZAÇÃO que causa o dano do Flagelo Celestial (130 a 2467 de Raio no 20 — a coluna do poedb é a da habilidade ativada).
 * No PoE (o PoB, other.lua PactOfLycia + TriggeredHeavensScourge) ele é um PACTO: base_deal_no_damage, recarga 4 s, "skill_empowers_next_x_spells_cast" 3 — fortalece as
 * próximas 3 magias de CANALIZAÇÃO que você conjurar, com "pact_skill_grant_damage_+%_final_to_exerted_skills" 40 (40% mais dano) —; enquanto você canaliza uma delas, o
 * Flagelo Celestial cai a cada 0,3 s (até 10 por canalização; ao parar, os restantes a cada 0,05 s), 1,2 m de raio, 7,5% de crítico, eficácia 230%; e o uso impõe uma
 * AFLIÇÃO — o PoB e o poedb salvo não trazem o que ela faz. A gema fica PARCIAL até a decisão do dono (o status deixava passar por não ter linhas).
 */
// (lote C2 da rodada 4, dono 28/10: o Pacto como no PoB — `gemas-r4c2.LYCIA`, `acoes`: o uso fortalece as 3 magias de canalização e o Flagelo cai enquanto você canaliza;
// a gema sai de parcial)
// (rodada 4, etapa final — o dono, 28/10: "faça como o PoB") o PACTO DE GHORR (o PoB, other.lua PactOfGhorr + TriggeredBloodrend; o poedb salvo, Pact_of_Ghorr e Fleshrend):
//   - o uso não fere (base_deal_no_spell_damage) — antes o jogo punha o degenerativo da coluna (1521,1/s no 20) no alvo;
//   - fortalece as próximas 3 magias de dano degenerativo que não sejam de afecção (skill_empowers_next_x_spells_cast 3): "+40% de dano degenerativo" — o PoB,
//     pact_skill_grant_damage_over_time_+%_final_to_spells: Damage MORE com ModFlag.Dot (`maisDotPct` no uso fortalecido);
//   - a FOME DE GHORR: 6 s × a Duração; ativa o DESTRUIR CARNE a cada 2 s, 150% mais rápido por estágio do Rito de Sangue: 3 projéteis em círculo (8 m/s, atravessam)
//     que põem, na área em volta de cada um, um degenerativo Físico de 0,4 s × a Duração (o dano da coluna do poedb — 1521,1/s no 20 —, com os Modificadores de Dano
//     Mágico), até 3 acúmulos, cada um com +25% de dano degenerativo sofrido (de toda fonte) pelo mesmo tempo.
//     SEM FONTE — escolhas do dono (02/11): o alcance pela duração, 8 m/s × 0,4 s = 3,2 m (1,6 casa — a fração como chance); a área de 1 casa em volta do caminho do
//     projétil; +1 estágio do Rito de Sangue por magia degenerativa sua usada durante a Fome, até 3; cada acerto de projétil dá um acúmulo.
export const GHORR = Object.freeze({
  slug: 'Pact_of_Ghorr', magias: 3, maisDotPct: 40, fomeMs: 6000, destruirCarneMs: 2000, porEstagioPct: 150, estagiosMax: 3,
  projeteis: 3, alcanceM: 8 * 0.4, areaCasas: 1, degenMs: 400, acumulosMax: 3, sofridoPorAcumuloPct: 25,
});
export const ehPactoDeGhorr = (slug) => slug === GHORR.slug;
/** A magia fortalecida pelo Pacto de Ghorr: uma magia sua com dano degenerativo próprio (`temDot` — o degenerativo da gema, não o de afecção), não o próprio Pacto. */
export const fortalecePeloGhorr = (slug, tags = [], temDot = false) => !ehPactoDeGhorr(slug) && tags.includes('magia') && !!temDot;
/** O intervalo do Destruir Carne (ms) com `estagios` do Rito de Sangue: 2 s ÷ (1 + 150% × estágios). */
export const intervaloDaFomeMs = (estagios = 0) => Math.max(1, Math.round(GHORR.destruirCarneMs / (1 + (GHORR.porEstagioPct / 100) * Math.min(GHORR.estagiosMax, Math.max(0, estagios | 0)))));
/** O alcance do projétil em casas (3,2 m ÷ 2 = 1,6): a parte inteira e a fração como chance pelo sorteio `u`. */
export const alcanceDoDestruirCarne = (u) => { const c = GHORR.alcanceM / 2; const t = Math.trunc(c + 1e-9); return t + (u < c - t - 1e-9 ? 1 : 0); };
/**
 * Um acúmulo do Destruir Carne no monstro `m` (`estados.carneDestruida`, até 3 — o mais velho sai): devolve o índice do acúmulo (0 a 2), a chave do degenerativo dele.
 */
export function acumularCarne(m, ms, agora) {
  const e = (m.estados ??= {});
  let pilha = (e.carneDestruida ?? []).filter((x) => x.ate > agora);
  let k;
  if (pilha.length >= GHORR.acumulosMax) {
    const velho = pilha.reduce((a, b) => (b.ate < a.ate ? b : a));
    k = velho.k;
    pilha = pilha.filter((x) => x !== velho);
  } else k = [0, 1, 2].find((i) => !pilha.some((x) => x.k === i));
  pilha.push({ k, ate: agora + ms });
  e.carneDestruida = pilha;
  return k;
}
/** O "+25% de dano degenerativo sofrido" por acúmulo do Destruir Carne vivo no monstro (toda fonte): o fator. */
export const fatorDaCarne = (m, agora) => 1 + (GHORR.sofridoPorAcumuloPct / 100) * Math.min(GHORR.acumulosMax, (m?.estados?.carneDestruida ?? []).filter((x) => x.ate > agora).length);
export const MOTIVOS_T2 = {};

// ---------------------------------------------------------------- o Golpe Relampejante do Arco

export const ARCO = 'Lightning_Strike_of_Arcing';
/** O "mais" por ricochete da gema (10% cada) e o "menos" do projétil (−50%) — `{ maisPct, projetilMaisPct }` —, ou null. `saltos`: os ricochetes da gema (nível + qualidade). */
export function golpeDoArco(slug, saltos) {
  if (slug !== ARCO) return null;
  return { maisPct: 10 * Math.max(0, saltos | 0), projetilMaisPct: -50 };
}

// ---------------------------------------------------------------- as linhas dos suportes

const N = String.raw`(-?\d+(?:[.,]\d+)?)`;
const num = (x) => parseFloat(String(x).replace(',', '.'));
const temTag = (ativa, t) => !!ativa?.tags?.includes(`poe:${t}`);
/**
 * As REGRAS dos suportes do lote, antes das gerais de `suportes-poe.mjs` (que davam o "mais"/o "aumentado" SEM a condição): `[regex, (m, texto, ativa) → efeito]`.
 *   - o Dano com Vida Cheia: "Habilidades de Ataque Suportadas causam X% mais Dano com Vida Cheia" — só com a Vida no máximo (`vidaCheia`; antes, sempre);
 *   - o Dreno de Mana: a qualidade "Dano aumentado em X% enquanto Drenando Mana" — só com um Dreno de Mana ativo (`drenandoMana`; antes, sempre);
 *   - o Eco Mágico Maior: "Habilidades reforçadas têm a área de efeito aumentada em X% por repetição" — a k-ésima repetição com k × X% (antes, X% em todo o uso,
 *     o primeiro inclusive — `acoes`, as repetições).
 */
//   - o Dreno de Mana: "Ataques Suportados tem X% do Dano Drenado como Mana" — o Dreno do PoE (a instância que recupera no tempo, com os tetos; o "Drenando Mana"
//     da qualidade) — `af:mana_leech`, como o Dreno de Vida (lote A5); antes, a cura instantânea do Draevor, em qualquer habilidade.
export const REGRAS_T2 = [
  [new RegExp(`^Ataques Suportados tem ${N}% do Dano Drenado como Mana$`, 'i'), (m, t, a) => (temTag(a, 'Ataque') || !temTag(a, 'Magia') ? { 'af:mana_leech': num(m[1]) } : {})],
  [new RegExp(`^Habilidades de Ataque Suportadas causam ${N}% mais Dano com Vida Cheia$`, 'i'), (m, t, a) => (temTag(a, 'Ataque') ? { 'af:mais_dano@vidaCheia': num(m[1]) } : {})],
  [new RegExp(`^Habilidades Suportadas causam Dano aumentado em ${N}% enquanto Drenando Mana$`, 'i'), (m) => ({ 'af:dmg_inc@drenandoMana': num(m[1]) })],
  [new RegExp(`^Habilidades reforçadas têm a área de efeito aumentada em ${N}% por repetição$`, 'i'), (m) => ({ repeticaoAreaT2Pct: num(m[1]) })],
];
/** O "aumentado" de Área da repetição `k` (o Eco Mágico Maior: k × X%; 0 no uso). */
export const areaDaRepeticao = (efeito, k) => (efeito?.repeticaoAreaT2Pct > 0 && k > 0 ? efeito.repeticaoAreaT2Pct * k : 0);

// ---------------------------------------------------------------- a Punctura

const PUNCTURA = /^Puncture(?:_of_Shanking)?$/;
/** O Sangramento da gema dura a duração da habilidade? (a Punctura e a do Estilhaço) */
export const sangramentoDaHabilidade = (slug) => PUNCTURA.test(slug ?? '');
