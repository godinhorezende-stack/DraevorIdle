// (lote E1a, 26/10) As linhas que faltavam nas gemas ATIVAS de LACAIO e de TOTEM com 1 ou 2 linhas de fora (o dono: "deixar essas gemas iguais ao Path of
// Exile 1"). A fonte é o PoB (Skills/act_int.lua, act_str.lua, act_dex.lua; Minions.lua) e, na falta dele, o poedb (`gemas-poe.json`). Aqui só as regras
// de leitura (puras, sem estado): quem invoca (`lacaios-poe.oQueInvoca`), o tique dos lacaios (`cacadas`) e o status (`gemas-poe.avaliarNoJogo`) as usam.
//
//   - a QUALIDADE do lacaio (as linhas da qualidade — o lacaio só lia as do nível):
//       "+N ao Máximo de Zumbis / Esqueletos / Armas Animadas" (`base_number_of_*_allowed` 0,05 / 0,1 por % — o PoB): o máximo, ⌊N⌋;
//       "Velocidade de Movimento dos Lacaios aumentada em X%" (o Guardião Animado): o passo a mais do lacaio (`poe.movimentoPct`);
//       "Lacaios têm Recuperação da Recarga aumentada em X%" (as variantes das Hordas, o Golpe Dominador, a Relíquia da Convicção): a recarga das
//         habilidades dele (`poe.recargaPct` — `recargaDoLacaio` e o golpe em área a cada N acertos, `cacadas`);
//       "Efeito do Buff aumentado em X%" (os Golens — `golem_buff_effect_+%`): o que o golem dá a você (`GemasPoe.adds`, com o das peças);
//       "Lacaios Regeneram X% de Vida por segundo" (o Golem da Carniça do Saque): a regeneração dele (`poe.regenPct`);
//       "X% de chance de convocar um Lacaio extra" (o Espírito Furioso): um a mais no uso (`acoes.invocarLacaios`);
//       "Efeito da Oferenda aumentado em X%" (as Oferendas — `offering_spells_effect_+%`): o bônus da Oferenda × (1 + X%).
//   - o NÍVEL do lacaio:
//       "Lacaios têm X% menos Vida Máxima" (o Golem de Pedra da Proteção): a vida × (1 − X%);
//       "Anima até N Armas" (a Animar Arma Vaal): quantas por uso;
//       "Ceifador faz com que seus Lacaios Não-Ceifadores causem X% menos Dano / tenham X% menos Vida Máxima" (`active_skill_non_reaper_minion_*_+%_final`,
//         um buff enquanto o Ceifador vive — act_int.lua:19516-19521): o golpe e a vida dos OUTROS lacaios (não os totens, que não são lacaios no PoE);
//       "Golens causam X% mais Dano por Lacaio Não-Golem próximo deles, até Y%" (o Golem da Carniça — só ele: `type = "SummonedCarrionGolem"`,
//         act_int.lua:18521): "próximo" é o de sempre do jogo, a até 4 casas (`condicoes-poe`: "por Inimigo próximo", a até 4).
//   - os TOTENS: a Velocidade de Projéteis da gema de totem (o Flamejante Sagrado, a Balista Estilhaçante) — o tiro do totem sai pelo caminho do SEU uso
//     desde o lote G20a (`Acoes.usarComoTotem` → `velocidadeDoProjetil`), então a linha vale como numa gema de projétil (`ehLinhaDeAlvos`).
const N = String.raw`([\d.]+)`;
const somar = (linhas, re) => (linhas ?? []).reduce((n, l) => n + (Number(re.exec(String(l))?.[1]) || 0), 0);

const RE = {
  maximo: new RegExp(`^\\+${N} ao Máximo de (?:Zumbis|Esqueletos|Armas Animadas)`, 'i'),
  movimento: new RegExp(`^Velocidade de Movimento dos Lacaios aumentada em ${N} ?%$`, 'i'),
  recarga: new RegExp(`^Lacaios têm Recuperação da Recarga aumentada em ${N} ?%$`, 'i'),
  efeitoDoBuff: new RegExp(`^Efeito do Buff aumentado em ${N} ?%$`, 'i'),
  regen: new RegExp(`^Lacaios Regeneram ${N} ?% de Vida por segundo$`, 'i'),
  extra: new RegExp(`^${N} ?% de chance de convocar um Lacaio extra$`, 'i'),
  oferenda: new RegExp(`^Efeito da Oferenda aumentado em ${N} ?%$`, 'i'),
  menosVida: new RegExp(`^Lacaios têm ${N} ?% menos Vida Máxima$`, 'i'),
  animaAte: new RegExp(`^Anima até ${N} Armas$`, 'i'),
  // (+ o texto do Ceifador dos Revenantes: "Ceifadores fazem com que seus Lacaios não-Ceifadores tenham X% menos Dano")
  ceifadorDano: new RegExp(`^Ceifador(?:es)? fa(?:z|zem) com que seus Lacaios Não-Ceifadores (?:causem|tenham) ${N} ?% menos Dano$`, 'i'),
  ceifadorVida: new RegExp(`^Ceifador(?:es)? fa(?:z|zem) com que seus Lacaios Não-Ceifadores tenham ${N} ?% menos Vida Máxima$`, 'i'),
  porNaoGolem: new RegExp(`^Golens causam ${N} ?% mais Dano por Lacaio Não-Golem próximo deles, até ${N} ?%$`, 'i'),
  // (as decisões do dono, 26/10)
  protecao: new RegExp(`^Golens concedem ${N} ?% do Dano Corpo a Corpo sofrido na Vida do seu Golem de Pedra antes da sua$`, 'i'),
  dominacao: new RegExp(`^${N} ?% de chance de invocar uma Sentinela da Dominação normal ao atingir um monstro raro ou único$`, 'i'),
  porCadaver: new RegExp(`^${N} segundos? adicionais de Duração Base por Cadáver extra consumido$`, 'i'),
  sangramento: new RegExp(`^Lacaios causam ${N} ?% mais Dano com Sangramento$`, 'i'),
};

/**
 * A qualidade do lacaio (as linhas da qualidade da gema — e as do nível com o mesmo texto: o "Velocidade de Movimento dos Lacaios aumentada" dos Robôs
 * Rastejantes vem no nível): `{ maximo, movimentoPct, recargaPct, efeitoDoBuffPct, regenPct, chanceDeLacaioExtra, efeitoDaOferendaPct }`.
 */
export function daQualidadeDoLacaio(linhasQ = []) {
  return {
    maximo: Math.floor(somar(linhasQ, RE.maximo) + 1e-9),
    movimentoPct: somar(linhasQ, RE.movimento),
    recargaPct: somar(linhasQ, RE.recarga),
    efeitoDoBuffPct: somar(linhasQ, RE.efeitoDoBuff),
    regenPct: somar(linhasQ, RE.regen),
    chanceDeLacaioExtra: somar(linhasQ, RE.extra),
    efeitoDaOferendaPct: somar(linhasQ, RE.oferenda),
  };
}

/**
 * O nível do lacaio (as linhas do nível): `{ menosVidaPct, animaAte, ceifador, maisPorNaoGolem, protecaoPct, chanceRaroUnico, porCadaverMs, maisSangramentoPct }`
 * (null/0 nos que a gema não tem). As decisões do dono (26/10):
 *   - o Golem de Pedra da Proteção: "X% do Dano Corpo a Corpo sofrido na Vida do seu Golem de Pedra antes da sua" (`stone_golem_grants_melee_damage_removed_from_
 *     stone_golem_before_life_or_es_%` — antes do Escudo de Energia e da Vida; é buff do golem: o Efeito do Buff vale);
 *   - o Golpe Dominador: "X% de chance de invocar uma Sentinela normal ao atingir um monstro raro ou único" — com o alvo do uso Raro ou Único, a chance de uma a mais;
 *   - as Oferendas: "N segundos adicionais de Duração Base por Cadáver extra consumido" — a Oferenda consome os cadáveres a até 4 casas (sem cadáver, não sai);
 *   - o Ceifador: "Lacaios causam X% mais Dano com Sangramento" só no Sangramento (antes valia no golpe inteiro).
 */
export function doNivelDoLacaio(linhas = []) {
  const ceifadorDano = somar(linhas, RE.ceifadorDano);
  const ceifadorVida = somar(linhas, RE.ceifadorVida);
  const g = (linhas ?? []).map((l) => RE.porNaoGolem.exec(String(l))).find(Boolean);
  return {
    menosVidaPct: somar(linhas, RE.menosVida),
    animaAte: Math.floor(somar(linhas, RE.animaAte)) || null,
    ceifador: ceifadorDano || ceifadorVida ? { menosDanoPct: ceifadorDano, menosVidaPct: ceifadorVida } : null,
    maisPorNaoGolem: g ? { pct: Number(g[1]) || 0, max: Number(g[2]) || 0 } : null,
    protecaoPct: somar(linhas, RE.protecao),
    chanceRaroUnico: somar(linhas, RE.dominacao),
    porCadaverMs: Math.round(somar(linhas, RE.porCadaver) * 1000),
    maisSangramentoPct: somar(linhas, RE.sangramento),
  };
}

/** O monstro Raro ou Único (o Chefe também) — o mesmo critério das outras gemas (`GemasPR1.raroOuUnico`). */
export const raroOuUnico = (alvo) => !!alvo && (/raro|unico/.test(String(alvo.raridade ?? alvo.raridadePoe ?? '')) || !!alvo.boss || !!alvo.chefe);
/** O Golpe Dominador: uma Sentinela a mais neste uso? (o alvo Raro ou Único e a chance da gema) */
export const sentinelaAMais = (q, alvo, rng = Math.random) => (q?.chanceRaroUnico > 0 && raroOuUnico(alvo) && rng() * 100 < q.chanceRaroUnico ? 1 : 0);

/** As Oferendas consomem os cadáveres a até 4 casas de você (no mesmo andar). */
export const CASAS_DA_OFERENDA = 4;
export function cadaveresDaOferenda(hunt) {
  const p = hunt?.pos;
  if (!p) return [];
  return (hunt.cadaveres ?? []).filter((c) => (c.z == null || c.z === (hunt.z ?? 0)) && Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= CASAS_DA_OFERENDA);
}
/** A duração da Oferenda com `n` cadáveres consumidos: a base + N s por cadáver EXTRA (o primeiro é o da Oferenda). */
export const duracaoDaOferenda = (q, n) => Math.max(0, q?.duracaoMs ?? 0) + Math.max(0, n - 1) * Math.max(0, q?.porCadaverMs ?? 0);

/**
 * O Golem de Pedra da Proteção: a parte do acerto corpo a corpo que vai para a vida dele antes do seu Escudo de Energia e da sua Vida (até a vida dele).
 * `fatorDe(l)`: o Efeito do Buff do golem (`GemasPoe.fatorDoBuffDoGolem`). Devolve `{ tomou, golem }`.
 */
export function desviarParaOGolemDePedra(hunt, dano, fatorDe = (l) => 1 + (l?.efeitoDoBuffPct ?? 0) / 100) {
  if (!(dano > 0)) return { tomou: 0, golem: null };
  const golem = (hunt?.lacaios ?? []).find((l) => l?.protecaoPct > 0 && l.hp > 0);
  if (!golem) return { tomou: 0, golem: null };
  const tomou = Math.max(0, Math.min(Math.floor(golem.hp), Math.round((dano * Math.min(100, golem.protecaoPct * fatorDe(golem))) / 100)));
  golem.hp -= tomou;
  return { tomou, golem };
}
/**
 * O Golem da Carniça: "Golens concedem X a Y de Dano Físico adicional" vai aos seus lacaios NÃO-golem (o PoB: `MinionModifier` com `SkillType.Golem, neg`) — não
 * a você. O dano físico a mais no golpe do lacaio `l`: a soma dos Golens da Carniça vivos × o Efeito do Buff de cada um. `[min, max]`.
 */
export function danoDoGolemDaCarnica(l, lacaios, fatorDe = (g) => 1 + (g?.efeitoDoBuffPct ?? 0) / 100) {
  if (!l || l.golem || l.tipo !== 'lacaio' || l.mercenario) return [0, 0];
  return (lacaios ?? []).filter((g) => g?.porLacaioFisico && g.hp > 0 && g !== l).reduce(([a, b], g) => [a + g.porLacaioFisico[0] * fatorDe(g), b + g.porLacaioFisico[1] * fatorDe(g)], [0, 0]);
}

/** O bônus da Oferenda com o "Efeito da Oferenda aumentado" (os números × (1 + X%); a condição "se Bloquearam" fica). */
export function oferendaComEfeito(bonus, efeitoPct = 0) {
  if (!bonus || !(efeitoPct > 0)) return bonus;
  const f = 1 + efeitoPct / 100;
  return Object.fromEntries(Object.entries(bonus).map(([k, v]) => [k, typeof v === 'number' ? v * f : v]));
}

// ---- no combate (o tique dos lacaios e o golpe deles) ----
/** O lacaio que o Ceifador afeta: os seus lacaios (não o próprio Ceifador, nem os totens, nem o mercenário — que é um aliado, não um lacaio). */
const afetaPeloCeifador = (l) => !!l && l.tipo === 'lacaio' && !l.ceifador && !l.mercenario;
/** O Ceifador vivo (o maior de cada, se houver mais de um — o PoE deixa só 1). */
function ceifadorVivo(lacaios) {
  return (lacaios ?? []).filter((x) => x?.ceifador && x.hp > 0).reduce((m, x) => ({ menosDanoPct: Math.max(m.menosDanoPct, x.ceifador.menosDanoPct ?? 0), menosVidaPct: Math.max(m.menosVidaPct, x.ceifador.menosVidaPct ?? 0) }), { menosDanoPct: 0, menosVidaPct: 0 });
}
/** O "menos Dano" do Ceifador no golpe deste lacaio (1 sem Ceifador vivo). */
export function fatorDoCeifador(l, lacaios) {
  if (!afetaPeloCeifador(l)) return 1;
  return Math.max(0, 1 - ceifadorVivo(lacaios).menosDanoPct / 100);
}
/**
 * O "menos Vida Máxima" do Ceifador nos outros lacaios, enquanto ele vive: a vida máxima de cada um passa a ser a de base × (1 − X%) (e volta quando ele
 * morre); a vida atual acompanha na mesma proporção. Chamado no tique dos lacaios e na invocação.
 */
export function aplicarCeifador(lacaios) {
  const menos = ceifadorVivo(lacaios).menosVidaPct;
  (lacaios ?? []).forEach((l) => {
    if (!afetaPeloCeifador(l) || !(l.hp > 0)) return;
    const f = Math.max(0.01, 1 - menos / 100);
    const antes = l.fatorDoCeifador ?? 1;
    if (Math.abs(antes - f) < 1e-9) return;
    const base = l.maxHp / antes;
    const proporcao = l.maxHp > 0 ? l.hp / l.maxHp : 1;
    l.maxHp = Math.max(1, Math.round(base * f));
    l.hp = Math.max(1, Math.min(l.maxHp, Math.round(l.maxHp * proporcao)));
    l.fatorDoCeifador = f;
  });
}
/** "Próximo" do lacaio: a até 4 casas (o de sempre do jogo). */
export const CASAS_PROXIMO = 4;
/** O "X% mais Dano por Lacaio Não-Golem próximo, até Y%" do Golem da Carniça (1 nos outros). */
export function fatorPorNaoGolemPerto(l, lacaios) {
  const g = l?.maisPorNaoGolem;
  if (!g?.pct) return 1;
  const perto = (lacaios ?? []).filter((x) => x && x !== l && x.hp > 0 && x.tipo === 'lacaio' && !x.golem && !x.mercenario && Math.max(Math.abs(x.x - l.x), Math.abs(x.y - l.y)) <= CASAS_PROXIMO).length;
  return 1 + Math.min(g.max || Infinity, g.pct * perto) / 100;
}

// ---- o status ----
const LINHAS_DO_LACAIO_E1A = [RE.maximo, RE.movimento, RE.recarga, RE.regen, RE.extra, RE.menosVida, RE.animaAte, RE.ceifadorDano, RE.ceifadorVida, RE.porNaoGolem, RE.dominacao, RE.porCadaver];
/**
 * (dono, 26/10) As linhas que o `LINHA_DE_LACAIO` contava como feitas sem que o jogo as fizesse: a Nova da Relíquia Sagrada (a regeneração que a Habilidade
 * Explosiva dá aos Aliados e aos Lacaios — a Nova não existe no jogo). Voltam a aparecer como "efeito não simulado".
 */
export const ehLinhaDeLacaioNaoFeita = (l) => /^A Habilidade Explosiva da Relíquia Sagrada concede/i.test(String(l ?? ''));
/** (o "Efeito do Buff" só nos Golens — a Relíquia Sagrada tem o dela, da Nova, que ainda não existe) */
const GOLEM = /^Summon_\w*Golem/;
/**
 * A Vaal Convocar Esqueletos: o poedb traz duas colunas que o PoB não tem ("Convoca N Guerreiros Esqueleto" e "+N ao Máximo de Esqueletos Convocados"
 * no NÍVEL — o PoB: 21 soldados, 9 arqueiros, 5 magos e 1 general, máximo 36, no nível 20; act_int.lua:20031-20062). Não valem.
 */
export const COLUNA_MAL_ROTULADA_E1A = { Vaal_Summon_Skeletons: /^Convoca \d+ Guerreiros Esqueleto$|^\+\d+ ao Máximo de Esqueletos Convocados$/i };
/**
 * A linha que o lote E1a faz (sai de "efeito não simulado"). Só na gema de LACAIO (`arquetipo`): é ela que invoca pelo `oQueInvoca` — a Absolvição, por
 * exemplo, é de área e ainda não convoca as Sentinelas, então a "Recuperação da Recarga dos Lacaios" da qualidade dela não vale.
 */
export function ehLinhaE1a(slug, l, arquetipo = 'lacaio') {
  if (arquetipo !== 'lacaio') return false;
  const s = String(slug ?? '');
  const t = String(l ?? '');
  if (COLUNA_MAL_ROTULADA_E1A[s]?.test(t)) return true;
  if (LINHAS_DO_LACAIO_E1A.some((re) => re.test(t))) return true;
  if (GOLEM.test(s) && RE.efeitoDoBuff.test(t)) return true;
  if (/_Offering$/.test(s) && RE.oferenda.test(t)) return true;
  // (a Animar Arma dos Braços Distantes: o lacaio já é de longe — `estiloDoLacaio`, o "ranged arms" do nome)
  if (s === 'Animate_Weapon_of_Ranged_Arms' && /^Lâminas Persist[eê]ntes Animadas se tornam Arcos$/i.test(t)) return true;
  return false;
}
