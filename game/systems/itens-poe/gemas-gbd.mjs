// OS LOTES G-B e G-D das gemas ATIVAS do PoE (dono, 25/10: as guardas, as mecânicas novas e o Escudo Tempestuoso — o plano `plano-ativas-3.md`, as
// recomendações aceitas). Aqui ficam os DADOS (o que as linhas dizem no nível e na qualidade, os números do PoB que o poedb não trouxe) e as contas puras e o
// estado da caçada que não precisa de ficha (sem importar a caçada nem `acoes.mjs`); quem usa é `gemas-poe.mjs` (os leitores no nível e o status), `acoes.mjs`
// (o uso, o tique, as Runas e os Clamores), `hunt/combate.mjs` e `poderes.mjs` (o acerto em você).
//
// G-B — as GUARDAS (o PoB: act_str.lua QuickGuard/MoltenShell/VaalMoltenShell/ImmortalCall/VaalImmortalCall, act_int.lua ArcaneCloak, act_dex.lua ArcticArmour/
// VaalArcticArmour/BloodRage, act_int.lua ManaInfusedStaff/SigilOfPower):
//   - D5: a ABSORÇÃO da guarda (GuardAbsorbRate / GuardAbsorbLimit): o acerto que chega em você, DEPOIS da mitigação (a armadura, as resistências, os "menos dano"
//     e as Égides) e ANTES do Escudo de Energia e da Vida, tem X% tirado do buff até o limite dele — a Pele de Aço (70%, o fixo do nível), a Carapaça Derretida (75%,
//     10% da Armadura até 5000), a Vaal (39%, 20% da Armadura até 10000) e o Manto Arcano (75%, até a Mana Gasta). O buff esgotado acaba. Só UM buff de Guarda por
//     vez (o novo tira o velho) e a recarga é COMPARTILHADA entre as Guardas não Vaal (a Vaal usa as almas — a recarga do jogo — e não entra na do grupo); "A
//     Recarga desta Habilidade não é recuperada durante seu efeito": a recarga começa quando o buff acaba (esgotado, substituído ou vencido);
//   - a REFLEXÃO da Carapaça (molten_shell_%_of_absorbed_damage_dealt_as_reflected_fire): 3000% do absorvido como Fogo ao acabar (esgotar, vencer ou ser trocado),
//     no raio de 1,5 m (radius 15) em volta de você; a Vaal: 9000% do absorvido NAQUELE segundo, a cada segundo, e 9000% do total ao acabar. Sem os seus
//     modificadores de dano, o monstro resiste normalmente (D5);
//   - o MANTO ARCANO: gasta 64% da Mana ATUAL no uso (conta como Mana Gasta — D9), o limite é o gasto e o buff dá Raio adicional (aos ataques e às magias) igual a
//     10% do gasto;
//   - o CHAMADO IMORTAL: consome até 5 Cargas de Tolerância — +20% de Duração do Buff e 15% menos Dano Físico sofrido (MORE × as cargas, sobre o −35% da gema) por
//     carga; o VAAL (D6): não tira mais os −34%/−35% herdados das colunas, e você não pode morrer — o PoB: immortal_call_prevent_all_damage, Condition:CannotDie —
//     por 0,4 s × (1 + 1,57 × as cargas consumidas) × a Duração;
//   - a ARMADURA ÁRTICA (a antiga): quem acerta você fica Resfriado por 0,5 s (arctic_armour_chill_when_hit_duration 500 — 30% de Velocidade de Ação); a VAAL (D7):
//     90% menos Dano de Acertos e conta como Congelado — você não age até o gelo quebrar (3 Acertos com dano) ou a duração (5 s, a do PoB — a coluna herdada da
//     Armadura Ártica saiu) acabar; as regenerações de Mana (30,6/s) e de Escudo de Energia (395/s) valem enquanto o gelo dura;
//   - a FÚRIA SANGRENTA (D8): a perda de 4% da Vida e do Escudo de Energia máximos por segundo é Dano Físico degenerativo (PhysicalDegen): passa pelos
//     modificadores de dano degenerativo sofrido e PODE MATAR;
//   - o CAJADO IMPREGNADO DE MANA: a Onda Arcana leva a Eficácia do Dano Adicionado de 450% (damageEffectiveness 4,5) no dano adicionado às magias das suas peças;
//     a duração de 0,35 s é o tempo da onda (o PoB mostra o dano médio de UM acerto — base_skill_show_average_damage_instead_of_dps);
//   - o EMBLEMA DO PODER (D9): o buff vale para os aliados (a party) na área (buffAllies).
// G-D — as MECÂNICAS NOVAS:
//   - D14: a RUNA DA PENITÊNCIA (PenanceBrand): cada Ativação (0,1 s) põe 1 de Energia no vinculado; com 20 vem a explosão (o acerto da gema) e a Runa sai; ela fica
//     vinculada sem limite de tempo (brand_atttached_duration_is_infinite) e a Energia some quando ela se desvincula. A da DISSIPAÇÃO pulsa a cada 1 s: +1 de
//     Energia por Ativação (até 20) e o pulso com "20% mais Dano com Acertos e com Afecções por Energia após a primeira" e "+0,1 m ao raio por Energia" (a mesma
//     conta). A da CONDUÇÃO (D15): a cada Ativação, 1 de Energia no vinculado e nos vizinhos a até 1 casa dele (os 0,9 m) que ainda não têm; ao se desvincular (o
//     vinculado morre ou a duração acaba), cada inimigo com Energia leva o acerto da gema;
//   - D15: a RUNA TEMPESTUOSA: cada Ativação envia os feixes ao vinculado e aos N − 1 vivos mais perto da Runa a até 3 casas (o alcance de vínculo, `PADRAO.alcance`);
//     N = 3 (+0,05 por qualidade);
//   - D16: a RUNA DO ARCANISTA (BrandSupport/SupportBrandSupport, o PoB): Ativada a cada 1 s vinculada (+0,5% por qualidade de frequência), vinculada por 3 s e
//     solta por 5 s; cada Ativação ativa as magias LIGADAS a ela (as do mesmo grupo de encaixes), saindo do lugar do vinculado, com "X% menos Dano" (o nível), "Y%
//     mais Dano com Acertos contra o Inimigo Vinculado" e "40% menos Área de Efeito" (support_brand_area_of_effect_+%_final −40);
//   - o CLAMOR INFERNAL (D16, o PoB act_str.lua InfernalCry/Combust): o raio do Clamor é 6 m (radius 60 — o "AoE Radius: 22" do poedb é o da Combustão e da
//     explosão); o buff dá "5% do Dano Físico como Fogo Extra por cada 5 de Poder, até 25"; Impele 6 ataques corpo a corpo; cada ataque Impelido por ele ativa a
//     COMBUSTÃO — um ataque em área (2,2 m) na casa do alvo, com 234,2% de Eficácia (o golpe da arma × 2,342) e 60% do Físico convertido em Fogo; o inimigo
//     provocado por ele ganha a penalidade (3,4 s × a Duração) e, se morrer com ela, explode: 8% da Vida máxima dele como Fogo em 2,2 m, sem os seus modificadores;
//   - o CLAMOR DE REUNIÃO: o buff vai aos ALIADOS no raio (o PoB: "Nearby allies gain a buff based on the damage of your weapon") — Dano de Ataque Adicional igual a
//     4% do dano da sua arma principal por cada 5 de Poder (até 30) —, e os ataques Impelidos por ele causam 5% mais Dano por aliado afetado (até 25%);
//   - o FOGO JUSTO DA DEVOÇÃO ARCANA e o VAAL (D18): o "dano em volta" (dotIsArea) — a queima renovada a cada tique nos inimigos no raio (como o feixe do Vínculo
//     Abrasador); a da Devoção: 70% da Mana máxima por segundo como Fogo base (os modificadores de Dano Mágico valem no degenerativo dela) e você queima 90% da
//     Mana máxima por segundo como Fogo (pela sua resistência a Fogo; NÃO MATA — acaba com 1 de Vida, "The effect ends when you have 1 life remaining"), "24% mais
//     Velocidade de Conjuração"; a Vaal: sacrifica 60% da Vida e do Escudo de Energia máximos (sem matar) e causa 158% do sacrificado por segundo durante 4 s,
//     "19% mais Dano Mágico";
//   - D17: o PACTO DE K'TASH: fortalece a próxima magia Vaal que causa dano — "+29% de dano" (o MORE do PoB) e "ganham novamente as almas consumidas" = a recarga
//     da gema Vaal volta pronta (as almas do jogo são a recarga); o "−50% de duração de impedimento de ganho de almas" não se aplica (o jogo não tem impedimento);
//   - o ESCUDO TEMPESTUOSO (o dono, 25/10): um buff que reserva 25% da Mana (manaReservationPercent 25, como no PoE), +25% de chance de Bloquear Dano Mágico com
//     escudo e Imunidade a Eletrização; ao bloquear, o raio sai no atacante e ricocheteia (chanceToTriggerCounterattackOnBlock 100, number_of_chains 1).
//
// EXCEÇÕES (as escolhas sem fonte do lote — aprovadas pelo dono em 26/10; e o Clamor de Reunião: cada aliado conta o Poder de um inimigo Normal, 1): (1) a Guarda Vaal não entra na recarga compartilhada (a recarga dela são as almas); (2) a
// Carapaça trocada por outra Guarda reflete o que absorveu, como ao vencer; (3) o golpe da Condução ao se desvincular é um acerto em cada inimigo com Energia (a
// área não repete nos vizinhos); (4) a Runa Tempestuosa mira os vivos mais perto da RUNA (o vinculado); (5) as magias da Runa do Arcanista saem do lugar do
// vinculado (a casa da Runa), mirando ele; (6) o raio da explosão do Clamor Infernal e o da Combustão são os 2,2 m do poedb.
//
// (Sem dependência da caçada nem dos outros módulos do PoE: só as linhas, os números e o estado JSON da caçada.)

const norm = (t) => String(t).replace(/(\d)%/g, '$1 %').replace(/\\n/g, ' ').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const achar = (linhas, re, g = 1) => { for (const l of linhas) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const tem = (linhas, re) => linhas.some((l) => re.test(norm(l)));
const somar = (linhas, re) => linhas.reduce((t, l) => t + (Number(re.exec(norm(l))?.[1]) || 0), 0);
const casas = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const mesmoAndar = (a, b) => (a?.z ?? 0) === (b?.z ?? 0);
const PREFIXO = 'poe-gema:';

// ---------------------------------------------------------------- os dados que o poedb não trouxe (o PoB)

/**
 * (D16 e o 0.6 do plano) As gemas que o poedb trouxe sem as linhas fixas do PoE (`mods: []`) ou com colunas HERDADAS da gema base: as linhas do PoB, em pt,
 * e as colunas que não são dela. Aplicado na leitura da coleção (`GemasPoe.iniciar`), antes de tudo.
 */
const MODS_DO_POB = {
  // (act_str.lua InfernalCry: warcry_count_power_from_enemies, infernal_cry_physical_damage_%_to_add_as_fire_per_5_power_up_to_cap 5 (limit 25),
  // skill_empowers_next_x_melee_attacks 6, infernal_cry_empowered_attacks_trigger_combust, infernal_cry_%_max_life_as_fire_on_death 8; Combust: baseMultiplier 2,342
  // no nível 20, skill_physical_damage_%_to_convert_to_fire 60)
  Infernal_Cry: [
    'Conta o Poder total de Inimigos no Alcance',
    'Buff concede 5 % do Dano Físico como Dano de Fogo Extra por cada 5 de Poder, contando um máximo de 25 de Poder',
    'Impele os próximos 6 Ataques Corpo a Corpo que você executar',
    'Ataques Impelidos ativam Combustão',
    'Inimigos Provocados explodem ao morrer, causando 8 % da Vida Máxima deles como Dano de Fogo',
  ],
  // (act_int.lua BrandSupport: base_sigil_repeat_frequency_ms 1000, base_skill_effect_duration 3000 (vinculada), base_secondary_skill_effect_duration 5000 (solta),
  // additive_cast_speed_modifiers_apply_to_sigil_repeat_frequency; SupportBrandSupport: support_brand_area_of_effect_+%_final −40)
  Arcanist_Brand: [
    'É Ativado a cada 1 segundo enquanto Vinculado',
    'Aumentos e Reduções à Velocidade de Conjuração também se aplicam à frequência de Ativação desta Habilidade',
    'Pode ser Vinculada por uma Duração total de 3 segundos',
    'Pode ser Desvinculada por uma Duração total de 5 segundos',
    'Ativa as Magias conectadas quando Ativada',
    'Habilidades Suportadas têm 40 % menos Área de Efeito',
  ],
  // (act_str.lua BattlemagesCry: skill_empowers_next_x_melee_attacks 5, divine_cry_additional_base_critical_strike_chance_per_5_power_up_to_cap 50 (÷100, limit 25))
  Battlemages_Cry: [
    'Conta o Poder total de Inimigos no Alcance',
    'Buff concede +0.5 % de Chance de Acerto Crítico base por cada 5 de Poder, contando um máximo de 25 de Poder',
    'Impele os próximos 5 Ataques Corpo a Corpo que você executar',
    'Ataques Impelidos ativam as Magias Suportadas',
  ],
  // (act_str.lua GeneralsCry: maximum_number_of_spiritual_cry_warriors 5 (+0,05 por qualidade), spiritual_cry_doubles_summoned_per_5_MP 2, warcry_gain_mp_from_corpses)
  Generals_Cry: [
    'Conta o Poder total de Inimigos e Cadáveres no Alcance',
    'Convoca 2 Guerreiros Ilusórios por cada 5 de Poder, até 5, que usam os Ataques conectados uma vez',
  ],
};
const QUALIDADE_DO_POB = {
  // (sigil_repeat_frequency_+% 0,5 por qualidade)
  Arcanist_Brand: ['Frequência de Ativação de Runas aumentada em (0 — 10) %'],
  Generals_Cry: ['+(0 — 1) ao número máximo de Guerreiros Ilusórios'],
};
/** As colunas que vieram da gema base (o poedb repete o cabeçalho dela): o PoB não as tem nesta. */
const COLUNAS_HERDADAS = {
  Vaal_Immortal_Call: [/menos Dano Elemental sofrido$/i, /menos Dano Físico sofrido$/i],
  Vaal_Arctic_Armour: [/enquanto parado$/i, /^Duração base é de/i],
};
/** (o raio do Clamor Infernal: o PoB, radius 60 — o "AoE Radius: 22" do poedb é o da Combustão) */
const PROPS_DO_POB = { Infernal_Cry: [[/^AoE Radius: 22$/, 'AoE Radius: 60']] };
/** Completa a coleção do poedb (uma vez, na leitura): as linhas fixas do PoB e as colunas herdadas fora. Devolve a lista. */
export function completarPeloPoB(gemas = []) {
  for (const g of gemas) {
    if (MODS_DO_POB[g.slug] && !(g.mods ?? []).some((m) => MODS_DO_POB[g.slug].includes(m))) g.mods = [...(g.mods ?? []), ...MODS_DO_POB[g.slug]];
    if (QUALIDADE_DO_POB[g.slug] && !(g.qualidade ?? []).length) g.qualidade = [...QUALIDADE_DO_POB[g.slug]];
    for (const [re, novo] of PROPS_DO_POB[g.slug] ?? []) g.props = (g.props ?? []).map((p) => (re.test(p) ? novo : p));
    const fora = COLUNAS_HERDADAS[g.slug];
    if (fora && Array.isArray(g.colunas)) {
      const idx = g.colunas.map((c, i) => (fora.some((re) => re.test(String(c))) ? i : -1)).filter((i) => i >= 0);
      if (idx.length) {
        g.colunas = g.colunas.filter((_, i) => !idx.includes(i));
        g.linhas = (g.linhas ?? []).map((l) => (Array.isArray(l) ? l.filter((_, i) => !idx.includes(i)) : l));
      }
    }
  }
  return gemas;
}

// ---------------------------------------------------------------- as GUARDAS (a absorção)

const LINHA_PELE = /^([\d.]+) % do Dano de Acertos é tirado do Buff antes da Vida ou Escudo de Energia Buff pode sofrer ([\d.]+) de Dano$/i;
const LINHA_CARAPACA = /^([\d.]+) % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a ([\d.]+) % da sua armadura, até ([\d.]+)$/i;
const LINHA_MANTO = /^([\d.]+) % do Dano de Acertos é sofrido no Buff antes da sua Vida ou Escudo de Energia Buff pode sofrer Dano igual a Mana Gasta pelo efeito desta Habilidade$/i;
const LINHA_GASTA = /^Gasta ([\d.]+) % da Mana atual$/i;
const LINHA_RAIO_DO_GASTO = /^Buff concede Dano de Raio Adicional igual a ([\d.]+) % da Mana Gasta pelo efeito desta Habilidade$/i;
const LINHA_REFLETE = /^Reflete ([\d.]+) % do Dano sofrido pelo Buff como Dano de Fogo quando o Buff expirar ou se esgotar$/i;
const LINHA_REFLETE_VAAL = /^Reflete ([\d.]+) % do Dano sofrido pelo Buff como Dano de Fogo por segundo, ou quando o Buff expirar ou se esgotar$/i;
export const LINHA_RECARGA_PARADA = /^A Recarga desta Habilidade não é recuperada durante seu efeito$/i;
/** (o PoB: MoltenShell radius 15 — 1,5 m; a Vaal não publica o dela: o da base) */
export const CARAPACA = Object.freeze({ raioM: 1.5 });
/**
 * A absorção da Guarda no nível: `{ pct, fixo?, armaduraPct?, maximo?, gastaPct?, raioDoGastoPct?, reflete?: { pct, porSegundo, raioM } }`, ou null (não é das
 * que absorvem). `fixo`: o limite do nível (a Pele de Aço); `armaduraPct`/`maximo`: X% da Armadura até M (a Carapaça); `gastaPct`: o Manto (o limite é o gasto).
 */
export function guardaDasLinhas(slug, linhas = []) {
  for (const l of linhas) {
    const t = norm(l);
    let m = LINHA_PELE.exec(t);
    if (m) return { pct: Number(m[1]), fixo: Number(m[2]) };
    m = LINHA_CARAPACA.exec(t);
    if (m) {
      const reflete = achar(linhas, LINHA_REFLETE);
      const refleteVaal = achar(linhas, LINHA_REFLETE_VAAL);
      return { pct: Number(m[1]), armaduraPct: Number(m[2]), maximo: Number(m[3]), ...(reflete || refleteVaal ? { reflete: { pct: reflete ?? refleteVaal, porSegundo: refleteVaal != null, raioM: CARAPACA.raioM } } : {}) };
    }
    m = LINHA_MANTO.exec(t);
    if (m) return { pct: Number(m[1]), gastaPct: achar(linhas, LINHA_GASTA) ?? 0, raioDoGastoPct: achar(linhas, LINHA_RAIO_DO_GASTO) ?? 0 };
  }
  return null;
}
/** O limite da Guarda no uso: o fixo, X% da Armadura (até o máximo) ou a Mana Gasta. */
export function limiteDaGuarda(d, { armadura = 0, gasto = 0 } = {}) {
  if (!d) return 0;
  if (d.fixo != null) return Math.max(0, Math.round(d.fixo));
  if (d.armaduraPct != null) return Math.max(0, Math.round(Math.min(d.maximo ?? Infinity, (Math.max(0, armadura) * d.armaduraPct) / 100)));
  return Math.max(0, Math.round(gasto));
}
/**
 * Liga a Guarda (`hunt.poeGuarda`, JSON): a ação do buff, o % que absorve, o que resta e o que ela já tirou (o total e o do segundo de agora — a reflexão da Vaal).
 */
export function porGuarda(hunt, { acao, slug, pct, limite, reflete = null }, agora = hunt?.clock ?? 0) {
  if (!hunt) return null;
  hunt.poeGuarda = { acao, slug, pct, limite, resta: limite, absorvido: 0, noSegundo: 0, proximoSegundo: agora + 1000, ...(reflete ? { reflete: { ...reflete } } : {}) };
  return hunt.poeGuarda;
}
/** A Guarda que absorve agora (o buff dela ligado e com o que tirar), ou null. */
export function guardaAtiva(hunt, agora = hunt?.clock ?? 0) {
  const g = hunt?.poeGuarda;
  const b = g ? hunt.buffs?.[g.acao] : null;
  return g && b && b.ate > agora && g.resta > 0 ? g : null;
}
/**
 * (D5) O acerto `dano` em você, depois da mitigação: a parte da Guarda (X%, até o que resta) sai do buff. Devolve quanto o buff tomou. (O fim — esgotada — é do tique:
 * `Acoes.tiqueDasGemasGBD`, que reflete e põe a recarga.)
 */
export function absorverNaGuarda(hunt, dano, agora = hunt?.clock ?? 0) {
  const g = guardaAtiva(hunt, agora);
  if (!g || !(dano > 0)) return 0;
  const tomou = Math.min(g.resta, Math.round((dano * g.pct) / 100));
  if (!(tomou > 0)) return 0;
  g.resta -= tomou;
  g.absorvido += tomou;
  g.noSegundo += tomou;
  return tomou;
}
/** O fogo refletido pela Carapaça de `absorvido` (o % da linha): o valor antes da resistência do monstro. */
export const fogoRefletido = (g, absorvido) => (g?.reflete ? (Math.max(0, absorvido) * g.reflete.pct) / 100 : 0);

// ---------------------------------------------------------------- o Chamado Imortal e o Vaal

const LINHA_IC_DURACAO = /^Duração do Buff aumentada em ([\d.]+) % por Carga de Tolerância removida$/i;
const LINHA_IC_FISICO = /^([\d.]+) % menos Dano Físico sofrido por Carga de Tolerância removida$/i;
const LINHA_IC_FIXA = /^A expiração do Buff não pode ser modificada$/i;
/** O PoB: "up to 5 Endurance Charges" (o Vaal: todas as removíveis — o limite das cargas). */
export const CHAMADO = Object.freeze({ maxCargas: 5 });
/** O Chamado Imortal: `{ duracaoPorCargaPct, fisicoPorCargaPct, vaal, maxCargas }`, ou null. */
export function chamadoDasLinhas(slug, linhas = []) {
  if (!/^(Vaal_)?Immortal_Call$/.test(slug)) return null;
  const vaal = slug === 'Vaal_Immortal_Call';
  return { duracaoPorCargaPct: achar(linhas, LINHA_IC_DURACAO) ?? 0, fisicoPorCargaPct: achar(linhas, LINHA_IC_FISICO) ?? 0, vaal, maxCargas: vaal ? 99 : CHAMADO.maxCargas };
}
/** O "menos Dano Físico sofrido" do Chamado com `n` cargas: o da gema × (1 − 15% × n), como um só "mais" (o MORE do PoB com o multiplicador das cargas). */
export const fisicoDoChamado = (basePct, porCargaPct, n) => ((1 + (basePct ?? 0) / 100) * Math.max(0, 1 - ((porCargaPct ?? 0) * Math.min(CHAMADO.maxCargas, Math.max(0, n))) / 100) - 1) * 100;
/** (D6) O Vaal: você não pode morrer — todo dano em você é impedido — enquanto o buff dura (`hunt.poeImortal`: até quando). */
export const imortal = (hunt, agora = hunt?.clock ?? 0) => (hunt?.poeImortal ?? 0) > agora;

// ---------------------------------------------------------------- a Armadura Ártica e a Vaal

const LINHA_AA_RESFRIA = /^Resfria Inimigos por ([\d.]+) segundos ao Acertar, reduzindo sua Velocidade de Ação em ([\d.]+) ?%$/i;
const LINHA_VAA_MENOS = /^Você sofre ([\d.]+) % menos Dano de Acertos e conta como Congelado$/i;
const LINHA_VAA_QUEBRA = /^Gelo se quebra após você sofrer (\d+) Acertos Danificadores ou a Duração expirar$/i;
const LINHA_VAA_MANA = /^Buff concede ([\d.]+) de Regeneração de Mana por segundo$/i;
const LINHA_VAA_ES = /^Buff concede ([\d.]+) de Regeneração de Escudo de Energia por segundo$/i;
/** A Armadura Ártica (a antiga): `{ resfriaMs, resfriaPct }`, ou null. */
export function articaDasLinhas(slug, linhas = []) {
  if (slug !== 'Old_Arctic_Armour') return null;
  const s = achar(linhas, LINHA_AA_RESFRIA);
  return s ? { resfriaMs: Math.round(s * 1000), resfriaPct: achar(linhas, LINHA_AA_RESFRIA, 2) ?? 30 } : null;
}
/** A Vaal: `{ menosPct, acertos, manaPorS, esPorS }`, ou null. */
export function articaVaalDasLinhas(slug, linhas = []) {
  if (slug !== 'Vaal_Arctic_Armour') return null;
  return { menosPct: achar(linhas, LINHA_VAA_MENOS) ?? 0, acertos: achar(linhas, LINHA_VAA_QUEBRA) ?? 3, manaPorS: achar(linhas, LINHA_VAA_MANA) ?? 0, esPorS: achar(linhas, LINHA_VAA_ES) ?? 0 };
}
/** O gelo da Vaal agora (`hunt.poeGeloVaal`: `{ acao, ate, acertos, max, menosPct }`), ou null. */
export function geloVaal(hunt, agora = hunt?.clock ?? 0) {
  const g = hunt?.poeGeloVaal;
  return g && g.ate > agora && (hunt.buffs?.[g.acao]?.ate ?? 0) > agora ? g : null;
}
/** O fator do acerto em você no gelo da Vaal (0,1 com 90% menos; 1 sem). */
export const fatorDoGeloVaal = (hunt, agora = hunt?.clock ?? 0) => { const g = geloVaal(hunt, agora); return g ? Math.max(0, 1 - g.menosPct / 100) : 1; };
/** Quebra o gelo da Vaal (os 3 acertos, a duração, ou o buff que saiu): o buff e o Congelado dele saem (o Congelado de um monstro, não). */
export function quebrarGelo(hunt, agora = hunt?.clock ?? 0) {
  const g = hunt?.poeGeloVaal;
  if (!g) return false;
  delete hunt.poeGeloVaal;
  if (hunt.buffs?.[g.acao]) delete hunt.buffs[g.acao];
  if (hunt.controle?.congelado?.geloVaal) delete hunt.controle.congelado;
  // (os atributos do buff saíram — as regenerações: a ficha é refeita no tique)
  hunt.poeFichaMudou = true;
  return true;
}
/**
 * (revisão G, 26/10 — o dono: "guarde TODAS, cada uma com a sua duração, e vale a mais forte ativa", o modelo do `tolhido`) Põe uma LENTIDÃO de `pct` até `ate` no
 * `e.lento`: cada fonte é uma instância com a sua duração (`lista`, com mais de uma); vale a de maior `pct` ainda ativa — a mais fraca segue depois que a forte acaba, até o
 * fim dela. Sai só a instância que outra cobre (`pct` e fim maiores ou iguais). `e.lento.ate` é o fim da última (o estado está ativo enquanto alguma está) e `e.lento.pct`
 * o da mais forte ativa (refeito a cada tique dos monstros — `atualizarLento`). `extra`: os campos da instância (o `dur` das Forças Profanadas). `agora` desconhecido:
 * as de antes contam como ativas (o tique tira as vencidas).
 */
const instanciasDoLento = (l, agora) => (l ? (l.lista ?? [l]).filter((i) => (i.ate ?? 0) > agora).map(({ ate, pct, dur }) => ({ ate, pct: pct ?? 0, ...(dur != null ? { dur } : {}) })) : []);
function montarLento(base, lista) {
  const { lista: _l, ate: _a, pct: _p, dur: _d, depois: _x, ...marcas } = base ?? {};
  if (!lista.length) return null;
  const forte = lista[0];
  return lista.length > 1 ? { ...marcas, ate: Math.max(...lista.map((i) => i.ate)), pct: forte.pct, ...(forte.dur != null ? { dur: forte.dur } : {}), lista } : { ...marcas, ...forte };
}
export function porLento(e, ate, pct, agora = -Infinity, extra = {}) {
  const novo = { ate, pct, ...extra };
  const todos = [...instanciasDoLento(e.lento, agora), novo];
  const cobre = (j, i) => j.pct >= i.pct && j.ate >= i.ate;
  const lista = todos.filter((i, k) => !todos.some((j, l) => l !== k && cobre(j, i) && (!cobre(i, j) || l > k))).sort((x, y) => y.pct - x.pct || y.ate - x.ate);
  e.lento = montarLento(e.lento, lista);
  return e.lento;
}
/** (revisão G) A cada tique: as instâncias vencidas saem e o `pct` passa a ser o da mais forte ainda ativa. */
export function atualizarLento(e, agora) {
  const l = e?.lento;
  if (!l?.lista) return;
  const lista = instanciasDoLento(l, agora).sort((x, y) => y.pct - x.pct || y.ate - x.ate);
  if (lista.length) e.lento = montarLento(l, lista);
}
/** (revisão G) A lentidão que vale agora (o `pct` da instância mais forte ativa; 0 sem nenhuma). */
export const pctDoLento = (e, agora) => Math.max(0, ...instanciasDoLento(e?.lento, agora).map((i) => i.pct));
/** (revisão G — as Forças Profanadas) Cada instância do lento volta à duração cheia dela (`dur`; sem ela, `padraoMs`). */
export function renovarLento(e, agora, padraoMs = 2000) {
  const l = e?.lento;
  if (!(l?.ate > agora)) return;
  for (const i of l.lista ?? []) if (i.ate > agora) i.ate = Math.max(i.ate, agora + (i.dur ?? l.dur ?? padraoMs));
  l.ate = Math.max(l.ate, agora + (l.dur ?? padraoMs), ...(l.lista ?? []).map((i) => i.ate));
}
/** (a Armadura Ártica) quem acerta você fica Resfriado (o `lento` do jogo, `pct` de Velocidade de Ação) por `ms` — com o buff dela ligado. Devolve se resfriou. */
export function resfriarQuemAcerta(hunt, bicho, agora = hunt?.clock ?? 0) {
  if (!bicho || !(bicho.hp > 0) || bicho.dummy) return false;
  const b = Object.values(hunt?.buffs ?? {}).find((x) => x?.gbd?.artica && x.ate > agora);
  if (!b) return false;
  const e = (bicho.estados ??= {});
  const ate = agora + b.gbd.artica.resfriaMs;
  porLento(e, ate, b.gbd.artica.resfriaPct, agora);
  return true;
}
/** Um acerto com dano em você no gelo: conta; no máximo, o gelo QUEBRA — devolve true (quem chama tira o buff e o Congelado). */
export function contarAcertoNoGelo(hunt, agora = hunt?.clock ?? 0) {
  const g = geloVaal(hunt, agora);
  if (!g) return false;
  g.acertos += 1;
  return g.acertos >= g.max;
}

// ---------------------------------------------------------------- o Fogo Justo da Devoção Arcana e o Vaal

const LINHA_RF_MANA = /^Causa ([\d.]+) % da sua Mana Máxima como Dano de Fogo Base por segundo$/i;
const LINHA_RF_QUEIMA_MANA = /^Você Queima por ([\d.]+) % da sua Mana Máxima por segundo como Dano de Fogo$/i;
const LINHA_RF_CONJURACAO = /^Concede ([\d.]+) % mais velocidade de conjuração$/i;
const LINHA_RF_MAGICO = /^Concede ([\d.]+) % mais Dano Mágico$/i;
const LINHA_RF_RAIO = /^O raio Base é de ([\d.]+) metros?$/i;
const LINHA_RF_RAIO_Q = /^\+([\d.]+) metros de raio$/i;
const LINHA_VRF = /^Sacrifica ([\d.]+) % do seu total de Escudo de Energia e Vida Causa ([\d.]+) % do Escudo de Energia e Vida Sacrificados como Dano de Fogo por segundo$/i;
const LINHA_DOT_MAGICO = /^Modificadores de Dano Mágico aplicam-se ao Dano Degenerativo desta Habilidade$/i;
/**
 * O Fogo Justo da Devoção Arcana ou o Vaal: `{ modo: 'mana'|'sacrificio', pctPorS, queimaPctPorS?, sacrificioPct?, raioM, conjuracaoMaisPct, magicoMaisPct,
 * dotMagico }`, ou null.
 */
export function fogoJustoDasLinhas(slug, linhas = [], daQualidade = []) {
  if (!/^(Righteous_Fire_of_Arcane_Devotion|Vaal_Righteous_Fire)$/.test(slug)) return null;
  const raioM = (achar(linhas, LINHA_RF_RAIO) ?? 1.8) + somar(daQualidade, LINHA_RF_RAIO_Q);
  const base = { raioM, conjuracaoMaisPct: achar(linhas, LINHA_RF_CONJURACAO) ?? 0, magicoMaisPct: achar(linhas, LINHA_RF_MAGICO) ?? 0, dotMagico: tem(linhas, LINHA_DOT_MAGICO) };
  if (slug === 'Vaal_Righteous_Fire') {
    const m = linhas.map((l) => LINHA_VRF.exec(norm(l))).find(Boolean);
    return m ? { ...base, modo: 'sacrificio', sacrificioPct: Number(m[1]), pctPorS: Number(m[2]) } : null;
  }
  const pct = achar(linhas, LINHA_RF_MANA);
  return pct != null ? { ...base, modo: 'mana', pctPorS: pct, queimaPctPorS: achar(linhas, LINHA_RF_QUEIMA_MANA) ?? 0 } : null;
}
/** O dano de Fogo base por segundo do Fogo Justo no uso: a Mana máxima × X% (a Devoção) ou o sacrificado × Y% (a Vaal). */
export const fogoJustoPorS = (d, { maxMana = 0, sacrificado = 0 } = {}) => (d?.modo === 'mana' ? (Math.max(0, maxMana) * d.pctPorS) / 100 : (Math.max(0, sacrificado) * (d?.pctPorS ?? 0)) / 100);
/** (D18) O FOGO JUSTO em VOCÊ (a Devoção): `valor` de Fogo antes da resistência; sai do Escudo de Energia e da Vida, sem matar (para em 1 de Vida). Devolve o que tirou. */
export function queimarEmVoce(estado, valor) {
  if (!(valor > 0) || !((estado?.hp ?? 0) > 1)) return 0;
  let resto = valor;
  const doEs = Math.min(Math.max(0, estado.es ?? 0), resto);
  estado.es = Math.max(0, (estado.es ?? 0) - doEs);
  resto -= doEs;
  const daVida = Math.min(Math.max(0, (estado.hp ?? 0) - 1), resto);
  estado.hp -= daVida;
  return doEs + daVida;
}

// ---------------------------------------------------------------- o Pacto de K'Tash

const LINHA_KTASH = /^\[Empowered\|Fortalece\] a próxima magia vaal danosa que você conjurar$/i;
const LINHA_KTASH_DANO = /^Habilidades fortalecidas causam \+ ?([\d.]+) % de dano$/i;
const LINHA_KTASH_IMPEDIMENTO = /^habilidades fortalecidas têm - ?([\d.]+) % de duração de impedimento de ganho de almas$/i;
const LINHA_KTASH_ALMAS = /^Habilidades fortalecidas ganham novamente as almas consumidas ao usar$/i;
/** O Pacto de K'Tash: `{ magias: 1, maisPct, devolveAlmas }`, ou null. */
export function ktashDasLinhas(slug, linhas = []) {
  if (slug !== 'Pact_of_KTash' || !tem(linhas, LINHA_KTASH)) return null;
  return { magias: 1, maisPct: achar(linhas, LINHA_KTASH_DANO) ?? 0, devolveAlmas: tem(linhas, LINHA_KTASH_ALMAS) };
}
/** As gemas de BUFF Vaal que causam dano (o Fogo Justo Vaal, a Carapaça Derretida Vaal): o Pacto também as fortalece (o dano delas sai do buff). */
export const KTASH_NO_BUFF = new Set(['Vaal_Righteous_Fire', 'Vaal_Molten_Shell']);
/** A magia que o Pacto fortalece: Vaal, magia, que causa dano (não o próprio Pacto). `tags`: as do PoE da habilidade; `temDano`: o uso tem golpe. */
export const ktashFortalece = (tags = [], temDano = true) => { const t = new Set(tags); return t.has('vaal') && t.has('magia') && !t.has('pacto') && !!temDano; };

// ---------------------------------------------------------------- o Escudo Tempestuoso

/** (o dono, 25/10) o Escudo Tempestuoso vira um buff (`guarda` do compilador) que reserva a Mana da gema (25%) — o PoB: SkillType.Buff, HasReservation. */
export const ARQUETIPO_GBD = Object.freeze({ Tempest_Shield: 'guarda' });
export const ehEscudoTempestuoso = (slug) => slug === 'Tempest_Shield';
/** O Escudo Tempestuoso precisa de escudo (RequiresShield). */
export const ESCUDO_TEMPESTUOSO = Object.freeze({ acao: `${PREFIXO}Tempest_Shield` });

// ---------------------------------------------------------------- as RUNAS: a Penitência, a Tempestuosa e o Arcanista

const LINHA_DISS_AFECCAO = /^Pulsos causam ([\d.]+) % mais Dano com Afecções por Energia após a primeira$/i;
const LINHA_DISS_ACERTO = /^Pulsos causam ([\d.]+) % mais Dano com Dano com Acertos por Energia após a primeira$/i;
const LINHA_DISS_RAIO = /^\+([\d.]+) metros ao raio do Pulso por Energia$/i;
const LINHA_COND = /^Até \+?([\d.]+) metros ao raio da propagação de Energia, escalonado pela distância da Runa$/i;
/** (o PoB: PenanceBrandMaxEnergy 20, PenanceBrandofDissipationMaxStages 20) */
export const PENITENCIA = Object.freeze({ maxEnergia: 20, vinculadaSemFimMs: 1e12, conducaoCasas: 1 });
/**
 * A Runa da Penitência: `{ modo: 'explode'|'pulsa'|'conduz', max, acertoPorPct?, afeccaoPorPct?, raioPorM?, propagaM? }`, ou null.
 */
export function penitenciaDasLinhas(slug, linhas = []) {
  if (slug === 'Penance_Brand') return { modo: 'explode', max: PENITENCIA.maxEnergia };
  if (slug === 'Penance_Brand_of_Dissipation') return { modo: 'pulsa', max: PENITENCIA.maxEnergia, acertoPorPct: achar(linhas, LINHA_DISS_ACERTO) ?? 0, afeccaoPorPct: achar(linhas, LINHA_DISS_AFECCAO) ?? 0, raioPorM: achar(linhas, LINHA_DISS_RAIO) ?? 0 };
  if (slug === 'Penance_Brand_of_Conduction') return { modo: 'conduz', propagaM: achar(linhas, LINHA_COND) ?? 0 };
  return null;
}
/** O pulso da Dissipação com `n` de Energia: `{ maisAcertoPct, maisAfeccaoPct, raioExtraM }` (o "mais" por Energia depois da primeira — o MORE do PoB × (n − 1)). */
export function pulsoDaDissipacao(d, n) {
  const k = Math.max(0, Math.min(d?.max ?? PENITENCIA.maxEnergia, n) - 1);
  return { maisAcertoPct: (d?.acertoPorPct ?? 0) * k, maisAfeccaoPct: (d?.afeccaoPorPct ?? 0) * k, raioExtraM: (d?.raioPorM ?? 0) * k };
}
const LINHA_FEIXES = /^Envia feixes até (\d+) Inimigos, incluindo o Inimigo Vinculado$/i;
const LINHA_FEIXES_Q = /^Envia feixes para \+?([\d.]+) Inimigos?$/i;
const LINHA_FEIXE_UM = /^Envia um feixe ao Inimigo Vinculado$/i;
/** (D15) os feixes da Runa Tempestuosa vão a até 3 casas (o alcance de vínculo da Runa — `RunasVinculadas.PADRAO.alcance`) */
export const FEIXES = Object.freeze({ alcance: 3 });
/** Quantos feixes cada Ativação da Runa Tempestuosa envia (o vinculado incluído; com os da qualidade, para baixo), ou null (não é dela). */
export function feixesDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug === 'Storm_Brand_of_Indecision' && tem(linhas, LINHA_FEIXE_UM)) return 1;
  const n = achar(linhas, LINHA_FEIXES);
  return n != null ? Math.floor(n + somar(daQualidade, LINHA_FEIXES_Q) + 1e-9) : null;
}
/** Os alvos dos feixes: o vinculado e os N − 1 vivos mais perto da Runa a até `alcance` casas (o mesmo andar). */
export function alvosDosFeixes(monstros = [], vinculado, n, alcance = FEIXES.alcance) {
  if (!vinculado || !(n > 0)) return [];
  const outros = monstros.filter((m) => m !== vinculado && m.hp > 0 && !m.dummy && mesmoAndar(m, vinculado) && casas(m, vinculado) <= alcance).sort((a, b) => casas(a, vinculado) - casas(b, vinculado) || String(a.uid).localeCompare(String(b.uid)));
  return [vinculado, ...outros.slice(0, Math.max(0, n - 1))];
}
const LINHA_ARC_MENOS = /^Habilidades Suportadas causam ([\d.]+) % menos Dano$/i;
const LINHA_ARC_MAIS = /^Habilidades Suportadas Causam ([\d.]+) % mais Dano com Acertos contra Inimigos Vinculados$/i;
const LINHA_ARC_AREA = /^Habilidades Suportadas têm ([\d.]+) % menos Área de Efeito$/i;
const LINHA_ARC_ATIVA = /^Ativa as Magias conectadas quando Ativada$/i;
const LINHA_ARC_FREQ = /^Frequência de Ativação de Runas aumentada em ([\d.]+) %$/i;
/** A Runa do Arcanista: `{ menosPct, contraVinculadoPct, menosAreaPct, freqPct }`, ou null. */
export function arcanistaDasLinhas(slug, linhas = [], daQualidade = []) {
  if (slug !== 'Arcanist_Brand') return null;
  return { menosPct: achar(linhas, LINHA_ARC_MENOS) ?? 0, contraVinculadoPct: achar(linhas, LINHA_ARC_MAIS) ?? 0, menosAreaPct: achar(linhas, LINHA_ARC_AREA) ?? 0, freqPct: somar(daQualidade, LINHA_ARC_FREQ) };
}
/** O "mais" das magias da Runa do Arcanista no alvo: `{ maisAcertoPct, maisAfeccaoPct }` (o menos de todo dano; o mais com Acertos só no vinculado). */
export function maisDoArcanista(d, noVinculado) {
  const menos = 1 - (d?.menosPct ?? 0) / 100;
  return { maisAcertoPct: (menos * (noVinculado ? 1 + (d?.contraVinculadoPct ?? 0) / 100 : 1) - 1) * 100, maisAfeccaoPct: (menos - 1) * 100 };
}

// ---------------------------------------------------------------- os CLAMORES: o Infernal e o de Reunião

const LINHA_INF_FOGO = /^Buff concede ([\d.]+) % do Dano Físico como Dano de Fogo Extra por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i;
const LINHA_INF_COMBUSTAO = /^Ataques Impelidos ativam Combustão$/i;
const LINHA_INF_EXPLODE = /^Inimigos Provocados explodem ao morrer, causando ([\d.]+) % da Vida Máxima deles como Dano de Fogo$/i;
const LINHA_INF_PENALIDADE = /^Duração da penalidade base é de ([\d.]+) segundos?$/i;
const LINHA_BMC_CRIT = /^Buff concede \+([\d.]+) % de Chance de Acerto Crítico base por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i;
/**
 * (o PoB: Combust — baseMultiplier e damageEffectiveness 1,369 no nível 1 e 2,342 no 20, a interpolação linear dos níveis; 60% do Físico convertido em Fogo; o raio de
 * 2,2 m do poedb — a exceção 6)
 */
export const COMBUSTAO = Object.freeze({ efic1: 1.369, efic20: 2.342, fisicoEmFogoPct: 60, raioM: 2.2, explosaoRaioM: 2.2 });
export const eficaciaDaCombustao = (nivel = 1) => { const n = Math.max(1, Math.min(40, nivel | 0 || 1)); return COMBUSTAO.efic1 + ((COMBUSTAO.efic20 - COMBUSTAO.efic1) * (n - 1)) / 19; };
/** O Clamor Infernal: `{ combustao, explodePct, penalidadeMs }`, ou null. */
export function infernalDasLinhas(slug, linhas = []) {
  if (slug !== 'Infernal_Cry') return null;
  return { combustao: tem(linhas, LINHA_INF_COMBUSTAO), explodePct: achar(linhas, LINHA_INF_EXPLODE) ?? 0, penalidadeMs: Math.round((achar(linhas, LINHA_INF_PENALIDADE) ?? 0) * 1000) };
}
/** Os atributos do buff dos Clamores do lote pelo Poder (`GemasPoe.clamorPeloPoder`): o Fogo Extra do Infernal e o crítico base do Mago de Batalha. */
export function clamorPeloPoderGBD(linhas = [], poder = 0) {
  const af = {};
  for (const l of linhas) {
    const t = norm(l);
    let m = LINHA_INF_FOGO.exec(t);
    if (m) af.phys_as_extra_fire = (af.phys_as_extra_fire ?? 0) + Number(m[1]) * Math.floor(Math.min(Math.max(0, poder), Number(m[3])) / Math.max(1, Number(m[2])));
    m = LINHA_BMC_CRIT.exec(t);
    if (m) af.crit_chance = (af.crit_chance ?? 0) + Number(m[1]) * Math.floor(Math.min(Math.max(0, poder), Number(m[3])) / Math.max(1, Number(m[2])));
  }
  return af;
}
const LINHA_REU_ARMA = /^Buff concede Dano de Ataque Adicional igual a ([\d.]+) % do Dano da sua Arma da Mão Principal por cada (\d+) de Poder, contando um máximo de (\d+) de Poder$/i;
const LINHA_REU_LACAIOS = /^Buff tem ([\d.]+) % mais Efeito em seus Lacaios$/i;
const LINHA_REU_POR_ALIADO = /^Ataques Impelidos causam ([\d.]+) % mais Dano por Aliado afetado, máximo de ([\d.]+) ?%$/i;
const LINHA_REU_ALIADOS = /^Conta o Poder total de Inimigos e Aliados no Raio$/i;
/** O Clamor de Reunião: `{ armaPct, porPoder, maxPoder, lacaiosMaisPct, porAliadoPct, porAliadoMax }`, ou null. */
export function reuniaoDasLinhas(slug, linhas = []) {
  if (slug !== 'Rallying_Cry') return null;
  const m = linhas.map((l) => LINHA_REU_ARMA.exec(norm(l))).find(Boolean);
  return { armaPct: m ? Number(m[1]) : 0, porPoder: m ? Number(m[2]) : 5, maxPoder: m ? Number(m[3]) : 30, lacaiosMaisPct: achar(linhas, LINHA_REU_LACAIOS) ?? 0, porAliadoPct: achar(linhas, LINHA_REU_POR_ALIADO) ?? 0, porAliadoMax: achar(linhas, LINHA_REU_POR_ALIADO, 2) ?? 0, contaAliados: tem(linhas, LINHA_REU_ALIADOS) };
}
/** (dono, 26/10) cada aliado no raio do Clamor de Reunião conta o Poder de um inimigo Normal */
export const REUNIAO = Object.freeze({ poderPorAliado: 1 });
/** O % da arma do buff do Clamor de Reunião com `poder`: X × ⌊min(poder, máx) / 5⌋. */
export const armaDaReuniao = (d, poder) => (d ? d.armaPct * Math.floor(Math.min(Math.max(0, poder), d.maxPoder) / Math.max(1, d.porPoder)) : 0);
/** O "mais" do ataque Impelido pelo Clamor de Reunião com `aliados` afetados (até o máximo). */
export const maisDaReuniao = (d, aliados) => (d ? Math.min(d.porAliadoMax, d.porAliadoPct * Math.max(0, aliados)) : 0);

// ---------------------------------------------------------------- o que o status lê

/** As linhas do lote que o jogo faz (saem de "efeito não simulado" — `GemasPoe.ehLinhaFeita`). */
const FEITAS = [
  [LINHA_PELE, /^Steelskin$/], [LINHA_CARAPACA, /^(Vaal_)?Molten_Shell$/], [LINHA_REFLETE, /^Molten_Shell$/], [LINHA_REFLETE_VAAL, /^Vaal_Molten_Shell$/],
  [LINHA_MANTO, /^Arcane_Cloak$/], [LINHA_GASTA, /^Arcane_Cloak$/], [LINHA_RAIO_DO_GASTO, /^Arcane_Cloak$/],
  [LINHA_RECARGA_PARADA, /^(Steelskin|Molten_Shell|Arcane_Cloak|Immortal_Call)$/],
  [LINHA_IC_DURACAO, /^(Vaal_)?Immortal_Call$/], [LINHA_IC_FISICO, /^Immortal_Call$/], [LINHA_IC_FIXA, /^Vaal_Immortal_Call$/],
  [LINHA_AA_RESFRIA, /^Old_Arctic_Armour$/], [LINHA_VAA_MENOS, /^Vaal_Arctic_Armour$/], [LINHA_VAA_QUEBRA, /^Vaal_Arctic_Armour$/], [LINHA_VAA_MANA, /^Vaal_Arctic_Armour$/], [LINHA_VAA_ES, /^Vaal_Arctic_Armour$/],
  [LINHA_RF_MANA, /^Righteous_Fire_of_Arcane_Devotion$/], [LINHA_RF_QUEIMA_MANA, /^Righteous_Fire_of_Arcane_Devotion$/], [LINHA_RF_CONJURACAO, /^Righteous_Fire_of_Arcane_Devotion$/],
  [LINHA_VRF, /^Vaal_Righteous_Fire$/], [LINHA_RF_MAGICO, /^Vaal_Righteous_Fire$/], [LINHA_RF_RAIO, /^(Righteous_Fire_of_Arcane_Devotion|Vaal_Righteous_Fire)$/], [LINHA_RF_RAIO_Q, /^(Righteous_Fire_of_Arcane_Devotion|Vaal_Righteous_Fire)$/],
  [LINHA_DOT_MAGICO, /^Righteous_Fire_of_Arcane_Devotion$/],
  [LINHA_KTASH, /^Pact_of_KTash$/], [LINHA_KTASH_DANO, /^Pact_of_KTash$/], [LINHA_KTASH_IMPEDIMENTO, /^Pact_of_KTash$/], [LINHA_KTASH_ALMAS, /^Pact_of_KTash$/],
  [LINHA_DISS_ACERTO, /^Penance_Brand_of_Dissipation$/], [LINHA_DISS_AFECCAO, /^Penance_Brand_of_Dissipation$/], [LINHA_DISS_RAIO, /^Penance_Brand_of_Dissipation$/], [LINHA_COND, /^Penance_Brand_of_Conduction$/],
  [LINHA_FEIXES, /^Storm_Brand$/], [LINHA_FEIXES_Q, /^Storm_Brand$/], [LINHA_FEIXE_UM, /^Storm_Brand_of_Indecision$/],
  [LINHA_ARC_MENOS, /^Arcanist_Brand$/], [LINHA_ARC_MAIS, /^Arcanist_Brand$/], [LINHA_ARC_AREA, /^Arcanist_Brand$/], [LINHA_ARC_ATIVA, /^Arcanist_Brand$/], [LINHA_ARC_FREQ, /^Arcanist_Brand$/],
  [LINHA_INF_FOGO, /^Infernal_Cry$/], [LINHA_INF_COMBUSTAO, /^Infernal_Cry$/], [LINHA_INF_EXPLODE, /^Infernal_Cry$/], [LINHA_INF_PENALIDADE, /^Infernal_Cry$/],
  [LINHA_BMC_CRIT, /^Battlemages_Cry$/],
  [LINHA_REU_ARMA, /^Rallying_Cry$/], [LINHA_REU_POR_ALIADO, /^Rallying_Cry$/], [LINHA_REU_ALIADOS, /^Rallying_Cry$/],
  // (o Impelir dos Clamores do lote — `GemasPoe.impelidosDaGema`)
  [/^Impele (?:os próximos|o próximo) \d+ Ataques?\b/i, /^(Infernal_Cry|Battlemages_Cry|Rallying_Cry)$/],
  [/^Causa [\d.]+ a [\d.]+ de Dano de Raio$/i, /^Tempest_Shield$/], [/^Ricocheteia \+?\d+ Vezes$/i, /^Tempest_Shield$/],
  // (o Cajado Impregnado: a duração da onda — o PoB a usa só no tempo da onda; a conta é a de um acerto)
  [/^Duração base é de [\d.]+ segundos?$/i, /^Mana-Infused_Staff$/], [/^\+[\d.]+ segundos à duração base$/i, /^Mana-Infused_Staff$/],
];
export const ehLinhaGBD = (slug, l) => { const t = norm(l); return FEITAS.some(([re, s]) => s.test(slug) && re.test(t)); };
/**
 * O que a mecânica das gemas do lote ainda não faz (vai nos motivos do status — `GemasPoe.avaliarNoJogo`): o que precisa de decisão do dono ou de outro lote.
 */
// (as linhas que ficam de fora vão como "efeito não simulado: <linha>": a contagem do Poder dos ALIADOS do Clamor de Reunião — quanto vale cada aliado não tem
// número no PoB nem no poedb, decisão do dono —, o buff dele nos lacaios, o Mago de Batalha como suporte das magias e os Guerreiros Ilusórios do Clamor do General)
export const MOTIVOS_GBD = {};
/** As gemas do lote que têm o efeito pelo uso (não pelo buff da ficha): o status não diz "nenhum efeito do buff". */
export const SEM_AF_NO_BUFF = new Set(['Arcane_Cloak', 'Pact_of_KTash', 'Righteous_Fire_of_Arcane_Devotion', 'Vaal_Righteous_Fire', 'Vaal_Immortal_Call', 'Steelskin', 'Molten_Shell', 'Vaal_Molten_Shell', 'Vaal_Arctic_Armour']);
/** (D16) As gemas do lote sem dano próprio cujo efeito é ativar as outras: a Runa do Arcanista (as magias ligadas a ela). */
export const EFEITO_SEM_DANO = new Set(['Arcanist_Brand']);
/** As gemas do lote cuja duração é a do PoE (sem o piso de 2 s dos buffs do jogo): as Guardas e o Fogo Justo Vaal. */
export const DURACAO_EXATA = new Set(['Steelskin', 'Molten_Shell', 'Vaal_Molten_Shell', 'Arcane_Cloak', 'Immortal_Call', 'Vaal_Immortal_Call', 'Vaal_Arctic_Armour', 'Vaal_Righteous_Fire']);
/**
 * As gemas do lote que ficam LIGADAS até desligar — o segundo clique com ela ligada a desliga, como no PoE (o Fogo Justo da Devoção: "O efeito termina quando você chegar a
 * 1 de vida"; revisão G, dono 26/10: + o Fogo Justo comum — a queima dele fica para a sessão das auras). O Fogo Justo Vaal não: é um buff de duração (4 s), e o uso de novo
 * enquanto ativo é recusado.
 */
export const LIGADAS_GBD = new Set(['Righteous_Fire_of_Arcane_Devotion', 'Righteous_Fire']);
