// As GEMAS DE REFORÇO — buffs, posturas, auras, escudo, velocidade, provocação —
// por DADOS (gamedata/gemas/reforcos.json; etapa 2 do plano, 30/09).
//
// Antes, a tabela `BUFFS` do acoes.mjs só ligava um relógio: fora o escudo e a
// velocidade, nenhum reforço tinha efeito no combate (o texto do catálogo
// dizia, o servidor não fazia). Agora cada um tem `efeitos` genéricos, lidos
// onde o combate já calcula: o dano/crítico/treino da skill (`bonus`), a cura
// recebida, a esquiva de magia de longe, as marcas nos bichos atingidos
// (vulnerável, enfraquecido) e a provocação. O nível, a raridade e a qualidade
// da gema escalam o efeito (`fatorDaGema`).
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { readFileSync } from 'node:fs';
import { CONFIG as CONFIG_DAS_GEMAS } from './gemas.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/gemas/reforcos.json', import.meta.url), 'utf8'));

/** id da magia → `{ dur, tipo, mult?, efeitos? }`. */
export const REFORCOS = DADOS.reforcos;
/** id da magia → o `tipo` de reforço que ela DESLIGA (o Cancel Magic Shield desliga o 'shield'). */
export const CANCELA = Object.fromEntries(Object.entries(DADOS.cancelamentos ?? {}).filter(([k]) => !k.startsWith('_')));

/**
 * Quanto a gema escala o efeito: 1 + (nível−1) × `escalaPorNivel`% × a raridade + a qualidade%.
 * `efeitoDaGema`: o de `Gemas.efeitoNaSkill` (nivel, raridade, qualidade); sem gema, 1.
 */
export function fatorDaGema(efeitoDaGema) {
  if (!efeitoDaGema) return 1;
  const mult = CONFIG_DAS_GEMAS.raridades.multiplicador[efeitoDaGema.raridade] ?? 1;
  return 1 + ((Math.max(1, efeitoDaGema.nivel ?? 1) - 1) * DADOS.escalaPorNivel * mult) / 100 + (efeitoDaGema.qualidade ?? 0) / 100;
}

/** O multiplicador de velocidade já escalado: a parte acima de 1 × o fator. */
export const velocidadeEscalada = (mult, fator) => 1 + (mult - 1) * fator;

/** Os reforços LIGADOS agora na caçada: `[{ id, def, fator }]`. */
export function ativos(hunt, agora = hunt?.clock ?? Date.now()) {
  const lista = [];
  for (const [id, b] of Object.entries(hunt?.buffs ?? {})) {
    if (!(b.ate > agora)) continue;
    const def = REFORCOS[id];
    if (def) lista.push({ id, def, fator: b.fator ?? 1 });
  }
  return lista;
}

const bate = (e, tags) => !e.tags?.length || e.tags.some((t) => tags.includes(t));

/**
 * A soma de um `efeito` dos reforços ligados para uma skill/golpe com estas `tags`
 * (dano, critChance, critDano, treino, curaRecebida, esquivaDeLonge...), já × o fator.
 */
export function bonus(hunt, efeito, tags = []) {
  let total = 0;
  for (const { def, fator } of ativos(hunt)) for (const e of def.efeitos ?? []) if (e.efeito === efeito && bate(e, tags)) total += e.pct * fator;
  return total;
}

/** O magic level que vem de outra perícia (Divine Defiance: 7,5% do distance vira ML em holy e cura). */
export function treinoDeOutraPericia(estado, hunt, tags) {
  let ml = 0;
  for (const { def, fator } of ativos(hunt)) {
    for (const e of def.efeitos ?? []) {
      if (e.efeito === 'treinoDeOutraPericia' && bate(e, tags)) ml += ((estado.skills?.[e.de]?.value ?? 0) * e.pct * fator) / 100;
    }
  }
  return ml;
}

/** Marca o bicho atingido com as auras ligadas (vulnerável, enfraquecido) — elas valem por `durMarca`. */
export function marcar(hunt, bicho, agora = hunt?.clock ?? Date.now()) {
  for (const { def, fator } of ativos(hunt, agora)) {
    for (const e of def.efeitos ?? []) {
      if (e.efeito === 'marcaVulneravel') (bicho.marcas ??= {}).vulneravel = { ate: agora + e.durMarca, pct: e.pct * fator, tipos: e.tipos };
      if (e.efeito === 'marcaEnfraquece') (bicho.marcas ??= {}).enfraquecido = { ate: agora + e.durMarca, pct: e.pct * fator };
    }
  }
}

/** Quanto a marca de vulnerável aumenta o dano do `tipo` neste bicho (1 = nada). */
export function vulnerabilidade(bicho, tipo, agora) {
  const m = bicho?.marcas?.vulneravel;
  return m && m.ate > agora && m.tipos.includes(tipo) ? 1 + m.pct / 100 : 1;
}

/** A força do bicho (o `forca` da Arena) × a marca de enfraquecido. */
export function forcaDoBicho(bicho, agora) {
  const m = bicho?.marcas?.enfraquecido;
  // × o buff de dano das mecânicas do mob (Enfurecido, Vingativo — `mobs/buffs.mjs`).
  return (bicho?.forca ?? 1) * (m && m.ate > agora ? 1 - m.pct / 100 : 1) * (1 + BuffsDeMob.soma(bicho, agora, 'danoPct') / 100);
}

/**
 * A provocação: os bichos vivos a até `raio` sqm (os mais perto, até `alvos`) passam a
 * perseguir você — vêm até o personagem (é o que junta a leva para a magia de área).
 * Devolve quantos vieram.
 */
export function provocar(hunt, def, distancia) {
  let n = 0;
  for (const e of def.efeitos ?? []) {
    if (e.efeito !== 'provocar') continue;
    const perto = hunt.monstros
      .filter((m) => m.hp > 0 && !m.dummy && distancia(hunt.pos, m) <= e.raio)
      .sort((a, b) => distancia(hunt.pos, a) - distancia(hunt.pos, b))
      .slice(0, e.alvos ?? Infinity);
    for (const m of perto) {
      m.perseguindo = true;
      m.provocadoAte = (hunt.clock ?? Date.now()) + def.dur;
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------- o texto do reforço (o tooltip dos buffs)

const TAGS_PT = { melee: 'corpo a corpo', ranged: 'à distância', physical: 'físico', fire: 'fogo', ice: 'gelo', earth: 'terra', energy: 'energia', death: 'morte', holy: 'sagrado', healing: 'cura', spell: 'magias' };
const TIPO_PT = { speed: 'Velocidade', rage: 'Fúria', postura: 'Postura', aura: 'Aura', shield: 'Escudo', desafio: 'Provocação' };
const AFETA_PT = { aura: 'Os bichos que você atingir', desafio: 'Os bichos por perto' };
const listaPt = (itens) => (itens ?? []).map((t) => TAGS_PT[t] ?? t).join(' e ');
const PERICIA_PT = { melee: 'Melee', distance: 'Distance', magic: 'Magic Level', shielding: 'Shielding' };
/** Onde o efeito vale: os ataques de perto/longe, ou as habilidades de tal tipo. */
const ondeVale = (tags) => (!tags?.length ? '' : tags.every((t) => t === 'melee' || t === 'ranged') ? ` nos ataques ${tags.map((t) => (t === 'melee' ? 'corpo a corpo' : 'à distância')).join(' e ')}` : ` nas habilidades de ${listaPt(tags)}`);
const num = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const seg = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`;
};

/**
 * O que o reforço FAZ, em texto, com os números REAIS (já × o fator da gema: nível, raridade, qualidade; a duração com o Skill Duration).
 * `{ nome?, tipo, tipoNome, duracaoMs, duracao, afeta, linhas, condicoes }`. Só texto: o combate lê os `efeitos` (`bonus`), nunca isto.
 * Os reforços são todos PESSOAIS (`hunt.buffs` de quem lançou); só as auras e a provocação agem nos bichos.
 */
export function descrever(id, efeitoDaGema = null) {
  const def = REFORCOS[id];
  if (!def) return null;
  const fator = fatorDaGema(efeitoDaGema);
  const duracaoMs = Math.round(def.dur * (1 + (efeitoDaGema?.duracaoPct ?? 0) / 100));
  const linhas = [];
  if (def.tipo === 'shield') linhas.push('O dano que você sofre sai da sua mana antes de sair da vida');
  if (def.mult) linhas.push(`+${num((velocidadeEscalada(def.mult, fator) - 1) * 100)}% de velocidade de movimento`);
  for (const e of def.efeitos ?? []) {
    const v = num((e.pct ?? 0) * fator);
    const onde = ondeVale(e.tags);
    if (e.efeito === 'dano') linhas.push(`+${v}% de dano${onde}`);
    else if (e.efeito === 'critChance') linhas.push(`+${v}% de chance de crítico${onde}`);
    else if (e.efeito === 'critDano') linhas.push(`+${v}% de dano crítico${onde}`);
    else if (e.efeito === 'treino') linhas.push(`+${v}% do seu magic level/skill${onde}`);
    else if (e.efeito === 'treinoDeOutraPericia') linhas.push(`${v}% da sua perícia de ${PERICIA_PT[e.de] ?? e.de} conta como magic level${onde}`);
    else if (e.efeito === 'curaRecebida') linhas.push(`+${v}% em toda cura que você recebe`);
    else if (e.efeito === 'esquivaDeLonge') linhas.push(`${v}% de chance de desviar de magias de bichos à distância`);
    else if (e.efeito === 'marcaVulneravel') linhas.push(`Quem você atinge sofre +${v}% de dano de ${listaPt(e.tipos)} por ${seg(e.durMarca)}`);
    else if (e.efeito === 'marcaEnfraquece') linhas.push(`Quem você atinge causa ${v}% menos dano por ${seg(e.durMarca)}`);
    else if (e.efeito === 'provocar') linhas.push(`Os bichos a até ${e.raio} sqm${e.alvos ? ` (no máximo ${e.alvos})` : ''} passam a atacar você`);
  }
  const condicoes = ['Não pode ser lançado de novo enquanto estiver ativo'];
  if (def.tipo === 'speed') condicoes.push('Só uma velocidade por vez: a mais nova vale');
  if (CANCELA && Object.values(CANCELA).includes(def.tipo)) condicoes.push('Pode ser desligado pela magia de cancelar');
  return { tipo: def.tipo, tipoNome: TIPO_PT[def.tipo] ?? def.tipo, duracaoMs, duracao: seg(duracaoMs), afeta: AFETA_PT[def.tipo] ?? 'Só você', linhas, condicoes };
}
