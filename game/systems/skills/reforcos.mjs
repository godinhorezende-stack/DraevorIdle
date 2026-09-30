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
  return (bicho?.forca ?? 1) * (m && m.ate > agora ? 1 - m.pct / 100 : 1);
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
