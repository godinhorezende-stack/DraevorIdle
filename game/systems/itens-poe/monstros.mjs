// Os MONSTROS da campanha do PoE como criaturas do Draevor (sistema de itens do PoE, incremento C2 — só com ITENS_POE=1).
//
// Decisão do dono (05/10): os status são os do PoE (vida, dano, tempo de ataque, armadura, evasão, escudo de energia, resistências,
// experiência — por nível, de `gamedata/itens-poe/campanha-poe.json`) e o DESENHO é o de uma criatura do Draevor parecida: pela palavra do
// nome (esqueleto, cobra, caranguejo, símio...), senão uma das criaturas nativas do mapa da área. Cada monstro × nível vira uma entrada
// do bestiário (`poe-<slug>-<nível>`), com o golpe corpo a corpo no formato dos poderes dos bichos (o dano do PoE, ±20% como no PoE).
//   - O escudo de energia do PoE soma na vida (aproximado: o Draevor não tem escudo nos bichos).
//   - O tempo de ataque vira a velocidade de ataque do bicho (contra o intervalo base do Draevor).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { CONFIG as ATRIBUTOS_DO_MOB } from '../mobs/atributos.mjs';
import { registrarPoderes } from '../poderes.mjs';
import * as Habilidades from './habilidades.mjs';

export const CAMPANHA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));

// ---- OS AJUSTES DA ENGINE (aba Acts → área → mobs; aba Mobs → desenho): `gamedata/itens-poe/campanha-ajustes.json`, por cima do que veio do Drive.
//   areas[id].monstros: a lista INTEIRA de monstros da área (com os status do PoE de cada um), quando o dono a editou;
//   desenhos[slug]: a criatura do Draevor que dá o desenho ao monstro do PoE.
const ARQ_AJUSTES = new URL('../../gamedata/itens-poe/campanha-ajustes.json', import.meta.url);
export const AJUSTES = existsSync(ARQ_AJUSTES) ? JSON.parse(readFileSync(ARQ_AJUSTES, 'utf8')) : { areas: {}, desenhos: {} };
AJUSTES.areas ??= {};
AJUSTES.desenhos ??= {};
for (const [id, a] of Object.entries(AJUSTES.areas)) if (CAMPANHA.areas[id] && Array.isArray(a.monstros)) CAMPANHA.areas[id].monstros = a.monstros;
const gravarAjustes = () => writeFileSync(ARQ_AJUSTES, `${JSON.stringify({ _nota: 'Ajustes da Engine sobre a campanha do PoE (mobs por área e desenho dos monstros). Gravado pela aba Acts / Mobs.', areas: AJUSTES.areas, desenhos: AJUSTES.desenhos }, null, 1)}\n`);

const CAMPOS_NUMERICOS = ['nivel', 'vida', 'dano', 'tempoAtaque', 'armadura', 'evasao', 'escudoDeEnergia', 'experiencia'];
/** Valida a lista de monstros de uma área (status do PoE). Devolve `{ ok, lista?, erros? }` — a lista limpa. */
export function validarMonstros(lista) {
  if (!Array.isArray(lista) || !lista.length) return { ok: false, erros: ['A área precisa de pelo menos um monstro.'] };
  const erros = [];
  const limpa = lista.map((m, i) => {
    const onde = `Monstro ${i + 1} (${m?.nome ?? '?'})`;
    if (!m?.slug || !m?.nome) erros.push(`${onde}: falta o monstro.`);
    const n = Object.fromEntries(CAMPOS_NUMERICOS.map((k) => [k, Number(m?.[k] ?? 0)]));
    if (!(n.nivel >= 1 && n.nivel <= 100)) erros.push(`${onde}: nível de 1 a 100.`);
    if (!(n.vida >= 1)) erros.push(`${onde}: vida precisa ser pelo menos 1.`);
    if (!(n.tempoAtaque >= 0.1 && n.tempoAtaque <= 10)) erros.push(`${onde}: tempo de ataque de 0,1 a 10 s.`);
    for (const k of ['dano', 'armadura', 'evasao', 'escudoDeEnergia', 'experiencia']) if (!(n[k] >= 0)) erros.push(`${onde}: ${k} não pode ser negativo.`);
    const res = Object.fromEntries(['fire', 'ice', 'energy', 'chaos'].map((e) => [e, Math.max(-100, Math.min(90, Number(m?.resistencias?.[e] ?? 0) || 0))]));
    // Só os campos do monstro (o que a tela calcula — desenho, drops, habilidades convertidas — não é gravado).
    return { slug: String(m.slug), nome: String(m.nome), unico: !!m.unico, ...n, nivel: Math.round(n.nivel), resistencias: res, ...(Array.isArray(m.habilidades) && m.habilidades.length ? { habilidades: m.habilidades } : {}) };
  });
  return erros.length ? { ok: false, erros } : { ok: true, lista: limpa };
}

/** Grava a lista de monstros da área (e põe na campanha carregada). `{ ok, erros? }`. */
export function salvarMonstrosDaArea(id, lista, { gravar = true } = {}) {
  const a = CAMPANHA.areas[id];
  if (!a || a.cidade) return { ok: false, erros: ['Área desconhecida (ou cidade).'] };
  const v = validarMonstros(lista);
  if (!v.ok) return v;
  a.monstros = v.lista;
  AJUSTES.areas[id] = { monstros: v.lista };
  if (gravar) gravarAjustes();
  return { ok: true };
}

/** Troca o desenho (a criatura do Draevor) de um monstro do PoE, em todas as áreas. `{ ok, erros? }`. */
export function definirDesenho(slugDoMonstro, chaveDoBestiario, { gravar = true } = {}) {
  if (chaveDoBestiario && !BESTIARY[chaveDoBestiario]) return { ok: false, erros: [`"${chaveDoBestiario}" não é uma criatura do bestiário.`] };
  if (chaveDoBestiario) AJUSTES.desenhos[slugDoMonstro] = chaveDoBestiario;
  else delete AJUSTES.desenhos[slugDoMonstro];
  if (gravar) gravarAjustes();
  return { ok: true };
}

/** Palavra do nome (pt) → a criatura do Draevor que dá o desenho (a primeira que casar e existir no bestiário). */
const DESENHOS = [
  [/esqueleto|osso|ósseo|ossada/i, 'skeleton'],
  [/estátua|construto|aparelho/i, 'animated-stone-golem'],
  [/cobra|serpente|víbora|ofídio/i, 'snake'],
  [/caranguejo|caraguejo|crustáceo/i, 'crab'],
  [/símio|gorila|marsupial|macaco/i, 'kongra'],
  [/aranha|aracnídeo|tecelã/i, 'giant-spider'],
  [/rhoa|abutre|galo|ave/i, 'terror-bird'],
  [/afogado|morto|trôpego|zumbi|escravo|cadáver|encharcado/i, 'zombie'],
  [/espectr|fantasma|sombrio|alma|aparição/i, 'ghost'],
  [/sereia/i, 'insane-siren'],
  [/fauno|ninfa/i, 'nymph'],
  [/bucaneiro|corsário|pirata/i, 'pirate-corsair'],
  [/necromante/i, 'necromancer'],
  [/mago|arquimago|erudito|acólito|arauto|feiticeir|bruxa/i, 'dark-sorcerer'],
  [/fanático|cultista|herético|adjudicador/i, 'cult-believer'],
  [/arqueiro/i, 'hunter'],
  [/guarda|soldado|sentinela|elite|campeão|vanguarda|guerreiro|rebelde|batedor|cavaleiro|protetor|guardião/i, 'midnight-warrior'],
  [/cão|sabujo|lobo/i, 'wolf'],
  [/leão/i, 'werelion'],
  [/demônio/i, 'demon'],
  [/elemental solar|chama|flamejante|ardente|infernal/i, 'blazing-fire-elemental'],
  [/escarchad|ártico|gelo|invernal/i, 'ice-golem'],
  [/elemental/i, 'earth-elemental'],
  [/devorador|bocarra|regurgitador/i, 'devourer'],
  [/sanguessuga|viscos|lodo|massa/i, 'slime'],
  [/vespa|carniceir|inseto|besouro/i, 'wasp'],
  [/titã|gigante|brutamonte|triturador/i, 'cyclops'],
  [/canibal|saqueador|bandido|assassino/i, 'bandit'],
  [/lasca|fragmento|resquício|colina|montanha|cascalho/i, 'earth-elemental'],
];

/** O desenho pelo nome, ou null. */
export function desenhoPeloNome(nome) {
  const k = DESENHOS.find(([re, key]) => re.test(nome) && BESTIARY[key])?.[1];
  return k ?? null;
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A chave do bestiário de um monstro do PoE num nível. */
export const chaveDe = (m) => `poe-${slug(m.slug)}-${m.nivel}`;

/**
 * Registra no bestiário (e nos poderes) um monstro do PoE, com o desenho de `desenho` (uma chave do bestiário do Draevor). Não repete.
 * Devolve a chave.
 */
export function registrar(m, desenho, { forcar = false } = {}) {
  const key = chaveDe(m);
  if (BESTIARY[key] && !forcar) return key;
  const base = BESTIARY[AJUSTES.desenhos[m.slug]] ?? BESTIARY[desenhoPeloNome(m.nome) ?? desenho] ?? BESTIARY[desenho] ?? Object.values(BESTIARY)[0];
  const intervaloBase = ATRIBUTOS_DO_MOB.ataque?.intervaloBaseMs ?? 2000;
  BESTIARY[key] = {
    name: m.nome,
    look: base.look,
    lookItem: base.lookItem ?? 0,
    colors: base.colors ?? null,
    exp: Math.round(m.experiencia),
    hp: Math.max(1, Math.round(m.vida + (m.escudoDeEnergia ?? 0))),
    class: base.class,
    race: base.race,
    stars: base.stars ?? 1,
    armor: Math.round(m.armadura ?? 0),
    speed: base.speed,
    loot: [],
    elements: { ...m.resistencias },
    // A velocidade de ataque do bicho: o intervalo base do Draevor ÷ o tempo de ataque do PoE (criarMonstro copia).
    velocidadeDeAtaque: Math.round((intervaloBase / Math.max(100, m.tempoAtaque * 1000)) * 1000) / 1000,
    poe: { nivel: m.nivel, dano: m.dano, tempoAtaque: m.tempoAtaque, evasao: m.evasao ?? 0, armadura: m.armadura ?? 0, unico: !!m.unico },
    ...(m.unico ? { boss: false } : {}),
  };
  // O golpe corpo a corpo e — nos chefes de área com as habilidades do poedb — as magias e áreas deles (`habilidades.mjs`).
  const melee = { tipo: 'melee', min: Math.max(1, Math.round(m.dano * 0.8)), max: Math.max(1, Math.round(m.dano * 1.2)), intervalo: Math.round(m.tempoAtaque * 1000), chance: 100 };
  registrarPoderes(key, { ataques: [melee, ...(m.habilidades?.length ? Habilidades.poderes(m) : [])], curas: [] }, { forcar });
  return key;
}

/**
 * Registra os monstros de todas as áreas (o desenho nativo vem de `nativosDoMapa(mapa)` — as criaturas do mapa do Draevor da área). Sem
 * o sistema ligado, nada. Devolve `{ porArea: Map(areaId → [chaves]), total }`.
 */
export function iniciar(nativosDoMapa = () => []) {
  const porArea = new Map();
  if (!ligado()) return { porArea, total: 0 };
  for (const a of Object.values(CAMPANHA.areas)) {
    if (a.cidade) continue;
    const nativos = nativosDoMapa(a.mapa).filter((k) => BESTIARY[k]);
    const chaves = a.monstros.map((m, i) => registrar(m, nativos[i % Math.max(1, nativos.length)] ?? 'skeleton'));
    porArea.set(a.id, chaves);
  }
  for (const c of Object.values(CAMPANHA.chefes)) if (c.monstro) registrar(c.monstro, 'demon');
  return { porArea, total: Object.keys(BESTIARY).filter((k) => k.startsWith('poe-')).length };
}
