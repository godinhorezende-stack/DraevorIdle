// Os MODS CONDICIONAIS do PoE (sistema de itens do PoE — só com ITENS_POE=1; dono, 07/10: "vários efeitos das armas não estão
// funcionando… n é só arma mas tbm equipamentos… colocando igual no PoE").
//
// Um mod do PoE muitas vezes vale só numa situação: "Dano Corpo a Corpo aumentado", "Velocidade de Ataque segurando um Escudo",
// "Chance de Crítico com Habilidades de Fogo", "Velocidade de Movimento se você Matou Recentemente", "Espaço esquerdo de anel: …".
// A tradução (`gamedata/itens-poe/traducao.json`) grava esses mods como `atributo@cond1+cond2` (ex.: `dmg_inc@corpo`,
// `atk_speed@comEscudo`, `crit_chance_inc@fogo`). Há dois tipos de condição:
//   - de ESTADO (o que o personagem empunha, o que aconteceu há pouco, o anel em que a peça está): resolvidas na SOMA dos atributos
//     (`resolver`, chamado no fim de `Afixos.soma`) — valendo, o número entra no atributo de sempre (`atk_speed`, `block`…);
//   - do GOLPE (as tags da habilidade: ataque, magia, corpo a corpo, projétil, área, fogo…; e o alvo com Vida Baixa): resolvidas em cada
//     acerto (`fichaDoGolpe`), que devolve a ficha daquele golpe com o "aumentado", o crítico, a penetração e as afecções dele.
import { ligado } from './catalogo.mjs';

/** "Recentemente" no PoE: nos últimos 4 segundos. */
export const RECENTE_MS = 4000;
/** "Vida Baixa" no PoE: 50% da vida máxima ou menos. */
export const VIDA_BAIXA = 0.5;
/** A janela em que o personagem conta como "movendo-se" depois do último passo. */
const MOVENDO_MS = 600;

/** Separa `stat@a+b` em `{ stat, conds: ['a','b'] }`. */
export function partir(chave) {
  const i = String(chave).indexOf('@');
  return i < 0 ? { stat: chave, conds: [] } : { stat: chave.slice(0, i), conds: chave.slice(i + 1).split('+').filter(Boolean) };
}
export const ehCondicional = (chave) => String(chave).includes('@');

// ---------------------------------------------------------------- as condições

/** As classes de arma do PoE → a condição "com <arma>". */
const COND_DA_CLASSE = {
  Bows: 'comArco', Wands: 'comVarinha', Daggers: 'comAdaga', Rune_Daggers: 'comAdaga', Claws: 'comGarra',
  One_Hand_Swords: 'comEspada', Thrusting_One_Hand_Swords: 'comEspada', Two_Hand_Swords: 'comEspada',
  One_Hand_Axes: 'comMachado', Two_Hand_Axes: 'comMachado', One_Hand_Maces: 'comMaca', Two_Hand_Maces: 'comMaca', Sceptres: 'comCetro',
  Staves: 'comCajado', Warstaves: 'comCajado',
};
const DUAS_MAOS = new Set(['Bows', 'Two_Hand_Swords', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Staves', 'Warstaves']);
const A_DISTANCIA = new Set(['Bows', 'Wands']);
/** As condições de ESTADO conhecidas (as outras são tags do golpe). `elusivo` e `soloSagrado` ainda não existem no jogo: nunca valem. */
export const CONDICOES_DE_ESTADO = new Set([
  ...new Set(Object.values(COND_DA_CLASSE)), 'umaMao', 'duasMaos', 'armaCorpo', 'comEscudo', 'duasArmas',
  'matouRecente', 'naoMatouRecente', 'criticoRecente', 'naoCriticoRecente', 'acertadoRecente', 'semDanoRecente', 'movendo', 'vidaBaixa',
  'lacaioMorreuRecente', 'usouLacaioRecente', 'elusivo', 'soloSagrado', 'vidaCheia',
]);
/** As tags de GOLPE conhecidas (as do poedb em português viram estas — `tagsDoPoe`). */
export const TAGS_DE_GOLPE = new Set([
  'ataque', 'magia', 'corpo', 'projetil', 'area', 'fogo', 'gelo', 'raio', 'fisico', 'caos', 'elemental', 'arco', 'totem', 'armadilha',
  'mina', 'lacaio', 'arauto', 'vaal', 'movimento', 'clamor', 'aura', 'maldicao', 'alvoVidaBaixa', 'dot', 'habilidade', 'suporte',
]);
/** As condições que dependem do ANEL em que a peça está (resolvidas peça a peça em `Afixos.somaDeItens`). */
export const CONDICOES_DE_ANEL = { anelEsquerdo: 'ring', anelDireito: 'ring2' };

const classeDe = (peca) => peca?.poe?.classe ?? null;
const recente = (quando, agora) => quando != null && agora - quando <= RECENTE_MS;

/** As condições de estado que VALEM agora para o personagem (um Set). */
export function condicoesDe(estado) {
  const v = new Set();
  const arma = classeDe(estado?.equipment?.weapon);
  const outra = classeDe(estado?.equipment?.shield);
  if (arma && COND_DA_CLASSE[arma]) v.add(COND_DA_CLASSE[arma]);
  if (arma) v.add(DUAS_MAOS.has(arma) ? 'duasMaos' : 'umaMao');
  if (arma && !A_DISTANCIA.has(arma)) v.add('armaCorpo');
  if (outra === 'Shields') v.add('comEscudo');
  if (outra && COND_DA_CLASSE[outra]) v.add('duasArmas');
  const h = estado?.hunt;
  const r = h?.poeRecente ?? {};
  const agora = h?.clock ?? 0;
  if (h) {
    v.add(recente(r.matou, agora) ? 'matouRecente' : 'naoMatouRecente');
    v.add(recente(r.critico, agora) ? 'criticoRecente' : 'naoCriticoRecente');
    if (recente(r.acertado, agora)) v.add('acertadoRecente');
    if (!recente(r.dano, agora)) v.add('semDanoRecente');
    if (r.moveu != null && agora - r.moveu <= MOVENDO_MS) v.add('movendo');
    // (Vida Cheia: a vida no máximo.)
    if (recente(r.lacaioMorreu, agora)) v.add('lacaioMorreuRecente');
    if (recente(r.usouLacaio, agora)) v.add('usouLacaioRecente');
  } else {
    v.add('naoMatouRecente').add('naoCriticoRecente').add('semDanoRecente');
  }
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) <= VIDA_BAIXA * estado.maxHp) v.add('vidaBaixa');
  if ((estado?.maxHp ?? 0) > 0 && (estado.hp ?? 0) >= estado.maxHp) v.add('vidaCheia');
  return v;
}

/** Marca um acontecimento "recente" na caçada (`matou`, `critico`, `acertado`, `dano`, `moveu`, `lacaioMorreu`, `usouLacaio`). */
export function marcar(hunt, oque, agora = hunt?.clock ?? 0) {
  if (!hunt || !ligado()) return;
  (hunt.poeRecente ??= {})[oque] = agora;
}

// ---------------------------------------------------------------- a soma

/**
 * Resolve os atributos condicionais de ESTADO na soma (`total`, mexe nele): `atk_speed@comEscudo` com escudo entra em `atk_speed`.
 * Os que têm alguma tag de GOLPE ficam (o `fichaDoGolpe` resolve em cada acerto). Devolve `total`.
 */
export function resolver(estado, total) {
  if (!ligado() || !total) return total;
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (!ehCondicional(k) || typeof v !== 'number') continue;
    const { stat, conds: c } = partir(k);
    if (c.some((x) => !CONDICOES_DE_ESTADO.has(x))) continue;
    conds ??= condicoesDe(estado);
    if (c.every((x) => conds.has(x))) total[stat] = (total[stat] ?? 0) + v;
  }
  return total;
}

/**
 * Os condicionais de GOLPE que sobram na soma (já com as condições de estado conferidas): `[{ stat, tags: [...], valor }]`. A ficha guarda
 * isto (`ficha.porTag`) para cada acerto escolher os seus.
 */
export function porTag(estado, total) {
  if (!ligado() || !total) return [];
  const saida = [];
  let conds = null;
  for (const [k, v] of Object.entries(total)) {
    if (!ehCondicional(k) || typeof v !== 'number' || !v) continue;
    const { stat, conds: c } = partir(k);
    const tags = c.filter((x) => !CONDICOES_DE_ESTADO.has(x));
    if (!tags.length) continue;
    conds ??= condicoesDe(estado);
    if (c.filter((x) => CONDICOES_DE_ESTADO.has(x)).every((x) => conds.has(x))) saida.push({ stat, tags, valor: v });
  }
  return saida;
}

// ---------------------------------------------------------------- o golpe

/** As tags do poedb (em português) → as tags de golpe daqui. */
const TAG_DO_POE = {
  Ataque: 'ataque', Magia: 'magia', 'Corpo a Corpo': 'corpo', Projétil: 'projetil', Área: 'area', Fogo: 'fogo', Gelo: 'gelo', Raio: 'raio',
  Físico: 'fisico', Caos: 'caos', Arco: 'arco', Totem: 'totem', Armadilha: 'armadilha', Mina: 'mina', Lacaio: 'lacaio', Arauto: 'arauto',
  Vaal: 'vaal', Movimento: 'movimento', Clamor: 'clamor', Aura: 'aura', Maldição: 'maldicao',
};
/** As tags de golpe de uma lista de tags do poedb (`['Ataque','Projétil','Arco']` → `['ataque','projetil','arco']`), + `elemental`. */
export function tagsDoPoe(lista = []) {
  const t = new Set();
  for (const x of lista) {
    const k = TAG_DO_POE[String(x).replace(/^poe:/, '')];
    if (k) t.add(k);
  }
  if (t.has('fogo') || t.has('gelo') || t.has('raio')) t.add('elemental');
  return [...t];
}
/** As tags do golpe básico: ataque + corpo a corpo (ou projétil, de longe) + físico (+ arco). */
export function tagsDoGolpeBasico(estado, categoria) {
  const arma = classeDe(estado?.equipment?.weapon);
  const longe = categoria === 'distancia' || categoria === 'magica' || A_DISTANCIA.has(arma);
  const t = ['ataque', longe ? 'projetil' : 'corpo', 'fisico'];
  if (arma === 'Bows') t.push('arco');
  return t;
}

/** A soma dos condicionais de golpe da ficha que valem para estas tags: `{ stat: valor }`. */
export function somaPorTags(ficha, tags) {
  const tem = new Set(tags);
  const s = {};
  for (const x of ficha?.porTag ?? []) if (x.tags.every((t) => tem.has(t))) s[x.stat] = (s[x.stat] ?? 0) + x.valor;
  return s;
}

const ELEMENTO_DA_TAG = { fogo: 'fire', gelo: 'ice', raio: 'energy', fisico: 'physical', caos: 'chaos' };

/**
 * A FICHA DE UM GOLPE: a ficha do personagem com o que vale só para estas tags (e este alvo) — o "Dano aumentado" (entra em cada elemento
 * de `danoDoElemento`, a soma aditiva do PoE), o crítico (chance × os "aumentada", multiplicador), a penetração e as afecções. Sem nada
 * condicional, a MESMA ficha volta (nada muda).
 */
export function fichaDoGolpe(ficha, tags = [], { alvo = null, estado = null, rng = Math.random } = {}) {
  if (!ligado() || !ficha?.afPoe) return ficha;
  const t = new Set(tags);
  if (alvo && alvo.maxHp > 0 && alvo.hp <= VIDA_BAIXA * alvo.maxHp) t.add('alvoVidaBaixa');
  const s = somaPorTags(ficha, [...t]);
  // A Fúria do PoE: +1% de Dano de Ataque aumentado por Fúria.
  const furia = t.has('ataque') ? furiaAtual(estado) : 0;
  // (O "Dano aumentado" sem condição já está em `danoDoElemento` da ficha; aqui só o condicional e a Fúria.)
  const danoGeral = (s.dmg_inc ?? 0) + furia;
  const critInc = s.crit_chance_inc ?? 0;
  const critMult = s.crit_dmg ?? 0;
  const pen = s.elem_pen ?? 0;
  const temAfeccao = Object.keys(s).some((k) => /^(chance_|dot_|ailment_|poison_|bleed_|ignite_|duracao_|efeito_|envenena)/.test(k));
  // Os sorteios do golpe: "Dano Dobrado" e "ignorar a Redução de Dano Físico" (a chance sem condição + a do golpe).
  const chance = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const dobro = chance('chance_dano_dobrado') > 0 && rng() * 100 < chance('chance_dano_dobrado');
  const ignora = chance('ignora_reducao_fisica') > 0 && rng() * 100 < chance('ignora_reducao_fisica');
  const f = { ...ficha };
  f.tagsDoGolpe = [...t];
  if (dobro) f.fatorDasCargas = (ficha.fatorDasCargas ?? 1) * 2;
  if (ignora) f.ignoraReducaoFisica = true;
  if (!danoGeral && !critInc && !critMult && !pen && !temAfeccao && !s.phys_pen) return f;
  if (danoGeral) f.danoDoElemento = Object.fromEntries(Object.entries({ physical: 0, fire: 0, ice: 0, energy: 0, chaos: 0, ...(ficha.danoDoElemento ?? {}) }).map(([el, v]) => [el, v + danoGeral]));
  if (critInc && ficha.critPontos != null) {
    const teto = ficha.critTeto ?? 1;
    f.critChance = Math.min(teto, Math.max(0, ficha.critPontos * (1 + ((ficha.critInc ?? 0) + critInc) / 100)));
    if (ficha.critMagiaPoe) f.critMagiaPoe = { ...ficha.critMagiaPoe, aumentada: ficha.critMagiaPoe.aumentada + critInc };
    if (ficha.critChanceMagia != null) f.critChanceMagia = Math.min(teto, Math.max(0, ficha.critPontos * (1 + ((ficha.critInc ?? 0) + (ficha.critIncMagia ?? 0) + critInc) / 100)));
  }
  if (critMult) f.critMultiplier = (ficha.critMultiplier ?? 1.5) + critMult / 100;
  if (pen || s.phys_pen) {
    const p = ficha.penetracao ?? { fisica: 0, elemental: 0, porElemento: {} };
    f.penetracao = { ...p, elemental: Math.min(100, (p.elemental ?? 0) + pen), fisica: Math.min(100, (p.fisica ?? 0) + (s.phys_pen ?? 0)) };
  }
  if (temAfeccao && ficha.recalcularAfeccoes) f.afeccoes = ficha.recalcularAfeccoes({ ...ficha.afPoe, ...somarSobre(ficha.afPoe, s) });
  return f;
}
const somarSobre = (base, s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, (base[k] ?? 0) + v]));

/** O elemento de uma tag (`'fogo'` → `'fire'`). */
export const elementoDaTag = (tag) => ELEMENTO_DA_TAG[tag] ?? null;

// ---------------------------------------------------------------- a Fúria

/** Fúria do PoE: até 30; +1% de Dano de Ataque aumentado por Fúria; perde 1 a cada 0,5 s sem ganhar Fúria há 2 s. */
export const FURIA = { maximo: 30, perdaMs: 500, esperaMs: 2000 };
export function furiaAtual(estado) {
  const f = estado?.hunt?.furia;
  return f ? Math.max(0, Math.min(FURIA.maximo, f.n | 0)) : 0;
}
export function ganharFuria(hunt, n, agora = hunt?.clock ?? 0) {
  if (!hunt || !(n > 0)) return;
  const f = (hunt.furia ??= { n: 0, ganhou: agora, perdeu: agora });
  f.n = Math.min(FURIA.maximo, (f.n | 0) + n);
  f.ganhou = agora;
  f.perdeu = agora;
}
/** O tique da Fúria (a caçada chama): sem ganhar há `esperaMs`, perde 1 a cada `perdaMs`. */
export function tiqueDaFuria(hunt, agora = hunt?.clock ?? 0) {
  const f = hunt?.furia;
  if (!f || !(f.n > 0)) return;
  if (agora - f.ganhou < FURIA.esperaMs) { f.perdeu = agora; return; }
  while (f.n > 0 && agora - f.perdeu >= FURIA.perdaMs) { f.n--; f.perdeu += FURIA.perdaMs; }
}

/** A chave de um atributo da peça vestida em `slot`, resolvendo a condição de ANEL: no anel certo, sem a condição; no outro, null. */
export function doAnel(chave, slot) {
  const { stat, conds } = partir(chave);
  const deAnel = conds.filter((c) => CONDICOES_DE_ANEL[c]);
  if (!deAnel.length) return chave;
  if (!deAnel.every((c) => CONDICOES_DE_ANEL[c] === slot)) return null;
  const resto = conds.filter((c) => !CONDICOES_DE_ANEL[c]);
  return resto.length ? `${stat}@${resto.join('+')}` : stat;
}

/** Os números base do PoE dos efeitos de acerto. */
export const NO_ACERTO = {
  // Atordoamento: chance = 200 × dano ÷ limiar (a vida máxima do alvo, − o "Ponto de Atordoamento reduzido"); abaixo de 15%, nada.
  atordoamento: { fator: 200, minimoPct: 15, duracaoMs: 350 },
  mutilar: { duracaoMs: 4000, lentidaoPct: 30 },
  cegar: { duracaoMs: 4000, precisaoMenosPct: 20 },
  desacelerar: { duracaoMs: 4000, lentidaoPct: 30 },
  provocar: { duracaoMs: 3000, danoMenosPct: 10 },
  // Empalar: guarda 10% do dano Físico do acerto; os próximos 5 acertos no alvo causam o guardado de novo; até 5 empalamentos, 8 s.
  empalar: { pctDoFisico: 10, acertos: 5, maximo: 5, duracaoMs: 8000 },
};
/** A recuperação do dano sofrido (Recoup do PoE) acontece em 4 s. */
export const RECUPERACAO_MS = 4000;

// ---------------------------------------------------------------- ler um mod

/** O valor de um atributo do PoE na soma do personagem (`ficha.afPoe`: já com as condições de estado), + o condicional do golpe. */
export function valor(ficha, stat) {
  const base = Number(ficha?.afPoe?.[stat]) || 0;
  if (!ficha?.tagsDoGolpe) return base;
  return base + (somaPorTags(ficha, ficha.tagsDoGolpe)[stat] ?? 0);
}
export const ativo = (s, agora) => !!s && s.ate > agora;

// ---------------------------------------------------------------- no ACERTO do personagem

/** O "X% de chance de causar Dano Dobrado" de um golpe: 2 ou 1. */
export const fatorDeDanoDobrado = (ficha, rng = Math.random) => (ligado() && rng() * 100 < valor(ficha, 'chance_dano_dobrado') ? 2 : 1);

/** O golpe ignora a redução de dano Físico do alvo? (a chance do "Acertos … ignoram a Redução de Dano Físico"). */
export const ignoraReducaoFisica = (ficha, rng = Math.random) => ligado() && rng() * 100 < valor(ficha, 'ignora_reducao_fisica');

/**
 * As partes de dano EXTRA de um ataque a partir do Físico dele: "Ganha X% do Dano Físico como Dano de Caos/Fogo extra" e "X% do Dano Físico
 * … é Convertido para um Elemento Aleatório". `fisico`: `[min, max]` (ou um número). Devolve `{ extras: { elemento: [min, max] },
 * convertidoPct }` — o convertido sai do Físico (quem chama tira) e entra no elemento sorteado.
 */
export function extrasDoFisico(ficha, fisico, rng = Math.random) {
  const [a, b] = Array.isArray(fisico) ? fisico : [fisico, fisico];
  const extras = {};
  const somar = (el, pct) => { if (pct > 0) { const x = extras[el] ?? [0, 0]; extras[el] = [x[0] + (a * pct) / 100, x[1] + (b * pct) / 100]; } };
  somar('chaos', valor(ficha, 'phys_as_extra_chaos'));
  somar('fire', valor(ficha, 'phys_as_extra_fire'));
  somar('ice', valor(ficha, 'phys_as_extra_ice'));
  somar('energy', valor(ficha, 'phys_as_extra_energy'));
  // As CONVERSÕES ("X% do Dano Físico Convertido em Dano de Fogo", e a de elemento aleatório): no máximo 100% do Físico, como no PoE.
  let conv = 0;
  const converter = (el, pct) => { const p = Math.max(0, Math.min(100 - conv, pct)); if (p > 0) { somar(el, p); conv += p; } };
  for (const el of ['fire', 'ice', 'energy', 'chaos']) converter(el, valor(ficha, `phys_conv_${el}`));
  if (valor(ficha, 'phys_conv_random') > 0) converter(['fire', 'ice', 'energy'][Math.floor(rng() * 3)], valor(ficha, 'phys_conv_random'));
  return { extras, convertidoPct: conv };
}

// ---------------------------------------------------------------- quando o personagem é ACERTADO

/** O personagem BLOQUEOU o golpe de `bicho`: "Inflige Causticar/Enfraquecer/Exaurir em Inimigos ao Bloquear seu Dano". */
export const AO_BLOQUEAR = { duracaoMs: 4000, causticar: 10, enfraquecer: 6, exaurir: 10 };
export function aoBloquear(hunt, bicho, ficha, { agora = hunt?.clock ?? 0, eventos = [] } = {}) {
  if (!ligado() || !bicho || !ficha?.afPoe) return eventos;
  const e = (bicho.estados ??= {});
  const ate = agora + AO_BLOQUEAR.duracaoMs;
  // Causticar: −10% de resistências elementais; Enfraquecer (Fragilizar): +6% de chance de crítico contra; Exaurir (Exaurido): 10% menos dano.
  if (valor(ficha, 'bloqueio_causticar') > 0) { e.causticado = { ate, pct: AO_BLOQUEAR.causticar }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'causticado' }); }
  if (valor(ficha, 'bloqueio_enfraquecer') > 0) { e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'fragilizado' }); }
  if (valor(ficha, 'bloqueio_exaurir') > 0) { e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir }; eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'exaurido' }); }
  return eventos;
}

/** O que os estados do PoE no BICHO mudam no golpe dele: `{ danoFator, precisaoFator, criticoFator }` (Cego, Exaurido, Provocado). */
export function doBicho(bicho, agora, { contraOutro = false } = {}) {
  const e = bicho?.estados ?? {};
  let danoFator = 1;
  let precisaoFator = 1;
  let criticoFator = 1;
  if (ativo(e.exaurido, agora)) danoFator *= 1 - e.exaurido.pct / 100;
  if (contraOutro && ativo(e.provocado, agora)) danoFator *= 1 - NO_ACERTO.provocar.danoMenosPct / 100;
  if (ativo(e.cego, agora)) {
    precisaoFator *= 1 - NO_ACERTO.cegar.precisaoMenosPct / 100;
    criticoFator *= 1 - (e.cego.criticoMenosPct ?? 0) / 100;
  }
  return { danoFator, precisaoFator, criticoFator };
}
/** A resistência elemental a menos do bicho Causticado (pontos), e a chance de crítico a mais contra ele Fragilizado (pontos de %). */
export const causticado = (bicho, agora) => (ativo(bicho?.estados?.causticado, agora) ? bicho.estados.causticado.pct : 0);
/** O Equilíbrio Elemental no bicho: +25 nos elementos que o acertaram, −50 nos outros (0 sem ele ou fora dos elementais). */
export function equilibrio(bicho, agora, tipo) {
  const q = bicho?.estados?.equilibrio;
  if (!ativo(q, agora) || !['fire', 'ice', 'energy'].includes(tipo)) return 0;
  return q.atingidos.includes(tipo) ? 25 : -50;
}
export const fragilizado = (bicho, agora) => (ativo(bicho?.estados?.fragilizado, agora) ? bicho.estados.fragilizado.pct : 0);

// ---------------------------------------------------------------- o tique da caçada

/**
 * Um tique (a caçada chama, `ms` de tempo): a Fúria, o "movendo-se", a recuperação do dano sofrido (Recoup) e a regeneração do Escudo de
 * Energia ("N de Escudo de Energia Regenerado por segundo"). `ficha`: a do personagem.
 */
export function tique(estado, hunt, ficha, ms, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt) return;
  tiqueDaFuria(hunt, agora);
  const pos = hunt.pos ? `${hunt.pos.x},${hunt.pos.y}` : null;
  if (pos && hunt.poeUltimaPos && pos !== hunt.poeUltimaPos) marcar(hunt, 'moveu', agora);
  hunt.poeUltimaPos = pos;
  if (hunt.recuperacoes?.length && (estado.hp ?? 0) > 0) {
    for (const r of hunt.recuperacoes) {
      const fim = Math.min(agora, r.ate);
      const de = r.ultimo ?? r.ate - RECUPERACAO_MS;
      const quanto = Math.max(0, fim - Math.max(de, agora - ms)) * r.porMs;
      r.ultimo = fim;
      r.resto = (r.resto ?? 0) + quanto;
      const inteiro = Math.floor(r.resto);
      if (inteiro > 0) {
        r.resto -= inteiro;
        if (r.recurso === 'hp') estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + inteiro);
        else estado.mana = Math.min(estado.maxMana ?? 0, (estado.mana ?? 0) + inteiro);
      }
    }
    hunt.recuperacoes = hunt.recuperacoes.filter((r) => r.ate > agora);
  }
  const esRegen = valor(ficha, 'es_regen');
  const esMax = Math.max(0, Math.round(ficha?.energyShield ?? 0));
  if (esRegen > 0 && esMax > 0 && (estado.es ?? 0) < esMax) {
    hunt.poeEsResto = (hunt.poeEsResto ?? 0) + (esRegen * ms) / 1000;
    const inteiro = Math.floor(hunt.poeEsResto);
    if (inteiro > 0) {
      hunt.poeEsResto -= inteiro;
      estado.es = Math.min(esMax, (estado.es ?? 0) + inteiro);
    }
  }
}

/**
 * Os alvos dos projéteis a MAIS / da perfuração de um golpe de longe: os `n` bichos vivos mais perto do `alvo` (sem ele), a até `alcance`
 * casas do personagem.
 */
export function alvosDosProjeteisExtras(hunt, alvo, n, alcance) {
  if (!ligado() || !(n > 0) || !hunt?.pos || !alvo) return [];
  const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return (hunt.monstros ?? [])
    .filter((m) => m !== alvo && m.hp > 0 && !m.dummy && d(hunt.pos, m) <= alcance)
    .sort((a, b) => d(alvo, a) - d(alvo, b))
    .slice(0, Math.floor(n));
}

/** A grade do andar de cada caçada (fora do estado salvo: a caçada registra a cada tique — `cacadas.tique`). */
const GRADES = new WeakMap();
export const definirGradeDoCombate = (hunt, fn) => { if (hunt) GRADES.set(hunt, fn); };

/**
 * O EMPURRÃO do PoE ("chance de Empurrar Inimigos ao acertar"): o bicho vai UMA casa para longe do personagem, se ela é andável e livre.
 * Devolve true se moveu.
 */
export function empurrar(hunt, bicho) {
  if (!hunt?.pos || !bicho || bicho.boss || bicho.dummy) return false;
  const dx = Math.sign(bicho.x - hunt.pos.x);
  const dy = Math.sign(bicho.y - hunt.pos.y);
  if (!dx && !dy) return false;
  const para = { x: bicho.x + dx, y: bicho.y + dy };
  const grade = GRADES.get(hunt)?.() ?? null;
  if (grade?.andavel && !grade.andavel.has(`${para.x},${para.y}`)) return false;
  if (hunt.monstros.some((m) => m !== bicho && m.hp > 0 && m.x === para.x && m.y === para.y)) return false;
  bicho.x = para.x;
  bicho.y = para.y;
  return true;
}


/** O Escudo de Energia que pode pagar o custo de uma habilidade cuja gema está na peça do `slot` ("Gaste Escudo de Energia antes da Mana…"). */
export function escudoParaOCusto(estado, slot, ficha) {
  if (!ligado() || !slot || !(Number(estado?.equipment?.[slot]?.poe?.af?.custo_do_escudo_local) > 0)) return 0;
  return Math.max(0, Math.min(estado.es ?? 0, Math.round(ficha?.energyShield ?? 0)));
}

/**
 * Os projéteis a mais, a perfuração e a área a mais que as PEÇAS dão a uma gema (com as tags `tags`, encaixada na peça do `slot`):
 * `{ projeteis, perfurar, area }` (área em casas de raio: +1 a cada 25%, a fração como chance).
 */
export function alvosDasPecas(estado, ficha, entry, tags, slot, rng = Math.random) {
  if (!ligado() || !ficha?.afPoe) return null;
  const s = somaPorTags(ficha, tags);
  const base = (k) => (Number(ficha.afPoe[k]) || 0) + (s[k] ?? 0);
  const local = estado?.equipment?.[slot]?.poe?.af ?? {};
  const t = new Set(tags);
  const localPorTag = (stat) => Object.entries(local).reduce((n, [k, v]) => { const p = partir(k); return n + (p.stat === stat && typeof v === 'number' && p.conds.every((c) => t.has(c)) ? v : 0); }, 0);
  const projetil = t.has('projetil');
  const projeteis = projetil ? base('extra_projectiles') + (Number(local.extra_projectiles_local) || 0) : 0;
  const perfurar = projetil ? base('perfurar') : 0;
  const ricochetes = projetil || t.has('magia') ? base('ricochetes') : 0;
  const areaPct = t.has('area') ? base('area_inc') + localPorTag('area_inc_local') : 0;
  const casas = areaPct / 25;
  const area = Math.trunc(casas) + (rng() < Math.abs(casas % 1) ? Math.sign(casas) : 0);
  return { projeteis: Math.floor(projeteis), perfurar: Math.floor(perfurar), area, ricochetes: Math.floor(ricochetes) };
}

// ---------------------------------------------------------------- o que o personagem RECEBE

/** A ficha do personagem de cada caçada (fora do estado salvo: a caçada registra a cada tique). */
const FICHAS_DA_CACADA = new WeakMap();
export const definirFichaDaCacada = (hunt, fn) => { if (hunt) FICHAS_DA_CACADA.set(hunt, fn); };
export const fichaDa = (hunt) => FICHAS_DA_CACADA.get(hunt)?.() ?? null;

/** O controle do motor (`combate/controle.mjs`) → a afecção do PoE. */
const AFECCAO_DO_CONTROLE = { congelado: { nome: 'congelamento', elemental: true }, lento: { nome: 'resfriamento', elemental: true }, atordoado: { nome: 'atordoamento' } };

/**
 * O CONTROLE de um monstro no personagem (`Controle.tentar`), pelos mods do PoE: evitar (Congelamento, Resfriamento, Atordoamento, Afecções
 * Elementais), imunidade, a duração em você ("Duração do Congelamento em você reduzida", das Afecções), a "Recuperação de Atordoamentos"
 * (encurta o atordoamento) e o efeito do Resfriamento em você (a lentidão). `{ evitou, duracaoFator, pctFator, chanceFator }`.
 */
export function controleNoJogador(ficha, efeito, rng = Math.random, hunt = null) {
  const a = AFECCAO_DO_CONTROLE[efeito];
  if (!ligado() || !ficha?.afPoe || !a) return { evitou: false, duracaoFator: 1, pctFator: 1, chanceFator: 1 };
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  // (+ a imunidade por tempo dos frascos: "Concede Imunidade a Congelamento por N segundos se usado enquanto Congelado".)
  const imunePorTempo = (hunt?.imunidadesPoe?.[a.nome] ?? 0) > (hunt?.clock ?? 0) || (efeito === 'lento' && (hunt?.imunidadesPoe?.lento ?? 0) > (hunt?.clock ?? 0));
  if (v(`imune_${a.nome}`) > 0 || imunePorTempo) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 0 };
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return { evitou: true, duracaoFator: 0, pctFator: 0, chanceFator: 1 };
  let duracaoFator = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100);
  if (efeito === 'atordoado') duracaoFator /= Math.max(0.1, 1 + v('stun_recovery') / 100);
  const pctFator = efeito === 'lento' ? Math.max(0, 1 + v('efeito_resfriamento_proprio') / 100) : 1;
  // "Ponto de Atordoamento reduzido": mais fácil de ser atordoado.
  const chanceFator = efeito === 'atordoado' ? 1 / Math.max(0.1, 1 - v('ponto_atordoamento_proprio_red') / 100) : 1;
  return { evitou: false, duracaoFator, pctFator, chanceFator };
}

/**
 * O fator do dano de `elemento` que passa pelas resistências do personagem, com as CONVERSÕES do dano recebido ("X% do Dano de Fogo dos
 * Acertos recebido como Dano de Gelo": essa parte passa pela resistência a Gelo). `protecao`: a da ficha (%). Sem conversão: 1 − res.
 */
export function fatorDaResistenciaRecebida(ficha, elemento, protecao = ficha?.protection ?? {}) {
  const res = (el) => Math.min(100, protecao[el] ?? 0);
  if (!ligado() || !ficha?.afPoe || !['fire', 'ice', 'energy'].includes(elemento)) return 1 - res(elemento) / 100;
  let resto = 1;
  let fator = 0;
  for (const outro of ['fire', 'ice', 'energy']) {
    if (outro === elemento) continue;
    const parte = Math.min(resto, (Number(ficha.afPoe[`recebe_${elemento}_como_${outro}`]) || 0) / 100);
    if (parte > 0) { fator += parte * (1 - res(outro) / 100); resto -= parte; }
  }
  return fator + resto * (1 - res(elemento) / 100);
}
/** "Recebe X% de Dano Físico como Dano Extra de um Elemento aleatório": o dano EXTRA (já resistido) a partir do Físico bruto. */
export function extraDoFisicoRecebido(ficha, fisico, rng = Math.random) {
  const pct = ligado() ? Number(ficha?.afPoe?.fisico_recebido_como_elemento) || 0 : 0;
  if (!(pct > 0) || !(fisico > 0)) return 0;
  const el = ['fire', 'ice', 'energy'][Math.floor(rng() * 3)];
  return (fisico * pct) / 100 * fatorDaResistenciaRecebida(ficha, el);
}
/** O crítico do monstro no personagem: a chance × o Cego, e o dano extra × (1 − "Dano Extra recebido de Acertos Críticos reduzido"). */
export function criticoDoBicho(base, bicho, ficha, agora, rng = Math.random) {
  if (!ligado()) return null;
  const { criticoFator } = doBicho(bicho, agora);
  const red = Number(ficha?.afPoe?.crit_dmg_taken_red) || 0;
  if (criticoFator === 1 && !red) return null;
  if (!(base.chance > 0) || !(rng() < base.chance * criticoFator)) return { critico: false, fator: 1 };
  return { critico: true, fator: 1 + (base.fator - 1) * Math.max(0, 1 - red / 100) };
}
