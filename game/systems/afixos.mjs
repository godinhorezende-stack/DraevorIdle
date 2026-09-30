// Afixos ("Atributos" da peça) — a soma do que está vestido, a régua, a cor, a
// forja (rerrolar) e a regra de guardar na venda automática.
//
// Formato na peça: `af: [{id, nivel, value, rr?}]` — `id` do `catalog.afixos`
// (49 no total), `nivel` o TIER do add (T1–T5), `value` já no número final
// ("+3.1%"), `rr` quantas vezes aquele posto foi rerrolado. Peça de antes do
// sistema de itens tinha `tier` (1–3) no lugar do nível: `nivelDe` resolve as
// duas, e a entrada no personagem converte (ver `systems/itens/item.mjs`). A
// essência (item 900001) leva um afixo só e `afixoDe` (o slot de onde saiu),
// `raridade` e `mitica` (a vermelha).
//
// O SORTEIO não mora mais aqui: raridade, quantidade, quais atributos, nível e
// valor saem do gerador central (`systems/itens/gerar.mjs`), com as tabelas em
// `gamedata/itens/*.json`. Antes era fixo em código, medido nos drops reais do
// original (1 afixo 73% / 2 24% / 3 3%; T1 90% / T2 8% / T3 2%; 31% "tortos").
import * as Atributos from './personagem/atributos.mjs';
import * as Especializacoes from './personagem/especializacoes.mjs';
import { CATALOGO, ITEM_CATALOG } from './dados.mjs';
import * as R from './regras.mjs';
import * as Gemas from './gemas.mjs';
import * as Imbuements from './imbuements.mjs';
// O sistema de itens (raridade, níveis 1–5, faixas por nível, pools): a régua
// de cada atributo passa a ser a dele — ver `systems/itens/config.mjs`.
import * as ItensConfig from './itens/config.mjs';
import * as Gerar from './itens/gerar.mjs';
import { raridadeDaPeca } from './itens/item.mjs';

export const FICHAS = CATALOGO.afixos ?? {};
export const ID_DA_ESSENCIA = 900001;
export const MAX_AFIXOS = 3;
export const FRACAO_DA_MITICA = 1.3;
export const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];

// Os slots cujas peças levam adds. O que cada peça aceita é o POOL do tipo dela
// (`gamedata/itens/pools.json`, via `Gerar.poolDe`) — a lista única de "o que
// pode rolar onde"; um add fora do pool (peça antiga, forja) sai "torto".
const SLOTS_COM_AFIXO = new Set(['weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack']);

/** Os adds que a peça aceita: o pool do tipo dela (sem os que não dropam); sem peça, todos. */
function nativosDe(slot, itemId) {
  if (!itemId || slot === 'backpack') return Object.keys(FICHAS);
  return Gerar.poolDe(itemId).filter((id) => ItensConfig.ATRIBUTOS[id]?.dropa !== false);
}

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const arredonda = (ficha, v) => (ficha.tipo === 'flat' ? Math.round(v) : Math.round(v * 10) / 10);

/** Onde o valor cai na régua do afixo, em % (100 = o topo; a vermelha passa). */
export function pctDe(a) {
  const f = FICHAS[a.id];
  if (!f || f.max <= f.min) return 0;
  return Math.round(((a.value - f.min) / (f.max - f.min)) * 100);
}

export const valorNaRegua = (id, pct) => {
  const f = FICHAS[id];
  return arredonda(f, f.min + (Math.max(0, pct) / 100) * (f.max - f.min));
};

const ehTorto = (slot, id, itemId) => !nativosDe(slot, itemId).includes(id);

/** A peça aceita afixo? (equipável, não empilha, de um slot com afixo) */
export function aceitaAfixo(id) {
  const meta = ITEM_CATALOG[id];
  return !!meta && !meta.stackable && SLOTS_COM_AFIXO.has(meta.slot);
}

/**
 * Os atributos de um drop — só a PONTE para o gerador central
 * (`systems/itens/gerar.mjs`), para não existir um segundo sorteio. O combate
 * já chama o gerador direto; isto fica para quem ainda pede só os `af`.
 */
export function rolarDrop(id, { boss = false, level = 1 } = {}) {
  if (!Gerar.aceitaAtributos(id)) return null; // mochila: só pela forja
  return Gerar.gerarItem({ itemId: id, level, boss }).af ?? [];
}

/** O NÍVEL (1–5) de um atributo: o gravado, ou (peça antiga) o da faixa onde o valor cai. */
export const nivelDe = (a) => a?.nivel ?? Gerar.nivelDoValor(a?.id, Number(a?.value) || 0);

/**
 * A cor de um atributo pelo nível: 1 azul (N1–N2), 2 roxa (N3–N4), 3 dourada
 * (N5), 4 vermelha (acima do teto do N5 — a essência vermelha da fusão).
 */
export function corDoAtributo(a) {
  const f = FICHAS[a?.id];
  if (f && Number(a.value) > f.max + 1e-9) return 4;
  const n = nivelDe(a);
  return n >= 5 ? 3 : n >= 3 ? 2 : 1;
}

/** Quantos atributos uma peça desta raridade pode ter (o topo da faixa da raridade). */
export function maxAtributos(raridade) {
  const q = ItensConfig.RARIDADES.raridades[raridade]?.atributos;
  return q ? Math.max(...Object.keys(q).map(Number)) : MAX_AFIXOS;
}

/** Rerroll: outro sorteio SEMPRE acima do pct atual (no topo: outro afixo, em 100%). Só do pool do equipamento. */
export function rerrolar(slot, af, indice, itemId = null) {
  const atual = af[indice];
  const pctAtual = Math.min(100, pctDe(atual));
  const outros = af.filter((_, i) => i !== indice).map((a) => a.id);
  const pool = nativosDe(slot, itemId).filter((id) => FICHAS[id]);
  const livres = pool.filter((id) => !outros.includes(id) && !(pctAtual >= 100 && id === atual.id));
  let id = Math.random() < 0.5 && pctAtual < 100 ? atual.id : sorteio(livres);
  id ??= atual.id;
  const pctSorteado = pctAtual >= 100 ? 100 : pctAtual + 1 + Math.random() * (100 - pctAtual - 1);
  let value = valorNaRegua(id, pctSorteado);
  /*
   * "Sempre acima" tem de valer no NÚMERO, não só no sorteio: numa régua curta
   * (perícia vai de 1 a 3) o arredondamento devolvia o mesmo valor — Shielding
   * +2 (50%) virava Shielding +2 (50%), e o reroll era pago sem mudar nada.
   * Mesmo afixo abaixo do topo: pelo menos um degrau (+1, ou +0,1 no %).
   */
  const f = FICHAS[id];
  if (id === atual.id && pctAtual < 100 && f && value <= atual.value) {
    value = Math.min(f.max, arredonda(f, atual.value + (f.tipo === 'flat' ? 1 : 0.1)));
  }
  return { id, nivel: Gerar.nivelDoValor(id, value), value, rr: (atual.rr ?? 0) + 1 };
}

// ------------------------------------------------------- o que está vestido

/** A soma de cada afixo nas peças VESTIDAS: `{atk_flat: 7, crit_chance: 1.3, ...}`. */
export function soma(estado) {
  const total = {};
  for (const [slot, peca] of Object.entries(estado.equipment ?? {})) {
    if (!peca?.af?.length || slot === 'backpack') continue;
    for (const a of peca.af) if (FICHAS[a.id]) total[a.id] = (total[a.id] ?? 0) + Number(a.value || 0);
  }
  return total;
}

/** O que vale agora de um afixo (0 se não tem). Cache por tique fica para depois. */
export const de = (estado, id) => soma(estado)[id] ?? 0;

// ------------------------------------------------------------ a tela

export function viewDoAfixo(a, slot, itemId = null) {
  const f = FICHAS[a.id] ?? { nome: a.id, tipo: 'pct', min: 0, max: 1 };
  const rr = a.rr ?? 0;
  return {
    id: a.id,
    nome: f.nome,
    tipo: f.tipo,
    valor: a.value,
    // "Nível do Atributo" (1–5). `tier` fica igual, para a tela de antes da atualização.
    nivel: nivelDe(a),
    tier: nivelDe(a),
    pct: pctDe(a),
    min: f.min,
    max: f.max,
    torto: slot ? ehTorto(slot, a.id, itemId) : false,
    rerrolls: rr,
    texto: `${f.nome} +${a.value}${f.tipo === 'pct' ? '%' : ''}`,
  };
}

// ------------------------------------------- guardar na venda automática

/** A cor da peça: a do melhor afixo (1 azul, 2 roxa, 3 dourada, 4 vermelha). */
export function corDaPeca(p) {
  let q = 0;
  for (const a of p.af ?? []) q = Math.max(q, corDoAtributo(a));
  return q;
}

/**
 * O filtro de loot pelo ATRIBUTO, no sistema de itens: `{nivel, quantos}` =
 * guardar a peça com pelo menos `quantos` atributos de nível `nivel` ou mais
 * (`nivel` 0 = o atributo não segura nada). Quem gravou as regras de antes (a
 * cor da estrela em 3 degraus e a contagem até 3) é traduzido: "qualquer"
 * vira N1+, "roxa para cima" N3+, "só a dourada" N5.
 */
export function regraDoAtributo(s = {}) {
  const nivel = s.guardarNivel != null ? Number(s.guardarNivel) : ({ 0: 0, 1: 1, 2: 3, 3: 5 }[Number(s.guardarAfixo ?? 1)] ?? 1);
  const quantos = s.guardarQuantos != null ? Number(s.guardarQuantos) : Math.max(1, Number(s.guardarEstrelas ?? 0));
  return { nivel: Math.max(0, Math.min(5, nivel || 0)), quantos: Math.max(1, Math.min(6, quantos || 1)) };
}

/**
 * A venda automática GUARDA esta peça? Tier, imbuement e essência nunca
 * vendem. Fora isso, as regras LIGADAS do filtro valem JUNTAS (a peça passa em
 * todas): `guardarRaridade` (0 não olha, 1 incomum para cima ... 5 só mítico)
 * e o atributo (`regraDoAtributo`, com `itemRules.soAfixo` = só nestes itens).
 * Nenhuma ligada: vende.
 */
export function guarda(estado, p) {
  if (p.tier || p.imbu?.length) return true;
  if (p.id === ID_DA_ESSENCIA) return true;
  const s = estado.settings ?? {};
  const pisoRaridade = Number(s.guardarRaridade ?? 0);
  const { nivel, quantos } = regraDoAtributo(s);
  if (!pisoRaridade && !nivel) return false;
  if (pisoRaridade > 0) {
    // A raridade do DROP (sistema de itens); a do catálogo só para peça antiga.
    const r = RARIDADES.indexOf(raridadeDaPeca(p));
    if (r < pisoRaridade) return false;
  }
  if (nivel > 0) {
    const soEm = estado.itemRules?.soAfixo ?? [];
    if (soEm.length && !soEm.includes(p.id)) return false;
    const bons = (p.af ?? []).filter((a) => corDoAtributo(a) === 4 || nivelDe(a) >= nivel).length;
    if (bons < quantos) return false;
  }
  return true;
}

// ------------------------------------------- vida/mana máxima e capacidade

/** A capacidade com o afixo "Capacidade" das peças vestidas. */
// + o imbuement "Increase Capacity" (% da capacidade), nas botas e na armadura.
export const capacidade = (estado) =>
  (R.maxCapacity(estado.vocation, estado.level ?? 1) + Gemas.bonus(estado).capacidade) * (1 + Imbuements.bonus(estado).capacidadePct / 100);

/**
 * "+Life" e "+Mana" dos adds, mais a Life do STR e a Mana do INT. Aplicados como diferença
 * sobre `maxHp`/`maxMana` (o resto do jogo lê esses dois campos), marcando o
 * quanto já foi posto em `afixoMax` — vestir, tirar e subir de level chamam
 * isto de novo e só a diferença entra ou sai.
 */
export function sincronizarMaximos(estado) {
  const t = soma(estado);
  // +Life / +Mana dos adds, e o que STR (Life) e INT (Mana) dão — ver `personagem/atributos.mjs`.
  const doAtributo = Atributos.efeitos(Atributos.principais(estado, t));
  // + a Life % da especialização da classe (Knight: Life), sobre a vida do level + a dos adds e do STR.
  const lifePct = Especializacoes.efeitos(estado).stats.life ?? 0;
  const vidaSemPct = R.statsBase(estado.vocation, estado.level ?? 1).maxHp + (t.life ?? 0) + doAtributo.vida;
  const quer = { hp: Math.round((t.life ?? 0) + doAtributo.vida + (vidaSemPct * lifePct) / 100), mana: Math.round((t.mana ?? 0) + doAtributo.mana) };
  const tem = estado.afixoMax ?? { hp: 0, mana: 0 };
  if (quer.hp === tem.hp && quer.mana === tem.mana) return;
  estado.maxHp = (estado.maxHp ?? 0) + quer.hp - tem.hp;
  estado.maxMana = (estado.maxMana ?? 0) + quer.mana - tem.mana;
  estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
  estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
  estado.afixoMax = quer;
}
