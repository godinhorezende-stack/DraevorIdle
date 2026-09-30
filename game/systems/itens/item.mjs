// A PEÇA — o que é da instância (e não do item-base do catálogo): o tier da
// forja (o futuro refino), os imbuements, os atributos (`af`), a raridade do
// drop e o efeito especial. Quem copia uma peça campo a campo (craft, mercado,
// vista da guilda) usa `camposDaPeca`, para nenhum campo novo se perder no
// caminho.
//
// E a CONVERSÃO das peças de antes do sistema de itens (decisão do dono:
// "converter e reescalar"): cada atributo antigo (`tier` 1–3, valor na régua
// antiga) ganha o `nivel` pela posição do valor na régua antiga — 0–20% N1,
// 20–40% N2, 40–60% N3, 60–85% N4, 85–100% N5, acima do topo (a essência
// vermelha) N5 acima do teto — e o valor vai para a MESMA posição dentro da
// faixa nova do nível. A peça sem raridade ganha a da quantidade de atributos
// (0 Comum, 1 Incomum, 2 Raro, 3 Épico). Nada é apagado; é idempotente.
//
// A MIGRAÇÃO v4 (reestruturação de itens, 29/09 — decisão do dono: "converter
// e tirar os extras"): os adds que saíram do jogo viram o add novo mais
// próximo NO MESMO TIER e na mesma posição dentro da faixa (Skill Melee T3 no
// meio → STR T3 no meio); dois que viram o mesmo add ficam num só (o de tier
// mais alto). A armadura mágica (`marmor`) e a armadura das peças que agora
// são de Evasion/Energy Shield viram a base nova pela vocação da peça, com a
// mesma qualidade de sorteio; a peça ganha o Item Level (o nível mínimo dela).
import { REGUA_ANTIGA, NIVEL_MAXIMO, ATRIBUTOS, LEGADO } from './config.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { valorNaFaixa, arredondar, CAMPOS_DA_BASE, rolarBase, aceitaAtributos, SLOTS_DE_JOIA, FATOR_DAS_DUAS } from './gerar.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import { requisitoDe } from '../personagem/requisitos.mjs';
import * as Gemas from '../skills/gemas.mjs';

const ID_DA_ESSENCIA = 900001;
const FAIXAS_ANTIGAS = [[0, 20], [20, 40], [40, 60], [60, 85], [85, 100]];
const RARIDADE_PELA_QUANTIDADE = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico', 'mítico'];

/** Os campos de instância de uma peça, para copiar (sem `id`/`count`). */
export function camposDaPeca(p) {
  if (!p) return {};
  return {
    ...(p.base ? { base: p.base } : {}),
    ...(p.tier ? { tier: p.tier } : {}),
    ...(p.imbu?.length ? { imbu: p.imbu } : {}),
    ...(p.af?.length ? { af: p.af } : {}),
    ...(p.raridade ? { raridade: p.raridade } : {}),
    ...(p.ilvl ? { ilvl: p.ilvl } : {}),
    ...(p.efeito ? { efeito: p.efeito } : {}),
    // Os sockets (com as gemas encaixadas) e a instância de uma gema solta: vão junto com a peça.
    ...(p.soquetes ? { soquetes: p.soquetes } : {}),
    ...(p.gema ? { gema: p.gema } : {}),
  };
}

/** Um campo do `base` como `[piso, teto]` (aceita o número solto das peças de antes da faixa); `null` se inválido. */
function faixaValida(v) {
  const [a, b] = Array.isArray(v) ? v : [v, v];
  const piso = Math.floor(Number(a));
  const teto = Math.floor(Number(b));
  // [0, 0] é válido: a peça só-mágica tem a armadura física ZERADA (e não o valor do catálogo).
  const zeroDeVerdade = Array.isArray(v) && piso === 0 && teto === 0;
  return (piso > 0 && teto > 0) || zeroDeVerdade ? [piso, Math.max(piso, teto)] : null;
}

/** O `base` de uma peça só com os campos e faixas válidos (vem do cliente em `comparar`, e do save). */
export function baseValida(base) {
  const saida = {};
  for (const campo of CAMPOS_DA_BASE) {
    const faixa = faixaValida(base?.[campo]);
    if (faixa) saida[campo] = faixa;
  }
  return saida;
}

/** `[piso, teto]` de um campo da peça: o sorteado no drop, ou o valor cheio do catálogo (faixa de largura zero). */
export function faixaDoCampo(p, campo) {
  const sorteada = faixaValida(p?.base?.[campo]);
  if (sorteada) return sorteada;
  const meta = ITEM_CATALOG[p?.id];
  // Sem faixa sorteada, a defesa segue o TIPO da base da peça (Armour, Evasion,
  // Energy Shield — `Atributos.tiposDaBase`), com o valor cheio do catálogo.
  if (DEFESAS.has(campo)) {
    const v = defesaDoCatalogo(meta)[campo] ?? 0;
    return v > 0 ? [v, v] : [0, 0];
  }
  const v = Math.floor(Number(meta?.[campo]));
  return v > 0 ? [v, v] : [0, 0];
}

const DEFESAS = new Set(['armor', 'evasion', 'es']);
/** A defesa de uma peça do catálogo sem sorteio: a armadura dele no tipo da base (joia: Armour). */
function defesaDoCatalogo(meta) {
  const armadura = Math.floor(Number(meta?.armor));
  if (!(armadura > 0)) return {};
  if (SLOTS_DE_JOIA.has(meta.slot) || !aceitaAtributos(meta.id)) return { armor: armadura };
  const v = Atributos.valoresDaBase(Atributos.tiposDaBase(meta), armadura, meta.minLevel ?? 1);
  return { armor: Math.round(v.armour ?? 0), evasion: Math.round(v.evasion ?? 0), es: Math.round(v.es ?? 0) };
}

/**
 * O item do catálogo COM os números desta peça: em cada campo sorteado no drop,
 * a MÉDIA da faixa (é o que a ficha mostra e o que defesa e armadura usam; o
 * ataque de cada golpe sorteia a faixa inteira). Peça sem `base` (kit inicial,
 * loja, drop de antes) segue com o valor cheio do catálogo.
 */
export function metaDaPeca(p) {
  const meta = ITEM_CATALOG[p?.id];
  if (!meta || !p?.base) return meta;
  const medias = {};
  for (const campo of Object.keys(baseValida(p.base))) {
    const [piso, teto] = faixaDoCampo(p, campo);
    medias[campo] = Math.round((piso + teto) / 2);
  }
  return { ...meta, ...medias };
}

/** Converte UM atributo antigo (sem `nivel`); devolve `true` se mudou. */
/** As faixas por tier de um add: o de hoje ou (id que saiu do jogo) o de antes (`legado`). */
const niveisDe = (id) => ATRIBUTOS[id]?.niveis ?? LEGADO[id]?.niveis;
const tipoDe = (id) => ATRIBUTOS[id]?.tipo ?? LEGADO[id]?.tipo;
const arredondarComo = (id, v) => (tipoDe(id) === 'flat' ? Math.round(v) : Math.round(v * 100) / 100);

export function converterAtributo(a) {
  const niveis = a && niveisDe(a.id);
  if (!niveis || a.nivel != null) return false;
  const r = REGUA_ANTIGA[a.id];
  const pct = r && r.max > r.min ? ((Number(a.value) - r.min) / (r.max - r.min)) * 100 : 0;
  if (pct > 100) {
    // A essência vermelha: acima do topo — segue acima do topo na régua nova.
    const [, hi] = niveis[String(NIVEL_MAXIMO)];
    const [n1] = niveis['1'];
    a.value = arredondarComo(a.id, n1 + (pct / 100) * (hi - n1));
    a.nivel = NIVEL_MAXIMO;
  } else {
    // A borda de cima é do nível de baixo: 0–20% N1, (20–40%] N2, ... (85–100%] N5.
    const nivel = FAIXAS_ANTIGAS.findIndex(([, hi]) => pct <= hi + 1e-9) + 1 || FAIXAS_ANTIGAS.length;
    const [lo, hi] = FAIXAS_ANTIGAS[nivel - 1];
    const [tlo, thi] = niveis[String(nivel)];
    a.nivel = nivel;
    a.value = ATRIBUTOS[a.id] ? valorNaFaixa(a.id, nivel, (Math.max(0, pct) - lo) / (hi - lo)) : arredondarComo(a.id, tlo + ((Math.max(0, pct) - lo) / (hi - lo)) * (thi - tlo));
  }
  delete a.tier;
  return true;
}

/**
 * O add novo de cada add que saiu do jogo (v4) — o mais próximo do que ele fazia.
 * Perícias viram o atributo principal que as sustenta; Vida/Mana %, Life/Mana;
 * Onslaught (golpe mais forte), Critical Damage; capacidade, STR (carga).
 */
export const ADD_NOVO_DO_ANTIGO = {
  skill_melee: 'str', skill_fist: 'str', skill_club: 'str', skill_sword: 'str', skill_axe: 'str',
  skill_distance: 'dex', skill_magic: 'int', skill_shielding: 'block',
  hp_max: 'life', mana_max: 'mana', hp_regen: 'life_regen', speed: 'move_speed',
  protect_all: 'phys_res', weapon_atk_pct: 'phys_dmg', onslaught: 'crit_dmg',
  spell_heal: 'int', spell_dmg: 'int', capacity: 'str',
};

/**
 * Troca os adds que saíram do jogo pelo novo (mesmo tier, mesma posição na
 * faixa; acima do teto do T5 — essência vermelha — segue acima). Dois no mesmo
 * add: fica o de tier mais alto (empate: o maior valor). Devolve `true` se mudou.
 */
export function renomearAdds(p) {
  if (!p?.af?.length) return false;
  let mudou = false;
  const saida = [];
  for (const a of p.af) {
    const novo = !ATRIBUTOS[a.id] && ADD_NOVO_DO_ANTIGO[a.id];
    if (novo && ATRIBUTOS[novo]) {
      const velhos = niveisDe(a.id);
      const nivel = Math.min(NIVEL_MAXIMO, Math.max(1, a.nivel ?? 1));
      const [lo, hi] = velhos?.[String(nivel)] ?? [0, 1];
      const pos = hi > lo ? (Number(a.value) - lo) / (hi - lo) : 1;
      const [nlo, nhi] = ATRIBUTOS[novo].niveis[String(nivel)];
      const valor = pos > 1 && nivel === NIVEL_MAXIMO ? arredondar(novo, nlo + pos * (nhi - nlo)) : valorNaFaixa(novo, nivel, pos);
      Object.assign(a, { id: novo, nivel, value: valor });
      mudou = true;
    }
    const igual = saida.findIndex((b) => b.id === a.id);
    if (igual < 0) saida.push(a);
    else {
      const b = saida[igual];
      if ((a.nivel ?? 0) > (b.nivel ?? 0) || ((a.nivel ?? 0) === (b.nivel ?? 0) && Number(a.value) > Number(b.value))) saida[igual] = a;
      mudou = true;
    }
  }
  if (mudou) p.af = saida;
  return mudou;
}

/**
 * A base de defesa de antes (v4): Armour/armadura mágica viram o tipo da base
 * pela vocação da peça (`Atributos.tiposDaBase`), com a MESMA qualidade de
 * sorteio (a faixa sorteada da armadura; as duas juntas valiam 75% cada). E o
 * Item Level que a peça não tinha: o nível mínimo dela. Devolve `true` se mudou.
 */
export function converterBase(p) {
  const meta = ITEM_CATALOG[p?.id];
  if (!meta || !aceitaAtributos(p.id)) return false;
  let mudou = false;
  if (!p.ilvl) {
    p.ilvl = Math.max(1, meta.minLevel ?? 1);
    mudou = true;
  }
  const b = p.base;
  if (!b || (b.evasion ?? b.es) != null) {
    if (b?.marmor) {
      delete b.marmor;
      mudou = true;
    }
    return mudou;
  }
  const fisica = faixaValida(b.armor);
  const magica = faixaValida(b.marmor);
  const tem = (f) => f && f[1] > 0;
  if (!tem(fisica) && !tem(magica)) {
    const tinha = 'marmor' in b;
    delete b.marmor;
    return mudou || tinha;
  }
  const antes = JSON.stringify(b);
  const f = tem(fisica) && tem(magica) ? 1 / FATOR_DAS_DUAS : 1;
  const [piso, teto] = (tem(fisica) ? fisica : magica).map((v) => v * f);
  delete b.marmor;
  if (SLOTS_DE_JOIA.has(meta.slot)) {
    b.armor = [Math.max(1, Math.round(piso)), Math.max(1, Math.round(teto))];
    return mudou || JSON.stringify(b) !== antes;
  }
  const tipos = Atributos.tiposDaBase(meta);
  const dePiso = Atributos.valoresDaBase(tipos, piso, p.ilvl);
  const deTeto = Atributos.valoresDaBase(tipos, teto, p.ilvl);
  const faixa = (k) => [Math.max(1, Math.round(dePiso[k])), Math.max(1, Math.round(deTeto[k]))];
  b.armor = dePiso.armour != null ? faixa('armour') : [0, 0];
  if (dePiso.evasion != null) b.evasion = faixa('evasion');
  if (dePiso.es != null) b.es = faixa('es');
  return mudou || JSON.stringify(b) !== antes;
}

/** Converte UMA peça (atributos + raridade); devolve `true` se mudou. */
export function converterPeca(p) {
  if (!p?.af?.length) return false;
  let mudou = false;
  for (const a of p.af) mudou = converterAtributo(a) || mudou;
  if (!p.raridade && p.id !== ID_DA_ESSENCIA) {
    p.raridade = RARIDADE_PELA_QUANTIDADE[p.af.length] ?? 'mítico';
    mudou = true;
  }
  return mudou;
}

/** Um sorteio repetível (mulberry32) a partir de um texto: a mesma peça lida duas vezes leva a mesma faixa. */
function sorteioDe(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A peça de ANTES das faixas (sem `base`) sorteia a dela agora, com a raridade
 * que já tem (Comum se não tiver). Devolve `true` se mudou. `rng` nulo = sorteio
 * repetível da própria peça: a leitura de um baú, do mercado ou do depósito não
 * pode dar uma faixa diferente a cada vez que a peça é vista. A munição também
 * sorteia (o ataque dela soma ao da arma, em faixa).
 */
export function sortearFaixa(p, rng = null) {
  if (p.base || !aceitaAtributos(p.id)) return false;
  const raridade = raridadeDaPeca(p);
  p.base = rolarBase(p.id, raridade, rng ?? sorteioDe(`${p.id}|${raridade}|${p.tier ?? 0}|${JSON.stringify(p.af ?? [])}`), p.ilvl ?? null);
  return true;
}

/**
 * Converte toda peça dentro de `raiz` (o estado do personagem, o baú da conta,
 * uma oferta do mercado...), onde quer que ela esteja: equipamento, mochila,
 * bolsa de loot, depósito, sacolas do boss. Anda pelo objeto procurando o
 * formato de peça (`id` numérico + `count`, ou + `af` em lista): converte os
 * atributos antigos e sorteia a faixa que faltar. Devolve quantas mudaram.
 */
export function converterTudo(raiz, rng = null, { abrirSoquetes = false } = {}) {
  let n = 0;
  const visitar = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (const x of o) visitar(x);
      return;
    }
    if (typeof o.id === 'number' && (Array.isArray(o.af) || typeof o.count === 'number')) {
      let mudou = converterPeca(o);
      mudou = renomearAdds(o) || mudou;
      mudou = sortearFaixa(o, rng) || mudou;
      mudou = converterBase(o) || mudou;
      // v5: a peça que já existia ganha TODOS os sockets do slot, abertos e ligados (decisão do dono) —
      // só na migração do personagem: peça sem sockets de outro caminho fica com 0.
      if (abrirSoquetes && !o.soquetes && ITEM_CATALOG[o.id]?.slot && !ITEM_CATALOG[o.id]?.stackable) {
        const s = Gemas.soquetesAbertos(ITEM_CATALOG[o.id]);
        if (s) {
          o.soquetes = s;
          mudou = true;
        }
      }
      if (mudou) n++;
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      // Os bichos da caçada não carregam peça (e são a maior parte do estado).
      if (k === 'monstros' || k === 'outrosAndares') continue;
      visitar(v);
    }
  };
  visitar(raiz);
  return n;
}

/** A versão do formato de item do personagem: quem já está nela não precisa ser varrido de novo. */
export const VERSAO_DOS_ITENS = 5; // 2: toda peça equipável sorteia a faixa (ataque/defesa/armadura); 3: a munição também (a 2 a tirou); 4: reestruturação (adds novos, Evasion/Energy Shield, Item Level); 5: sockets e gemas de skill

/** Converte o personagem (uma vez — marca `versaoDosItens`). Devolve quantas peças mudaram. */
export function converterPersonagem(estado) {
  if (!estado || estado.versaoDosItens === VERSAO_DOS_ITENS) return 0;
  // Sorteio de verdade (uma vez só, e fica gravado no personagem).
  const antes = estado.versaoDosItens ?? 0;
  let n = converterTudo(estado, Math.random, { abrirSoquetes: antes < 5 });
  // v5: as magias/runas da barra viram gemas encaixadas (ver `skills/gemas.mjs`).
  if (antes < 5) n += Gemas.migrarPersonagem(estado);
  estado.versaoDosItens = VERSAO_DOS_ITENS;
  return n;
}

/** Equipável que não empilha: é a peça que ganha raridade (e atributos) no drop. */
export const ehEquipavel = (meta) => !!meta?.slot && !meta.stackable;

/**
 * A raridade de uma peça. Equipável: SÓ a do drop (`p.raridade`); sem ela
 * (kit inicial, loja, peça antiga) é comum — o dono: "dos itens equipáveis
 * tire a raridade dos itens, o que define é o drop". O resto (comida,
 * material) segue a do catálogo.
 */
export function raridadeDaPeca(p) {
  if (p?.raridade) return p.raridade;
  const meta = ITEM_CATALOG[p?.id];
  return ehEquipavel(meta) ? 'comum' : meta?.rarity ?? 'comum';
}

/*
 * O catálogo que vai para o cliente leva a defesa PADRÃO das peças que não
 * são só-Armour (`defesaPadrao`: {armor, evasion, es}) — o balão de uma peça
 * sem faixa sorteada (kit inicial, loja) mostra a mesma defesa que a ficha usa
 * (`faixaDoCampo`), e não a armadura crua do catálogo.
 */
for (const meta of Object.values(ITEM_CATALOG)) {
  const d = defesaDoCatalogo(meta);
  if (d.evasion || d.es) meta.defesaPadrao = d;
  // O requisito de atributo (modelo Path of Exile): o balão mostra, e o equipar confere (`personagem/requisitos.mjs`).
  const req = requisitoDe(meta);
  if (req) meta.requisito = req;
}
