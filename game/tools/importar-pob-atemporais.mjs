// IMPORTA as JOIAS ATEMPORAIS do Path of Building (dono, 16/10: "Pode baixar agora" as tabelas, "As 6 joias, ~33 MB" no repositório, e a
// tradução "Pode" — pela árvore do poedb, o resto no padrão do jogo e listado). Grava:
//   - `gamedata/itens-poe/atemporais/atemporais.json`: os conquistadores (o tipo e o número da Keystone de cada líder — `ModParser.lua`), as
//     sementes de cada joia (`Modules/Data.lua`), o índice de cada nó nas tabelas (`NodeIndexMapping.lua`, com o id local → global) e as
//     passivas conquistadas (`LegionPassives.lua`: as 337 adições e os 381 nós — os do Abismo ficam de fora, outra mecânica), com as linhas
//     em inglês e em português;
//   - `gamedata/itens-poe/atemporais/lut/`: as tabelas (o byte de cada notável em cada semente; a da Vaidade Gloriosa, por nó e semente, de
//     tamanho variável), como o PoB as guarda (zlib; a da Vaidade em 5 partes).
// A REGRA da conquista (`Classes/PassiveSpec.lua`) fica em `systems/itens-poe/atemporais.mjs`.
//
// Os arquivos do PoB são só LIDOS como dados (nada do Lua roda). Baixados com a autorização do dono (16/10) para fora do repositório.
//
//   node tools/importar-pob-atemporais.mjs [pasta src/Data do PoB] [pasta da árvore do poedb]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lerTabelaLua } from './lua-tabela.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const PASTA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'atemporais');
const POB = '/home/deploy/referencias-poe/pob';
const POEDB_ARVORE = '/home/deploy/scrapling/saida/arvore';

/** Os tipos de joia do PoB (`data.timelessJewelTypes`) e as sementes (`timelessJewelSeedMin/Max`; a Arrogância Elegante ÷ 20). */
export const TIPOS = { vaal: 1, karui: 2, maraketh: 3, templar: 4, eternal: 5, kalguur: 6 };
const ARQUIVO_DO_TIPO = { 1: 'GloriousVanity', 2: 'LethalPride', 3: 'BrutalRestraint', 4: 'MilitantFaith', 5: 'ElegantHubris', 6: 'HeroicTragedy' };

/** O "#"-modelo de uma linha (os números viram "#", na ordem) e os números. */
export function modelo(texto) {
  const valores = [];
  const m = String(texto).replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1').replace(/-?\d+(?:\.\d+)?/g, (n) => { valores.push(n); return '#'; });
  return { m: m.trim(), valores };
}
/** O EN → PT das linhas da árvore do poedb (o mesmo nó nas duas línguas, linha a linha; o "#"-modelo mais comum). */
export function dicionarioDaArvore(us, pt) {
  const conta = new Map();
  for (const [id, n] of Object.entries(us.nodes ?? {})) {
    const a = n.stats ?? [];
    const b = pt.nodes?.[id]?.stats ?? [];
    if (a.length !== b.length) continue;
    a.forEach((x, k) => {
      const e = modelo(x);
      const p = modelo(b[k]);
      if (e.valores.length !== p.valores.length) return;
      const c = conta.get(e.m) ?? new Map();
      c.set(p.m, (c.get(p.m) ?? 0) + 1);
      conta.set(e.m, c);
    });
  }
  return new Map([...conta].map(([en, c]) => [en, [...c].sort((x, y) => y[1] - x[1])[0][0]]));
}

/**
 * As linhas que a árvore do poedb não tem (as Keystones e os notáveis dos conquistadores), traduzidas no padrão do jogo — o texto das regras de
 * `traducao.json` quando elas existem (o dono confere a lista: o relatório do lote).
 */
export const MANUAIS = {
  '#% chance to Intimidate Enemies for # seconds on Hit': '#% de chance de Intimidar Inimigos por # segundos ao Acertar',
  'Poisons you inflict deal Damage #% faster': 'Envenenamentos infligidos por você causam Dano #% mais rápido',
  "#% chance to gain Alchemist's Genius when you use a Flask": '#% de chance de ganhar Gênio do Alquimista ao usar um Frasco',
  'You gain Onslaught for # seconds on Kill': 'Você ganha Investida por # segundos ao Matar',
  '+# to Devotion': '+# de Devoção',
  '#% increased Ward': 'Salvaguarda aumentada em #%',
  'All Damage taken bypasses Energy Shield': 'Todo o Dano sofrido ignora o Escudo de Energia',
  '#% of Elemental Damage taken as Chaos Damage': '#% do Dano Elemental sofrido como Dano de Caos',
  '#% less Life Regeneration Rate': 'Taxa de Regeneração de Vida #% menor',
  '#% less maximum Total Life Recovery per Second from Leech': 'Recuperação Total de Vida máxima por Segundo do Dreno #% menor',
  'Energy Shield Recharge instead applies to Life': 'A Recarga do Escudo de Energia se aplica à Vida em vez disso',
  'Energy Shield starts at zero': 'O Escudo de Energia começa em zero',
  'Cannot Recharge or Regenerate Energy Shield': 'Não pode Recarregar nem Regenerar o Escudo de Energia',
  'Lose #% of Energy Shield per second': 'Perde #% do Escudo de Energia por segundo',
  'Life Leech effects Recover Energy Shield instead while on Full Life': 'Efeitos de Dreno de Vida Recuperam o Escudo de Energia em vez disso enquanto com Vida Cheia',
  '#% of Non-Chaos Damage taken bypasses Energy Shield': '#% do Dano Não-Caótico sofrido ignora o Escudo de Energia',
  '#% of Physical Damage Converted to Fire Damage': '#% do Dano Físico Convertido em Dano de Fogo',
  '#% of Physical Damage Converted to Cold Damage': '#% do Dano Físico Convertido em Dano de Gelo',
  '#% of Physical Damage Converted to Lightning Damage': '#% do Dano Físico Convertido em Dano de Raio',
  '#% of Cold Damage Leeched as Life': '#% do Dano de Gelo é Drenado como Vida',
  '#% of Lightning Damage Leeched as Life': '#% do Dano de Raio é Drenado como Vida',
  '#% of Physical Damage Leeched as Life': '#% do Dano Físico é Drenado como Vida',
  '#% of Chaos Damage Leeched as Life': '#% do Dano de Caos é Drenado como Vida',
  '(#-#)% additional Physical Damage Reduction': '#% de Redução de Dano Físico adicional',
  '#% additional Physical Damage Reduction': '#% de Redução de Dano Físico adicional',
  '(#-#) Life gained when you Block': '# de Vida recebida ao Bloquear',
  '# Life gained when you Block': '# de Vida recebida ao Bloquear',
  'Curse Skills have #% increased Skill Effect Duration': 'Habilidades de Maldição têm a Duração do Efeito de Habilidades aumentada em #%',
  'Life Recovery from Non-Instant Leech is not applied': 'A Recuperação de Vida do Dreno não instantâneo não é aplicada',
  '#% additional Physical Damage Reduction for every #% Life Recovery per second from Leech': '#% de Redução de Dano Físico adicional para cada #% de Recuperação de Vida por segundo do Dreno',
  '#% of Cold and Lightning Damage taken as Fire Damage': '#% do Dano de Gelo e de Raio sofrido como Dano de Fogo',
  '#% less Cold Resistance': 'Resistência a Gelo #% menor',
  '#% less Lightning Resistance': 'Resistência a Raio #% menor',
  'Chance to Block Attack Damage is doubled': 'A Chance de Bloquear Dano de Ataques é dobrada',
  'Chance to Block Spell Damage is doubled': 'A Chance de Bloquear Dano Mágico é dobrada',
  'You take #% of Damage from Blocked Hits': 'Você sofre #% do Dano dos Acertos Bloqueados',
  'Mana Recovery from Regeneration is not applied': 'A Recuperação de Mana da Regeneração não é aplicada',
  '# Rage Regenerated for every # Mana Regeneration per Second': '# de Fúria Regenerada para cada # de Regeneração de Mana por Segundo',
  'Does not delay Inherent Loss of Rage': 'Não atrasa a Perda Inerente de Fúria',
  'Skills Cost +# Rage': 'Habilidades Custam +# de Fúria',
  "#% less Attack Damage taken if you haven't been Hit by an Attack Recently": '#% menos Dano de Ataques sofrido se você não foi Acertado por um Ataque Recentemente',
  '#% more chance to Evade Attacks if you have been Hit by an Attack Recently': '#% mais chance de Evadir Ataques se você foi Acertado por um Ataque Recentemente',
  '#% more Attack Damage taken if you have been Hit by an Attack Recently': '#% mais Dano de Ataques sofrido se você foi Acertado por um Ataque Recentemente',
  'Flasks Gain # Charges per empty Flask Slot every # seconds': 'Frascos Ganham # Cargas por espaço de Frasco vazio a cada # segundos',
  "Can't use Helmets": 'Não pode usar Elmos',
  'Your Damage with Critical Strikes is Lucky': 'Seu Dano com Golpes Críticos é Sortudo',
  "Enemies' Damage with Critical Strikes against you is Lucky": 'O Dano dos Inimigos com Golpes Críticos contra você é Sortudo',
  'You are Blind': 'Você está Cego',
  'Blind does not affect your Light Radius': 'Cegueira não afeta seu Raio de Iluminação',
  '#% more Melee Critical Strike Chance while Blinded': '#% mais Chance de Crítico Corpo a Corpo enquanto Cego',
  'While not on Full Life, Sacrifice #% of Mana per Second to Recover that much Life': 'Enquanto não estiver em Vida Cheia, Sacrifica #% da Mana por Segundo para Recuperar a mesma quantidade de Vida',
  'Armour applies to Fire, Cold and Lightning Damage taken from Hits instead of Physical Damage': 'A Armadura se aplica ao Dano de Fogo, Gelo e Raio sofrido de Acertos em vez do Dano Físico',
  '#% more Spell Damage per Power Charge': '#% mais Dano Mágico por Carga de Poder',
  'Gain Power Charges instead of Frenzy Charges': 'Ganha Cargas de Poder em vez de Cargas de Frenesi',
  '#% of Maximum Mana is Converted to twice that much Armour': '#% da Mana Máxima é Convertida no dobro disso em Armadura',
  '#% of Physical Damage Converted to Fire Damage while you have at least # Devotion': '#% do Dano Físico Convertido em Dano de Fogo enquanto você tiver pelo menos # de Devoção',
  '#% of Physical Damage Converted to Cold Damage while you have at least # Devotion': '#% do Dano Físico Convertido em Dano de Gelo enquanto você tiver pelo menos # de Devoção',
  '#% of Physical Damage Converted to Lightning Damage while you have at least # Devotion': '#% do Dano Físico Convertido em Dano de Raio enquanto você tiver pelo menos # de Devoção',
  'Gain #% of Maximum Mana as Extra Maximum Energy Shield while you have at least # Devotion': 'Ganha #% da Mana Máxima como Escudo de Energia Máximo Extra enquanto você tiver pelo menos # de Devoção',
  'Gain Arcane Surge on Hit with Spells if you have at least # Devotion': 'Ganha Fúria Arcana ao Acertar com Magias se você tiver pelo menos # de Devoção',
  '+# to Minimum Endurance Charges while you have at least # Devotion': '+# ao Mínimo de Cargas de Tolerância enquanto você tiver pelo menos # de Devoção',
  '+# to Minimum Power Charges while you have at least # Devotion': '+# ao Mínimo de Cargas de Poder enquanto você tiver pelo menos # de Devoção',
  '+# to Minimum Frenzy Charges while you have at least # Devotion': '+# ao Mínimo de Cargas de Frenesi enquanto você tiver pelo menos # de Devoção',
  'Immune to Elemental Ailments while on Consecrated Ground if you have at least # Devotion': 'Imune a Afecções Elementais enquanto em Solo Consagrado se você tiver pelo menos # de Devoção',
  '#% additional Physical Damage Reduction while you have at least # Devotion': '#% de Redução de Dano Físico adicional enquanto você tiver pelo menos # de Devoção',
  '+#% to all maximum Resistances if you have at least # Devotion': '+#% a todas as Resistências máximas se você tiver pelo menos # de Devoção',
  '#% chance to inflict Fire Exposure on Hit if you have at least # Devotion': '#% de chance de infligir Exposição a Fogo ao Acertar se você tiver pelo menos # de Devoção',
  '#% chance to inflict Cold Exposure on Hit if you have at least # Devotion': '#% de chance de infligir Exposição a Gelo ao Acertar se você tiver pelo menos # de Devoção',
  '#% chance to inflict Lightning Exposure on Hit if you have at least # Devotion': '#% de chance de infligir Exposição a Raio ao Acertar se você tiver pelo menos # de Devoção',
  'Life Recovery from Flasks also applies to Energy Shield': 'A Recuperação de Vida dos Frascos também se aplica ao Escudo de Energia',
  'Nearby Allies and Enemies Share Charges with you': 'Aliados e Inimigos Próximos Compartilham Cargas com você',
  'Enemies Hitting you have #% chance to gain an Endurance,': 'Inimigos que Acertam você têm #% de chance de ganhar uma Carga de Tolerância,',
  'Frenzy or Power Charge': 'Frenesi ou Poder',
  'Auras from your Skills can only affect you': 'Auras das suas Habilidades só podem afetar você',
  'Aura Skills have #% more Aura Effect per #% of maximum Mana they Reserve': 'Habilidades Aura têm #% mais Efeito de Aura por cada #% de Mana máxima que Reservarem',
  '#% more Mana Reservation of Aura Skills': '#% mais Reserva de Mana das Habilidades de Aura',
  'Ignore Attribute Requirements': 'Não possui Requisitos de Atributos',
  'Gain no inherent bonuses from Attributes': 'Não ganha os bônus inerentes dos Atributos',
  '#% chance to gain a Frenzy Charge on Hit': '#% de chance de ganhar uma Carga de Frenesi ao Acertar',
  '#% increased Energy Shield per Power Charge': 'Escudo de Energia aumentado em #% por Carga de Poder',
  '#% increased Effect of Shock': 'Efeito da Eletrização aumentado em #%',
  '#% increased Projectile Attack Damage': 'Dano de Ataques com Projéteis aumentado em #%',
  '#% increased Ward during any Flask Effect': 'Salvaguarda aumentada em #% durante qualquer Efeito de Frasco',
  '#% chance for Ward to be Restored when you Use a Flask': '#% de chance da Salvaguarda ser Restaurada ao usar um Frasco',
  'Gain # Endurance Charge when Ward Breaks': 'Ganha # Carga de Tolerância quando a Salvaguarda se Rompe',
  'Gain # Power Charge when Ward Breaks': 'Ganha # Carga de Poder quando a Salvaguarda se Rompe',
  'Gain # Frenzy Charge when Ward Breaks': 'Ganha # Carga de Frenesi quando a Salvaguarda se Rompe',
  '#% faster Restoration of Ward': 'Restauração da Salvaguarda #% mais rápida',
  '#% increased Armour while you have Unbroken Ward': 'Armadura aumentada em #% enquanto você tiver Salvaguarda Intacta',
  '#% increased Evasion Rating while you have Unbroken Ward': 'Evasão aumentada em #% enquanto você tiver Salvaguarda Intacta',
  '+# to Ward per # Armour on Equipped Helmet': '+# de Salvaguarda por # de Armadura no Elmo Equipado',
  '+# to Ward per # Evasion Rating on Equipped Gloves': '+# de Salvaguarda por # de Evasão nas Luvas Equipadas',
  '+# to Ward per # Energy Shield on Equipped Boots': '+# de Salvaguarda por # de Escudo de Energia nas Botas Equipadas',
  '#% increased Damage while you have Unbroken Ward': 'Dano aumentado em #% enquanto você tiver Salvaguarda Intacta',
  'Damage Penetrates #% Elemental Resistances while your Ward is Broken': 'Dano Penetra #% das Resistências Elementais enquanto sua Salvaguarda estiver Rompida',
  '#% increased effect of Non-Curse Auras from your skills while your Ward is Broken': 'Efeito das Auras Não-Maldição das suas habilidades aumentado em #% enquanto sua Salvaguarda estiver Rompida',
  '#% chance to Restore Ward when you Block': '#% de chance de Restaurar a Salvaguarda ao Bloquear',
  '#% Chance to Block Attack Damage': '+#% de Chance de Bloquear Dano de Ataque',
  'Remove a random Damaging Ailment when Ward is Restored': 'Remove uma Afecção Danificadora aleatória quando a Salvaguarda é Restaurada',
  'Iron Flasks gain # charges when your Ward Breaks': 'Frascos de Ferro ganham # cargas quando sua Salvaguarda se Rompe',
  'Chance to Evade Hits is based off of #% of your Ward instead of your Evasion Rating': 'A Chance de Evadir Acertos se baseia em #% da sua Salvaguarda em vez da sua Evasão',
  'Physical Damage Reduction from Hits is based off of #% of your Ward instead of your Armour': 'A Redução de Dano Físico de Acertos se baseia em #% da sua Salvaguarda em vez da sua Armadura',
  'While you have Unbroken Ward, your next non-channelling Attack you Use yourself breaks your Ward to gain Added Cold Damage equal to #% of Ward': 'Enquanto você tiver Salvaguarda Intacta, seu próximo Ataque sem canalização usado por você rompe sua Salvaguarda para ganhar Dano de Gelo Adicional igual a #% da Salvaguarda',
  '#% less Ward': 'Salvaguarda #% menor',
  'Ward has a #% chance to not Break': 'A Salvaguarda tem #% de chance de não se Romper',
};

/**
 * A linha em português: o "#"-modelo da inglesa (a faixa "(a-b)" — que a Vaidade Gloriosa sorteia — conta como um número só, e fica como faixa)
 * pelo dicionário da árvore ou pelos `MANUAIS`, com os números da inglesa de volta, na ordem. Null sem tradução.
 */
export function traduzir(dic, en) {
  const nums = [];
  const limpo = String(en).replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
  const m = limpo.replace(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)|-?\d+(?:\.\d+)?/g, (todo, a, b) => { nums.push(a != null ? `(${a}-${b})` : todo); return '#'; }).trim();
  const pt = dic.get(m) ?? MANUAIS[m];
  if (!pt) return null;
  let k = 0;
  const texto = pt.replace(/#/g, () => nums[k++] ?? '#');
  return dic.has(m) ? texto : Object.assign(new String(texto), { manual: true });
}

/** O índice das tabelas: `{ indice: {nó: índice}, tamanho: {nó: bytes da Vaidade}, notaveis, total, localParaGlobal }`. */
export function lerIndice(texto) {
  const indice = {};
  const tamanho = {};
  for (const m of texto.matchAll(/^nodeIDList\[(\d+)\] = \{ index = (\d+), size = (\d+) \}/gm)) { indice[m[1]] = Number(m[2]); tamanho[m[1]] = Number(m[3]); }
  const localParaGlobal = {};
  for (const m of texto.matchAll(/^nodeIDList\["localIdToGlobalId"\]\[(\d+)\]\[(\d+)\] = (\d+)/gm)) (localParaGlobal[m[1]] ??= {})[m[2]] = Number(m[3]);
  return { indice, tamanho, notaveis: Number(/nodeIDList\["sizeNotable"\] = (\d+)/.exec(texto)?.[1]), total: Number(/nodeIDList\["size"\] = (\d+)/.exec(texto)?.[1]), localParaGlobal };
}

/** Os líderes (`conquerorList` do `ModParser.lua`): `{ nome: { tipo, id } }` — os do Abismo ficam de fora. */
export function lerLideres(texto) {
  const corpo = /local conquerorList = \{([\s\S]*?)\n\}/.exec(texto)?.[1] ?? '';
  const saida = {};
  for (const m of corpo.matchAll(/\["(\w+)"\]\s*=\s*\{\s*id = "?([\w]+)"?,\s*type = "(\w+)"\s*\}/g)) if (TIPOS[m[3]]) saida[m[1]] = { tipo: m[3], id: m[2] };
  return saida;
}

export function importar(pob = POB, poedb = POEDB_ARVORE) {
  const dic = dicionarioDaArvore(JSON.parse(readFileSync(join(poedb, 'arvore-poedb-3.29-us.json'), 'utf8')), JSON.parse(readFileSync(join(poedb, 'arvore-poedb-3.29-pt.json'), 'utf8')));
  const legiao = (() => { const t = readFileSync(join(pob, 'TimelessJewelData', 'LegionPassives.lua'), 'utf8'); return lerTabelaLua(t, t.indexOf('return') + 6); })();
  const semTraducao = [];
  const passiva = (x) => {
    if (!x || /^abyss/.test(x.id)) return null;
    const en = Array.isArray(x.sd) ? x.sd : Object.values(x.sd ?? {});
    const traduzidas = en.map((l) => { const t = traduzir(dic, l); if (!t) semTraducao.push({ id: x.id, en: l }); return t; });
    const pt = traduzidas.map((t) => (t == null ? null : String(t)));
    // (as linhas traduzidas à mão — sem par na árvore do poedb — para o dono conferir: `docs/atemporais-traducoes.md`)
    const manuais = traduzidas.map((t, i) => (t?.manual ? i : null)).filter((i) => i != null);
    const stats = {};
    for (const [k, s] of Object.entries(Array.isArray(x.stats) ? {} : x.stats ?? {})) stats[k] = { min: s.min, max: s.max, index: s.index, fmt: s.fmt };
    const ordem = Array.isArray(x.sortedStats) ? x.sortedStats : Object.values(x.sortedStats ?? {});
    return { id: x.id, nome: x.dn, en, pt, ordem, stats, ...(manuais.length ? { manuais } : {}), ...(x.ks ? { keystone: true } : {}), ...(x.not ? { notavel: true } : {}) };
  };
  const indice = lerIndice(readFileSync(join(pob, 'TimelessJewelData', 'NodeIndexMapping.lua'), 'utf8'));
  return {
    dados: {
      fonte: 'Path of Building (PathOfBuildingCommunity/PathOfBuilding, master: Data/TimelessJewelData, Modules/Data.lua, Modules/ModParser.lua, Classes/PassiveSpec.lua) — 16/10/2026',
      tipos: TIPOS,
      arquivos: ARQUIVO_DO_TIPO,
      sementes: { 1: [100, 8000], 2: [10000, 18000], 3: [500, 8000], 4: [2000, 10000], 5: [100, 8000], 6: [100, 8000] },
      adicoesTotal: legiao.additions.length,
      lideres: lerLideres(readFileSync(join(pob, 'Modules', 'ModParser.lua'), 'utf8')),
      ...indice,
      adicoes: legiao.additions.map(passiva),
      nos: legiao.nodes.map(passiva),
    },
    semTraducao,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pob = process.argv[2] ?? POB;
  const { dados, semTraducao } = importar(pob, process.argv[3] ?? POEDB_ARVORE);
  mkdirSync(join(PASTA, 'lut'), { recursive: true });
  writeFileSync(join(PASTA, 'atemporais.json'), `${JSON.stringify(dados)}\n`);
  for (const f of readdirSync(join(pob, 'TimelessJewelData'))) if (/\.zip(\.part\d+)?$/.test(f) && Object.values(ARQUIVO_DO_TIPO).some((n) => f.startsWith(`${n}.zip`))) copyFileSync(join(pob, 'TimelessJewelData', f), join(PASTA, 'lut', f));
  console.log(`${Object.keys(dados.lideres).length} líderes, ${dados.adicoes.filter(Boolean).length} adições e ${dados.nos.filter(Boolean).length} nós (sem os do Abismo); sem tradução: ${semTraducao.length}`);
  for (const s of semTraducao) console.log(`  — ${s.id}: ${s.en}`);
}
