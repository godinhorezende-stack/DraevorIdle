// Os MONSTROS da campanha do PoE como criaturas do Draevor (sistema de itens do PoE, incremento C2 — só com ITENS_POE=1).
//
// Decisão do dono (05/10): os status são os do PoE (vida, dano, tempo de ataque, armadura, evasão, escudo de energia, resistências,
// experiência — por nível, de `gamedata/itens-poe/campanha-poe.json`) e o DESENHO é o de uma criatura do Draevor parecida: pela palavra do
// nome (esqueleto, cobra, caranguejo, símio...), senão uma das criaturas nativas do mapa da área. Cada monstro × nível vira uma entrada
// do bestiário (`poe-<slug>-<nível>`), com o golpe corpo a corpo no formato dos poderes dos bichos (o dano do PoE, ±20% como no PoE).
//   - O escudo de energia do PoE soma na vida (aproximado: o Draevor não tem escudo nos bichos).
//   - O tempo de ataque vira a velocidade de ataque do bicho (contra o intervalo base do Draevor).
import { readFileSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import { CONFIG as ATRIBUTOS_DO_MOB } from '../mobs/atributos.mjs';
import { registrarPoderes } from '../poderes.mjs';

export const CAMPANHA = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));

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
export function registrar(m, desenho) {
  const key = chaveDe(m);
  if (BESTIARY[key]) return key;
  const base = BESTIARY[desenhoPeloNome(m.nome) ?? desenho] ?? BESTIARY[desenho] ?? Object.values(BESTIARY)[0];
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
  registrarPoderes(key, { ataques: [{ tipo: 'melee', min: Math.max(1, Math.round(m.dano * 0.8)), max: Math.max(1, Math.round(m.dano * 1.2)), intervalo: Math.round(m.tempoAtaque * 1000), chance: 100 }], curas: [] });
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
