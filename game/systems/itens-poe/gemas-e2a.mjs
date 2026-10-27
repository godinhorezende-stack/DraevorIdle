// (lote E2A, 26/10) As linhas que faltavam nas gemas ATIVAS de LACAIO (as mais difíceis da fila — o dono: "deixar essas gemas iguais ao Path of Exile 1"). A fonte é o
// PoB (Skills/act_int.lua, act_str.lua; Minions.lua; Skills/minion.lua; Modules/Data.lua e CalcPerform.lua) e, na falta dele, o poedb (`gemas-poe.json`). Aqui só as
// regras de leitura e as contas puras (sem a caçada): quem invoca (`lacaios-poe.oQueInvoca`, `acoes.invocarLacaios`), o tique dos lacaios (`cacadas`) e o status
// (`gemas-poe.avaliarNoJogo`) as usam.
//
//   - as OFERENDAS: a Carnal ("Aumenta a Velocidade de Conjuração / de Movimento dos Lacaios em X%" — a conjuração já valia no lacaio que conjura; o movimento passa a
//     valer no passo do lacaio, `lacaios-poe.movimentoDoLacaio`) e a Óssea ("+X% de Chance de Bloquear Dano Mágico" — o bloqueio da magia do bicho no lacaio,
//     `cacadas`, que já valia: só não era lido pelo status);
//   - os ESPECTROS (act_int.lua:14998-15160): "+X% de todas Resistências Elementais" (minion_elemental_resistance_%, o nível + a qualidade) nas três do espectro;
//     "X% mais Velocidade de Movimento dos Lacaios" (active_skill_minion_movement_velocity_+%_final — o compilador o lia e ninguém o usava; vale também na
//     Relíquia Sagrada) no passo; o da Transitoriedade: a duração-base de 30 s (spectres_have_base_duration_ms, × a Duração dos Lacaios), "Espectros não viajam
//     entre as Áreas" (no jogo nenhum lacaio passa de uma caçada a outra), a Chance de Crítico aumentada (minion_critical_strike_chance_+%) — no golpe e nas
//     MAGIAS do espectro (as do monstro erguido, que até aqui não rolavam crítico) — e o "Máximo de N Espectros Erguidos" da qualidade (0,05 por %);
//   - o CEIFADOR DA EVISCERAÇÃO: "X% de chance de agravar sangramento em alvos atingidos com ataques" (minion_aggravate_bleeding_on_attack_hit_chance_%, 2 por %
//     da qualidade): o acerto de ataque do Ceifador agrava os Sangramentos do alvo (`combate/dot.agravar`);
//   - os ZUMBIS: o da Pancada — "Ataque de Impacto … Efeito em Área aumentado em X%" e "… Velocidade de Recarga aumentada em X%" (zombie_slam_area_of_effect_+% e
//     zombie_slam_cooldown_speed_+%, só na Pancada — `SkillId ZombieSlam`) no golpe em área do zumbi; a coluna "…aumentada em %" (sem número) é a mesma do poedb; o
//     da Queda (act_int.lua:15332; minion.lua:750 GAZombieCorpseGroundImpact): o zumbi CAI no alvo, acerta a área dele uma vez (2,5× o golpe — baseMultiplier 2.5 —,
//     sempre acerta) e morre (o "não sobrevive ao impacto"); o tempo até a queda é o hitTimeOverride do PoB (1 s ÷ a velocidade de convocação — 1); "+200 ao
//     número máximo de Zumbis" (base_number_of_zombies_allowed 200 — o máximo da gema); "Não requer um cadáver"; "Lacaios têm X% de chance de causar Dano
//     Dobrado" (minion_chance_to_deal_double_damage_%, 0,75 por % — a qualidade);
//   - o GOLPE SAGRADO (act_str.lua:6207): "+X metros para o alcance do golpe corpo a corpo do lacaio" (minion_melee_range_+, o nível + a qualidade): o alcance do
//     Armamento em casas (1 casa = 2 m; a fração é a chance de uma casa a mais, sorteada ao invocar — a mesma conversão das áreas); o "Lacaios causam X% menos
//     Dano" do poedb tem o sinal errado do nível 7 em diante (o PoB: active_skill_minion_damage_+%_final de −60 no 1 a +168 no 20 — `HOLY_STRIKE_MAIS_DANO`);
//     a conversão de 50% do Físico em Raio vale no Armamento (o golpe do jogador ainda não existe: a linha segue);
//   - as SENTINELAS ASCENDIDAS (a Absolvição Vaal e a Dominação Vaal — vaal_upgrade_minion_damage_+%_final 300 e …damage_taken_+%_final −70): 300% mais Dano no
//     golpe e 70% menos Dano sofrido; o máximo da Dominação Vaal é 3 (o poedb junta o "não conta para os limites normais" na mesma linha e o leitor não o via);
//   - os ROBÔS RASTEJANTES (act_int.lua:20085; CalcPerform.lua:1360-1395; Data.lua:418-424): DOIS robôs (o Resfriante e o Eletrizante — "Máximo de 1 … de cada
//     tipo"), que não atacam (non_attacking) nem sofrem dano; a aura de cada um (raio 30 = 3 m) Resfria ou Eletriza os inimigos nela, sem acerto, com o efeito
//     de base do PoE (Resfriamento 10%, Eletrização 15%) × (1 + o "Efeito Resfriante / Eletrizante aumentado" da gema); e "10% mais Dano de Armadilhas e Minas"
//     para você enquanto eles existem (skitterbots_trap_mine_damage_+%_final — o buff da habilidade);
//   - a BALISTA DE CERCO DE TRARTHUS (o TOTEM — act_dex.lua:14115): um ANEL de balistas em volta do local mirado (active_skill_summon_X_totems_in_ring_override: 4 + o do
//     nível — 8 no 20; o poedb escreve "Invoca 1 Totens" em todo nível), que disparam UMA vez no local e desaparecem (totem_fire_in_formation / totemFireOnce); o
//     "Alcance do Posicionamento de Totens aumentado em 300%" (totem_placement_range_+%) põe o anel no alvo; o "X% mais Dano de Projétil" da qualidade
//     (active_skill_projectile_damage_+%_final) é linha local do uso (`linhas-das-gemas`, `mais_dano@projetil`);
//   - a TROCA DE CORPOS DO SACRIFÍCIO (act_int.lua:2391): a Troca de Corpos (o lote B3 — `acoes`: a explosão nos dois lugares, o Fogo base + 4% da sua Vida máxima, o raio
//     14 + o do nível) com um LACAIO danificável no lugar do cadáver — sem alvo, os lacaios têm a prioridade sobre os inimigos —: o lacaio é destruído numa explosão de
//     Fogo base igual a X% da Vida máxima dele (skill_minion_explosion_life_%, 0,25 por % da qualidade), com 300% mais Área só nela
//     (corpse_warp_area_of_effect_+%_final_when_consuming_minion); o "50% menos Dano de Afecções" (active_skill_ailment_damage_+%_final) vale na gema toda — ela passa a
//     ser de ÁREA (como a Troca de Corpos), não de lacaio (o tipo Minion do poedb a jogava nos lacaios, e ela não invocava nada).
const N = String.raw`([\d.]+)`;
const norm = (t) => String(t ?? '').replace(/(\d)%/g, '$1 %').replace(/[ㅤ ]/g, ' ').replace(/\s+/g, ' ').trim();
const somar = (linhas, re, g = 1) => (linhas ?? []).reduce((n, l) => n + (Number(re.exec(norm(l))?.[g]) || 0), 0);
const achar = (linhas, re, g = 1) => { for (const l of linhas ?? []) { const m = re.exec(norm(l)); if (m) return Number(m[g]); } return null; };
const tem = (linhas, re) => (linhas ?? []).some((l) => re.test(norm(l)));

export const RE = Object.freeze({
  // as Oferendas (os textos do nível — `lacaios-poe.bonusDaOferenda` já os lia)
  conjOferenda: new RegExp(`^Aumenta a Velocidade de Conjuração dos Lacaios em ${N} %$`, 'i'),
  movOferenda: new RegExp(`^Aumenta a Velocidade de Movimento dos Lacaios em ${N} %$`, 'i'),
  bloqueioMagicoOferenda: new RegExp(`^Concede aos Lacaios \\+${N} % de Chance de Bloquear Dano Mágico$`, 'i'),
  // os Espectros
  resElem: new RegExp(`^Lacaios possuem \\+${N} % de todas Resistências Elementais$`, 'i'),
  movMais: new RegExp(`^${N} % mais Velocidade de Movimento dos Lacaios$`, 'i'),
  duracaoEspectro: new RegExp(`^Espectros têm Duração Base de ${N} segundos?(?: Espectros não viajam entre as Áreas)?$`, 'i'),
  critInc: new RegExp(`^Lacaios têm Chance de Acerto Crítico aumentada em ${N} %$`, 'i'),
  maxEspectrosQ: new RegExp(`^Máximo de ${N} Espectros Erguidos$`, 'i'),
  // (lote D1, decisão do dono 27/10) "Velocidade de Movimento dos Lacaios está no Máximo" — o teto do passo (`ESPECTRO.movTetoPct`)
  movMaximo: /^Velocidade de Movimento dos Lacaios está no Máximo$/i,
  // o Ceifador da Evisceração
  agravar: new RegExp(`^Lacaios têm ${N} % de chance de agravar sangramento em alvos atingidos com ataques$`, 'i'),
  // os Zumbis
  impactoArea: new RegExp(`^Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em ${N} %$`, 'i'),
  impactoRecarga: new RegExp(`^Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em ${N} %$`, 'i'),
  impactoRecargaSemNumero: /^Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em ?%$/i,
  maxZumbis: new RegExp(`^\\+${N} ao número máximo de Zumbis$`, 'i'),
  semCadaver: /^Não requer um cadáver$/i,
  dobrado: new RegExp(`^Lacaios têm ${N} % de chance de causar Dano Dobrado$`, 'i'),
  // o Golpe Sagrado
  alcance: new RegExp(`^\\+${N} metros para o alcance do golpe corpo a corpo do lacaio$`, 'i'),
  conversaoRaio: new RegExp(`^Este ataque e lacaios convertem ${N} % do dano físico em dano elétrico$`, 'i'),
  menosDano: new RegExp(`^Lacaios causam ${N} % menos Dano$`, 'i'),
  maxArmamentos: /^Máximo de (\d+) Armamentos Sagrados$/i,
  // as Sentinelas Ascendidas
  ascMais: new RegExp(`^Sentinelas Ascendidos causam ${N} % mais Dano$`, 'i'),
  ascMenos: new RegExp(`^Sentinelas Ascendidos sofrem ${N} % menos Dano$`, 'i'),
  ascMax: /^Máximo de (\d+) Sentinelas Ascendidos\b/i,
  // os Robôs Rastejantes
  resfriante: new RegExp(`^Lacaios tem Efeito Resfriante aumentado em ${N} %$`, 'i'),
  eletrizante: new RegExp(`^Lacaios têm Efeito Eletrizante aumentado em ${N} %$`, 'i'),
  maisArmadilhaMina: new RegExp(`^Robôs Rastejantes concedem ${N} % mais Dano de Armadilhas e Minas$`, 'i'),
  // a Balista de Cerco de Trarthus
  posicionamento: new RegExp(`^Alcance do Posicionamento de Totens aumentado em ${N} %$`, 'i'),
  anel: /^Invoca (\d+) Totens de Balista em círculo que usam esta habilidade$/i,
  desaparecem: /^Após atacar, os totens desaparecem$/i,
});

/** A Balista de Cerco de Trarthus: o "anel" do PoB por nível — 4 (constante) + o do nível (act_dex.lua:14160-14199). */
export const ANEL_DE_TRARTHUS = Object.freeze([0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 8].map((v) => 4 + v));
/**
 * O ANEL de totens da gema (a Balista de Cerco de Trarthus): `{ n, posicionamentoPct, umaVez }` — quantos por uso (o do PoB no nível), o "Alcance do Posicionamento" e o
 * "Após atacar, os totens desaparecem" — ou null.
 */
export function anelDoTotem(slug, linhas = [], nivel = 1) {
  if (slug !== 'Siege_Ballista_of_Trarthus' || !tem(linhas, RE.anel)) return null;
  const n = ANEL_DE_TRARTHUS[Math.max(1, Math.min(ANEL_DE_TRARTHUS.length, Math.round(nivel) || 1)) - 1];
  return { n, posicionamentoPct: somar(linhas, RE.posicionamento), umaVez: tem(linhas, RE.desaparecem) };
}
/** As casas do anel em volta de `centro` (as andáveis e livres a 1 casa — `ocupadas`: "x,y" dos bichos —, as mais perto de `de` primeiro; sem nenhuma, o centro). */
export function casasDoAnel(centro, de, andavel = null, ocupadas = null) {
  const cs = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) cs.push({ x: centro.x + dx, y: centro.y + dy });
  const livres = cs.filter((c) => (!andavel || andavel.has(`${c.x},${c.y}`)) && !ocupadas?.has(`${c.x},${c.y}`)).sort((a, b) => Math.max(Math.abs(a.x - de.x), Math.abs(a.y - de.y)) - Math.max(Math.abs(b.x - de.x), Math.abs(b.y - de.y)));
  return livres.length ? livres : [{ x: centro.x, y: centro.y }];
}

/**
 * (lote D1, decisão do dono 27/10) os Espectros: "Velocidade de Movimento dos Lacaios está no Máximo" é o movement_velocity_cap −53 do PoB sobre a base 128
 * (`Misc.lua`) — o teto de +75% no aumento total do passo do lacaio (128 − 53).
 */
export const ESPECTRO = Object.freeze({ movTetoPct: 128 - 53 });
/** O Golpe Sagrado: o active_skill_minion_damage_+%_final do PoB por nível (1 a 40 — act_str.lua:6260-6299). */
export const HOLY_STRIKE_MAIS_DANO = Object.freeze([-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288, 294, 300, 306, 312, 318, 324, 330, 336, 342, 348]);
/** A Queda do Zumbi (o PoB): 2,5× o golpe (baseMultiplier), 1 s até o impacto (hitTimeOverride = 1 ÷ a velocidade de convocação). */
export const QUEDA = Object.freeze({ mult: 2.5, ms: 1000 });
/** Os Robôs Rastejantes (o PoB): a aura de 3 m (radius 30); o efeito de base do Resfriamento (10%, até 30) e da Eletrização (15%, até 50) sem acerto. */
export const ROBOS = Object.freeze({ raioM: 3, resfriamento: { base: 10, maximo: 30 }, eletrizacao: { base: 15, maximo: 50 } });

/**
 * O que o lote faz no lacaio da gema `slug` (`linhas`: as do nível; `daQualidade`: as da qualidade; `nivel`: o da gema). Só o que a gema tem:
 * `{ resElemPct, movMaisPct, duracaoMs, critIncPct, maximoExtra, agravarPct, impactoAreaPct, impactoRecargaPct, maximoBase, nome, danoDobradoPct, queda, alcanceM,
 *    conversaoRaioPct, correcaoMaisDano, maisDanoPct, menosDanoRecebidoPct, robos }`.
 */
export function doLacaioE2a(slug, linhas = [], daQualidade = [], nivel = 1) {
  const s = String(slug ?? '');
  const todas = [...(linhas ?? []), ...(daQualidade ?? [])];
  const r = {};
  if (/^Raise_Spectre/.test(s)) {
    const res = somar(todas, RE.resElem);
    if (res) r.resElemPct = res;
    const dur = achar(linhas, RE.duracaoEspectro);
    if (dur > 0) r.duracaoMs = Math.round(dur * 1000);
    const crit = somar(linhas, RE.critInc);
    if (crit) r.critIncPct = crit;
    const extra = Math.floor(somar(daQualidade, RE.maxEspectrosQ) + 1e-9);
    if (extra) r.maximoExtra = extra;
    // (lote D1, decisão do dono 27/10) o teto do passo: +75% no aumento total
    if (tem(linhas, RE.movMaximo)) r.movTetoPct = ESPECTRO.movTetoPct;
  }
  // (o "X% mais Velocidade de Movimento dos Lacaios" — o Espectro e a Relíquia Sagrada)
  const movMais = somar(linhas, RE.movMais);
  if (movMais) r.movMaisPct = movMais;
  if (s === 'Summon_Reaper_of_Eviscerating') {
    const a = somar(todas, RE.agravar);
    if (a) r.agravarPct = a;
  }
  if (s === 'Raise_Zombie_of_Slamming') {
    const area = somar(linhas, RE.impactoArea);
    const rec = somar(linhas, RE.impactoRecarga);
    if (area) r.impactoAreaPct = area;
    if (rec) r.impactoRecargaPct = rec;
  }
  if (s === 'Raise_Zombie_of_Falling') {
    r.maximoBase = Math.floor(somar(linhas, RE.maxZumbis)) || 200;
    r.nome = 'Zumbi';
    r.queda = { ...QUEDA };
    const d = somar(todas, RE.dobrado);
    if (d) r.danoDobradoPct = d;
  }
  if (s === 'Holy_Strike') {
    // (o "Máximo de N Armamentos Sagrados" — base_holy_strike_maximum_number_of_animated_weapons — não tem o "Convocados" que o leitor procura: valia 1)
    const max = achar(linhas, RE.maxArmamentos);
    if (max > 0) { r.maximoBase = max; r.nome = 'Armamento Sagrado'; }
    const m = somar(todas, RE.alcance);
    if (m) r.alcanceM = m;
    const c = achar(linhas, RE.conversaoRaio);
    if (c > 0) r.conversaoRaioPct = c;
    // (o leitor de `oQueInvoca` tirou o número do poedb como "menos"; o certo é o do PoB no nível)
    const lido = somar(linhas, RE.menosDano);
    const n = Math.max(1, Math.min(HOLY_STRIKE_MAIS_DANO.length, Math.round(nivel) || 1));
    r.correcaoMaisDano = lido + HOLY_STRIKE_MAIS_DANO[n - 1];
  }
  if (/^Vaal_(?:Absolution|Domination)$/.test(s)) {
    const mais = somar(linhas, RE.ascMais);
    const menos = somar(linhas, RE.ascMenos);
    if (mais) r.maisDanoPct = mais;
    if (menos) r.menosDanoRecebidoPct = menos;
    const max = achar(linhas, RE.ascMax);
    if (max > 0) r.maximoBase = max;
  }
  if (s === 'Summon_Skitterbots') {
    const fr = somar(linhas, RE.resfriante);
    const el = somar(linhas, RE.eletrizante);
    r.robos = {
      raioM: ROBOS.raioM,
      resfriarPct: Math.min(ROBOS.resfriamento.maximo, ROBOS.resfriamento.base * (1 + fr / 100)),
      eletrizarPct: Math.min(ROBOS.eletrizacao.maximo, ROBOS.eletrizacao.base * (1 + el / 100)),
      maisArmadilhaMinaPct: somar(linhas, RE.maisArmadilhaMina),
    };
  }
  return r;
}

/** O arquétipo próprio das gemas do lote (o classificador as via como lacaio pelo tipo Minion). */
export const ARQUETIPO_E2A = Object.freeze({ Bodyswap_of_Sacrifice: 'area' });
const LINHA_SAC_DANO = /^Esta Magia causa ([\d.]+) a ([\d.]+) , mais ([\d.]+) % da sua Vida Máxima, como Dano de Fogo base$/i;
const LINHA_SAC_LACAIO = /^Explosões causam Dano de Fogo base igual a ([\d.]+) % da Vida máxima do Lacaio$/i;
const LINHA_SAC_AREA = /^([\d.]+) % mais Área de Efeito se Consumindo um Lacaio$/i;
/** O raio-base da Troca de Corpos (o PoB: radius 14 = 1,4 m — o mesmo de `GemasB3.TROCA_DE_CORPOS`). */
export const SACRIFICIO = Object.freeze({ raioBaseM: 1.4, lacaioPertoCasas: 3 });
/**
 * A TROCA DE CORPOS DO SACRIFÍCIO: `{ min, max, vidaPct, lacaio: true, lacaioPct, areaLacaioMaisPct, raioM }` (o mesmo molde da Troca de Corpos — `acoes` usa o `min/max/vidaPct`
 * na explosão da magia e o `lacaio` no lugar do cadáver), ou null.
 */
export function trocaDoSacrificio(slug, linhas = [], daQualidade = [], stats = {}) {
  if (slug !== 'Bodyswap_of_Sacrifice') return null;
  for (const l of linhas ?? []) {
    const m = LINHA_SAC_DANO.exec(norm(l));
    if (!m) continue;
    return {
      min: Number(m[1]), max: Number(m[2]), vidaPct: Number(m[3]), lacaio: true, lacaioPct: somar([...linhas, ...daQualidade], LINHA_SAC_LACAIO), areaLacaioMaisPct: achar(linhas, LINHA_SAC_AREA) ?? 0,
      raioM: SACRIFICIO.raioBaseM + (stats.raioBonus ?? 0),
    };
  }
  return null;
}
/** O lacaio que a Troca de Corpos do Sacrifício consome: o danificável (não o totem, o intocável, o mercenário, o que ainda cai) a até `alcance` de você, o mais perto de `ponto`. */
export function lacaioDoSacrificio(lacaios, voce, ponto, alcance) {
  const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return (lacaios ?? []).filter((l) => l?.hp > 0 && l.tipo === 'lacaio' && !l.intocavel && !l.mercenario && !l.queda && d(voce, l) <= alcance).sort((a, b) => d(a, ponto) - d(b, ponto))[0] ?? null;
}

/** O passo do lacaio com o "mais" e o teto: o aumento total (%) = (1 + aumentado) × (1 + mais) − 1; (lote D1) com `tetoPct`, no máximo o teto. */
export const movimentoComMais = (aumentadoPct, maisPct, tetoPct = null) => {
  const total = ((1 + (Number(aumentadoPct) || 0) / 100) * (1 + (Number(maisPct) || 0) / 100) - 1) * 100;
  return tetoPct != null ? Math.min(Number(tetoPct), total) : total;
};

/**
 * Os ROBÔS RASTEJANTES na invocação: o i-ésimo robô (0 = o Resfriante, 1 = o Eletrizante) — `{ elemento, nome, auraNaoDano: { tipo, pct, raioM }, afDono }` (o buff
 * de "mais Dano de Armadilhas e Minas" vai num só: é o da habilidade, não de cada robô).
 */
export function roboDaInvocacao(robos, i) {
  if (!robos) return null;
  const frio = i % 2 === 0;
  return {
    elemento: frio ? 'ice' : 'energy', nome: frio ? 'Robô Rastejante Resfriante' : 'Robô Rastejante Eletrizante',
    auraNaoDano: { tipo: frio ? 'resfriar' : 'eletrizar', pct: frio ? robos.resfriarPct : robos.eletrizarPct, raioM: robos.raioM },
    afDono: frio && robos.maisArmadilhaMinaPct > 0 ? { 'mais_dano@armadilha': robos.maisArmadilhaMinaPct, 'mais_dano@mina': robos.maisArmadilhaMinaPct } : null,
  };
}

/**
 * A Eletrização sem acerto (a aura do Robô Eletrizante) no bicho: vale a mais forte e não encurta a que já corre (a mesma regra do acerto — `afeccoes`); a mesma
 * força só renova o fim. Devolve se pôs/renovou.
 */
export function eletrizarNaAura(bicho, pct, ate, agora) {
  if (!bicho || bicho.imuneChoque || !(pct > 0)) return false;
  const e = (bicho.estados ??= {});
  const atual = e.chocado;
  if (atual && atual.ate > agora && atual.pct > pct) return false;
  if (atual && atual.ate > agora && atual.pct === pct) { atual.ate = Math.max(atual.ate, ate); return true; }
  e.chocado = { ate, pct, dur: ate - agora };
  return true;
}

/** As casas do raio em metros (1 casa = 2 m; a fração é a chance de uma a mais — a conversão das áreas). */
export const casasDosMetros = (m, rng = Math.random) => Math.floor((Number(m) || 0) / 2) + (rng() < ((Number(m) || 0) / 2) % 1 ? 1 : 0);

// ---- o status ----
/**
 * A linha que o lote E2A faz (sai de "efeito não simulado"). Só na gema de LACAIO (`arquetipo`): é ela que invoca pelo `oQueInvoca` — e as do anel na gema de
 * TOTEM da Balista de Cerco de Trarthus.
 */
export function ehLinhaE2a(slug, l, arquetipo = 'lacaio') {
  const s = String(slug ?? '');
  const t = norm(l);
  // (a Troca de Corpos do Sacrifício, de área)
  if (s === 'Bodyswap_of_Sacrifice') return arquetipo === 'area' && [LINHA_SAC_DANO, LINHA_SAC_LACAIO, LINHA_SAC_AREA].some((re) => re.test(t));
  // (o totem: a Balista de Cerco de Trarthus)
  if (arquetipo === 'totem') return s === 'Siege_Ballista_of_Trarthus' && [RE.posicionamento, RE.anel, RE.desaparecem].some((re) => re.test(t));
  if (arquetipo !== 'lacaio') return false;
  if (/^(?:Bone|Flesh)_Offering$/.test(s) && [RE.conjOferenda, RE.movOferenda, RE.bloqueioMagicoOferenda].some((re) => re.test(t))) return true;
  if (/^Raise_Spectre/.test(s) && [RE.resElem, RE.critInc, RE.maxEspectrosQ, RE.movMaximo].some((re) => re.test(t))) return true;
  if (s === 'Raise_Spectre_of_Transience' && RE.duracaoEspectro.test(t)) return true;
  if (s === 'Summon_Reaper_of_Eviscerating' && RE.agravar.test(t)) return true;
  if (s === 'Raise_Zombie_of_Slamming' && [RE.impactoArea, RE.impactoRecarga, RE.impactoRecargaSemNumero].some((re) => re.test(t))) return true;
  if (s === 'Raise_Zombie_of_Falling' && [RE.maxZumbis, RE.semCadaver, RE.dobrado].some((re) => re.test(t))) return true;
  if (s === 'Holy_Strike' && RE.alcance.test(t)) return true;
  if (/^Vaal_(?:Absolution|Domination)$/.test(s) && [RE.ascMais, RE.ascMenos].some((re) => re.test(t))) return true;
  if (s === 'Summon_Skitterbots' && [RE.resfriante, RE.eletrizante, RE.maisArmadilhaMina].some((re) => re.test(t))) return true;
  return false;
}
