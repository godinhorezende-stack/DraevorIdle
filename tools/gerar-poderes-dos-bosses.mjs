// Gera `assets_raw/gamedata/boss-poderes.json` e `monstro-poderes.json`: os
// ataques e as curas de cada boss e de cada bicho das hunts, lidos do `monster.lua` do Canary (opentibiabr/canary, o datapack que o
// servidor original usa — ver `api-mapeada/canary/boss-luas.json` para o
// caminho de cada arquivo).
//
// Conferido ao vivo (Zoros, 2026-09-24, `api-mapeada/captura-bosses-0924/`):
// cada golpe do original cai dentro da faixa min..max do arquivo, depois da
// proteção do personagem; o nome do golpe é "de <elemento> em <forma>".
//
// Uso: node tools/gerar-poderes-dos-bosses.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const RAIZ = new URL('../', import.meta.url);
const ENUMS = readFileSync(new URL('api-mapeada/canary/utils_definitions.hpp', RAIZ), 'utf8');

function lerEnum(nome) {
  const i = ENUMS.indexOf(`enum ${nome}`);
  const corpo = ENUMS.slice(ENUMS.indexOf('{', i) + 1, ENUMS.indexOf('};', i));
  const valores = {};
  let v = -1;
  for (const linha of corpo.split('\n')) {
    const m = linha.match(/^\s*(\w+)\s*(=\s*([^,/]+))?,?/);
    if (!m?.[1]) continue;
    v = m[3] ? (/^\d+$/.test(m[3].trim()) ? Number(m[3].trim()) : valores[m[3].trim()]) : v + 1;
    valores[m[1]] = v;
  }
  return valores;
}
const EFEITO = lerEnum('MagicEffectClasses');
const TIRO = lerEnum('ShootType_t');

const ELEMENTO = {
  COMBAT_PHYSICALDAMAGE: 'physical', COMBAT_FIREDAMAGE: 'fire', COMBAT_ICEDAMAGE: 'ice',
  COMBAT_EARTHDAMAGE: 'earth', COMBAT_ENERGYDAMAGE: 'energy', COMBAT_DEATHDAMAGE: 'death',
  COMBAT_HOLYDAMAGE: 'holy', COMBAT_LIFEDRAIN: 'lifedrain', COMBAT_MANADRAIN: 'manadrain',
  COMBAT_DROWNDAMAGE: 'drown',
};

function bloco(txt, nome) {
  const i = txt.indexOf(`monster.${nome} = {`);
  if (i < 0) return '';
  let d = 0;
  const j = txt.indexOf('{', i);
  for (let k = j; k < txt.length; k++) {
    if (txt[k] === '{') d++;
    else if (txt[k] === '}' && --d === 0) return txt.slice(j + 1, k);
  }
  return '';
}

function entradas(b) {
  const out = [];
  let d = 0;
  let ini = -1;
  for (let k = 0; k < b.length; k++) {
    if (b[k] === '{') { if (d++ === 0) ini = k; } else if (b[k] === '}' && --d === 0) out.push(b.slice(ini + 1, k));
  }
  return out.map((e) => {
    const o = {};
    for (const [, k, v] of e.matchAll(/(\w+)\s*=\s*("[^"]*"|[-\w.]+)/g)) {
      o[k] = v.startsWith('"') ? v.slice(1, -1) : /^-?[\d.]+$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v;
    }
    return o;
  });
}

// Para as magias com nome (ver acima): o elemento e a forma pela palavra do nome.
function elementoPeloNome(nome) {
  const n = nome.toLowerCase();
  if (/mana/.test(n)) return 'manadrain';
  if (/death|sudden|dread/.test(n)) return 'death';
  if (/energy|cloud/.test(n)) return 'energy';
  if (/fire|explosion/.test(n)) return 'fire';
  if (/ice/.test(n)) return 'ice';
  if (/earth|stone|boulder/.test(n)) return 'earth';
  if (/divine|holy/.test(n)) return 'holy';
  return 'physical';
}
function formaPeloNome(nome) {
  const n = nome.toLowerCase();
  if (/wave/.test(n)) return { forma: 'feixe', raio: 0, comprimento: 7, espalha: 3, noAlvo: false };
  if (/beam/.test(n)) return { forma: 'feixe', raio: 0, comprimento: 7, espalha: 0, noAlvo: false };
  if (/chain|missile|strike|rune|leech/.test(n)) return { forma: 'alvo', raio: 0, comprimento: 0, espalha: 0, noAlvo: true };
  return { forma: 'area', raio: /berserk/.test(n) ? 1 : 3, comprimento: 0, espalha: 0, noAlvo: false };
}
const EFEITO_DO_ELEMENTO = {
  death: EFEITO.CONST_ME_MORTAREA, energy: EFEITO.CONST_ME_ENERGYAREA, fire: EFEITO.CONST_ME_FIREAREA,
  ice: EFEITO.CONST_ME_ICEAREA, earth: EFEITO.CONST_ME_POISONAREA, holy: EFEITO.CONST_ME_HOLYAREA,
  physical: EFEITO.CONST_ME_GROUNDSHAKER, manadrain: EFEITO.CONST_ME_MAGIC_BLUE,
};
const TIRO_DO_ELEMENTO = {
  death: TIRO.CONST_ANI_DEATH, energy: TIRO.CONST_ANI_ENERGY, fire: TIRO.CONST_ANI_FIRE, ice: TIRO.CONST_ANI_ICE,
  earth: TIRO.CONST_ANI_EARTH, holy: TIRO.CONST_ANI_HOLY, physical: TIRO.CONST_ANI_LARGEROCK,
};

// Melee com `skill`/`attack` em vez de min/max: a fórmula do Canary
// (`Weapons::getMaxMeleeDamage`).
const maxDoMelee = (a) => (a.maxDamage != null ? Math.abs(a.maxDamage) : Math.ceil(a.skill * (a.attack * 0.05) + a.attack * 0.5));

const ignorados = {};
function gerar(DIR) {
const saida = {};
for (const arquivo of readdirSync(DIR)) {
  const id = arquivo.replace('.lua', '');
  const txt = readFileSync(new URL(arquivo, DIR), 'utf8');
  const ataques = [];
  for (const a of entradas(bloco(txt, 'attacks'))) {
    if (a.name === 'melee') {
      ataques.push({ tipo: 'melee', min: Math.abs(a.minDamage ?? 0), max: maxDoMelee(a), intervalo: a.interval ?? 2000, chance: a.chance ?? 100 });
    } else if (a.name === 'combat' && ELEMENTO[a.type] && a.maxDamage) {
      ataques.push({
        tipo: 'magia',
        elemento: ELEMENTO[a.type],
        min: Math.abs(a.minDamage),
        max: Math.abs(a.maxDamage),
        intervalo: a.interval ?? 2000,
        chance: a.chance ?? 100,
        forma: a.radius ? 'area' : a.length ? 'feixe' : 'alvo',
        raio: a.radius ?? 0,
        comprimento: a.length ?? 0,
        espalha: a.spread ?? 0,
        alcance: a.range ?? 0,
        noAlvo: a.target === true,
        efeito: EFEITO[a.effect] ?? null,
        tiro: TIRO[a.shootEffect] ?? null,
      });
    } else if (a.maxDamage && a.name !== 'condition') {
      // Magia com script próprio (data/scripts/spells/monster): o dano vem do
      // monster.lua; elemento e forma saem do NOME — estimativa, marcada.
      const elemento = elementoPeloNome(a.name);
      const forma = formaPeloNome(a.name);
      ataques.push({
        tipo: 'magia', estimado: true, nome: a.name, elemento, min: Math.abs(a.minDamage ?? 0), max: Math.abs(a.maxDamage),
        intervalo: a.interval ?? 2000, chance: a.chance ?? 100, ...forma, alcance: a.range ?? 7,
        efeito: EFEITO_DO_ELEMENTO[elemento], tiro: forma.forma === 'alvo' ? TIRO_DO_ELEMENTO[elemento] ?? null : null,
      });
    } else {
      ignorados[a.name] = (ignorados[a.name] ?? 0) + 1;
    }
  }
  const curas = entradas(bloco(txt, 'defenses'))
    .filter((d) => d.name === 'combat' && d.type === 'COMBAT_HEALING' && d.maxDamage)
    .map((d) => ({ min: d.minDamage, max: d.maxDamage, intervalo: d.interval ?? 2000, chance: d.chance ?? 100, efeito: EFEITO[d.effect] ?? null }));
  saida[id] = { ataques, curas };
}
return saida;
}

const FONTE = 'opentibiabr/canary monster.lua (ver tools/gerar-poderes-dos-bosses.mjs)';
const bosses = gerar(new URL('api-mapeada/canary/luas/', RAIZ));
writeFileSync(new URL('assets_raw/gamedata/boss-poderes.json', RAIZ), JSON.stringify({ _fonte: FONTE, bosses }, null, 1));
// Os bichos das hunts (`api-mapeada/canary/monstro-luas.json` diz de onde veio cada um).
const monstros = gerar(new URL('api-mapeada/canary/luas-monstros/', RAIZ));
writeFileSync(new URL('assets_raw/gamedata/monstro-poderes.json', RAIZ), JSON.stringify({ _fonte: FONTE, monstros }, null, 1));
console.log(Object.keys(bosses).length, 'bosses,', Object.keys(monstros).length, 'monstros; ignorados (magias com script próprio, condições, velocidade):', ignorados);
