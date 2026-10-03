// A BIBLIOTECA de conteúdos do editor de Acts: só LEITURA, sobre os cadastros que o jogo já usa (nada é copiado nem gravado).
// Funções puras — quem fala HTTP é `admin/conteudo-http.mjs` (`/api/mapas/_conteudo/biblioteca…`, prefixo trancado ao público).
// Regra: nunca inventar valor. O que o cadastro não traz sai como `null` (a tela escreve "não cadastrado").
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO, ITEM_CATALOG, MONTARIAS_REAIS } from '../systems/dados.mjs';
import * as ConfigDeItens from '../systems/itens/config.mjs';
import { tipoDoItem, aceitaAtributos, poolDe, gerarItem, armaduraBase, ataqueBaseDaJoia, SLOTS_DE_JOIA } from '../systems/itens/gerar.mjs';
import { CONFIG as CONFIG_DE_GEMAS, maximoDeSockets } from '../systems/skills/gemas.mjs';
import { CRITICO_POR_PECA } from '../systems/aparencia.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Premium from '../systems/premium.mjs';
import { PORTAS_DE_ACESSO } from '../engine/portas-de-acesso.mjs';
import * as Arquivos from '../systems/encontros/arquivos.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import { TEMPO_NA_SALA_MS } from '../systems/bosses.mjs';
import { exigidasDaFase } from '../systems/campanha-conteudo.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const lerJson = (arq) => JSON.parse(readFileSync(join(RAIZ, arq), 'utf8'));
const PODERES_BOSS = lerJson('boss-poderes.json').bosses ?? {};
const PODERES_MONSTRO = lerJson('monstro-poderes.json').monstros ?? {};

export const CATEGORIAS = [
  ['hunts', 'Hunts normais'],
  ['vips', 'Hunts VIP'],
  ['especiais', 'Hunts especiais'],
  ['divinas', 'Hunts divinas'],
  ['bosses', 'Bosses'],
  ['monstros', 'Monstros'],
  ['mapas', 'Mapas e áreas'],
  ['itens', 'Itens'],
  ['drops', 'Tabelas de drops'],
  ['encontros', 'Recompensas e eventos'],
  ['outfits', 'Outfits'],
  ['montarias', 'Montarias'],
];
const DE_HUNT = { hunts: () => CATALOGO.hunts, vips: () => CATALOGO.vips, especiais: () => CATALOGO.especiais, divinas: () => CATALOGO.divinas, bosses: () => CATALOGO.bosses };
const TIPO_DA_HUNT = { hunts: 'hunt normal', vips: 'hunt vip', especiais: 'hunt especial', divinas: 'hunt divina', bosses: 'boss' };

const ou = (v) => (v === undefined || v === '' ? null : v);
const fase = (id) => Campanha.faseDe(id);
const nomeDoItem = (id) => ITEM_CATALOG[id]?.name ?? null;
const arquivoDeMapa = (id) => existsSync(join(RAIZ, 'hunts', `${id}-map.json`));

/** Lê os encontros direto do arquivo da fase (a pasta é a que o jogo usa). */
function encontrosDoArquivo(huntId) {
  const arq = join(Arquivos.PASTA, `${huntId}.json`);
  if (!existsSync(arq)) return null;
  try {
    return JSON.parse(readFileSync(arq, 'utf8')).encontros ?? [];
  } catch {
    return null;
  }
}

/** Referências a itens que não existem no catálogo (aviso para quem monta drops). */
const itensQuebrados = (ids) => [...new Set(ids.filter((id) => id != null && !ITEM_CATALOG[id]))];

function monstroResumo(key) {
  const m = CATALOGO.bestiary[key];
  return m ? { key, nome: m.name, hp: ou(m.hp), exp: ou(m.exp), look: ou(m.look), desenho: desenhoDoMonstro(m) } : { key, nome: null, cadastrado: false, desenho: null };
}

// ------------------------------------------------------------------ listagem

// O DESENHO de cada linha, para a tela pôr o sprite real no card (`sprites.mjs` do jogo): criatura = `look` + cores
// (ou `lookItem`, o bicho que é um objeto); item = o próprio id. Sem desenho cadastrado: `null` (a tela põe o marcador).
// Só conta como desenho o que EXISTE nos atlas que o cliente baixa (o cadastro pode apontar um `look` sem folha).
const OUTFITS = new Set(Object.keys(lerJson('outfits.json')));
const SPRITES_DE_ITEM = new Set(Object.keys(lerJson('item-sprites.json')));
const temOutfit = (look) => OUTFITS.has(String(look));
const temSpriteDeItem = (id) => SPRITES_DE_ITEM.has(String(id));
const desenhoDoMonstro = (m) => (m?.look && temOutfit(m.look) ? { tipo: 'criatura', look: m.look, cores: m.colors ?? null } : m?.lookItem && temSpriteDeItem(m.lookItem) ? { tipo: 'item', id: m.lookItem } : null);
const desenhoDaHunt = (h) => {
  const c = (h.creatures ?? []).find((x) => CATALOGO.bestiary[x.key]);
  return c ? desenhoDoMonstro(CATALOGO.bestiary[c.key]) : null;
};
const desenhoDoItem = (i) => (i && temSpriteDeItem(i.id) ? { tipo: 'item', id: Number(i.id) } : null);
/** Quantas referências quebradas (itens que não existem) a linha tem — o selo de alerta do card. */
const alertasDoMonstro = (m) => itensQuebrados((m?.loot ?? []).map((l) => l.id)).length;

function linhasDeHunt(cat) {
  return (DE_HUNT[cat]() ?? []).map((h) => {
    const key = cat === 'bosses' ? h.creatures?.[0]?.key : null;
    return { id: h.id, nome: h.name ?? null, categoria: cat, tipo: TIPO_DA_HUNT[cat], nivel: ou(h.level), desenho: key && CATALOGO.bestiary[key] ? desenhoDoMonstro(CATALOGO.bestiary[key]) : desenhoDaHunt(h), raridade: null, usos: usosDe(cat === 'bosses' ? 'bosses' : 'hunts', h.id).length, alertas: key ? alertasDoMonstro(CATALOGO.bestiary[key]) : 0, monstros: (h.creatures ?? []).length };
  });
}
function linhasDeMonstros() {
  return Object.entries(CATALOGO.bestiary).map(([key, m]) => ({ id: key, nome: m.name ?? null, categoria: 'monstros', tipo: m.boss ? 'boss' : (m.class ?? null), nivel: null, desenho: desenhoDoMonstro(m), raridade: m.stars > 0 ? `${m.stars} estrela(s)` : null, usos: usosDe('monstros', key).length, alertas: alertasDoMonstro(m), hp: ou(m.hp) }));
}
function linhasDeMapas() {
  const dir = join(RAIZ, 'hunts');
  return readdirSync(dir).filter((a) => a.endsWith('-map.json')).map((a) => {
    const id = a.slice(0, -'-map.json'.length);
    return { id, nome: id, categoria: 'mapas', tipo: 'mapa', nivel: null, desenho: null, raridade: null, usos: usosDe('mapas', id).length, alertas: 0 };
  });
}
function linhasDeItens() {
  // `nivel` do item = o nível mínimo para usar (`minLevel`); `sockets` = o máximo do slot (o que cada peça abre é sorteado no drop).
  return Object.values(ITEM_CATALOG).map((i) => ({ id: String(i.id), nome: i.name ?? null, categoria: 'itens', tipo: i.type ?? null, nivel: ou(i.minLevel), desenho: desenhoDoItem(i), raridade: ou(i.rarity), usos: usosDe('itens', String(i.id)).length, alertas: 0, slot: ou(i.slot), sockets: maximoDeSockets(i) || null }));
}
// Os outfits e as montarias de verdade (`mounts-real.json`, o que a aba Aparência e a Store usam). `vocation` do
// outfit é o SEXO do boneco (0 feminino, 1 masculino), como no protocolo do cliente.
const SEXO = { 0: 'feminino', 1: 'masculino' };
function linhasDeOutfits() {
  return (MONTARIAS_REAIS.outfits ?? []).map((o) => ({ id: `${o.look}`, nome: o.name ?? null, categoria: 'outfits', tipo: SEXO[o.vocation] ?? null, nivel: null, desenho: temOutfit(o.look) ? { tipo: 'criatura', look: o.look, cores: null } : null, raridade: o.owned ? 'grátis' : 'loja', usos: 0, alertas: 0 }));
}
function linhasDeMontarias() {
  return (MONTARIAS_REAIS.mounts ?? []).map((m) => ({ id: `${m.id}`, nome: m.name ?? null, categoria: 'montarias', tipo: m.type ?? null, nivel: null, desenho: temOutfit(m.look) ? { tipo: 'criatura', look: m.look, cores: null } : null, raridade: m.premium ? 'premium' : 'livre', usos: 0, alertas: 0, velocidade: ou(m.speed) }));
}
function linhasDeDrops() {
  const tabelas = Object.keys(CONFIG.tabelas ?? {}).map((id) => ({ id: `tabela:${id}`, nome: id, categoria: 'drops', tipo: 'tabela reutilizável de encontro', nivel: null, desenho: null, raridade: null, usos: 0, alertas: 0 }));
  return tabelas;
}
function linhasDeEncontros() {
  const dir = Arquivos.PASTA;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((a) => a.endsWith('.json')).map((a) => {
    const id = a.slice(0, -5);
    const enc = encontrosDoArquivo(id) ?? [];
    return { id, nome: fase(id)?.nome ?? id, categoria: 'encontros', tipo: 'encontros da fase', nivel: null, desenho: null, raridade: null, usos: 0, alertas: itensQuebrados(enc.flatMap((e) => (e.recompensa?.drops ?? []).map((d) => d.id))).length, encontros: enc.length };
  });
}

// ------------------------------------------------------------------ onde cada conteúdo é usado

/**
 * O índice de USO (montado uma vez, na primeira consulta — os cadastros só mudam com o servidor reiniciando):
 * `{ categoria: Map<id, [{ categoria, id, nome, como }]> }`. `categoria` da referência pode não ser da Biblioteca
 * (`atos`, `bosses-unicos`): a tela mostra como texto. Só leitura.
 */
let INDICE = null;
function indiceDeUsos() {
  if (INDICE) return INDICE;
  const ix = { monstros: new Map(), itens: new Map(), hunts: new Map(), bosses: new Map(), mapas: new Map() };
  // Uma referência por (categoria, id): a mesma hunt como "monstro" e "spawn" vira UMA linha, com os dois papéis.
  const por = (cat, id, ref) => {
    const k = String(id);
    const l = ix[cat].get(k) ?? [];
    const ja = l.find((r) => r.categoria === ref.categoria && r.id === ref.id);
    if (!ja) l.push({ ...ref });
    else if (!ja.como.split(' · ').includes(ref.como)) ja.como = `${ja.como} · ${ref.como}`;
    ix[cat].set(k, l);
  };
  for (const cat of Object.keys(DE_HUNT)) {
    for (const h of DE_HUNT[cat]() ?? []) {
      const ref = { categoria: cat, id: h.id, nome: h.name ?? h.id };
      for (const c of h.creatures ?? []) por('monstros', c.key, { ...ref, como: cat === 'bosses' ? 'criatura do boss' : 'monstro da hunt' });
      for (const l of Object.values(h.spawnPorAndar ?? {})) for (const s of l) por('monstros', s.key, { ...ref, como: 'spawn da hunt' });
      for (const i of h.itens ?? []) por('itens', i?.id ?? i, { ...ref, como: 'item da hunt' });
      const mapa = arquivoDeMapa(h.id) ? h.id : h.online && arquivoDeMapa(h.online) ? h.online : null;
      if (mapa) por('mapas', mapa, { ...ref, como: 'mapa da hunt' });
    }
  }
  for (const [key, m] of Object.entries(CATALOGO.bestiary)) {
    for (const l of m.loot ?? []) por('itens', l.id, { categoria: 'monstros', id: key, nome: m.name ?? key, como: `loot do monstro (${Number(((l.chance ?? 0) * (l.chance <= 1 ? 100 : 1)).toFixed(4))}%)` });
  }
  Campanha.FASES.forEach((f, i) => por('hunts', f.huntId, { categoria: 'atos', id: `ato-${f.ato}`, nome: `Ato ${f.ato}`, como: `fase ${i + 1} da campanha` }));
  for (let n = 1; n <= Campanha.ATOS; n++) {
    const b = Campanha.bossDoAto(n);
    if (b?.bossId) por('bosses', b.bossId, { categoria: 'atos', id: `ato-${n}`, nome: `Ato ${n}`, como: 'boss final do ato' });
  }
  for (const b of Catalogo.todos?.() ?? []) if (b.base) por('monstros', b.base, { categoria: 'bosses-unicos', id: b.id, nome: b.nome ?? b.id, como: 'criatura-base do boss único' });
  const dir = Arquivos.PASTA;
  if (existsSync(dir)) {
    for (const a of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const huntId = a.slice(0, -5);
      for (const e of encontrosDoArquivo(huntId) ?? []) {
        for (const d of e.recompensa?.drops ?? []) por('itens', d.id, { categoria: 'encontros', id: huntId, nome: fase(huntId)?.nome ?? huntId, como: `drop do encontro ${e.id} (${d.chance}%)` });
        for (const g of e.criaturas ?? []) if (g?.key) por('monstros', g.key, { categoria: 'encontros', id: huntId, nome: fase(huntId)?.nome ?? huntId, como: `criatura do encontro ${e.id}` });
      }
    }
  }
  INDICE = ix;
  return ix;
}
const CATEGORIA_DO_USO = { hunts: 'hunts', vips: 'hunts', especiais: 'hunts', divinas: 'hunts', bosses: 'bosses', monstros: 'monstros', itens: 'itens', mapas: 'mapas' };
/** Onde o conteúdo é usado (lista vazia se não é usado, ou se a categoria não tem índice). */
export function usosDe(categoria, id) {
  const cat = CATEGORIA_DO_USO[categoria];
  return cat ? (indiceDeUsos()[cat].get(String(id)) ?? []) : [];
}

function todasAsLinhas(cat) {
  if (DE_HUNT[cat]) return linhasDeHunt(cat);
  if (cat === 'monstros') return linhasDeMonstros();
  if (cat === 'mapas') return linhasDeMapas();
  if (cat === 'itens') return linhasDeItens();
  if (cat === 'drops') return linhasDeDrops();
  if (cat === 'encontros') return linhasDeEncontros();
  if (cat === 'outfits') return linhasDeOutfits();
  if (cat === 'montarias') return linhasDeMontarias();
  return null;
}

/** Contagem por categoria (a entrada da tela). */
export function resumo() {
  return CATEGORIAS.map(([id, nome]) => ({ id, nome, total: todasAsLinhas(id)?.length ?? 0 }));
}

/**
 * Busca com filtros. `categoria` obrigatória; `q` casa nome OU id (sem acento/caixa); `tipo` exato; `nivelMin/nivelMax` só valem onde o
 * cadastro tem nível; `ordem`: 'nome' (padrão) | 'nivel' | 'id'. Pagina por `limite` (até 200) e `deslocamento`.
 */
export function listar({ categoria, q, tipo, raridade, slot, situacao, nivelMin, nivelMax, ordem = 'nome', limite = 100, deslocamento = 0 } = {}) {
  const base = todasAsLinhas(categoria);
  if (!base) return { ok: false, erros: [`Categoria desconhecida: ${categoria}.`] };
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q).trim();
  const min = nivelMin === '' || nivelMin == null ? null : Number(nivelMin);
  const max = nivelMax === '' || nivelMax == null ? null : Number(nivelMax);
  let r = base.filter((l) => {
    if (t && !norm(l.nome).includes(t) && !norm(l.id).includes(t)) return false;
    if (tipo && l.tipo !== tipo) return false;
    if (raridade && l.raridade !== raridade) return false;
    if (slot && l.slot !== slot) return false;
    // `situacao`: o que pede atenção — sem desenho, com referência quebrada, sem uso nenhum.
    if (situacao === 'sem-desenho' && l.desenho) return false;
    if (situacao === 'alerta' && !l.alertas) return false;
    if (situacao === 'sem-uso' && l.usos) return false;
    if (min != null && Number.isFinite(min) && !(l.nivel != null && l.nivel >= min)) return false;
    if (max != null && Number.isFinite(max) && !(l.nivel != null && l.nivel <= max)) return false;
    return true;
  });
  const chave = ordem === 'nivel' ? (l) => l.nivel ?? Infinity : ordem === 'id' ? (l) => norm(l.id) : ordem === 'usos' ? (l) => -l.usos : (l) => norm(l.nome ?? l.id);
  r = r.sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0));
  const total = r.length;
  const tam = Math.min(200, Math.max(1, Number(limite) || 100));
  const de = Math.max(0, Number(deslocamento) || 0);
  return { ok: true, categoria, total, tipos: [...new Set(base.map((l) => l.tipo).filter(Boolean))].sort(), raridades: [...new Set(base.map((l) => l.raridade).filter(Boolean))].sort(), slots: [...new Set(base.map((l) => l.slot).filter(Boolean))].sort(), temNivel: base.some((l) => l.nivel != null), itens: r.slice(de, de + tam) };
}

// ------------------------------------------------------------------ detalhes

function requisitosDaHunt(h, cat) {
  const tranca = Premium.trancaDaHunt(h);
  const f = fase(h.id);
  return {
    acesso: tranca ? { tipo: tranca, premium: true, pergaminho: tranca === 'vip' ? null : (PORTAS_DE_ACESSO[tranca]?.nome ?? null), levelMinimo: ou(h.level) } : null,
    campanha: f ? { ato: f.ato, exige: exigidasDaFase(h.id) ?? null } : null,
    task: cat === 'bosses' ? ou(h.task) : null,
  };
}

function detalheDeHunt(cat, id) {
  const h = (DE_HUNT[cat]() ?? []).find((x) => x.id === id);
  if (!h) return null;
  const f = fase(id);
  const enc = encontrosDoArquivo(id);
  const spawn = h.spawnPorAndar ? Object.entries(h.spawnPorAndar).map(([andar, l]) => ({ andar: Number(andar), monstros: l.map((s) => ({ key: s.key, nome: s.name ?? null, peso: ou(s.weight) })) })) : null;
  const dropsDeEncontro = (enc ?? []).flatMap((e) => (e.recompensa?.drops ?? []).map((d) => ({ encontro: e.id, tipo: e.tipo, item: d.id, nome: nomeDoItem(d.id), chancePct: d.chance })));
  return {
    id: h.id,
    nome: ou(h.name),
    categoria: cat,
    tipo: TIPO_DA_HUNT[cat],
    descricao: ou(h.blurb),
    mapa: { arquivo: arquivoDeMapa(h.id) ? `${h.id}-map.json` : arquivoDeMapa(h.online) ? `${h.online}-map.json` : null, origem: ou(h.origin), largura: ou(h.limite?.w), altura: ou(h.limite?.h), partida: ou(h.partida) },
    nivel: { atual: ou(h.level), campanha: f ? f.nivel : null, levelOriginal: f ? f.levelOriginal : null },
    monstros: (h.creatures ?? []).map((c) => monstroResumo(c.key)),
    spawn: { densidade: ou(h.density), forcaDosBichos: ou(h.forcaDosBichos), porAndar: spawn, modo: ou(h.modo), versaoOnline: ou(h.online) },
    dificuldade: f ? { tipo: 'campanha', escala: Object.keys(Campanha.CAMPANHA.dificuldades), ato: f.ato } : null,
    requisitos: requisitosDaHunt(h, cat),
    cooldowns: { horas: ou(h.cooldownHours), semEspera: h.semEspera === true ? true : null },
    duracao: { naSalaMs: cat === 'bosses' ? TEMPO_NA_SALA_MS : null, instancia: 'a hunt de campanha fica limpa e recomeça (pausa do "Hunt Clear!" em gamedata/instancias.json)' },
    drops: { porMonstro: 'ver cada monstro (loot do bestiário)', lootCount: ou(h.lootCount), itensDaHunt: ou(h.itens?.length ? h.itens : null), deEncontros: dropsDeEncontro.length ? dropsDeEncontro : null },
    recompensas: { exp: ou(h.exp), hp: ou(h.hp), encontros: enc ? enc.length : null, primeiraVitoria: Campanha.ehBossDeAto?.(id) ? 'libera o próximo ato (campanha)' : null },
    especiais: { campanha: f ? { huntId: f.huntId, pular: f.pular ?? null } : null, bossDeAto: Campanha.ehBossDeAto?.(id) ? { ato: Campanha.atoDoBoss(id) } : null, naMao: ou(h.naMao) },
    referenciasQuebradas: { itens: itensQuebrados([...dropsDeEncontro.map((d) => d.item), ...(h.itens ?? []).map((i) => i?.id ?? i)]) },
  };
}

function detalheDeMonstro(key) {
  const m = CATALOGO.bestiary[key];
  if (!m) return null;
  const loot = (m.loot ?? []).map((l) => ({ item: l.id, nome: l.name ?? nomeDoItem(l.id), chancePct: ou(l.chance != null ? Number((l.chance * (l.chance <= 1 ? 100 : 1)).toFixed(4)) : null) }));
  return {
    id: key,
    nome: ou(m.name),
    categoria: 'monstros',
    tipo: m.boss ? 'boss' : ou(m.class),
    sprite: { look: ou(m.look), lookItem: ou(m.lookItem), cores: ou(m.colors) },
    atributos: { hp: ou(m.hp), exp: ou(m.exp), armadura: ou(m.armor), velocidade: ou(m.speed), raca: ou(m.race), estrelas: ou(m.stars) },
    resistencias: ou(m.elements && Object.keys(m.elements).length ? m.elements : null),
    habilidades: PODERES_MONSTRO[key]?.ataques ?? PODERES_BOSS[key]?.ataques ?? null,
    curas: PODERES_MONSTRO[key]?.curas ?? PODERES_BOSS[key]?.curas ?? null,
    bestiario: { classe: ou(m.class), abatesParaCompletar: ou(m.toKill), pontosDeCharm: ou(m.charmPoints), ocorrencia: ou(m.occurrence), ondeVive: ou(m.locations) },
    drops: { modelo: 'chance individual por item, por morte (loot do bestiário)', itens: loot.length ? loot : null },
    referenciasQuebradas: { itens: itensQuebrados(loot.map((l) => l.item)) },
  };
}

function detalheDeBoss(id) {
  const base = detalheDeHunt('bosses', id);
  if (!base) return null;
  const key = CATALOGO.bosses.find((b) => b.id === id)?.creatures?.[0]?.key ?? id;
  const mob = detalheDeMonstro(key);
  const unico = Catalogo.bossUnico?.(id) ?? null;
  return {
    ...base,
    sprite: mob?.sprite ?? null,
    atributos: mob?.atributos ?? null,
    resistencias: mob?.resistencias ?? null,
    habilidades: PODERES_BOSS[id]?.ataques ?? PODERES_BOSS[key]?.ataques ?? mob?.habilidades ?? null,
    dano: (PODERES_BOSS[id] ?? PODERES_BOSS[key])?.ataques?.map((a) => ({ tipo: a.tipo, min: a.min ?? null, max: a.max ?? null })) ?? null,
    arena: base.mapa,
    drops: { ...base.drops, doBoss: mob?.drops?.itens ?? null },
    bossUnico: unico ? { categoria: unico.categoria ?? null } : null,
    referenciasQuebradas: { itens: [...new Set([...(base.referenciasQuebradas?.itens ?? []), ...(mob?.referenciasQuebradas?.itens ?? [])])] },
  };
}

function detalheDeMapa(id) {
  const arq = join(RAIZ, 'hunts', `${id}-map.json`);
  if (!existsSync(arq)) return null;
  const usadoPor = [];
  for (const cat of Object.keys(DE_HUNT)) for (const h of DE_HUNT[cat]() ?? []) if (h.id === id || h.online === id) usadoPor.push({ categoria: cat, id: h.id, nome: ou(h.name) });
  return { id, nome: id, categoria: 'mapas', tipo: 'mapa', arquivo: `${id}-map.json`, tamanhoBytes: statSync(arq).size, usadoPor: usadoPor.length ? usadoPor : null, observacao: 'Em produção `gamedata/hunts` é sobreposto por `data/mapas`; esta é a cópia do código.' };
}

/**
 * O que a peça deste item PODE ter, tirado das regras de drop (`itens/raridades.json`, `pools.json`, `atributos.json`,
 * `skills/config` dos sockets) — nada sorteado nem inventado: a faixa da base por raridade, quantos atributos, o poder,
 * os atributos possíveis e os sockets.
 */
function regrasDoItem(meta) {
  const R = ConfigDeItens.RARIDADES.raridades;
  const joia = SLOTS_DE_JOIA.has(meta.slot);
  const valores = { attack: joia ? ataqueBaseDaJoia(meta) : Number(meta.attack) || 0, defense: joia ? 0 : Number(meta.defense) || 0, armor: armaduraBase(meta) };
  const porRaridade = Object.fromEntries(ConfigDeItens.ORDEM.map((r) => {
    const f = R[r]?.base ?? { piso: [1, 1], teto: [1, 1] };
    const faixas = Object.fromEntries(Object.entries(valores).filter(([, v]) => v > 0).map(([c, v]) => [c, [Math.max(1, Math.round(v * f.piso[0])), Math.max(1, Math.round(v * f.teto[1]))]]));
    return [r, { nome: ConfigDeItens.nomeDaRaridade(r), quantosAtributos: R[r]?.atributos ?? null, poder: R[r]?.efeito ?? null, chanceDoPoder: R[r]?.efeito ? R[r]?.chanceDoEfeito ?? 1 : null, faixaDaBase: faixas, ...(joia ? { conteudoDaJoia: R[r]?.joia ?? null } : {}) }];
  }));
  const pool = poolDe(Number(meta.id)).map((id) => {
    const a = ConfigDeItens.ATRIBUTOS[id] ?? {};
    return { id, nome: a.nome ?? id, tipo: a.tipo ?? null, categoria: a.categoria ?? null, peso: a.peso ?? null, nivelMinimo: a.nivelMinimo ?? null, raridades: a.raridades ?? null, faixasPorTier: a.niveis ?? null };
  });
  const max = maximoDeSockets(meta);
  return {
    tipoDaPeca: tipoDoItem(meta),
    aceitaAtributos: aceitaAtributos(Number(meta.id)),
    porRaridade,
    atributosPossiveis: pool,
    sockets: max ? { maximo: max, porRaridade: CONFIG_DE_GEMAS.sockets.drop } : null,
  };
}

function detalheDeItem(id) {
  const i = ITEM_CATALOG[id];
  if (!i) return null;
  const equipavel = !!i.slot && !i.stackable;
  return {
    id: String(i.id), nome: ou(i.name), categoria: 'itens', tipo: ou(i.type), raridade: ou(i.rarity), slot: ou(i.slot), equipavel,
    peso: ou(i.weight), empilhavel: ou(i.stackable), compra: ou(i.buy), venda: ou(i.sell), npc: ou(i.npc), chanceBase: ou(i.dropChance), sprite: ou(i.hasSprite),
    requisitos: { nivelMinimo: ou(i.minLevel), vocacoes: ou(i.vocations) },
    base: { ataque: ou(i.attack), defesa: ou(i.defense), defesaExtra: ou(i.extraDefense), armadura: ou(i.armor), elemento: ou(i.element), alcance: ou(i.range), duasMaos: ou(i.twoHanded), velocidade: ou(i.speed), habilidade: ou(i.skill) },
    imbuements: i.imbuementSlots ? { slots: i.imbuementSlots, tipos: ou(i.imbuementTipos) } : null,
    regras: equipavel ? regrasDoItem(i) : null,
    meta: i,
  };
}

/** Semente → gerador pseudo-aleatório (mulberry32): a mesma semente dá as mesmas peças de exemplo. */
function rngDaSemente(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Os dados da PRÉVIA DO TOOLTIP: o catálogo do item e as réguas que o balão do jogo usa (afixos, poderes, tiers), e
 * peças de EXEMPLO sorteadas pelo gerador do jogo (`gerarItem`) em cada raridade, no `itemLevel` pedido. São exemplos
 * do que pode cair — o mesmo sorteio do drop, com semente fixa —, não peças de ninguém.
 */
export function dadosDoTooltip(id, { itemLevel = null, semente = 1 } = {}) {
  const meta = ITEM_CATALOG[id];
  if (!meta) return null;
  const nivel = Math.max(1, Math.min(2000, Math.round(Number(itemLevel) || meta.minLevel || 1)));
  const rng = rngDaSemente(Number(semente) || 1);
  const exemplos = aceitaAtributos(Number(id)) ? ConfigDeItens.ORDEM.map((r) => ({ raridade: r, peca: gerarItem({ itemId: Number(id), raridade: r, itemLevel: nivel, rng }) })) : [];
  return { itens: { [id]: meta }, catalogo: { afixos: CATALOGO.afixos, efeitosDeItem: CATALOGO.efeitosDeItem, efeitosDeTier: CATALOGO.efeitosDeTier }, itemLevel: nivel, semente: Number(semente) || 1, exemplos };
}

function detalheDeOutfit(id) {
  const o = (MONTARIAS_REAIS.outfits ?? []).find((x) => String(x.look) === String(id));
  if (!o) return null;
  return { id: String(o.look), nome: ou(o.name), categoria: 'outfits', tipo: SEXO[o.vocation] ?? null, look: o.look, addons: ou(o.addons), premium: !!o.premium, gratis: !!o.owned, preco: ou(o.price), colecao: o.owned ? null : { criticoPorPeca: CRITICO_POR_PECA } };
}
function detalheDeMontaria(id) {
  const m = (MONTARIAS_REAIS.mounts ?? []).find((x) => String(x.id) === String(id));
  if (!m) return null;
  return { id: String(m.id), nome: ou(m.name), categoria: 'montarias', tipo: ou(m.type), look: m.look, velocidade: ou(m.speed), premium: !!m.premium, preco: ou(m.price), colecao: { criticoPorPeca: CRITICO_POR_PECA } };
}

function detalheDeDrop(id) {
  const nome = id.replace(/^tabela:/, '');
  const t = CONFIG.tabelas?.[nome];
  return t ? { id, nome, categoria: 'drops', tipo: 'tabela reutilizável de encontro', modelo: 'lista `{id, chance}` com chance individual por item', tabela: t } : null;
}

function detalheDeEncontros(id) {
  const enc = encontrosDoArquivo(id);
  if (!enc) return null;
  return {
    id,
    nome: fase(id)?.nome ?? id,
    categoria: 'encontros',
    tipo: 'encontros da fase',
    encontros: enc.map((e) => ({ id: e.id, tipo: e.tipo, nome: ou(e.nome), obrigatorio: e.obrigatorio === true, probabilidade: ou(e.probabilidade), condicao: ou(e.condicao?.tipo), drops: (e.recompensa?.drops ?? []).map((d) => ({ item: d.id, nome: nomeDoItem(d.id), chancePct: d.chance })), moedasMedia: ou(e.recompensa?.moedasMedia), bossId: ou(e.bossId) })),
    referenciasQuebradas: { itens: itensQuebrados(enc.flatMap((e) => (e.recompensa?.drops ?? []).map((d) => d.id))) },
  };
}

/** O detalhe de um conteúdo (`null` se não existe). Sempre sobre o cadastro original — nada é copiado. */
export function detalhe(categoria, id) {
  const i = String(id ?? '');
  let d = null;
  if (DE_HUNT[categoria]) d = categoria === 'bosses' ? detalheDeBoss(i) : detalheDeHunt(categoria, i);
  else if (categoria === 'monstros') d = detalheDeMonstro(i);
  else if (categoria === 'mapas') d = detalheDeMapa(i);
  else if (categoria === 'itens') d = detalheDeItem(i);
  else if (categoria === 'drops') d = detalheDeDrop(i);
  else if (categoria === 'encontros') d = detalheDeEncontros(i);
  else if (categoria === 'outfits') d = detalheDeOutfit(i);
  else if (categoria === 'montarias') d = detalheDeMontaria(i);
  if (!d) return null;
  // O desenho e o "onde é usado" vêm da mesma conta da lista (a tela mostra o sprite e a aba Usos).
  const linha = todasAsLinhas(categoria)?.find((l) => l.id === i);
  return { ...d, desenho: linha?.desenho ?? null, usadoEm: usosDe(categoria, i) };
}

/** Referências quebradas em TODO o catálogo de hunts/bosses/monstros (para a validação da biblioteca). */
export function auditarReferencias() {
  const problemas = [];
  for (const cat of [...Object.keys(DE_HUNT), 'monstros']) {
    for (const l of todasAsLinhas(cat)) {
      const d = detalhe(cat, l.id);
      const q = d?.referenciasQuebradas?.itens ?? [];
      if (q.length) problemas.push({ categoria: cat, id: l.id, itensInexistentes: q });
    }
  }
  return problemas;
}
