// Gera assets_raw/gamedata/proficiencia.json — os dados da Proficiência de arma.
//
// Fontes:
// - api-mapeada/servidor/proficiency.json: a lista das 678 armas e a view de
//   cada uma, capturadas do original (perks com código, tipo, perícia, ícone).
// - api-mapeada/canary/proficiencia/proficiencies.json (Canary, base do
//   original): as 678 views batem perk a perk com ele; dele saem só o que a view
//   não traz — a classe do bestiary (`BestiaryName`), o elemento e o alcance.
// - api-mapeada/canary/luas/*.lua: a raridade de cada boss (bane/archfoe/nemesis).
//
// A tabela de XP de cada arma sai da própria view capturada (o `current`/`next`
// casados com as 3 tabelas do Canary).
//
// Uso: node tools/gerar-proficiencia.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (p) => JSON.parse(readFileSync(new URL(p, raiz), 'utf8'));

const TABELAS = {
  knight: [1250, 20000, 80000, 300000, 1500000, 6000000, 20000000, 40000000, 60000000],
  standard: [1750, 25000, 100000, 400000, 2000000, 8000000, 30000000, 60000000, 90000000],
  crossbow: [600, 8000, 30000, 150000, 650000, 2500000, 10000000, 20000000, 30000000],
};

const capt = ler('api-mapeada/servidor/proficiency.json');
const canary = new Map(ler('api-mapeada/canary/proficiencia/proficiencies.json').map((p) => [p.Name, p]));

function tabelaDa(view) {
  for (const [nome, t] of Object.entries(TABELAS)) {
    const nivel = view.level;
    const current = nivel ? t[nivel - 1] : 0;
    if (current === view.current && t[nivel] === view.next) return nome;
  }
  throw new Error(`tabela desconhecida: ${view.itemName} ${view.current}/${view.next}`);
}

const armas = {};
const grupos = {};
for (const e of capt.list) {
  const view = capt.viewPorArma[e.itemId];
  armas[e.itemId] = {
    name: e.name,
    proficiency: e.proficiency,
    skill: e.skill,
    twoHanded: e.twoHanded,
    minLevel: e.minLevel,
    vocations: e.vocations,
    tabela: tabelaDa(view),
  };
  if (grupos[view.name]) continue;
  const doCanary = canary.get(view.name);
  if (!doCanary) throw new Error(`grupo sem Canary: ${view.name}`);
  grupos[view.name] = view.levels.map((nivel, i) =>
    nivel.perks.map((perk, j) => {
      const c = doCanary.Levels[i].Perks[j];
      if (c.Type !== perk.code || c.Value !== perk.value) throw new Error(`perk diferente: ${view.name} ${i}/${j}`);
      return {
        ...perk,
        ...(c.BestiaryName ? { classe: c.BestiaryName } : {}),
        ...(c.ElementId != null ? { elemento: c.ElementId } : {}),
        ...(c.DamageType != null ? { tipoDeDano: c.DamageType } : {}),
        ...(c.Range ? { alcance: c.Range } : {}),
      };
    }),
  );
}

const raridade = {};
const dirLuas = new URL('api-mapeada/canary/luas/', raiz);
for (const arq of readdirSync(dirLuas)) {
  const m = readFileSync(new URL(arq, dirLuas), 'utf8').match(/bossRace\s*=\s*RARITY_([A-Z]+)/);
  if (m) raridade[arq.replace(/\.lua$/, '')] = m[1].toLowerCase();
}

const saida = {
  fonte: 'original (lista e views de 678 armas) + Canary (classe do bestiary, tabelas de XP, XP por estrela e por raridade de boss)',
  tabelas: TABELAS,
  // XP por morte: estrelas do bestiary (0..5) e raridade do boss.
  xpPorEstrela: [1, 30, 70, 100, 165, 240],
  xpDoBoss: { bane: 500, archfoe: 5000, nemesis: 15000 },
  // Os níveis de maestria passam 2 do último perk (MASTERY_EXPERIENCE_OFFSET do Canary).
  niveisDeMaestria: 2,
  raridade,
  armas,
  grupos,
};
writeFileSync(new URL('assets_raw/gamedata/proficiencia.json', raiz), JSON.stringify(saida));
console.log('armas', Object.keys(armas).length, 'grupos', Object.keys(grupos).length, 'bosses com raridade', Object.keys(raridade).length);
