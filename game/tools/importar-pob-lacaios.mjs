// IMPORTA a FORÇA dos LACAIOS do Path of Building para `gamedata/itens-poe/pob-lacaios.json` (dono, 16/10: "Aplicar o PoB" nos lacaios do
// grupo idle da árvore — o Sentinela, as Relíquias, as Aranhas, o Fantasma — e "Incluir no lote 44" os lacaios das gemas).
//
// No PoE a vida e o dano de um lacaio são os da TABELA DE ALIADOS do nível dele × o multiplicador do tipo (`Data/Minions.lua` do PoB:
// `life`, `damage`, `attackTime`, `energyShield` — fração da vida —, `armour`/`evasion` — × as tabelas de monstro —, as resistências de base
// e o "não pode sofrer dano"); as tabelas estão em `Data/Misc.lua`. Das habilidades dos lacaios (`Data/Skills/minion.lua`) vêm o
// multiplicador do golpe e a velocidade de ataque da habilidade principal (`levels[1].baseMultiplier` / `attackSpeedMultiplier`); do
// `Skills/sup_int.lua`, o Poder Fantasmal pelo nível do Suporte: Convocar Fantasma.
//
// Os arquivos do PoB são só LIDOS como texto (nada do Lua roda). Baixados com a autorização do dono (16/10) de
// raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding/master/src/Data/ para fora do repositório.
//
//   node tools/importar-pob-lacaios.mjs [pasta Data do PoB]     (padrão: /home/deploy/referencias-poe/pob)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'pob-lacaios.json');
const FONTE_PADRAO = '/home/deploy/referencias-poe/pob';

/** Uma tabela `data.<nome> = { a, b, … }` do Misc.lua (o índice 0 é o nível 1). */
export function tabela(misc, nome) {
  const m = new RegExp(`data\\.${nome} = \\{([^}]*)\\}`).exec(misc);
  if (!m) throw new Error(`a tabela ${nome} não está no Misc.lua`);
  return m[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => Math.round(Number(x) * 1000) / 1000);
}

const num = (corpo, campo) => {
  const m = new RegExp(`\\n\\t${campo} = (-?[\\d.]+),`).exec(corpo);
  return m ? Number(m[1]) : null;
};

/** `{ id: { nome, vida, es, armadura, evasao, res, dano, spread, tempo, habilidades, imune } }` do Minions.lua. */
export function lacaios(texto) {
  const saida = {};
  for (const m of texto.matchAll(/minions\["(\w+)"\] = \{([\s\S]*?)\n\}/g)) {
    const [, id, corpo] = m;
    const nome = /\n\tname = "([^"]+)"/.exec(corpo)?.[1] ?? id;
    const habilidades = [...(/skillList = \{([\s\S]*?)\}/.exec(corpo)?.[1] ?? '').matchAll(/"(\w+)"/g)].map((x) => x[1]);
    const imune = /mod\("DamageTaken", "MORE", -100/.test(corpo);
    const x = {
      nome, vida: num(corpo, 'life') ?? 1, dano: num(corpo, 'damage') ?? 0, spread: num(corpo, 'damageSpread') ?? 0.2, tempo: num(corpo, 'attackTime') ?? 1,
      res: { fire: num(corpo, 'fireResist') ?? 0, ice: num(corpo, 'coldResist') ?? 0, energy: num(corpo, 'lightningResist') ?? 0, chaos: num(corpo, 'chaosResist') ?? 0 },
      habilidades,
    };
    const es = num(corpo, 'energyShield');
    const armadura = num(corpo, 'armour');
    const evasao = num(corpo, 'evasion');
    if (es) x.es = es;
    if (armadura) x.armadura = armadura;
    if (evasao) x.evasao = evasao;
    if (imune) x.imune = true;
    // (lote 87, dono 19/10: a parte B — a precisão e o atordoamento dos lacaios) o multiplicador da precisão (`accuracy` × a tabela de precisão de
    // monstro do nível: `tabelas.precisao`), o "Limiar de Atordoamento aumentado" (`StunThreshold` INC — o Zumbi, +30%) e o "não pode ser
    // Atordoado" (`StunImmune` — os Robôs)
    const precisao = num(corpo, 'accuracy');
    const limiar = /mod\("StunThreshold", "INC", (-?[\d.]+)/.exec(corpo);
    if (precisao != null) x.precisao = precisao;
    if (limiar) x.limiarAtordoamentoPct = Number(limiar[1]);
    if (/mod\("StunImmune", "FLAG", 1/.test(corpo)) x.imuneAtordoamento = true;
    saida[id] = x;
  }
  return saida;
}

/** O multiplicador do golpe e a velocidade de ataque (nível 1) de cada habilidade de lacaio `ids` no `Skills/minion.lua`. */
export function habilidades(texto, ids) {
  const saida = {};
  for (const id of ids) {
    const i = texto.indexOf(`skills["${id}"] = {`);
    if (i < 0) continue;
    const fim = texto.indexOf('\nskills[', i + 10);
    const corpo = texto.slice(i, fim < 0 ? undefined : fim);
    const nivel1 = /\[1\] = \{([^}]*)\}/.exec(corpo)?.[1] ?? '';
    const v = (k) => { const m = new RegExp(`${k} = (-?[\\d.]+)`).exec(nivel1); return m ? Number(m[1]) : null; };
    const x = {};
    if (v('baseMultiplier') != null) x.mult = v('baseMultiplier');
    if (v('attackSpeedMultiplier') != null) x.velPct = v('attackSpeedMultiplier');
    if (/\n\tbaseFlags = \{[\s\S]*?spell = true/.test(corpo)) x.magia = true;
    saida[id] = x;
  }
  return saida;
}

/**
 * O PODER FANTASMAL pelo nível do Suporte: Convocar Fantasma (`Skills/sup_int.lua`, `SupportSummonPhantasm` — os stats na ordem: a chance ao
 * matar, o máximo de Fantasmas e o Dano Físico Mágico mínimo e máximo que cada Fantasma dá): `{ nivel: [mín, máx] }`.
 */
export function poderFantasmal(texto) {
  const i = texto.indexOf('skills["SupportSummonPhantasm"] = {');
  if (i < 0) throw new Error('o Suporte: Convocar Fantasma não está no sup_int.lua');
  const fim = texto.indexOf('\nskills[', i + 10);
  const corpo = texto.slice(i, fim < 0 ? undefined : fim);
  const saida = {};
  for (const m of corpo.matchAll(/\[(\d+)\] = \{ ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+),/g)) saida[m[1]] = [Number(m[4]), Number(m[5])];
  return saida;
}

export function importar(pasta = FONTE_PADRAO) {
  const misc = readFileSync(join(pasta, 'Misc.lua'), 'utf8');
  const todos = lacaios(readFileSync(join(pasta, 'Minions.lua'), 'utf8'));
  const usadas = [...new Set(Object.values(todos).flatMap((l) => l.habilidades))];
  return {
    fonte: 'Path of Building (PathOfBuildingCommunity/PathOfBuilding, master, src/Data: Minions.lua, Misc.lua, Skills/minion.lua, Skills/sup_int.lua) — 16/10/2026',
    tabelas: {
      vida: tabela(misc, 'monsterAllyLifeTable'), dano: tabela(misc, 'monsterAllyDamageTable'),
      armadura: tabela(misc, 'monsterArmourTable'), evasao: tabela(misc, 'monsterEvasionTable'),
      // (lote 87) a precisão de monstro por nível (`monsterAccuracyTable`) — × o `precisao` do lacaio
      precisao: tabela(misc, 'monsterAccuracyTable'),
    },
    lacaios: todos,
    habilidades: habilidades(readFileSync(join(pasta, 'Skills', 'minion.lua'), 'utf8'), usadas),
    poderFantasmal: poderFantasmal(readFileSync(join(pasta, 'Skills', 'sup_int.lua'), 'utf8')),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dados = importar(process.argv[2] ?? FONTE_PADRAO);
  writeFileSync(SAIDA, `${JSON.stringify(dados)}\n`);
  console.log(`${Object.keys(dados.lacaios).length} lacaios, ${Object.keys(dados.habilidades).length} habilidades → ${SAIDA}`);
}
