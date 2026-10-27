// IMPORTA as HABILIDADES dos LACAIOS do Path of Building para `gamedata/itens-poe/pob-habilidades-lacaios.json` (rodada 4 das gemas, lote L — o dono:
// "quero resolver" a limitação "o lacaio ataca do jeito do tipo dele": cada lacaio usa as HABILIDADES dele do PoB).
//
// Do `Minions.lua`: a lista de habilidades de cada lacaio (`skillList`), o alcance do ataque (`attackRange`, em unidades — 10 = 1 m) e a arma
// (`weaponType1`: o arco faz do ataque padrão um projétil). Do `Skills/minion.lua`: cada habilidade inteira — as flags (magia, ataque, corpo a corpo,
// projétil, área), os tipos, o tempo de conjuração, a eficácia (base e incremental, a conta do dano das magias), os stats constantes, os stats do nível
// (os valores posicionais na ordem dos `stats`), o raio de base (`skill("radius", N)`), e cada nível (o requisito, o multiplicador do golpe, a recarga,
// os usos guardados, o crítico, a velocidade de ataque). Do `Misc.lua`: as tabelas de vida e de dano de MONSTRO por nível (o Espectro: o monstro
// erguido leva os multiplicadores dele para as tabelas de aliado do nível do Espectro).
//
// Os arquivos do PoB são só LIDOS como texto (nada do Lua roda).
//
//   node tools/importar-pob-habilidades-lacaios.mjs [pasta do PoB]     (padrão: /home/deploy/referencias-poe/pob)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tabela } from './importar-pob-lacaios.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'pob-habilidades-lacaios.json');
const FONTE_PADRAO = '/home/deploy/referencias-poe/pob';

const numero = (x) => Math.round(Number(x) * 1e6) / 1e6;

/** Um nível `{ 0.8, 1.2, cooldown = 6, …, statInterpolation = { 3, 3, }, }` → `{ v: [posicionais], interp, req, mult, ef, cd, usos, crit, velPct }` (`interp`: a
 * interpolação de cada posicional — 1 o valor, 2 linear até o próximo nível pelo nível do lacaio, 3 a eficácia; só quando não é tudo 1). */
export function nivel(texto) {
  const interp = [...(/statInterpolation = \{([^}]*)\}/.exec(texto)?.[1] ?? '').matchAll(/\d+/g)].map((x) => Number(x[0]));
  const sem = texto.replace(/statInterpolation = \{[^}]*\},?/, '');
  const v = [];
  const x = {};
  for (const parte of sem.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\w+) = (-?[\d.]+)$/.exec(parte);
    if (m) {
      const k = { levelRequirement: 'req', baseMultiplier: 'mult', damageEffectiveness: 'ef', cooldown: 'cd', storedUses: 'usos', critChance: 'crit', attackSpeedMultiplier: 'velPct' }[m[1]];
      if (k) x[k] = numero(m[2]);
    } else if (/^-?[\d.]+$/.test(parte)) v.push(numero(parte));
  }
  return { ...(v.length ? { v } : {}), ...(interp.some((i) => i !== 1) ? { interp } : {}), ...x };
}

/** Todas as habilidades do `Skills/minion.lua`: `{ id: { nome, magia, ataque, corpo, projetil, area, movimento, tipos, conjuracao, baseEf, incEf, raio, dps, const, stats, niveis } }`. */
export function habilidades(texto) {
  const saida = {};
  for (const m of texto.matchAll(/^skills\["(\w+)"\] = \{\n([\s\S]*?)\n\}/gm)) {
    const [, id, corpo] = m;
    const flags = /\n\tbaseFlags = \{([\s\S]*?)\n\t\},/.exec(corpo)?.[1] ?? '';
    const flag = (k) => new RegExp(`\\b${k} = true`).test(flags);
    const tipos = [...(/\n\tskillTypes = \{([^\n]*)\}/.exec(corpo)?.[1] ?? '').matchAll(/SkillType\.(\w+)/g)].map((x) => x[1]);
    const num = (k) => { const r = new RegExp(`\\n\\t${k} = (-?[\\d.]+),`).exec(corpo); return r ? numero(r[1]) : null; };
    const constantes = {};
    for (const c of (/\n\tconstantStats = \{([\s\S]*?)\n\t\},/.exec(corpo)?.[1] ?? '').matchAll(/\{ "([^"]+)", (-?[\d.]+) \}/g)) constantes[c[1]] = numero(c[2]);
    const stats = [...(/\n\tstats = \{([\s\S]*?)\n\t\},/.exec(corpo)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const niveis = [...(/\n\tlevels = \{([\s\S]*?)\n\t\},/.exec(corpo)?.[1] ?? '').matchAll(/\[\d+\] = \{ ([^\n]*) \},/g)].map((x) => nivel(x[1]));
    const raio = /skill\("radius", (\d+)\)/.exec(corpo)?.[1];
    const dps = /skill\("dpsMultiplier", ([\d.]+)\)/.exec(corpo)?.[1];
    saida[id] = {
      nome: /(?:^|\n)\tname = "([^"]+)"/.exec(corpo)?.[1] ?? id,
      ...(flag('spell') ? { magia: true } : {}), ...(flag('attack') ? { ataque: true } : {}), ...(flag('melee') ? { corpo: true } : {}),
      ...(flag('projectile') ? { projetil: true } : {}), ...(flag('area') || stats.includes('is_area_damage') ? { area: true } : {}),
      ...(flag('movement') || tipos.includes('Movement') || tipos.includes('Travel') ? { movimento: true } : {}),
      tipos, ...(num('castTime') != null ? { conjuracao: num('castTime') } : {}),
      ...(num('baseEffectiveness') != null ? { baseEf: num('baseEffectiveness') } : {}), ...(num('incrementalEffectiveness') != null ? { incEf: num('incrementalEffectiveness') } : {}),
      ...(raio ? { raio: Number(raio) } : {}), ...(dps ? { dps: Number(dps) } : {}),
      const: constantes, stats, niveis,
    };
  }
  return saida;
}

/** Os lacaios do `Minions.lua`: `{ id: { nome, habilidades, alcance, arma } }`. */
export function lacaios(texto) {
  const saida = {};
  for (const m of texto.matchAll(/minions\["(\w+)"\] = \{([\s\S]*?)\n\}/g)) {
    const [, id, corpo] = m;
    const alcance = /\n\tattackRange = (\d+),/.exec(corpo)?.[1];
    const arma = /\n\tweaponType1 = "([^"]+)"/.exec(corpo)?.[1];
    // os mods do lacaio que mexem no golpe (o `modList`, só as linhas ativas — as comentadas com "--" não valem no PoB): a conversão do Físico, o Físico
    // adicionado aos ataques (ModFlag 65536 = Attack) e o "mais" da velocidade de ataque (ModFlag 1 = Attack)
    const mods = (/\n\tmodList = \{([\s\S]*?)\n\t\},/.exec(corpo)?.[1] ?? '').split('\n').filter((l) => /^\s*mod\(/.test(l));
    const conversao = {};
    let somado = null;
    let velMaisPct = 0;
    for (const l of mods) {
      let r;
      if ((r = /mod\("PhysicalDamageConvertTo(Fire|Cold|Lightning|Chaos)", "BASE", (-?[\d.]+)/.exec(l))) conversao[{ Fire: 'fire', Cold: 'ice', Lightning: 'energy', Chaos: 'chaos' }[r[1]]] = Number(r[2]);
      if ((r = /mod\("Physical(Min|Max)", "BASE", (-?[\d.]+), 0, 65536\)/.exec(l))) { somado ??= [0, 0]; somado[r[1] === 'Min' ? 0 : 1] = Number(r[2]); }
      if ((r = /mod\("Speed", "MORE", (-?[\d.]+), 1, 0\)/.exec(l))) velMaisPct += Number(r[1]);
    }
    saida[id] = {
      nome: /\n\tname = "([^"]+)"/.exec(corpo)?.[1] ?? id,
      habilidades: [...(/skillList = \{([\s\S]*?)\}/.exec(corpo)?.[1] ?? '').matchAll(/"(\w+)"/g)].map((x) => x[1]),
      ...(alcance ? { alcance: Number(alcance) } : {}), ...(arma ? { arma } : {}),
      ...(Object.keys(conversao).length ? { conversao } : {}), ...(somado ? { somado } : {}), ...(velMaisPct ? { velMaisPct } : {}),
    };
  }
  return saida;
}

export function importar(pasta = FONTE_PADRAO) {
  const misc = readFileSync(join(pasta, 'Misc.lua'), 'utf8');
  return {
    fonte: 'Path of Building (PathOfBuildingCommunity/PathOfBuilding, master, src/Data: Minions.lua, Misc.lua, Skills/minion.lua) — lido em 27/10/2026',
    tabelas: { vidaMonstro: tabela(misc, 'monsterLifeTable'), danoMonstro: tabela(misc, 'monsterDamageTable') },
    lacaios: lacaios(readFileSync(join(pasta, 'Minions.lua'), 'utf8')),
    habilidades: habilidades(readFileSync(join(pasta, 'Skills', 'minion.lua'), 'utf8')),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dados = importar(process.argv[2] ?? FONTE_PADRAO);
  writeFileSync(SAIDA, `${JSON.stringify(dados)}\n`);
  console.log(`${Object.keys(dados.lacaios).length} lacaios, ${Object.keys(dados.habilidades).length} habilidades → ${SAIDA}`);
}
