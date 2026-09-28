// Barra de ação: magias, runas e poções que o personagem usa numa hunt —
// tanto sozinho (Barra automática) quanto por clique/tecla (`huntAction`).
// Mesmo contrato `{ok, erro?}` de `inventario.mjs`/`loja.mjs`; nunca fala
// com a rede.
//
// ---- O que é REAL aqui, e o que é aproximado ----
//
// O catálogo inteiro é o REAL, capturado ao vivo (`send({t:'actions'})` no
// site original, 2026-09-23 — `gamedata/action-catalog.json`, cópia de
// `api-mapeada/servidor/actionCatalog.json`): 114 magias das 5 vocações, 18
// runas, 12 poções, com palavras, level, magic level, mana, cooldown, grupo,
// elemento, formato da área (`forma`), efeito/projétil, alcance e os 22
// slots com os papéis reais (5 vida, 2 mana, velocidade, 3 suporte, 11
// ataque). Os textos de `blocked` são os mesmos que o original manda.
//
// Aproximado: o `damage` de cada entrada veio JÁ CALCULADO para quem pediu —
// o servidor original não manda a fórmula. Com a mesma captura em dois knights
// (level 90 e 343) o dano vira uma reta por level (`danoNoLevel`): exata nos
// dois pontos medidos, estimada fora deles. Magic level não entra (os dois são
// knights), então magia de mago em mago sai subestimada. Magias de suporte/
// velocidade gastam mana, cooldown e mostram o efeito, mas ainda não aplicam
// buff nenhum, e `overTime` (dano contínuo) não é aplicado.
import { ACTION_CATALOG, ACTION_CATALOG_ALTO, LEVELS_DAS_CAPTURAS, ITEM_CATALOG } from './dados.mjs';
import { removerItem } from './inventario.mjs';
import * as Treino from './treino.mjs';
import * as R from './regras.mjs';
import * as Ficha from './ficha.mjs';
import * as Summon from './summon.mjs';
import * as Arvore from './arvore.mjs';
import * as Proficiencia from './proficiencia.mjs';

export const PAPEL_DO_SLOT = ACTION_CATALOG.papelDoSlot;
export const SLOTS = ACTION_CATALOG.slots;
export const SLOTS_POR_FILEIRA = ACTION_CATALOG.slotsPorFileira;
export const PAPEIS = ACTION_CATALOG.papeis;

const ENTRADAS = [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes, ...ACTION_CATALOG.items];
const POR_ID = new Map(ENTRADAS.map((e) => [e.id, e]));
const ALTO_POR_ID = new Map([...ACTION_CATALOG_ALTO.spells, ...ACTION_CATALOG_ALTO.runes].map((e) => [e.id, e]));

/** O `{min,max}` da entrada no level dado — reta entre as duas capturas reais. */
function danoNoLevel(entry, level) {
  const baixo = entry.damage;
  const alto = ALTO_POR_ID.get(entry.id)?.damage;
  if (!baixo) return { min: 0, max: 0 };
  if (!alto) return { min: baixo.min, max: baixo.max };
  const [l1, l2] = LEVELS_DAS_CAPTURAS;
  const reta = (a, b) => Math.max(1, Math.round(a + ((b - a) * ((level ?? l1) - l1)) / (l2 - l1)));
  const min = reta(baixo.min, alto.min);
  return { min, max: Math.max(min, reta(baixo.max, alto.max)) };
}

// Alcance de runa/magia sem `range` próprio (runas vêm com 7 do original).
const ALCANCE_PADRAO = 7;
const distanciaChebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/*
 * Exportado: `cacadas.mjs::round()` usa a MESMA tabela para o golpe básico de
 * wand/rod (o elemento vem do item, não de uma magia daqui) — uma cor por
 * elemento, um lugar só, em vez de duas tabelas que um dia vão discordar.
 */
export const COR_DO_ELEMENTO = {
  death: '#8f24c9', fire: '#ff9000', ice: '#4fc3ff', physical: '#ff0000',
  energy: '#c832ff', earth: '#7a5c2e', holy: '#ffe066',
};

const doTodos = (entry) => !entry.vocations?.length;

/** Por que ESTE personagem não pode usar a entrada — o mesmo texto do original, ou null. */
function bloqueio(entry, estado) {
  if (!doTodos(entry) && !entry.vocations.includes(estado.vocation)) {
    return entry.kind === 'item' ? `é de ${entry.vocations.join(', ')}` : 'outra vocação';
  }
  if ((entry.level ?? 0) > (estado.level ?? 0)) return `requer level ${entry.level}`;
  const ml = estado.magic?.value ?? 0;
  if ((entry.magicLevel ?? 0) > ml) return `requer magic level ${entry.magicLevel}`;
  return null;
}

/** `send({t:'actions'})` — o catálogo inteiro, como o original: cada entrada com seu `blocked`. */
export function catalogo(estado) {
  const comBloqueio = (entry) => ({
    ...entry,
    ...(entry.damage ? { damage: { ...entry.damage, ...danoNoLevel(entry, estado.level) } } : {}),
    blocked: bloqueio(entry, estado),
  });
  return {
    spells: ACTION_CATALOG.spells.map(comBloqueio),
    runes: ACTION_CATALOG.runes.map(comBloqueio),
    items: ACTION_CATALOG.items.map(comBloqueio),
    slots: SLOTS,
    slotsPorFileira: SLOTS_POR_FILEIRA,
    papeis: PAPEIS,
    papelDoSlot: PAPEL_DO_SLOT,
  };
}

/** `send({t:'actions', action:'set', slot, value})` — `value:null` esvazia o slot. */
export function definir(estado, { slot, value }) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return { ok: false, erro: 'Slot inválido.' };
  if (value == null) {
    (estado.actions ??= Array(SLOTS).fill(null))[slot] = null;
    return { ok: true };
  }
  const entry = POR_ID.get(value.id);
  if (!entry) return { ok: false, erro: 'Essa ação não existe.' };
  if (!entry.papeis.includes(PAPEL_DO_SLOT[slot])) return { ok: false, erro: `Esse slot só aceita ${PAPEIS[PAPEL_DO_SLOT[slot]].nome}.` };
  const motivo = bloqueio(entry, estado);
  if (motivo) return { ok: false, erro: `Não dá: ${motivo}.` };
  (estado.actions ??= Array(SLOTS).fill(null))[slot] = {
    id: entry.id,
    kind: entry.kind,
    enabled: value.enabled !== false,
    minMana: Math.max(0, Number(value.minMana) || 0),
    minTargets: Math.max(1, Number(value.minTargets) || 1),
    maxTargets: Math.max(0, Number(value.maxTargets) || 0),
    conditions: Array.isArray(value.conditions) ? value.conditions : [],
  };
  return { ok: true };
}

/** `send({t:'actions', action:'key', slot, key})` — `key:null` tira a tecla. */
export function trocarTecla(estado, { slot, key }) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return { ok: false, erro: 'Slot inválido.' };
  (estado.hotkeys ??= Array(SLOTS).fill(null))[slot] = key ? String(key).toLowerCase() : null;
  return { ok: true };
}

/** `send({t:'actions', action:'swap', from, to})` — troca os dois slots (ação e tecla). */
export function trocar(estado, { from, to }) {
  if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < SLOTS)) return { ok: false, erro: 'Slot inválido.' };
  const acoes = (estado.actions ??= Array(SLOTS).fill(null));
  const teclas = (estado.hotkeys ??= Array(SLOTS).fill(null));
  [acoes[from], acoes[to]] = [acoes[to], acoes[from]];
  [teclas[from], teclas[to]] = [teclas[to], teclas[from]];
  return { ok: true };
}

/** `send({t:'actionPreset', action:'save', name})` — guarda os slots+teclas atuais com um nome. */
export function salvarPreset(estado, { name }) {
  const nome = String(name ?? '').trim().slice(0, 24);
  if (!nome) return { ok: false, erro: 'Dê um nome ao conjunto.' };
  const presets = (estado.actionPresets ??= []);
  const existente = presets.find((p) => p.name === nome);
  const novo = { name: nome, actions: structuredClone(estado.actions ?? []), hotkeys: structuredClone(estado.hotkeys ?? []) };
  novo.slots = novo.actions.filter(Boolean).length;
  if (existente) Object.assign(existente, novo);
  else presets.push(novo);
  return { ok: true };
}

/** `send({t:'actionPreset', action:'apply', name})`. */
export function aplicarPreset(estado, { name }) {
  const preset = (estado.actionPresets ?? []).find((p) => p.name === name);
  if (!preset) return { ok: false, erro: 'Conjunto não existe mais.' };
  estado.actions = structuredClone(preset.actions);
  estado.hotkeys = structuredClone(preset.hotkeys);
  return { ok: true };
}

/** `send({t:'actionPreset', action:'delete', name})`. */
export function apagarPreset(estado, { name }) {
  estado.actionPresets = (estado.actionPresets ?? []).filter((p) => p.name !== name);
  return { ok: true };
}

/** Uma condição do slot bate com o estado atual? `kind:'stat'` (vida/mana) ou `kind:'nome'` (criatura). */
function condicaoBate(condition, estado, alvo) {
  if (condition.kind === 'nome') {
    if (!alvo) return false;
    const bate = (condition.names ?? []).includes(alvo.name);
    return condition.op === 'diferente' ? !bate : bate;
  }
  const sujeito = condition.who === 'target' ? alvo : estado;
  if (!sujeito) return false;
  const atual = condition.stat === 'mana' ? sujeito.mana : sujeito.hp;
  const maximo = condition.stat === 'mana' ? sujeito.maxMana : sujeito.maxHp;
  const valor = condition.percent ? (100 * (atual ?? 0)) / Math.max(1, maximo ?? 1) : (atual ?? 0);
  return condition.op === 'lte' ? valor <= condition.value : valor >= condition.value;
}

export function condicoesDoSlotBatem(action, estado, alvo) {
  return (action.conditions ?? []).every((c) => condicaoBate(c, estado, alvo));
}

/** Falta vida/mana suficiente para esta cura não ser jogada fora? */
function precisaDeCura(entry, estado) {
  const faltaHp = (estado.maxHp ?? 0) - (estado.hp ?? 0);
  const faltaMana = (estado.maxMana ?? 0) - (estado.mana ?? 0);
  const hp = entry.kind === 'item' ? entry.heal : entry.heals ? [danoNoLevel(entry, estado.level).min] : null;
  const mana = entry.kind === 'item' ? entry.mana : null;
  if (hp && faltaHp >= hp[0]) return true;
  if (mana && faltaMana >= mana[0]) return true;
  // Suporte/velocidade (haste, buffs) não "curam": deixa passar.
  return !hp && !mana;
}

/*
 * ---- Magia de suporte: dura, e só volta quando acaba ----
 *
 * No original a magia de suporte fica LIGADA por um tempo — o card com o
 * relógio acima da barra (`hunt.buffs`, `renderBuffsDaMagia` no hud.mjs) — e a
 * barra só lança de novo quando esse tempo acaba E a recarga já passou. O
 * catálogo real não traz a duração (só o comentário do client: "o magic
 * shield dura mais de três minutos"); estas são as durações do Tibia. `tipo`
 * é o que o client lê: 'shield' (o escudo na vida) e 'speed' (com `mult`, a
 * corrida na ficha).
 */
const BUFFS = {
  'spell-magic-shield': { dur: 200_000, tipo: 'shield' },
  'spell-haste': { dur: 33_000, tipo: 'speed', mult: 1.3 },
  'spell-strong-haste': { dur: 22_000, tipo: 'speed', mult: 1.7 },
  'spell-charge': { dur: 5_000, tipo: 'speed', mult: 1.9 },
  'spell-swift-foot': { dur: 10_000, tipo: 'speed', mult: 1.8 },
  'spell-blood-rage': { dur: 10_000, tipo: 'rage' },
  'spell-sharpshooter': { dur: 10_000, tipo: 'rage' },
  'spell-master-of-decay': { dur: 60_000, tipo: 'postura' },
  'spell-master-of-flames': { dur: 60_000, tipo: 'postura' },
  'spell-master-of-thunder': { dur: 60_000, tipo: 'postura' },
  'spell-divine-defiance': { dur: 60_000, tipo: 'postura' },
  'spell-elemental-synthesis': { dur: 60_000, tipo: 'postura' },
  'spell-shared-conservation': { dur: 60_000, tipo: 'postura' },
  'spell-aura-of-exposed-weakness': { dur: 10_000, tipo: 'aura' },
  'spell-aura-of-sapped-strength': { dur: 10_000, tipo: 'aura' },
  'spell-challenge': { dur: 10_000, tipo: 'desafio' },
  'spell-chivalrous-challenge': { dur: 10_000, tipo: 'desafio' },
};

/** Os buffs ativos agora, no formato do client (`{icone, nome, resta, tipo, mult}`). */
export function buffsAtivos(hunt) {
  const agora = hunt.clock ?? 0;
  const lista = [];
  for (const [id, b] of Object.entries(hunt.buffs ?? {})) {
    if (b.ate <= agora) continue;
    const entry = POR_ID.get(id);
    lista.push({ icone: entry?.icon ?? null, nome: entry?.name ?? id, resta: b.ate - agora, tipo: b.tipo, ...(b.mult ? { mult: b.mult } : {}) });
  }
  return lista.sort((a, b) => a.resta - b.resta);
}

/** Um buff deste tipo está ligado? (o escudo, por exemplo — ver `contraAtaque`). */
export function temBuff(hunt, tipo) {
  const agora = hunt?.clock ?? 0;
  return Object.values(hunt?.buffs ?? {}).some((b) => b.tipo === tipo && b.ate > agora);
}

const sortear = (min, max) => min + Math.floor(Math.random() * Math.max(1, max - min + 1));

/*
 * ---- A recarga das magias de ataque no original: a METADE da do catálogo ----
 *
 * Medido nas duas capturas do Zoros (knight, Winter Dream Court, 5 min,
 * `captura-monstros-0924`): ele lança uma magia de ataque por segundo (mediana
 * 1,02 s entre elas) e relança cada uma na metade da recarga do catálogo —
 * Annihilation 30 s → 14,8 s; Groundshaker 8 s → 3,3 s; Fierce Berserk
 * 6 s → 2,8 s; Shield Bash 4 s → 2,0 s. O golpe básico continua a cada 2 s,
 * igual aqui: não é o relógio da caçada que anda em dobro, são as magias de
 * ataque. E ele não tem bônus de recarga nenhum (derived, árvore, gemas).
 *
 * Aqui a recarga do grupo era 2 s: só saía uma magia a cada 2 s, e da sexta
 * magia da barra para baixo nenhuma chegava a sair ("teste os slots de magia
 * de ataque ... verificando se todas estão sendo utilizadas").
 */
const FATOR_DA_RECARGA_DE_ATAQUE = 0.5;
const recargaDe = (entry, ms) => (entry.papeis?.[0] === 'attack' ? Math.round(ms * FATOR_DA_RECARGA_DE_ATAQUE) : ms);

/** As casas que a `forma` real da magia pega, centradas em (cx, cy). */
/*
 * Onda, feixe e varredura vêm na `forma` olhando para o NORTE (só casas com
 * y <= 0 — ver `AREA_WAVE6` da Front Sweep: [[-1,-1],[0,-1],[1,-1]]). Girar
 * para `dir` (0 norte, 1 leste, 2 sul, 3 oeste, o `dir` do personagem).
 */
const direcional = (entry) => (entry.forma ?? []).some(([, dy]) => dy < 0) && !(entry.forma ?? []).some(([, dy]) => dy > 0);
const girar = ([dx, dy], dir) => (dir === 1 ? [-dy, dx] : dir === 2 ? [-dx, -dy] : dir === 3 ? [dy, -dx] : [dx, dy]);
const casasDaForma = (entry, cx, cy, dir = null) =>
  (entry.forma ?? [[0, 0]]).map((d) => (dir == null ? d : girar(d, dir))).map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }));

/** Os 4 lados, começando pelo que aponta para o alvo (eixo dominante). */
function ordemDosLados(pos, alvo) {
  if (!alvo) return [0, 1, 2, 3];
  const dx = alvo.x - pos.x;
  const dy = alvo.y - pos.y;
  const primeiro = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  return [primeiro, ...[0, 1, 2, 3].filter((d) => d !== primeiro)];
}

/*
 * ---- A poção, pela barra OU pela mochila: as mesmas regras ----
 *
 * A barra (`disparar`) sempre conferiu level e vocação, a recarga e se a
 * poção não seria jogada fora. O uso pela mochila (botão direito / toque longo,
 * `Inventario.usar`) tinha uma cópia própria que só olhava a vocação: um
 * knight level 100 bebia a supreme health potion (level 200), a mesma poção
 * saía duas vezes no mesmo instante (somando com a da barra, na caçada) e era
 * gasta com a vida cheia. Agora a mochila passa por aqui, com as funções que a
 * barra já usa.
 *
 * Recarga: 1 s da própria poção e 1 s para TODAS as poções (vida e mana não
 * saem no mesmo instante, como no Tibia) — os valores que `disparar` já
 * aplicava. Ela mora no relógio da caçada; fora dela não há recarga (a barra
 * também só funciona caçando).
 */
export const RECARGA_DA_POCAO_MS = 1000;
const GRUPO_DAS_POCOES = 'grupo:item';

/** Dá para beber `entry` (uma poção do catálogo) agora? `{ok}` ou `{ok:false, erro, motivo}`. */
export function podeBeberPocao(estado, entry) {
  const motivo = bloqueio(entry, estado);
  if (motivo) return { ok: false, erro: `Não dá: ${motivo}.`, motivo: 'BLOQUEADA' };
  const hunt = estado.hunt;
  if (hunt) {
    const agora = hunt.clock ?? 0;
    for (const chave of [entry.id, GRUPO_DAS_POCOES]) {
      const cd = hunt.cooldowns?.[chave];
      if (cd && !R.jaPode(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: chave === entry.id ? 'COOLDOWN' : 'COOLDOWN_DO_GRUPO', faltaMs: cd.ate - agora };
    }
  }
  if (!precisaDeCura(entry, estado)) return { ok: false, erro: 'Não precisa agora.', motivo: 'NAO_PRECISA' };
  return { ok: true };
}

/** Bebeu: liga a recarga da poção e a de todas as poções (só na caçada). */
export function marcarRecargaDaPocao(estado, entry) {
  const hunt = estado.hunt;
  if (!hunt) return;
  const agora = hunt.clock ?? 0;
  const cds = (hunt.cooldowns ??= {});
  const propria = recargaDe(entry, entry.cooldown ?? RECARGA_DA_POCAO_MS);
  cds[entry.id] = { ate: agora + propria, total: propria };
  cds[GRUPO_DAS_POCOES] = { ate: agora + RECARGA_DA_POCAO_MS, total: RECARGA_DA_POCAO_MS };
}

/**
 * Dispara UM slot — do loop automático (`cacadas.mjs::tique`) ou de um
 * `huntAction` manual. `alvo`/`hunt` vêm de quem chamou (evita import
 * circular com `cacadas.mjs`, que já sabe escolher o alvo com `alvoAtual`).
 * Devolve `{ok, erro?}` e, em caso de sucesso, `eventos` (mesmo formato de
 * `round()`) e `alvo` (se o golpe foi nele — quem chamou decide matar ou não).
 */
export function disparar(estado, hunt, personagem, slot, alvo) {
  const action = estado.actions?.[slot];
  if (!action?.id) return { ok: false, erro: 'Esse slot está vazio.', motivo: 'VAZIO' };
  if (action.enabled === false) return { ok: false, erro: 'Esse slot está desligado.', motivo: 'DESLIGADA' };
  const entry = POR_ID.get(action.id);
  if (!entry) return { ok: false, erro: 'Ação desconhecida.', motivo: 'DESCONHECIDA' };
  // Defesa em profundidade: `definir()` já recusa vocação/level errados ao
  // configurar o slot, mas um arranjo salvo (`actionPresets`) antes de um
  // level up, por exemplo, não passa por ali de novo.
  if (bloqueio(entry, estado)) return { ok: false, erro: 'Você não pode mais usar isso.', motivo: 'BLOQUEADA' };

  const agora = hunt.clock ?? 0;
  const cds = (hunt.cooldowns ??= {});
  const cd = cds[action.id];
  /*
   * ---- O intervalo do combo (R.COMBO_SKILL_INTERVAL_MS) ----
   *
   * Entre a execução REAL da última skill de ataque e esta, no mínimo o
   * intervalo do combo — pelo instante gravado lá embaixo, quando a anterior
   * de fato saiu. Vale para o combo automático e para o clique/tecla, que
   * passam os dois por aqui. Sem folga de tique: é um mínimo, não uma recarga.
   */
  const deAtaque = entry.papeis?.[0] === 'attack';
  if (deAtaque && hunt.ultimoAtaqueEm != null && agora - hunt.ultimoAtaqueEm < R.COMBO_SKILL_INTERVAL_MS) {
    return { ok: false, erro: 'Aguarde o intervalo entre magias.', motivo: 'INTERVALO_DO_COMBO', faltaMs: R.COMBO_SKILL_INTERVAL_MS - (agora - hunt.ultimoAtaqueEm) };
  }
  // `R.jaPode` (meio tique de folga): com tique de 249ms, `agora < ate` fazia
  // uma recarga de 2s esperar 9 tiques (2,24s) em vez de 8.
  if (cd && !R.jaPode(agora, cd.ate)) return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN', faltaMs: cd.ate - agora };
  const grupo = `grupo:${entry.group ?? entry.kind}`;
  // Magias: recarga do grupo (attack/healing/support). Poções: uma recarga só
  // para todas, como no Tibia (vida e mana não saem no mesmo instante). Runa
  // de ATAQUE divide a recarga do grupo com as magias de ataque, como no Tibia:
  // antes ela saía junto, em paralelo, e as três runas de uma barra de knight
  // davam 215 golpes cada em 10 min por cima das magias (sem captura de runa no
  // original para conferir — é a regra do Tibia). Runa de cura continua livre.
  const grupoDeAtaque = entry.kind === 'rune' && entry.papeis?.[0] === 'attack' ? 'grupo:attack' : null;
  const grupoQueConta = grupoDeAtaque ?? (entry.kind !== 'rune' ? grupo : null);
  if (grupoQueConta && cds[grupoQueConta] && !R.jaPode(agora, cds[grupoQueConta].ate)) {
    return { ok: false, erro: 'Ainda recarregando.', motivo: 'COOLDOWN_DO_GRUPO', faltaMs: cds[grupoQueConta].ate - agora };
  }
  // "Custo de mana das magias" da árvore (−1,8% = mais barata).
  const custoDeMana = entry.kind === 'item' ? 0 : Math.max(0, Math.round((entry.mana ?? 0) * (1 + (Ficha.combate(estado).custoDeMana ?? 0))));
  if (custoDeMana && (estado.mana ?? 0) < custoDeMana) return { ok: false, erro: 'Sem mana.', motivo: 'MANA' };

  const papel = entry.papeis[0];
  const ataque = papel === 'attack';
  const vivos = hunt.monstros.filter((b) => b.hp > 0);
  const x = hunt.pos.x;
  const y = hunt.pos.y;

  /*
   * ---- Onde a magia de ataque pega, ANTES de gastar nada ----
   *
   * "as skills não estão acertando os mobs e tá espamando sem parar — o certo
   * é só quando tiver mob no alcance". Duas causas: (1) onda/feixe/varredura
   * (`AREA_WAVE*`, `AREA_BEAM*`, `AREA_SQUAREWAVE*`, a Front Sweep...) vêm no
   * catálogo desenhadas olhando para o NORTE e eram usadas sem girar — batiam
   * no chão vazio atrás do personagem; (2) área em volta dele saía mesmo sem
   * bicho nenhum dentro. Agora a área é calculada primeiro (girada para o lado
   * com mais bichos, começando pelo do alvo) e a magia só sai se pegar pelo
   * menos `minTargets` (1 por padrão, o "Bichos por perto" do slot).
   */
  let atingidos = [];
  let casas = null;
  let virarPara = null;
  if (ataque) {
    const centradoNoAlvo = entry.miraNoChao || entry.alvoNoCentro;
    if (!entry.forma) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      // Sem `range` próprio é golpe de corpo a corpo (Brutal Strike, Tiger Clash...).
      if (distanciaChebyshev(hunt.pos, alvo) > (entry.range || 1)) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      atingidos = [alvo];
    } else if (centradoNoAlvo) {
      if (!alvo) return { ok: false, erro: 'Sem alvo.', motivo: 'SEM_ALVO' };
      if (distanciaChebyshev(hunt.pos, alvo) > (entry.range || ALCANCE_PADRAO)) return { ok: false, erro: 'Alvo fora de alcance.', motivo: 'FORA_DE_ALCANCE' };
      casas = casasDaForma(entry, alvo.x, alvo.y);
    } else {
      const lados = direcional(entry) ? ordemDosLados(hunt.pos, alvo) : [null];
      let melhor = null;
      for (const dir of lados) {
        const cs = casasDaForma(entry, x, y, dir);
        const n = vivos.filter((b) => cs.some((c) => c.x === b.x && c.y === b.y)).length;
        if (!melhor || n > melhor.n) melhor = { dir, cs, n };
      }
      casas = melhor.cs;
      virarPara = melhor.dir;
    }
    if (casas) atingidos = vivos.filter((b) => casas.some((c) => c.x === b.x && c.y === b.y));
    if (atingidos.length < Math.max(1, Number(action.minTargets) || 1)) return { ok: false, erro: 'Nenhum bicho na área.', motivo: 'SEM_BICHO_NA_AREA' };
  } else if (!entry.heals && entry.kind === 'spell' && !vivos.some((b) => distanciaChebyshev(hunt.pos, b) <= 8)) {
    // Suporte/velocidade (haste, buffs): só com bicho por perto, senão era mana jogada fora sem parar.
    return { ok: false, erro: 'Nenhum bicho por perto.', motivo: 'SEM_BICHO_POR_PERTO' };
  }
  // Suporte: não relança enquanto o efeito dele ainda está ligado.
  const buff = BUFFS[entry.id];
  if (buff && !R.jaPode(agora, hunt.buffs?.[entry.id]?.ate)) return { ok: false, erro: 'Ainda está ativo.', motivo: 'EFEITO_ATIVO' };
  if (entry.id === 'spell-cancel-magic-shield' && !temBuff(hunt, 'shield')) return { ok: false, erro: 'Sem escudo para cancelar.', motivo: 'SEM_ESCUDO' };
  // Magia de familiar: só sem um em campo e fora da recarga dele (ver `summon.mjs`).
  if (entry.summon) {
    const pode = Summon.podeInvocar(estado, hunt, hunt.ultimoTique ?? Date.now());
    if (!pode.ok) return { motivo: 'FAMILIAR', ...pode };
  }
  if (!condicoesDoSlotBatem(action, estado, alvo)) return { ok: false, erro: 'Condição não bate.', motivo: 'CONDICAO' };
  // Cura sem condição configurada não é desperdiçada: só sai se faltar pelo
  // menos a cura MÍNIMA dela (o slot novo nasce com `conditions: []` no client,
  // e sem isto a poção de vida saía a cada recarga com a vida cheia).
  if (!ataque && !(action.conditions ?? []).length && !precisaDeCura(entry, estado)) {
    return { ok: false, erro: 'Não precisa agora.', motivo: 'NAO_PRECISA' };
  }

  /*
   * ---- Poção e runa: da mochila, ou compradas na hora ----
   *
   * No original a barra não precisa de estoque: o relatório real mostra
   * "Gasto: 503" poções e "Suprimentos: -79.474 gold" — 503 x 158, o `cost` da
   * great mana potion no catálogo. Ela é paga com o ouro do bolso no momento
   * de usar. Aqui: se tiver na mochila, usa a da mochila (de graça); senão,
   * paga o `cost` do bolso; sem ouro, não sai.
   */
  if (entry.kind === 'item' || entry.kind === 'rune') {
    const preco = entry.cost ?? ITEM_CATALOG[entry.itemId]?.buy ?? 0;
    const daMochila = removerItem(estado, entry.itemId, 1);
    if (!daMochila) {
      if (!preco || (estado.gold ?? 0) < preco) return { ok: false, erro: `Sem ${entry.name} e sem ouro para comprar.`, motivo: 'SEM_SUPRIMENTO' };
      estado.gold -= preco;
    }
    // Conta no relatório da caçada (grupo "Gasto" e a linha "Suprimentos").
    const sessao = hunt.sessao;
    if (sessao) {
      sessao.itens.gastos[entry.itemId] = (sessao.itens.gastos[entry.itemId] ?? 0) + 1;
      sessao.supplies += preco;
    }
  }
  if (custoDeMana) {
    estado.mana = Math.max(0, (estado.mana ?? 0) - custoDeMana);
    Treino.gastarMana(estado, custoDeMana);
  }

  const eventos = [];
  if (virarPara != null) hunt.pos.dir = virarPara;
  if (buff) {
    // Uma velocidade só por vez (a mais nova vale), como no Tibia.
    if (buff.tipo === 'speed') for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === 'speed') delete hunt.buffs[id];
    (hunt.buffs ??= {})[entry.id] = { ate: agora + buff.dur, tipo: buff.tipo, ...(buff.mult ? { mult: buff.mult } : {}) };
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x: hunt.pos.x, y: hunt.pos.y, color: '#f36500' });
  }
  if (entry.id === 'spell-cancel-magic-shield') {
    for (const [id, b] of Object.entries(hunt.buffs ?? {})) if (b.tipo === 'shield') delete hunt.buffs[id];
  }
  if (entry.summon) {
    Summon.invocar(estado, hunt, action, hunt.ultimoTique ?? Date.now());
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x: hunt.pos.x, y: hunt.pos.y, color: '#f36500' });
  }

  if (!ataque) {
    // Cura: poção usa `heal`/`mana` ([min,max]); magia/runa de cura usa `damage`.
    const cura = entry.heals && entry.kind !== 'item' ? danoNoLevel(entry, estado.level) : null;
    const hp = entry.kind === 'item' ? entry.heal : cura ? [cura.min, cura.max] : null;
    const mp = entry.kind === 'item' ? entry.mana : null;
    if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: 'player', x, y });
    if (hp) {
      // "Cura de magia" (afixo) e "Força de cura" (árvore) nas magias de cura
      // (poção não) — e as habilidades Graça e Fonte viva.
      // + "% da perícia como cura" da proficiência, nas magias de cura.
      const bruta = sortear(hp[0], hp[1]) + (entry.kind === 'spell' ? Proficiencia.daPericia(estado, Proficiencia.bonus(estado).periciaNaCura) : 0);
      // + "cura de <magia>" das gemas (supremo).
      const daGema = Ficha.combate(estado).magiasDasGemas?.[action.id]?.cura ?? 0;
      const cura = entry.kind === 'item' ? bruta : Arvore.aoCurarComMagia(estado, Math.round(bruta * (1 + ((Ficha.combate(estado).curaDeMagia ?? 0) + daGema) / 100)));
      estado.hp = Math.min(estado.maxHp ?? estado.hp, (estado.hp ?? 0) + cura);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#00ff66' });
    }
    if (mp) {
      const cura = sortear(mp[0], mp[1]);
      estado.mana = Math.min(estado.maxMana ?? estado.mana, (estado.mana ?? 0) + cura);
      eventos.push({ t: 'heal', uid: 'player', quem: personagem?.nome, x, y, v: cura, color: '#4fc3ff' });
    }
  } else {
    if (entry.words) eventos.push({ t: 'say', uid: 'player', quem: personagem?.nome, text: entry.words, x, y, color: '#f36500' });
    if (entry.projetil && alvo) eventos.push({ t: 'shot', id: entry.projetil, x, y, tx: alvo.x, ty: alvo.y });
    const cor = COR_DO_ELEMENTO[entry.element] ?? COR_DO_ELEMENTO.physical;
    if (casas && entry.efeito) for (const c of casas) eventos.push({ t: 'fx', id: entry.efeito, x: c.x, y: c.y });
    else if (entry.efeito) eventos.push({ t: 'fx', id: entry.efeito, uid: alvo.uid, x: alvo.x, y: alvo.y });
    const { min, max } = danoNoLevel(entry, estado.level);
    const fichaBase = Ficha.combate(estado);
    // Gemas: "+X% dano de <magia>" e "+X% dano crítico de <magia>" (supremos).
    const daGema = fichaBase.magiasDasGemas?.[action.id];
    let ficha = daGema?.critico ? { ...fichaBase, critMultiplier: fichaBase.critMultiplier + daGema.critico / 100 } : fichaBase;
    // Runa: + crítico de runa da proficiência. Magia: + "% da perícia como dano".
    const prof = fichaBase.proficiencia;
    if (entry.kind === 'rune' && (prof.critChanceRunas || prof.critDanoRunas)) ficha = { ...ficha, critChance: ficha.critChance + prof.critChanceRunas, critMultiplier: ficha.critMultiplier + prof.critDanoRunas };
    const daPericia = entry.kind === 'spell' ? Proficiencia.daPericia(estado, prof.periciaNaMagia, fichaBase.skillBonus) : 0;
    let total = 0;
    const danos = [];
    for (const bicho of atingidos) {
      // Cada alvo rola o crítico dele; o leech sai uma vez, do dano somado.
      // "Dano de magia" e "Dano de <elemento>" (afixos e árvore), na magia/runa daquele elemento.
      const mult = 1 + ((ficha.danoDeMagia ?? 0) + (ficha.danoDoElemento?.[entry.element] ?? 0) + (daGema?.dano ?? 0)) / 100;
      const { dano, crit, onslaught } = Ficha.rolarCritico(estado, (sortear(min, max) + daPericia) * mult, bicho, eventos, ficha);
      bicho.hp -= dano;
      total += dano;
      danos.push({ bicho, dano });
      eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: dano, foe: true, crit, onslaught, spell: entry.name, alvo: bicho.name, color: cor });
    }
    // Cataclismo, Arco voltaico, Inverno sem fim, Raiz venenosa (ver `Arvore.depoisDaMagia`).
    if (entry.kind === 'spell') total += Arvore.depoisDaMagia(estado, hunt, entry.element, danos, eventos, cor);
    Ficha.aplicarLeech(estado, total, eventos, personagem?.nome, { x, y }, ficha);
  }

  // Gemas: "-Ns recarga de <magia>" (supremo), sem passar de zero.
  const recarga = Math.max(0, recargaDe(entry, entry.cooldown ?? 1000) - (Ficha.combate(estado).magiasDasGemas?.[action.id]?.recargaMs ?? 0));
  cds[action.id] = { ate: agora + recarga, total: recarga };
  // O familiar: o slot mostra a espera dele (17 min no nível 0, 2 min no 100).
  if (entry.summon) cds[action.id] = { ate: agora + Summon.recarga(estado), total: Summon.recarga(estado) };
  if (entry.kind === 'spell' || grupoDeAtaque) {
    const doGrupo = recargaDe(entry, entry.groupCooldown ?? (grupoDeAtaque ? 2000 : 0));
    cds[grupoQueConta] = { ate: agora + doGrupo, total: doGrupo };
  }
  if (entry.kind === 'item') cds[grupo] = { ate: agora + RECARGA_DA_POCAO_MS, total: RECARGA_DA_POCAO_MS };
  // A execução REAL de uma skill de ataque: é daqui que o intervalo do combo conta.
  if (deAtaque) hunt.ultimoAtaqueEm = agora;
  return { ok: true, eventos };
}
