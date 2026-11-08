// IMPORTA as CARTAS DE ADIVINHAÇÃO do poedb para `gamedata/itens-poe/cartas.json` (08/11 — o dono, nos mapas únicos: "Criar as cartas": as cartas
// do poedb, a pilha, a troca na Zuma pelo item da carta; o chefe do Claustro Pútrido as derruba e o Baralho Empilhado abre uma).
//
// A fonte é o Scrapling (`/home/deploy/scrapling`, `extrair/cartas.py` → `saida/cartas/cartas.json`): a lista do poedb em português e em inglês
// (o nome, a pilha, a recompensa) e a página de cada carta em inglês (o DropLevel, o ouro da troca de moedas, onde cai). Cada RECOMPENSA vira o
// que o jogo dá (`recompensa`, lida por `itens-poe/cartas.mjs`):
//   { tipo: 'moeda', slug, n }                         — "3x Chaos Orb" (e "5x Currency": `slug: null`, as moedas do sorteio)
//   { tipo: 'unico', slug } | 'unicoDaBase' { base } | 'unicoDaClasse' { classes }  — o Único pelo nome, ou um Único da base/classe ("Axe")
//   { tipo: 'peca', base | classes, raridade, ilvl, links, influencia }           — "Six-Link Staff (Item Level 55)", "Two-Stone Ring"
//   { tipo: 'gema', slug | filtro, nivel, qualidade }  — "Level 4 Enlighten", "Level 21 Spell Gem", "Minion Gem (+20%)"
//   { tipo: 'mapa', tier, raridade }                   — "Map (Map Tier 14)"
//   { tipo: 'carta', slug | null }                     — "Divination Card" (uma ao acaso) ou a carta pelo nome
// com `corrompido` quando a carta diz. A recompensa que o jogo não tem (o fragmento, o escaravelho, o mapa Ocupado…) fica `null`, com o motivo:
// a carta não cai nem sai do Baralho (como no sorteio dos pools, só o que tem efeito no jogo).
//
// O PESO do sorteio: o PoE não publica o das cartas; o poedb dá o ouro da troca de moedas de cada uma (25 a 1850) — a carta cara é a rara: o
// peso é (1000 / ouro)² (a Doutor, 925 de ouro, sai ~1400 vezes menos que uma de 25). Sem ouro, o do meio (250).
//
//   ITENS_POE=1 node tools/importar-cartas.mjs [caminho do cartas.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'cartas.json');
const FONTE_PADRAO = '/home/deploy/scrapling/saida/cartas/cartas.json';
/** Os ids das cartas: 7.950.001 em diante (o id nunca muda — as cartas guardadas apontam para ele). */
export const PRIMEIRO_ID = 7_950_001;
const OURO_DO_MEIO = 250;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** As palavras de CLASSE do poedb → as classes do catálogo. */
export const CLASSES = [
  [/^(?:one-hand|one hand) weapon$/i, ['Claws', 'Daggers', 'Rune_Daggers', 'One_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Sceptres', 'Wands']],
  [/^(?:two-hand|two hand) weapon$/i, ['Bows', 'Staves', 'Warstaves', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Two_Hand_Swords']],
  [/^weapon$/i, ['Bows', 'Claws', 'Daggers', 'Rune_Daggers', 'One_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Swords', 'Thrusting_One_Hand_Swords', 'Sceptres', 'Wands', 'Staves', 'Warstaves', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Two_Hand_Swords']],
  [/^axe$/i, ['One_Hand_Axes', 'Two_Hand_Axes']], [/^sword$/i, ['One_Hand_Swords', 'Two_Hand_Swords', 'Thrusting_One_Hand_Swords']], [/^mace$/i, ['One_Hand_Maces', 'Two_Hand_Maces']],
  [/^staff$/i, ['Staves', 'Warstaves']], [/^bow$/i, ['Bows']], [/^claw$/i, ['Claws']], [/^dagger$/i, ['Daggers', 'Rune_Daggers']], [/^wand$/i, ['Wands']], [/^sceptre$/i, ['Sceptres']],
  [/^shield$/i, ['Shields']], [/^quiver$/i, ['Quivers']], [/^ring$/i, ['Rings']], [/^amulet$/i, ['Amulets']], [/^talisman$/i, ['Amulets']], [/^belt$/i, ['Belts']],
  [/^jewel(?:le)?ry$/i, ['Rings', 'Amulets', 'Belts']], [/^(?:body )?armou?r$/i, ['Body_Armours']], [/^helmet$/i, ['Helmets']], [/^gloves$/i, ['Gloves']], [/^boots$/i, ['Boots']],
  [/^jewel$/i, ['Jewels']], [/^abyss jewel$/i, ['Abyss_Jewels']], [/^flask$/i, ['Life_Flasks', 'Mana_Flasks', 'Hybrid_Flasks', 'Utility_Flasks']],
  [/^(?:item|armou?r piece)$/i, ['Amulets', 'Rings', 'Belts', 'Body_Armours', 'Boots', 'Gloves', 'Helmets', 'Shields', 'Quivers', 'Bows', 'Claws', 'Daggers', 'One_Hand_Axes', 'One_Hand_Maces', 'One_Hand_Swords', 'Sceptres', 'Wands', 'Staves', 'Two_Hand_Axes', 'Two_Hand_Maces', 'Two_Hand_Swords']],
];
const INFLUENCIAS = { Shaper: 'shaper', Elder: 'elder', Crusader: 'crusader', Redeemer: 'redeemer', Hunter: 'hunter', Warlord: 'warlord' };
/** As palavras de GEMA genérica ("Level 21 Spell Gem", "Minion Gem") → o filtro (`cartas.mjs` sorteia). */
const FILTROS_DE_GEMA = [
  [/^vaal gem$/i, 'vaal'], [/^support gem$/i, 'suporte'], [/^spell gem$/i, 'magia'], [/^minion gem$/i, 'lacaio'], [/^(?:skill )?gem$/i, 'qualquer'], [/^attack gem$/i, 'ataque'],
  [/^aura gem$/i, 'aura'], [/^chaos gem$/i, 'caos'], [/^trap gem$/i, 'armadilha'], [/^transfigured golem gem$/i, 'golemTransfigurada'], [/^golem gem$/i, 'golem'],
  [/^transfigured gem$/i, 'transfigurada'], [/^(?:exceptional support gem|empower, enhance or enlighten)$/i, 'excepcional'], [/^awakened (?:exceptional )?gem$/i, 'despertada'],
];
/** As moedas por GRUPO ("20x Quality Currency", "10x Oil" — `cartas.mjs` sorteia uma do grupo a cada uma). */
const GRUPOS_DE_MOEDA = [[/^quality currency$/i, 'qualidade'], [/^oil$/i, 'oleo']];

/** O índice do catálogo para o mapeamento: as moedas, os únicos, as bases (pelo nome em inglês) e as gemas. */
export function indices({ catalogo, moedas, gemas }) {
  const unicos = new Map();
  const bases = new Map();
  const unicosDaBase = new Map();
  for (const [classe, c] of Object.entries(catalogo.classes)) {
    for (const b of c.bases ?? []) bases.set(norm(b.slug), { id: b.id, classe, nomePt: b.nome, nomeEn: b.slug.replace(/_/g, ' ').toLowerCase().replace(/[^a-z0-9 ]/g, '') });
    for (const u of c.unicos ?? []) unicos.set(norm(u.slug), { slug: u.slug, classe });
  }
  for (const [classe, c] of Object.entries(catalogo.classes)) for (const u of c.unicos ?? []) {
    const b = (c.bases ?? []).find((x) => x.nome === u.base);
    if (b) (unicosDaBase.get(b.id) ?? unicosDaBase.set(b.id, []).get(b.id)).push(u.slug);
  }
  const moeda = new Map(moedas.map((m) => [norm(m.slug), m.slug]));
  const gema = new Map();
  for (const d of gemas) if (d.poe?.slug) { gema.set(norm(d.poe.slug), d.poe.slug); gema.set(norm(d.poe.slug.replace(/_Support$/, '')), d.poe.slug); }
  return { unicos, bases, unicosDaBase, moeda, gema };
}

/** A recompensa de UMA carta (os spans em inglês do poedb) → `{ recompensa }` ou `{ recompensa: null, motivo }`. */
export function recompensaDe(spansEn, ix, cartas = new Set()) {
  const spans = (spansEn ?? []).slice(1);
  if (!spans.length || !spans[0].texto) return { recompensa: null, motivo: 'o poedb não traz a recompensa' };
  const classe = spans[0].classe;
  const tudo = spans.map((s) => s.texto).join(' | ');
  const nomeCru = spans[0].texto.replace(/\s+Item Level:.*$|\s+Quality:.*$|\s+Map Tier:.*$|\s+Modifiers:.*$|\s+Corrupted$/, '').trim();
  const num = (re) => Number((tudo.match(re) ?? [])[1]) || null;
  const corrompido = /Corrupted/.test(tudo) ? { corrompido: true } : {};
  const ilvl = num(/Item Level:\s*\|?\s*(\d+)/);
  const qualidade = num(/Quality:\s*\|?\s*\+(\d+)%/);
  const influencia = Object.entries(INFLUENCIAS).find(([k]) => new RegExp(`${k} Item`).test(tudo))?.[1] ?? null;
  const qtd = Number((nomeCru.match(/^(\d+)x\s+/) ?? [])[1]) || 1;
  const nome = nomeCru.replace(/^\d+x\s+/, '');
  if (classe === 'divination' || /^Divination Card$/i.test(nome)) {
    if (/^Divination Card$/i.test(nome)) return { recompensa: { tipo: 'carta', slug: null, n: qtd } };
    const slug = [...cartas].find((s) => norm(s) === norm(nome) || norm(s) === norm(`The ${nome}`));
    return slug ? { recompensa: { tipo: 'carta', slug, n: qtd } } : { recompensa: null, motivo: `a carta "${nome}" não está na lista` };
  }
  if (classe === 'currencyitem') {
    if (/^Currency$/i.test(nome)) return { recompensa: { tipo: 'moeda', slug: null, n: qtd } };
    const grupo = GRUPOS_DE_MOEDA.find(([re]) => re.test(nome))?.[1];
    if (grupo) return { recompensa: { tipo: 'moeda', grupo, n: qtd } };
    // (as Tatuagens são moedas no poedb: "Journey Tattoo" — uma Tatuagem da Jornada ao acaso)
    if (/^Journey Tattoo$/i.test(nome)) return { recompensa: { tipo: 'tatuagem', jornada: true, n: qtd } };
    const slug = ix.moeda.get(norm(nome));
    return slug ? { recompensa: { tipo: 'moeda', slug, n: qtd } } : { recompensa: null, motivo: `a moeda "${nome}" não existe no jogo` };
  }
  if (classe === 'gemitem' || /Gem$/.test(nome) || /^Level \d+ /.test(nome)) {
    const nivel = num(/Level (\d+)/) ?? 1;
    const resto = nome.replace(/^Level \d+\s+/, '');
    const filtro = FILTROS_DE_GEMA.find(([re]) => re.test(resto))?.[1];
    if (filtro) return { recompensa: { tipo: 'gema', filtro, nivel, ...(qualidade ? { qualidade } : {}), ...corrompido } };
    const slug = ix.gema.get(norm(resto)) ?? ix.gema.get(norm(`${resto} Support`));
    return slug ? { recompensa: { tipo: 'gema', slug, nivel, ...(qualidade ? { qualidade } : {}), ...corrompido } } : { recompensa: null, motivo: `a gema "${resto}" não existe no jogo` };
  }
  // os MAPAS (o "Map" com o tier; o mapa com nome do PoE — o Templo Vaal, o Ocupado — não existe aqui)
  if (/\bMap$/.test(nome)) {
    if (!/^Map$/i.test(nome)) return { recompensa: null, motivo: `o mapa "${nome}" não existe no jogo` };
    const tier = num(/Map Tier:\s*\|?\s*(\d+)/) ?? 16;
    return { recompensa: { tipo: 'mapa', tier, raridade: classe === 'rareitem' ? 'raro' : classe === 'magicitem' ? 'magico' : 'normal', ...corrompido } };
  }
  if (classe === 'uniqueitem') {
    const u = ix.unicos.get(norm(nome.replace(/\s+Two-Implicit$/, '')));
    if (u) return { recompensa: { tipo: 'unico', slug: u.slug, ...corrompido } };
    const b = ix.bases.get(norm(nome));
    if (b && ix.unicosDaBase.get(b.id)?.length) return { recompensa: { tipo: 'unicoDaBase', base: b.id, ...corrompido } };
    const cl = CLASSES.find(([re]) => re.test(nome))?.[1];
    if (cl) return { recompensa: { tipo: 'unicoDaClasse', classes: cl, ...corrompido } };
    // ("Agnerod Staff": os Únicos de nome começando por "Agnerod" — o Leste, o Oeste, o Norte, o Sul — um deles ao acaso)
    const prefixo = norm(nome.split(/\s+/)[0]);
    const daFamilia = prefixo.length >= 5 ? [...ix.unicos.values()].filter((x) => norm(x.slug).startsWith(prefixo)).map((x) => x.slug) : [];
    if (daFamilia.length) return { recompensa: { tipo: 'unico', slugs: daFamilia, ...corrompido } };
    return { recompensa: null, motivo: `o único "${nome}" não existe no jogo` };
  }
  // (o Único que o poedb marca com outra classe — "The Eternity Shroud Two-Implicit")
  const unicoPeloNome = ix.unicos.get(norm(nome.replace(/\s+Two-Implicit$/, '')));
  if (unicoPeloNome) return { recompensa: { tipo: 'unico', slug: unicoPeloNome.slug, ...corrompido } };
  // a PEÇA (Normal, Mágica, Rara): "Six-Link Staff", "Gemini Claw of Celebration" (a base dentro do nome), "Body Armour" (a classe)
  const links = /^Six-Link(?:ed)? /.test(nome) ? 6 : /^Five-Link(?:ed)? /.test(nome) ? 5 : 0;
  const semLink = nome.replace(/^(?:Six|Five)-Link(?:ed)?\s+/, '');
  // (os fragmentos, os escaravelhos, as plantas de Assalto, as penas — o jogo não tem)
  if (/Fragment|Scarab|Blueprint|Feather|Vessel|Echo|Mortal |Attribute Transforming/i.test(semLink)) return { recompensa: null, motivo: `o item "${nome}" não existe no jogo` };
  const raridade = classe === 'rareitem' ? 'raro' : classe === 'magicitem' ? 'magico' : /^size-/.test(classe) && influencia ? 'raro' : 'normal';
  const extra = { raridade, ...(ilvl ? { ilvl } : {}), ...(links ? { links } : {}), ...(influencia ? { influencia } : {}), ...(qualidade ? { qualidade } : {}), ...corrompido };
  // (a base pelas PALAVRAS inteiras do nome — "Offering to the Goddess" não é um "Ring")
  const palavrasDoNome = ` ${semLink.toLowerCase().replace(/[^a-z0-9 ]/g, '')} `;
  const base = [...ix.bases.values()].filter((b) => palavrasDoNome.includes(` ${b.nomeEn} `)).sort((a, b) => b.nomeEn.length - a.nomeEn.length)[0];
  if (base) return { recompensa: { tipo: 'peca', base: base.id, ...extra } };
  // (o nome com afixo — "Seraphim's Armour", "Surgeon's Flask", "Weapon of Crafting", "Jewellery of Farrul", "Cluster Jewel": a palavra da classe dentro dele)
  const palavras = semLink.replace(/^(?:Runic|Merciless|Bloodthirsty|Unassailable|Dictator's Prophecy)\s+/i, '');
  const cl = CLASSES.find(([re]) => re.test(palavras))?.[1]
    ?? CLASSES.find(([re]) => palavras.split(/\s+/).some((w, i, a) => re.test(w) || re.test(a.slice(i, i + 2).join(' '))))?.[1];
  if (cl) return { recompensa: { tipo: 'peca', classes: cl, ...extra, ...(raridade === 'normal' && /'s |\bof\b/.test(palavras) ? { raridade: 'magico' } : {}) } };
  return { recompensa: null, motivo: `o item "${nome}" não existe no jogo` };
}

/** O peso de sorteio da carta pelo ouro da troca (`(1000 / ouro)²`). */
export const pesoDoOuro = (ouro) => Math.round(((1000 / Math.max(25, Number(String(ouro ?? '').replace(/,/g, '')) || OURO_DO_MEIO)) ** 2) * 100) / 100;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.ITENS_POE ??= '1';
  const caminho = resolve(process.argv[2] ?? FONTE_PADRAO);
  if (!existsSync(caminho)) throw new Error(`não achei ${caminho} — rode antes, no Scrapling: extrair/cartas.py`);
  await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  const { MOEDAS } = await import('../systems/itens-poe/moedas.mjs');
  const { DEFS } = await import('../systems/skills/gemas.mjs');
  const fonte = JSON.parse(readFileSync(caminho, 'utf8'));
  const antigos = existsSync(SAIDA) ? Object.fromEntries((JSON.parse(readFileSync(SAIDA, 'utf8')).cartas ?? []).map((c) => [c.slug, c.id])) : {};
  const ix = indices({ catalogo: Catalogo.catalogo(), moedas: MOEDAS, gemas: [...DEFS.values()] });
  const slugs = new Set(fonte.map((c) => c.slug));
  const usados = new Set(Object.values(antigos));
  let proximo = PRIMEIRO_ID;
  const cartas = [...fonte].sort((a, b) => a.slug.localeCompare(b.slug)).map((c) => {
    let id = antigos[c.slug];
    if (!id) { while (usados.has(proximo)) proximo++; id = proximo; usados.add(id); }
    const r = recompensaDe(c.spansEn, ix, slugs);
    const pilha = Number(String(c.pilha ?? '').split('/')[1]) || 1;
    return {
      slug: c.slug, id, nome: c.nome ?? c.nomeEn, nomeEn: c.nomeEn, pilha, recompensaTexto: (c.recompensa ?? []).slice(1).join(' '), recompensaEn: (c.recompensaEn ?? []).slice(1).join(' '),
      dropLevel: Number(c.dropLevel) || 1, ouro: Number(String(c.ouro ?? '').replace(/,/g, '')) || null, peso: pesoDoOuro(c.ouro), caiEm: c.caiEm ?? null,
      recompensa: r.recompensa, ...(r.motivo ? { motivo: r.motivo } : {}),
    };
  });
  const saida = {
    _nota: 'As cartas de adivinhação do poedb (tools/importar-cartas.mjs ← o Scrapling, extrair/cartas.py): a pilha, a recompensa (o que o jogo dá — itens-poe/cartas.mjs) e o peso do sorteio ((1000/ouro)², o ouro da troca de moedas do poedb). recompensa null: o jogo não tem o item (fora do sorteio).',
    icone: 'Divination_Card.png',
    cartas,
  };
  writeFileSync(SAIDA, `${JSON.stringify(saida, null, 1)}\n`);
  const sem = cartas.filter((c) => !c.recompensa);
  console.log(`${cartas.length} cartas: ${cartas.length - sem.length} com a recompensa no jogo, ${sem.length} sem`);
  const motivos = {};
  for (const c of sem) motivos[c.motivo.replace(/".*"/, '"…"')] = (motivos[c.motivo.replace(/".*"/, '"…"')] ?? 0) + 1;
  console.log(motivos);
}
