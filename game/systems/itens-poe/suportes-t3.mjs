// (lote T3, rodada 4 das gemas — 27/10: as gemas "implementada, sem teste próprio" da parte 3) As correções dos SUPORTES que os testes do lote acharam. Aqui ficam as
// regras (`[regex, (m, texto, ativa) → { chave: valor } | null]`, o formato de `suportes-poe.REGRAS`), que entram ANTES das gerais, e as contas puras que o uso lê.
//
//   - a IMOLAÇÃO (o PoB, sup_int.lua SupportImmolation: "Supported Skills have X to Y Added Fire Damage against Burning Enemies" — o stat
//     `added_fire_damage_vs_burning`, com a condição { type = "ActorCondition", actor = "enemy", var = "Burning" }): o adicionado só vale no acerto contra o alvo
//     Queimando. A regra geral ("têm X a Y de Dano de Fogo adicional") pegava o começo da linha e somava SEMPRE, mesmo sem nenhum inimigo Queimando. Agora o efeito
//     guarda a faixa à parte (`imolacaoMin`/`imolacaoMax`) e o acerto a soma na parte de Fogo só no alvo com a queimadura — o mesmo caminho do "Fogo adicionado contra
//     Inimigos Queimando" da Armadilha Flamejante (`Acoes`: `fogoContraQueimando`, × a Eficácia do Dano Adicionado da gema, o "aumentado" do Fogo e os "mais" do golpe).
//   - o CRÍTICO dos suportes (os Golpes Críticos Aumentados: o PoB, sup_int.lua SupportIncreasedCriticalStrikes — "CritChance INC 60→117" e "CritChance BASE +2"): a
//     regra geral fazia do "X% da Chance de Crítico aumentada" um "+X÷20 pontos" somados no fim (117% virava +5,85%) e o "+2%" entrava depois dos aumentos. No PoE o
//     "+X%" soma à BASE e o "aumentada" soma aos aumentos da habilidade: (base + 2) × (1 + aumentos + 117%). Agora as linhas viram modificadores LOCAIS da habilidade
//     suportada (`af:` → a soma da habilidade, `Acoes.comAsLinhasDaGema`), como o PoB: o aumentado em `crit_chance_inc`, a base em `crit_base_golpe` (`fichaDoGolpe` soma
//     os dois na conta do crítico do golpe — e na das magias do PoE, `critMagiaPoe`) e o "X% menos Chance" (o Destruição Controlada: CritChance MORE −80) em
//     `crit_mais_pct`. O "dos Ataques" / "Mágico" (o Conjurar ao Crítico) só no golpe com a tag (`@ataque` / `@magia`).
//   - o "X% MENOS/MAIS Duração" dos suportes (o Menos Duração: o PoB "Duration MORE −49"; o Sofrimento Veloz e o Desperto: "25% less Duration of Supported Skills and
//     Damaging Ailments they inflict"): é um "mais" — multiplica a duração —, e a regra geral o somava como um "aumentada" (`duracaoPct`), junto dos "aumentada" da árvore e
//     das peças. Agora vai a `duracaoMaisPct` (o "mais" que `Acoes.fatorDeDuracao` já multiplica); quem lia só o `duracaoPct` (o buff, o reforço, os lacaios, a Crueldade, o
//     Relâmpago Vivo) multiplica também pelo `fatorMaisDaDuracao`.
//   - o "+N ao Nível de Gemas de Habilidades de <tipo> Suportadas" (o Dano Adicional de Gelo Desperto: "+1 to Level of Supported Cold Skill Gems"; a Blasfêmia Desperta: "of
//     Supported Curse Skill Gems"): a regra geral só reconhecia Físicas, Fogo, Caos, Aura e Golpes — nas outras o nível subia em QUALQUER gema ligada (a Bola de Fogo ia ao
//     nível 24 com o Gelo Desperto). Agora o tipo da linha vira a tag que a ativa precisa ter: Gelo, Raio, Maldição, Lacaios, e as Elementais (Fogo, Gelo ou Raio).
const N = '([\\d.]+)';
const num = (s) => Number(String(s).replace(',', '.'));

const temTag = (ativa, t) => !!ativa?.tags?.includes(`poe:${t}`);
/** As tags que a ativa precisa ter (uma delas) para o "+N ao Nível" da linha (null: qualquer gema). */
function tagsDoNivel(t) {
  if (/Físicas/i.test(t)) return ['Físico'];
  if (/Elementais/i.test(t)) return ['Fogo', 'Gelo', 'Raio'];
  for (const [re, tag] of [[/de Fogo/i, 'Fogo'], [/de Gelo/i, 'Gelo'], [/de Raio/i, 'Raio'], [/de Caos/i, 'Caos'], [/Aura/i, 'Aura'], [/Maldição/i, 'Maldição'], [/Lacaios?/i, 'Lacaio']]) if (re.test(t)) return [tag];
  // (achado C3 da rodada 4) o "de Golpes" do Dano Propagado Desperto: nas gemas do PoE a tag é "Golpear" (46 gemas — o Golpe Duplo, o Golpe Pesado…)
  if (/Golpes/i.test(t)) return ['Golpe', 'Golpear'];
  return null;
}
/** (achado C3 da rodada 4) Os "mais/menos" LOCAIS dos suportes (`af:` no efeito) que MULTIPLICAM — entre suportes e com o da gema —, como cada more/less do PoE. */
export const MAIS_LOCAL_QUE_MULTIPLICA = /^af:(?:crit_mais_pct|duracao_afeccoes_dano_mais)(?:@\w+)?$/;
const TAG_DO_CRITICO = { ataques: 'ataque', 'mágico': 'magia', magico: 'magia' };
export const REGRAS_T3 = [
  [new RegExp(`^\\+?${N} (?:ao|do) N[iíï]vel (?:de|das) Gemas de (?:Habilidade )?(\\S+)? ?(?:de )?(?:Habilidades? )?(\\S+)? ?Suportadas`, 'i'), (m, t, a) => {
    const so = tagsDoNivel(t);
    return !so || so.some((x) => temTag(a, x)) ? { nivelExtra: Math.floor(num(m[1])) } : null;
  }],
  [new RegExp(`têm ${N}% da Chance de Crítico aumentada$`, 'i'), (m) => ({ 'af:crit_chance_inc': num(m[1]) })],
  [new RegExp(`Chance de Acerto Crítico (dos Ataques|Mágico) aumentad[oa] em ${N}%$`, 'i'), (m) => ({ [`af:crit_chance_inc@${TAG_DO_CRITICO[m[1].split(' ').pop().toLowerCase()]}`]: num(m[2]) })],
  [new RegExp(`têm \\+${N}% de Chance de (?:Acerto )?Crítico$`, 'i'), (m) => ({ 'af:crit_base_golpe': num(m[1]) })],
  [new RegExp(`têm ${N}% menos Chance de (?:Golpe|Acerto) Crítico$`, 'i'), (m) => ({ 'af:crit_mais_pct': -num(m[1]) })],
  [new RegExp(`têm ${N} a ${N} de Dano de Fogo adicional contra Inimigos Queimando$`, 'i'), (m) => ({ imolacaoMin: num(m[1]), imolacaoMax: num(m[2]) })],
  [new RegExp(`têm ${N}% (mais|menos) Duração do Efeito de Habilidades$`, 'i'), (m) => ({ duracaoMaisPct: (m[2].toLowerCase() === 'mais' ? 1 : -1) * num(m[1]) })],
  [new RegExp(`^${N}% (mais|menos) Duração das Habilidades Suportadas e Afecções Danificadoras`, 'i'), (m) => { const v = (m[2].toLowerCase() === 'mais' ? 1 : -1) * num(m[1]); return { duracaoMaisPct: v, 'af:duracao_afeccoes_dano_mais': v }; }],
];

/**
 * O Fogo adicionado contra o alvo Queimando deste uso: o da gema (`daGema`, `[min, max]` ou null — a Armadilha Flamejante) + o da Imolação ligada (`efeito.imolacaoMin`/
 * `imolacaoMax`). `[min, max]` ou null.
 */
export function fogoContraQueimandoDoUso(daGema, efeito) {
  const a = Number(efeito?.imolacaoMin) || 0;
  const b = Number(efeito?.imolacaoMax) || a;
  if (!(a > 0 || b > 0)) return daGema ?? null;
  return [(daGema?.[0] ?? 0) + a, (daGema?.[1] ?? 0) + b];
}

/**
 * O crítico dos suportes no efeito (`af:crit_chance_inc`, `af:crit_base_golpe`, `af:crit_mais_pct`, com a condição de tag `@ataque`/`@magia` só se `tags` a tem):
 * `{ inc, base, mais }` (os %), ou null sem nenhum. Para os acertos que não montam a ficha com as linhas da habilidade (o do Arauto, o ataque ativado).
 */
export function criticoDoEfeito(ef, tags = []) {
  const t = new Set(tags);
  const r = { inc: 0, base: 0, mais: 0 };
  let tem = false;
  for (const [k, v] of Object.entries(ef ?? {})) {
    const m = /^af:crit_(chance_inc|base_golpe|mais_pct)(?:@(\w+))?$/.exec(k);
    if (!m || typeof v !== 'number' || !v || (m[2] && !t.has(m[2]))) continue;
    const c = { chance_inc: 'inc', base_golpe: 'base', mais_pct: 'mais' }[m[1]];
    r[c] = c === 'mais' ? ((1 + r[c] / 100) * (1 + v / 100) - 1) * 100 : r[c] + v;
    tem = true;
  }
  return tem ? r : null;
}
/**
 * A chance de crítico `chance` (0–1) de uma ficha (`pontos`: a base em fração; `inc`: os aumentos em %) com o crítico dos suportes `c` (`criticoDoEfeito`) — a mesma
 * conta do PoB: (base + "+X%") × (1 + aumentos + "aumentada") × o "mais" de antes × o "mais" do suporte. Sem base (`pontos` 0), a base é só o "+X%".
 */
export function chanceComOCritico(chance, { pontos = 0, inc = 0, teto = 1 } = {}, c = null) {
  if (!c) return chance;
  const p = Math.max(0, Number(pontos) || 0);
  const maisAntes = p > 0 ? Math.max(0, chance) / (p * Math.max(0.01, 1 + inc / 100)) : 1;
  return Math.min(teto, Math.max(0, (p + c.base / 100) * Math.max(0, 1 + (inc + c.inc) / 100) * maisAntes * Math.max(0, 1 + c.mais / 100)));
}

/** O "mais/menos Duração" dos suportes (`duracaoMaisPct`) como fator — para quem lê só o `duracaoPct` (o "aumentada"). */
export const fatorMaisDaDuracao = (ef) => Math.max(0, 1 + (Number(ef?.duracaoMaisPct) || 0) / 100);
