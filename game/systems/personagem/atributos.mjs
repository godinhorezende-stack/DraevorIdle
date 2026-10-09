// OS ATRIBUTOS PRINCIPAIS do personagem — STR, DEX e INT — e as regras que
// dependem deles e das novas defesas (Accuracy, Evasion, Energy Shield).
// Configuração: `gamedata/atributos-principais.json` (nenhum número de
// balanceamento dessas mecânicas fica no código).
//
// O dono: "O Draevor terá SOMENTE 3 atributos principais: STR, DEX, INT", com
// efeitos reais: STR → Life e Physical Damage; DEX → Accuracy, Evasion e
// Attack Speed; INT → Mana e Magic Damage. Vêm da base da vocação + pontos
// automáticos por level + itens (decisão do dono — nada para distribuir à mão).
//
// Tudo aqui é PURO sobre `estado` + a soma dos adds (`Afixos.soma`): quem
// agrega é a ficha (`ficha.mjs`, `Ficha.combate`) — a MESMA conta que a tela,
// a comparação e o combate usam.
import { readFileSync } from 'node:fs';
import * as Formulas from '../combate/formulas.mjs';
import { daCurva } from '../mobs/curvas.mjs';
import { classeDe } from '../itens-poe/classes.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

export const CONFIG = JSON.parse(readFileSync(new URL('../../gamedata/atributos-principais.json', import.meta.url), 'utf8'));
export const PRINCIPAIS = ['str', 'dex', 'int'];
const E = CONFIG.efeitos;
/** Os bônus por ponto do PoE (Força: 0,5 de vida; Inteligência: 0,5 de mana — como no PoE, dono 07/10: "2 de Inteligência = 1 de mana"): a tabela `efeitos` com o PoE ligado — o Editor de Classes edita por cima (`systems/classes.mjs`). */
export const EFEITOS_DO_POE = { STR_LIFE_PER_POINT: 0.5, STR_PHYSICAL_DAMAGE_PER_POINT: 0.2, DEX_ACCURACY_PER_POINT: 2, DEX_EVASION_PER_POINT: 0, DEX_EVASION_PCT_PER_POINT: 0.2, DEX_ATTACK_SPEED_PER_POINT: 0, INT_MANA_PER_POINT: 0.5, INT_MAGIC_DAMAGE_PER_POINT: 0, INT_ENERGY_SHIELD_PCT_PER_POINT: 0.2 };
if (itensPoeLigado()) Object.assign(E, EFEITOS_DO_POE);

/** A vocação do jogo sem a promoção ("elite knight" → knight). */
const vocacaoDe = (estado) => {
  // A CLASSE do Editor de Classes (`systems/classes.mjs`): uma classe criada no editor tem a própria entrada em `porVocacao` (atributos iniciais e por level); sem ela vale a vocação.
  const classe = String(estado?.classe ?? '').toLowerCase();
  if (classe && CONFIG.porVocacao[classe]) return classe;
  const v = String(estado?.vocation ?? 'none').toLowerCase();
  return CONFIG.porVocacao[v] ? v : Object.keys(CONFIG.porVocacao).find((k) => v.includes(k)) ?? 'none';
};

/**
 * STR, DEX e INT do personagem: a base da vocação + `porLevel` × (level − 1)
 * (arredondado para baixo) + o que os itens somam (`adds`, a soma dos adds
 * vestidos). `{ str, dex, int, daVocacao: {...} }`.
 */
export function principais(estado, adds = {}) {
  const v = CONFIG.porVocacao[vocacaoDe(estado)];
  const nivel = Math.max(1, estado?.level ?? 1);
  // Sistema de itens do PoE (só com ITENS_POE=1): a CLASSE do PoE do personagem (a do Editor de Classes, cuja fábrica é a do PoE: atributos iniciais e nenhum ganho
  // por level — decisão do dono, 05/10); quem ainda não tem classe do PoE usa a padrão da vocação.
  const classe = classeDe(estado);
  const daClasse = classe ? CONFIG.porVocacao[classe.slug.toLowerCase()] ?? { base: classe.atributos, porLevel: {} } : v;
  const daVocacao = Object.fromEntries(PRINCIPAIS.map((k) => [k, Math.floor((daClasse.base[k] ?? 0) + (daClasse.porLevel?.[k] ?? 0) * (nivel - 1))]));
  // PoE: "Força aumentada em X%", "Atributos aumentados em X%" (`str_inc`/`dex_inc`/`int_inc`) multiplicam o total do atributo.
  const total = Object.fromEntries(PRINCIPAIS.map((k) => [k, Math.round((daVocacao[k] + Math.round(adds[k] ?? 0)) * (1 + (adds[`${k}_inc`] ?? 0) / 100))]));
  return { ...total, daVocacao };
}

/** O que STR/DEX/INT dão ao personagem (`p` = `principais(...)`). */
export function efeitos(p, af = null) {
  // Com o PoE ligado, a tabela `E` é a do PoE (STR +0,5 de vida e +0,2% de dano físico; DEX +2 de precisão e +0,2% de evasão; INT +0,5 de mana e +0,2% de
  // escudo de energia — `classes.EFEITOS_DO_POE`), editável no Editor de Classes como a do Draevor.
  // (`af`: as keystones que tiram o bônus INERENTE — Solipsismo "Inteligência não concede nenhum bônus inerente ao Escudo de Energia",
  // Terror dos Magos "Destreza não concede nenhum bônus inerente à Evasão".)
  const semEsDaInt = Number(af?.sem_es_da_int) > 0;
  const semEvasaoDaDes = Number(af?.sem_evasao_da_des) > 0;
  return {
    vida: p.str * E.STR_LIFE_PER_POINT,
    danoFisicoPct: p.str * E.STR_PHYSICAL_DAMAGE_PER_POINT,
    precisao: p.dex * E.DEX_ACCURACY_PER_POINT,
    evasao: p.dex * E.DEX_EVASION_PER_POINT,
    velocidadeDeAtaquePct: p.dex * E.DEX_ATTACK_SPEED_PER_POINT,
    mana: p.int * E.INT_MANA_PER_POINT,
    danoMagicoPct: p.int * E.INT_MAGIC_DAMAGE_PER_POINT,
    // Bônus em % da DEX sobre a Evasion e da INT sobre o Energy Shield (0 de fábrica: o jogo de antes não muda; liga-se no Editor de Classes).
    evasaoPct: semEvasaoDaDes ? 0 : p.dex * (E.DEX_EVASION_PCT_PER_POINT ?? 0),
    energyShieldPct: semEsDaInt ? 0 : p.int * (E.INT_ENERGY_SHIELD_PCT_PER_POINT ?? 0),
  };
}

// ---------------------------------------------------------------- precisão

/** A Accuracy BASE do personagem (sem DEX e sem itens): cresce com o level. */
// Na escala do PoE: 2 por level (como no PoE).
export const precisaoBase = (level) => (itensPoeLigado() ? 2 * Math.max(1, level ?? 1) : CONFIG.precisao.BASE + CONFIG.precisao.POR_LEVEL * Math.max(1, level ?? 1));

/**
 * O LEVEL de um bicho: o da fase da campanha onde ele está (`hunt.escala.nivel`,
 * a força para que ele foi escalado); fora dela, uma estimativa pela exp
 * (os bichos do Tibia não têm level próprio).
 */
export function levelDoBicho(hunt, bicho) {
  // Os levels a mais da raridade (pedido do dono, 01/10: valem no combate — ver `mobs/raridade.mjs`).
  const extra = bicho?.levelExtra ?? 0;
  if (hunt?.escala?.nivel) return hunt.escala.nivel + extra;
  // A exp a mais da raridade (`expMult`) não sobe o level do mob — quem sobe é o `levelExtra`.
  const exp = Math.max(1, (bicho?.exp ?? 1) / (bicho?.expMult ?? 1));
  return Math.min(2000, Math.max(1, Math.min(2000, Math.round(Math.sqrt(exp) * 3))) + extra);
}

/** Chance (0–1) do golpe do jogador ACERTAR o bicho: a Accuracy dele contra a evasão do bicho. */
export function chanceDeAcerto(precisao, levelBicho, evasaoDoBichoPronta = null) {
  const c = CONFIG.precisao;
  // A evasão do bicho: a que `mobs/atributos.mjs` calculou (curva, faixa, espécie, modificadores) ou, sem ela, a curva deste level.
  const evasaoDoBicho = evasaoDoBichoPronta ?? daCurva('evasao', levelBicho);
  // Modo 'poe' (`combate/formulas.json`): precisão / (precisão + (evasão / 4)^0,8), entre 5% e 95%.
  if (Formulas.PARAMETROS.acerto.modo === 'poe') return Formulas.chanceDeAcertoPoe(precisao, evasaoDoBicho);
  const bruta = (c.FATOR * precisao) / Math.max(1, precisao + evasaoDoBicho);
  return Math.min(c.MAX, Math.max(c.MIN, bruta));
}

/**
 * Chance (0–1) de acertar um monstro EVASIVO do level: a evasão da curva × (1 + `evasaoPct`/100) — o modificador "Evasivo" dos monstros
 * (+100% de evasão, `itens-poe/modificadores-monstro.json`). É a linha "Chance de Acertar Monstros Evasivos" da tela do PoE.
 */
export function chanceDeAcertoEvasivo(precisao, levelBicho, evasaoPct = 100) {
  return chanceDeAcerto(precisao, levelBicho, daCurva('evasao', levelBicho) * (1 + evasaoPct / 100));
}

/** Chance (0–1) de o jogador ESQUIVAR o golpe corpo a corpo do bicho: a Evasion dele contra a precisão do bicho. */
export function chanceDeEsquiva(evasao, levelBicho, precisaoDoBichoPronta = null) {
  const c = CONFIG.evasao;
  if (!(evasao > 0)) return 0;
  // A precisão do bicho: a de `mobs/atributos.mjs` ou, sem ela, a curva deste level.
  const precisaoDoBicho = precisaoDoBichoPronta ?? daCurva('precisao', levelBicho);
  // Modo 'poe': a chance de evitar é o complemento da chance de acerto do bicho contra esta evasão.
  if (Formulas.PARAMETROS.acerto.modo === 'poe') return 1 - Formulas.chanceDeAcertoPoe(precisaoDoBicho, evasao);
  return Math.min(c.MAX, evasao / (evasao + precisaoDoBicho));
}

// ---------------------------------------------------------------- bases

/** As vocações "de verdade" de uma peça do catálogo (sem as vazias). */
const vocacoesDa = (meta) => (meta?.vocations ?? []).map((v) => String(v).toLowerCase());

/**
 * O TIPO DE BASE de uma peça de defesa: um ou dois de `armour`, `evasion`,
 * `es` (Energy Shield). Pela vocação da peça (decisão do dono); peça de todas
 * as vocações, pelo peso. Só para peças com armadura (o resto não tem base de
 * defesa).
 */
export function tiposDaBase(meta) {
  const vs = new Set(vocacoesDa(meta));
  const tem = (v) => vs.has(v);
  const mago = tem('sorcerer') || tem('druid');
  if (vs.size) {
    const tipos = new Set();
    if (tem('knight')) tipos.add('armour');
    if (tem('paladin')) tipos.add('evasion');
    if (mago) tipos.add('es');
    if (tem('monk')) {
      tipos.add('armour');
      tipos.add('evasion');
    }
    // Peça de 3 vocações ou mais: fica com as duas primeiras (a híbrida mais natural).
    return [...tipos].slice(0, 2);
  }
  const peso = Number(meta?.weight) || 0;
  if (peso >= CONFIG.bases.PESO_PESADA) return ['armour'];
  if (peso <= CONFIG.bases.PESO_LEVE) return ['evasion'];
  return ['armour', 'evasion'];
}

/**
 * Os valores da base de defesa de uma peça, a partir da armadura do catálogo
 * (`armadura`) e do Item Level: `{ armour?, evasion?, es? }`. Armour é a
 * armadura do Tibia (a mesma fórmula de redução); Evasion e Energy Shield
 * crescem com o Item Level. Base híbrida: cada tipo com `FATOR_HIBRIDA`.
 */
export function valoresDaBase(tipos, armadura, itemLevel) {
  const b = CONFIG.bases;
  const f = tipos.length > 1 ? b.FATOR_HIBRIDA : 1;
  const il = Math.max(1, itemLevel ?? 1);
  const saida = {};
  for (const t of tipos) {
    if (t === 'armour') saida.armour = armadura * f;
    if (t === 'evasion') saida.evasion = armadura * (b.EVASAO_A + il * b.EVASAO_B) * f;
    if (t === 'es') saida.es = armadura * (b.ENERGY_SHIELD_A + il * b.ENERGY_SHIELD_B) * f;
  }
  return saida;
}
