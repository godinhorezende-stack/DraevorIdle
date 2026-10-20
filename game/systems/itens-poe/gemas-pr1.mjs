// O LOTE PR1 das gemas do PoE (dono, 20/10: as gemas ATIVAS de projétil que só pediam atributos e escalas que já existem, e a correção do Arremesso de
// Escudo Espectral). Aqui ficam os DADOS das linhas e as contas puras (sem a caçada); quem usa é `gemas-poe.mjs` (o status e os leitores no nível),
// `linhas-das-gemas.mjs` (o dano adicional pela Vida/Mana máxima) e `acoes.mjs` (o uso).
//
// O que o lote faz, pelo PoE 1 (o PoB e o poedb):
//   - o Sifão de Poder (as três): "20% de chance de receber uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único" (a Vaal: sempre) — o PoB:
//     chance_to_gain_power_charge_on_rare_or_unique_enemy_hit_% 20/100 (act_int.lua:14124/14205/14291), sorteado por projétil que acerta;
//   - o ARREMESSO DE ESCUDO ESPECTRAL (as três — a correção do plano): os "Projéteis adicionais" são as ESTILHAS, não mais escudos ("Modifiers that cause
//     additional projectiles to be fired will add more shards, not more copies of the shield" — o PoB, act_dex.lua:14296): o escudo (que não perfura) acerta e
//     Ricocheteia (+3, o primário), e a cada colisão com um inimigo solta as N estilhas em direções aleatórias, perfurando todos, com "50% menos Dano"
//     (thrown_shield_secondary_projectile_damage_+%_final −50; o Despedaçamento, −25). O de Trarthus é um escudo perfurante que para no local mirado e solta 6
//     estilhas de cada vez (stationary_shield_throw_projectiles_per_interval 6) a cada 0,6 s (…_firing_interval_ms 600), cada intervalo 40% mais rápido
//     (…_interval_acceleration_%_per_interval 40), até todas saírem;
//   - a Flecha Galvânica: o CONE na sua frente (o PoB: a parte "Cone", radius 28 + 0,5 m da qualidade… — act_dex.lua:8590-8625), com os aumentos e reduções da
//     Velocidade de Projéteis somados à Área de Efeito dele (additive_arrow_speed_modifiers_apply_to_area_of_effect: o "aumentado", não o "mais");
//   - o Desenterrar: "Cadáveres Criados têm Vida Máxima aumentada em X%" (maximum_life_+%_for_corpses_you_create, a qualidade);
//   - o Ensanguentar da Transmissão: "Dispara tentáculos em até 1 Alvo" é o que o jogo já faz (1 alvo e os ricochetes).
// (O dano adicional igual a X% da Vida/Mana máxima — a Flecha Ardente do Vigor e o Sifão de Poder do Arquimago — é regra de `linhas-das-gemas.mjs`.)
//
// EXCEÇÕES DO DONO (as escolhas sem fonte do lote, para o aval): (1) a estilha não acerta o inimigo em que o escudo colidiu (ela nasce nele); (2) as estilhas
// saem só nas colisões com inimigos (não no terreno); (3) a primeira rajada do de Trarthus sai 0,6 s depois de o escudo parar, e "40% mais rápido" divide o
// intervalo por 1,4; (4) o cone da Galvânica sai de você na direção do alvo, com a forma do cone do Tiro Gélido (a ponta colada e o fundo no raio).
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[1]); } return null; };
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);

// ---------------------------------------------------------------- o Sifão de Poder

const LINHA_DO_SIFAO = /^(?:([\d.]+) % de chance de receber|Receba) uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único$/i;
/** A chance (%) de Carga de Poder por projétil que acerta um Raro ou Único (a Vaal: 100), ou 0. */
export function cargaDoSifaoDasLinhas(linhas = []) {
  for (const l of linhas) {
    const m = LINHA_DO_SIFAO.exec(norm(l));
    if (m) return m[1] == null ? 100 : Number(m[1]);
  }
  return 0;
}
/** O alvo conta como Raro ou Único (os chefes também — `ModsPoe.aoAcertar`). */
export const raroOuUnico = (alvo) => !!alvo && (/raro|unico/.test(String(alvo.raridade ?? alvo.raridadePoe ?? '')) || !!alvo.boss || !!alvo.chefe);

// ---------------------------------------------------------------- o Arremesso de Escudo Espectral

/** (o PoB, act_dex.lua:14498-14520) o de Trarthus: 6 por vez, a cada 0,6 s, cada intervalo 40% mais rápido. */
export const TRARTHUS = Object.freeze({ porVez: 6, intervaloMs: 600, aceleraPct: 40 });
const LINHA_DAS_ESTILHAS = /^Projéteis de Estilhas Causam ([\d.]+) % menos Dano$/i;
const LINHA_DE_TRARTHUS = /^Dispara (\d+) fragmentos por vez até que todos sejam disparados$/i;
/** As estilhas da gema: `{ menosPct, trarthus: { porVez, intervaloMs, aceleraPct } | null }`, ou null fora do Arremesso de Escudo Espectral. */
export function estilhasDasLinhas(slug, linhas = []) {
  if (!/^Spectral_Shield_Throw/.test(slug)) return null;
  const menosPct = achar(linhas, LINHA_DAS_ESTILHAS);
  if (menosPct == null) return null;
  const porVez = achar(linhas, LINHA_DE_TRARTHUS);
  return { menosPct, trarthus: porVez ? { ...TRARTHUS, porVez } : null };
}
/**
 * O uso com as estilhas (`Acoes.comOsAlvosDaGema`): os projéteis adicionais (os da gema, dos suportes e das peças) viram as estilhas. O escudo comum não
 * perfura e solta `estilhas.n` a cada colisão (`Secundarios.resolver`); o de Trarthus para no local mirado (o alvo: nada adiante dele) e as solta de lá
 * (`estilhasDoObjeto`, `Acoes.criarObjetosDoUso`) — as estilhas perfuram todos.
 */
export function estilhasNoUso(e, d) {
  if (!d || !e) return e;
  const n = Math.max(0, Math.round(Number(e.alvosExtras) || 0));
  if (d.trarthus) return { ...e, alvosExtras: 0, perfurar: 0, estilhasDoObjeto: n, estilhasMenosPct: d.menosPct };
  return { ...e, alvosExtras: 0, perfurar: 0, estilhas: { n, pct: Math.max(0, 100 - d.menosPct) } };
}
/** O objeto do de Trarthus (`Acoes.criarObjetosDoUso`): `{ tipo: 'escudo', … }`, ou null. */
export function objetoDasLinhas(slug, linhas = []) {
  const d = estilhasDasLinhas(slug, linhas);
  return d?.trarthus ? { tipo: 'escudo', menosPct: d.menosPct, ...d.trarthus } : null;
}
/** Os intervalos (ms) das rajadas do de Trarthus para `n` estilhas: a primeira aos 0,6 s, cada seguinte ÷ 1,4. */
export function rajadasDoEscudo(n, { porVez = TRARTHUS.porVez, intervaloMs = TRARTHUS.intervaloMs, aceleraPct = TRARTHUS.aceleraPct } = {}) {
  const r = [];
  let falta = Math.max(0, Math.round(n));
  let t = 0;
  let passo = intervaloMs;
  while (falta > 0) {
    t += passo;
    const k = Math.min(porVez, falta);
    r.push({ em: t, n: k });
    falta -= k;
    passo /= 1 + aceleraPct / 100;
  }
  return r;
}

// ---------------------------------------------------------------- a Flecha Galvânica

const LINHA_DA_GALVANICA = /^Aumentos e Reduções a Velocidade de Projéteis também se aplicam ao Efeito em Área dessa Habilidade$/i;
/** A gema tem o cone da Galvânica (o raio padrão do PoB, 2,8 m: radius 28). */
export const temConeGalvanico = (slug) => slug === 'Galvanic_Arrow';
export const CONE_GALVANICO = Object.freeze({ raioPadraoM: 2.8, alcanceDaEnergia: 3 });
/**
 * (revisão do PR1) a Flecha Galvânica da ENERGIA: "Cria uma explosão de raio do seu Arco, sem disparar flechas, mas causando dano aos inimigos num cone à sua
 * frente" (o PoB, GalvanicArrowAltX — act_dex.lua: radius 28 + 8 + o do nível + 0,2 por qualidade): o cone sai de você na direção do alvo (a forma do da
 * Galvânica), no raio da gema × √ da Área de Efeito — ela não tem projétil, então a Velocidade de Projéteis não entra (o "additive_arrow_speed…" é só da base).
 * O alcance do uso: as casas do cone (3, como a base), não o da área no chão do molde.
 */
export const temConeGalvanicoDeVoce = (slug) => slug === 'Galvanic_Arrow_of_Energy';
/**
 * (revisão do PR1) a Flecha Galvânica do SURTO: as 3 flechas que, se o voo para ao colidir com um alvo, "criam uma explosão de raio, causando dano aos inimigos
 * num cone atrás do alvo" (o PoB, GalvanicArrowAltY — parts Arrow/Cone, radius 28): em cada impacto de flecha, o cone sai do acertado na direção do tiro, como o
 * do Tiro Gélido (o acertado não leva o do próprio cone — a mesma exceção do Tiro Gélido).
 */
export const temConeAtrasDoAlvo = (slug) => slug === 'Galvanic_Arrow_of_Surging';
/**
 * O raio (m) do cone: o da gema × √ do fator da Área do PoE — (1 + a Área aumentada + a Velocidade de Projéteis aumentada) × (1 + o "mais"), como
 * `ModsPoe.fatorDaArea`.
 */
export const metrosDoConeGalvanico = (raioM, areaIncPct = 0, velIncPct = 0, areaMaisPct = 0) => raioM * Math.sqrt(Math.max(0, 1 + (areaIncPct + velIncPct) / 100) * Math.max(0, 1 + areaMaisPct / 100));

// ---------------------------------------------------------------- o Desenterrar

const LINHA_DO_CADAVER = /^Cadáveres Criados têm Vida Máxima aumentada em ([\d.]+) %$/i;
/** O "Vida Máxima aumentada" dos cadáveres criados (a qualidade do Desenterrar), em %. */
export const vidaDoCadaverDasLinhas = (linhas = []) => somar(linhas, LINHA_DO_CADAVER);

// ---------------------------------------------------------------- o status

const LINHAS_PR1 = [
  [LINHA_DO_SIFAO, /^(Vaal_)?Power_Siphon/],
  [LINHA_DAS_ESTILHAS, /^Spectral_Shield_Throw/],
  [LINHA_DE_TRARTHUS, /^Spectral_Shield_Throw_of_Trarthus$/],
  [LINHA_DA_GALVANICA, /^Galvanic_Arrow$/],
  [LINHA_DO_CADAVER, /^Unearth$/],
  [/^Dispara tentáculos em até 1 Alvo$/i, /^Exsanguinate_of_Transmission$/],
];
/** A linha da gema é uma das que este lote faz (sai de "efeito não simulado"). */
export const ehLinhaPR1 = (slug, l) => LINHAS_PR1.some(([re, gema]) => gema.test(slug) && re.test(norm(l)));
