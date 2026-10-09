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

/** Os reforços LIGADOS agora na caçada: `[{ id, def, fator }]`. A gema do PoE guarda no buff os efeitos do nível dela (`efeitosPoe`). */
export function ativos(hunt, agora = hunt?.clock ?? Date.now()) {
  const lista = [];
  for (const [id, b] of Object.entries(hunt?.buffs ?? {})) {
    if (!(b.ate > agora)) continue;
    const def = REFORCOS[id];
    if (def) lista.push({ id, def: b.efeitosPoe ? { ...def, efeitos: b.efeitosPoe } : def, fator: b.fator ?? 1, lancado: b.desde ?? 0 });
  }
  return lista;
}

/*
 * ---- As MALDIÇÕES do PoE no monstro (09/10, auditoria de dependências) ----
 * A gema de maldição (`poe-maldicao`) liga um buff e cada acerto AMALDIÇOA o monstro: `bicho.maldicoes[<id da gema>] = { ate, desde, dur,
 * efeitos: [{ tipo: 'vulneravel'|'enfraquecido', pct, tipos? }], expirou, desacelera }`. Como no PoE:
 *   - o LIMITE de maldições no monstro é 1 (+ "Você pode aplicar uma Maldição adicional"): a nova substitui a mais antiga; a MARCA tem o
 *     limite próprio de 1 (não conta nem soma com o das outras);
 *   - a maldição ativa NÃO renova a cada acerto: corre a duração dela (o "expirou X%" conta); vencida, o próximo acerto amaldiçoa de novo;
 *   - "Suas Maldições têm Efeito aumentado em X% se Y% da Duração expirou" (`expirou`) e "Inimigos Amaldiçoados por você são Desacelerados"
 *     (`desacelera`: o passo do monstro) vêm da ficha de quem conjurou (`acoes.efeitosDaMaldicao` → o efeito `maldicaoRegras`).
 */
const ehMaldicao = (def) => def?.tipo === 'poe-maldicao';
/** As maldições ATIVAS no monstro (`[{ id, ...maldição }]`). */
export const maldicoesAtivas = (bicho, agora) => Object.entries(bicho?.maldicoes ?? {}).filter(([, m]) => m && m.ate > agora).map(([id, m]) => ({ id, ...m }));
/** O monstro está amaldiçoado por você agora? */
export const amaldicoado = (bicho, agora) => maldicoesAtivas(bicho, agora).length > 0;
/** O fator do "Efeito aumentado se Y% da Duração expirou" desta maldição agora (1 = nada). */
const fatorDoExpirou = (m, agora) => 1 + (m.expirou ?? []).reduce((s, x) => s + ((agora - m.desde) >= x.apos * m.dur ? x.pct : 0), 0) / 100;
/**
 * As REGRAS das maldições ativas no monstro, da ficha de quem conjurou: "têm Regeneração de Vida reduzida em X%" (a maior — `regenMenos`),
 * "não podem Recuperar Escudo de Energia" (`semRecargaEs`) e "Inimigos Amaldiçoados Mortos por você são destruídos" (`destruir`: sem cadáver).
 */
export function regrasDasMaldicoes(bicho, agora) {
  const ativas = maldicoesAtivas(bicho, agora);
  return {
    regenMenos: Math.max(0, ...ativas.map((m) => m.regenMenos ?? 0)),
    semRecargaEs: ativas.some((m) => m.semRecargaEs),
    destruir: ativas.some((m) => m.destruir),
  };
}
/**
 * O que a maldição faz em VOCÊ quando o monstro a reflete ("100% de chance de Refletir Feitiços"): os mesmos efeitos, como no PoE —
 * a parte "vulnerável" a um elemento vira resistência a menos (Inflamabilidade, Ulceração, Condutividade, Fraqueza Elemental, Desespero no
 * Caos); a Vulnerabilidade (todos os tipos) vira Dano Físico recebido aumentado; o Enfraquecer, menos dano causado.
 */
export function afDaMaldicaoNoJogador(efeitos) {
  const af = {};
  const somar = (k, v) => { af[k] = (af[k] ?? 0) + v; };
  for (const e of efeitos ?? []) {
    if (e.tipo === 'enfraquecido') somar('mais_dano', -e.pct);
    if (e.tipo !== 'vulneravel') continue;
    const tipos = e.tipos ?? [];
    if (tipos.length >= 5 && tipos.includes('physical')) { somar('dano_physical_recebido_inc', e.pct); continue; }
    for (const el of tipos) {
      if (['fire', 'ice', 'energy', 'chaos'].includes(el)) somar(`${el}_res`, -e.pct);
      else if (el === 'physical') somar('dano_physical_recebido_inc', e.pct);
    }
  }
  return af;
}

/** O passo do monstro amaldiçoado e Desacelerado (×; 1 = normal): a maior lentidão entre as maldições ativas. */
export function fatorDeDesaceleracao(bicho, agora) {
  const pct = Math.max(0, ...maldicoesAtivas(bicho, agora).map((m) => m.desacelera ?? 0));
  return pct > 0 ? 1 / Math.max(0.1, 1 - pct / 100) : 1;
}

/** Registra o reforço de uma gema de fora do catálogo (as do PoE — `itens-poe/gemas-poe.mjs`): `{ dur, tipo, efeitos }`. */
export function registrar(id, def) {
  REFORCOS[id] = def;
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

/**
 * Marca o bicho atingido com as auras ligadas (vulnerável, enfraquecido) — elas valem por `durMarca`; a MALDIÇÃO do PoE amaldiçoa (acima).
 * Devolve `{ amaldicoouSemMaldicao }`: o monstro não tinha maldição e passou a ter (o evento "ao Amaldiçoar um Inimigo sem Maldições").
 */
export function marcar(hunt, bicho, agora = hunt?.clock ?? Date.now()) {
  const tinha = amaldicoado(bicho, agora);
  let amaldicoou = false;
  for (const { id, def, fator, lancado } of ativos(hunt, agora)) {
    if (ehMaldicao(def)) {
      const efeitos = [];
      let dur = 0;
      for (const e of def.efeitos ?? []) {
        if (e.efeito === 'marcaVulneravel') efeitos.push({ tipo: 'vulneravel', pct: e.pct * fator, tipos: e.tipos });
        if (e.efeito === 'marcaEnfraquece') efeitos.push({ tipo: 'enfraquecido', pct: e.pct * fator });
        if (/^marca/.test(e.efeito)) dur = Math.max(dur, e.durMarca ?? 0);
      }
      if (!efeitos.length && !(def.efeitos ?? []).some((e) => e.efeito === 'maldicaoRegras')) continue;
      const regras = (def.efeitos ?? []).find((e) => e.efeito === 'maldicaoRegras') ?? {};
      // À PROVA DE MALDIÇÕES (o "Infeitiçável" do PoE): o Feitiço não pega — a Marca, sim; e o "Seus Feitiços podem afetar Inimigos a Prova
      // de Maldições" (a Ocultista) passa.
      if (bicho.aProvaDeMaldicoes && regras.feitico && !regras.afetaAProva) continue;
      const maldicoes = (bicho.maldicoes ??= {});
      for (const [k, m] of Object.entries(maldicoes)) if (!(m?.ate > agora)) delete maldicoes[k];
      // já amaldiçoado por ESTA: a maldição corre a duração dela (não renova a cada acerto — o "expirou X%" e a duração valem)
      if (maldicoes[id]) continue;
      // o LIMITE: a nova tira a lançada há mais tempo DO MESMO GRUPO (as Marcas têm o limite delas, à parte) — se ela mesma foi lançada
      // depois; senão espera (duas maldições ligadas com limite 1: vale a lançada por último, sem trocar a cada acerto)
      const limite = Math.max(1, regras.limite ?? 1);
      const marca = !!regras.marca;
      const doGrupo = () => Object.entries(maldicoes).filter(([, m]) => !!m.marca === marca).sort((a, b) => (a[1].lancada ?? 0) - (b[1].lancada ?? 0));
      let cabe = true;
      while (doGrupo().length >= limite) {
        const [velha, m] = doGrupo()[0];
        if ((m.lancada ?? 0) >= lancado) { cabe = false; break; }
        delete maldicoes[velha];
      }
      if (!cabe) continue;
      dur ||= 6000;
      maldicoes[id] = { ate: agora + dur, desde: agora, lancada: lancado, dur, efeitos, ...(marca ? { marca: true } : {}), ...(regras.expirou?.length ? { expirou: regras.expirou } : {}), ...(regras.desacelera ? { desacelera: regras.desacelera } : {}),
        ...(regras.regenMenos ? { regenMenos: regras.regenMenos } : {}), ...(regras.semRecargaEs ? { semRecargaEs: true } : {}), ...(regras.destruir ? { destruir: true } : {}) };
      amaldicoou = true;
      // "100% de chance de Refletir Feitiços": o Feitiço posto nele volta para VOCÊ (os mesmos efeitos, pela duração dele — `afDaMaldicaoNoJogador`).
      if (regras.feitico && bicho.refleteFeiticos > 0 && Math.random() * 100 < bicho.refleteFeiticos) {
        const af = afDaMaldicaoNoJogador(efeitos);
        if (Object.keys(af).length) (hunt.maldicoesNoJogador ??= {})[`refletida:${id}`] = { ate: agora + dur, nome: regras.nome ?? 'Maldição refletida', af };
      }
      continue;
    }
    for (const e of def.efeitos ?? []) {
      if (e.efeito === 'marcaVulneravel') (bicho.marcas ??= {}).vulneravel = { ate: agora + e.durMarca, pct: e.pct * fator, tipos: e.tipos };
      if (e.efeito === 'marcaEnfraquece') (bicho.marcas ??= {}).enfraquecido = { ate: agora + e.durMarca, pct: e.pct * fator };
    }
  }
  return { amaldicoouSemMaldicao: amaldicoou && !tinha };
}

/** Quanto a marca de vulnerável (e as maldições) aumentam o dano do `tipo` neste bicho (1 = nada). */
export function vulnerabilidade(bicho, tipo, agora) {
  const m = bicho?.marcas?.vulneravel;
  let f = m && m.ate > agora && m.tipos.includes(tipo) ? 1 + m.pct / 100 : 1;
  for (const c of maldicoesAtivas(bicho, agora)) for (const e of c.efeitos) if (e.tipo === 'vulneravel' && e.tipos.includes(tipo)) f *= 1 + (e.pct * fatorDoExpirou(c, agora)) / 100;
  return f;
}

/** A força do bicho (o `forca` da Arena) × a marca de enfraquecido (e as maldições que enfraquecem). */
export function forcaDoBicho(bicho, agora) {
  const m = bicho?.marcas?.enfraquecido;
  let f = m && m.ate > agora ? 1 - m.pct / 100 : 1;
  for (const c of maldicoesAtivas(bicho, agora)) for (const e of c.efeitos) if (e.tipo === 'enfraquecido') f *= Math.max(0, 1 - (e.pct * fatorDoExpirou(c, agora)) / 100);
  // × o buff de dano das mecânicas do mob (Enfurecido, Vingativo — `mobs/buffs.mjs`).
  return (bicho?.forca ?? 1) * f * (1 + BuffsDeMob.soma(bicho, agora, 'danoPct') / 100);
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
