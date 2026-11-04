// IMPORTADOR da referência de itens do PoE (Fase 1 do sistema de itens no modelo do PoE — docs/engine/04-piloto-prefixo-sufixo.md).
//
// Lê a coleção local (`poe-itens/**`, extraída do PoEDB; ver docs/engine/02-referencia-poe.md) e grava UM catálogo normalizado:
// classes de item → bases (requisitos, atributos, implícitos, ícone) e o pool `normal` de cada arquétipo (prefixos e sufixos por
// FAMÍLIA, com os tiers: nome, iLvl, peso, texto e as faixas numéricas), mais os únicos (mods fixos em texto). Nada é inventado: o que
// a fonte não traz fica `null`, e cada classe guarda as URLs de origem. (04/11: + os FRASCOS HÍBRIDOS, que a coleção não tem — vêm das
// páginas do poedb já baixadas com o Scrapling, `POEDB_HTML`; ver `classeHibrida`.)
//
// A COLEÇÃO fica fora do repositório (`REFERENCIAS_POE`, padrão `/home/deploy/referencias-poe`): é só a fonte deste tool. O que o JOGO
// usa entra no repositório (dono, 08/10, revogando a decisão de 04/10 de deixar tudo fora): o catálogo em
// `game/gamedata/itens-poe/catalogo-itens.json` e SÓ as imagens que ele referencia em `game/gamedata/itens-poe/icones-itens/` (as mesmas
// pastas relativas de `original/`, para o caminho do ícone no catálogo continuar valendo; a subpasta `poe-itens/Mapas/` é dos tools dos
// Mapas e este tool não mexe nela — `PASTAS_DE_OUTROS_TOOLS`). Uso:
//   node tools/importar-poe-itens.mjs              → grava o catálogo e as imagens dele, e imprime o relatório
//   node tools/importar-poe-itens.mjs --checar     → só o relatório (não grava)
//   node tools/importar-poe-itens.mjs --so-imagens → só refaz as imagens do catálogo que já está no repositório
//   node tools/importar-poe-itens.mjs --so-pools   → só refaz os POOLS ESPECIAIS (`game/gamedata/itens-poe/pools/<pool>.json`)
//
// Os pools especiais (influências, corrompido, bancada do mestre, essência, fósseis, velado, eldritch, síntese, encantamento…) ficam FORA
// do catálogo (o drop comum só usa o pool `normal`, como na campanha do PoE) e cada um num arquivo: o sistema que precisar dele (orbe Vaal,
// essência, fóssil, orbe de influência…) lê só o seu, sob demanda (`itens-poe/catalogo.mjs` `poolEspecial`).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const ORIGINAL = join(RAIZ, 'original');
const ORIGEM = join(ORIGINAL, 'poe-itens');
const ITENS_POE = fileURLToPath(new URL('../game/gamedata/itens-poe/', import.meta.url));
const DESTINO = join(ITENS_POE, 'catalogo-itens.json');
const IMAGENS = join(ITENS_POE, 'icones-itens');
const POOLS = join(ITENS_POE, 'pools');

/** O que cada pool especial é no PoE (o nome que a tela e o relatório mostram). */
export const POOLS_ESPECIAIS = {
  corrupted: 'Corrompido — implícitos de corrupção (Orbe Vaal)',
  master: 'Bancada do mestre (craft)',
  essence: 'Essência',
  delve: 'Fósseis (Delve)',
  incursion: 'Incursão (Templo de Atzoatl)',
  veiled: 'Velado (Betrayal — Orbe do Caos/Exaltado Oculto)',
  bestiary: 'Bestiário (craft das feras)',
  scourgeup: 'Flagelo — o benefício',
  scourgedown: 'Flagelo — o malefício',
  elder: 'Influência do Ancião',
  shaper: 'Influência do Criador',
  crusader: 'Influência do Cruzado',
  redeemer: 'Influência do Redentor',
  hunter: 'Influência do Caçador',
  warlord: 'Influência do Senhor da Guerra',
  sentinel: 'Sentinela',
  synthesis: 'Síntese — implícitos sintetizados',
  synthesis_corrupted: 'Síntese corrompida',
  searing: 'Eldritch — Exarca Abrasador (implícito)',
  eater: 'Eldritch — Devorador de Mundos (implícito)',
  haunted: 'Assombrado',
  enchant: 'Encantamento (Labirinto)',
  warbands: 'Bandos de guerra',
};

/** Os caminhos de imagem que o catálogo referencia (relativos a `original/`). */
export function imagensDoCatalogo(dados) {
  const refs = new Set();
  const andar = (x) => {
    if (Array.isArray(x)) for (const v of x) andar(v);
    else if (x && typeof x === 'object') for (const v of Object.values(x)) andar(v);
    // (O link do poedb — `relatorio.hibridos.icones`, o ícone que falta baixar — não é imagem da coleção.)
    else if (typeof x === 'string' && !/^https?:/i.test(x) && /\.(png|webp|jpe?g|gif|svg)$/i.test(x)) refs.add(x.replace(/^\/+/, ''));
  };
  andar(dados);
  return [...refs].sort();
}

/**
 * As subpastas de `icones-itens/` (relativas a ela) que são de OUTROS tools, não do catálogo: `copiarImagens` não as apaga. Os MAPAS do
 * endgame (`poe-itens/Mapas/`: `icones/Map_Tier_N.png`, `unicos/<Único>.png` e `unicos/<Único>_T<N>.png`) são gravados por
 * game/tools/importar-icones-mapas.mjs, importar-mapas-unicos.mjs e montar-mapas-poe.mjs e referenciados por `mapas.json` (os `_T<N>`
 * nem aparecem lá: `itens-poe/mapas.mjs` `iconeDoUnico` monta o nome) — apagar a pasta inteira sumia com eles (visto em 11/10).
 */
export const PASTAS_DE_OUTROS_TOOLS = ['poe-itens/Mapas'];

/** Apaga o conteúdo de `pasta`, menos os caminhos de `preservar` (relativos a ela) — as pastas no caminho até eles ficam. */
function limparMenos(pasta, preservar) {
  const guardar = preservar.map((rel) => join(pasta, rel));
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (guardar.includes(p)) continue;
      if (e.isDirectory() && guardar.some((g) => g.startsWith(p + sep))) andar(p);
      else rmSync(p, { recursive: true, force: true });
    }
  };
  if (existsSync(pasta)) andar(pasta);
}

/**
 * Refaz `icones-itens/` com só as imagens referenciadas: o que é do catálogo é apagado e copiado de novo da coleção; as
 * `PASTAS_DE_OUTROS_TOOLS` ficam como estão. Devolve `{ copiadas, faltando, bytes }`. `destino`, `original` e `preservar` são para os testes.
 */
export function copiarImagens(dados, { destino = IMAGENS, original = ORIGINAL, preservar = PASTAS_DE_OUTROS_TOOLS } = {}) {
  limparMenos(destino, preservar);
  let copiadas = 0;
  let bytes = 0;
  const faltando = [];
  for (const rel of imagensDoCatalogo(dados)) {
    const de = join(original, rel);
    if (!existsSync(de)) { faltando.push(rel); continue; }
    const para = join(destino, rel);
    mkdirSync(dirname(para), { recursive: true });
    copyFileSync(de, para);
    copiadas++;
    bytes += statSync(para).size;
  }
  return { copiadas, faltando, bytes };
}

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
const ARQUETIPO = { forca: 'str', destreza: 'dex', inteligencia: 'int' };

/** As faixas numéricas de um texto de mod: "+(175—189) de Vida" → modelo "+{0} de Vida" e faixas [[175, 189]]. Número solto vira faixa fixa. */
export function analisarTexto(texto) {
  const faixas = [];
  const modelo = String(texto ?? '')
    .replace(/\((-?[\d.]+)\s*[—–-]\s*(-?[\d.]+)\)/g, (_, a, b) => `{${faixas.push([Number(a), Number(b)]) - 1}}`)
    .replace(/(?<![\w{.])(-?\d+(?:\.\d+)?)(?![\w}.])/g, (m) => `{${faixas.push([Number(m), Number(m)]) - 1}}`);
  return { modelo, faixas };
}

/** O arquétipo da base pelos requisitos de atributo (str, dex, int ou a combinação, na ordem str_dex_int); sem requisito: null. */
export function arquetipoDaBase(base) {
  const r = base?.requisitos ?? {};
  const partes = ['forca', 'destreza', 'inteligencia'].filter((k) => r[k]).map((k) => ARQUETIPO[k]);
  return partes.length ? partes.join('_') : null;
}

function normalizarGrupo(g, lado) {
  const tiers = (g.tiers ?? g.mods ?? []).map((t) => {
    const { modelo, faixas } = analisarTexto(t.texto ?? t.modificador);
    return { tier: t.tier ?? null, nome: t.nome ?? null, ilvl: t.nivel ?? t.ilvl ?? null, peso: t.peso ?? null, texto: t.texto ?? t.modificador ?? null, modelo, faixas };
  });
  return { familia: g.familia, lado, tags: g.tags ?? [], peso: g.peso_grupo ?? tiers.reduce((n, t) => n + (t.peso ?? 0), 0), ilvlMax: g.ilvl_max ?? null, tiers };
}

/** O pool `normal` (o drop comum) de uma página de mods: prefixos e sufixos por família. Influência, essência, craft etc. ficam de fora. */
function poolNormal(pagina) {
  const p = pagina?.normal;
  if (!p) return null;
  return {
    prefixos: (p.prefixos?.grupos ?? []).map((g) => normalizarGrupo(g, 'prefixo')),
    sufixos: (p.sufixos?.grupos ?? []).map((g) => normalizarGrupo(g, 'sufixo')),
  };
}

/** Os pools especiais de uma página: `{ <pool>: { prefixos, sufixos, implicitos } }` (os "outros" do PoEDB são implícitos). */
function poolsEspeciaisDa(pagina) {
  const r = {};
  for (const [pool, p] of Object.entries(pagina ?? {})) {
    if (pool === 'normal' || !p || typeof p !== 'object') continue;
    const x = {
      prefixos: (p.prefixos?.grupos ?? []).map((g) => normalizarGrupo(g, 'prefixo')),
      sufixos: (p.sufixos?.grupos ?? []).map((g) => normalizarGrupo(g, 'sufixo')),
      implicitos: (p.outros?.grupos ?? []).map((g) => normalizarGrupo(g, 'implicito')),
    };
    if (x.prefixos.length || x.sufixos.length || x.implicitos.length) r[pool] = x;
  }
  return r;
}

/**
 * TODOS os pools especiais da coleção, na mesma forma do pool normal do catálogo: `{ <pool>: { classes: { <classe>: { <página>: {
 * prefixos, sufixos, implicitos } } }, familias, tiers } }`. A página tem o mesmo nome que no catálogo (`str_dex`, `*`, a base da joia).
 */
export function importarPoolsEspeciais(origem = ORIGEM) {
  const pools = {};
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (!e.isDirectory()) continue;
      if (existsSync(join(p, 'atributos-bases.json')) && existsSync(join(p, 'modificadores-tiers.json'))) lerClasse(p);
      else andar(p);
    }
  };
  const lerClasse = (dir) => {
    const id = relative(origem, dir).split('/').pop();
    const tiers = lerJson(join(dir, 'modificadores-tiers.json'));
    for (const [nome, pagina] of Object.entries(tiers.paginas ?? {})) {
      const sufixo = nome.startsWith(`${id}_`) ? nome.slice(id.length + 1) : nome === id ? '*' : nome;
      for (const [pool, x] of Object.entries(poolsEspeciaisDa(pagina))) {
        const alvo = (pools[pool] ??= { classes: {}, familias: 0, tiers: 0 });
        (alvo.classes[id] ??= {})[sufixo] = x;
        for (const g of [...x.prefixos, ...x.sufixos, ...x.implicitos]) {
          alvo.familias++;
          alvo.tiers += g.tiers.length;
        }
      }
    }
  };
  andar(origem);
  return pools;
}

/** Grava um arquivo por pool em `game/gamedata/itens-poe/pools/` (a pasta é refeita). Devolve o resumo `{ pool: { familias, tiers, bytes } }`. */
export function gravarPoolsEspeciais(pools) {
  rmSync(POOLS, { recursive: true, force: true });
  mkdirSync(POOLS, { recursive: true });
  const resumo = {};
  for (const [pool, x] of Object.entries(pools).sort(([a], [b]) => a.localeCompare(b))) {
    const arq = join(POOLS, `${pool}.json`);
    const corpo = { _nota: `Pool especial do PoE "${pool}" (${POOLS_ESPECIAIS[pool] ?? 'sem descrição'}), da coleção poe-itens (PoEDB) — tools/importar-poe-itens.mjs. Fora do drop comum: entra pelo sistema dele.`, pool, nome: POOLS_ESPECIAIS[pool] ?? pool, familias: x.familias, tiers: x.tiers, classes: x.classes };
    writeFileSync(arq, JSON.stringify(corpo));
    resumo[pool] = { familias: x.familias, tiers: x.tiers, bytes: statSync(arq).size };
  }
  return resumo;
}
const imprimirPools = (r) => {
  const total = Object.values(r).reduce((n, x) => n + x.bytes, 0);
  console.log(`pools especiais: ${Object.keys(r).length} em ${POOLS} (${(total / 1e6).toFixed(1)} MB) — ${Object.entries(r).map(([k, x]) => `${k} ${x.familias}/${x.tiers}`).join(', ')}`);
};

function hashDe(arq) {
  return createHash('sha1').update(readFileSync(arq)).digest('hex');
}

/**
 * O slug SEM REPETIÇÃO de cada base da página, na ordem: o PoE tem bases DIFERENTES com o mesmo nome em inglês (as 3 Botas de Dois Tons, os 6
 * Talismãs das Aves Gêmeas, o Talismã do Lobo Grandioso de 2.1.0 e o do "Rito da Lua", a Aljava da Flecha Serrada antiga…) e a coleção
 * repete o slug. A 1ª ocorrência fica com o slug de sempre; a N-ésima ganha `_N`, como os ícones da própria coleção (`Slug_2.png`). Antes o
 * id `Classe/Slug` se repetia: `gerar.acharBase` achava só a primeira e o único da outra nunca era gerado (Olhos do Lobo Grandioso).
 */
export function slugsDistintos(bases) {
  const reais = new Set(bases.map((b) => b.slug));
  const usados = new Set();
  const vezes = new Map();
  return bases.map((b) => {
    const k = (vezes.get(b.slug) ?? 0) + 1;
    vezes.set(b.slug, k);
    // (O `_N` nunca toma o slug de outra base real nem um já dado.)
    let n = k;
    let slug = k === 1 ? b.slug : `${b.slug}_${n}`;
    while (k > 1 && (usados.has(slug) || reais.has(slug))) slug = `${b.slug}_${++n}`;
    usados.add(slug);
    return { slug, ocorrencia: k };
  });
}

/**
 * Os FRASCOS HÍBRIDOS do PoE 1 (classe "Frascos Híbridos" — `Hybrid_Flasks`): a coleção `poe-itens` não tem a classe, então vêm das páginas do
 * poedb pt já baixadas com o Scrapling (`POEDB_HTML`, padrão `/home/deploy/scrapling/saida/html`; leitura só como dado). A base, de
 * `<Slug>.html`: "Recupera N de Vida por S Segundo", "Recupera N de Mana por S Segundo", "Consome X de Y Cargas na utilização" e o DropLevel
 * (o requisito de nível dos frascos é o DropLevel: Médio de Vida 3 → "Requer Nível 3", Divino 60 → 60; o card do híbrido não traz a linha,
 * mas o único do Grande — Divinação Destilada — pede o 30 do DropLevel dele). O POOL: os mods das páginas de Vida e de Mana (o `ModsView` do
 * #ModifiersCalc) que podem nascer no híbrido — o poedb lista em `spawn_no` as tags do peso fora a `flask`: o mod que tem `hybrid_flask` ali
 * não nasce nele (o "Vida Recuperada… / Retira…% da Mana"), e o que tem a tag da própria página (`life_flask` no de Vida) só nasce na classe
 * dela (o "Recupera um adicional de…% em 10 segundos" — o híbrido tem as tags `hybrid_flask, flask`). O peso é o `DropChance` (o da tag `flask`).
 * (04/11, auditoria dos itens — frente A: os 4 que faltavam. O Grande e o Consagrado, as bases dos únicos Divinação Destilada e O Jarro
 * Contorcido, ficam fora desta leva — entram pondo o slug aqui.) O ÍCONE não está na coleção: `icone` fica null e o relatório dá o link.
 */
export const POEDB_HTML = process.env.POEDB_HTML ?? '/home/deploy/scrapling/saida/html';
export const FRASCOS_HIBRIDOS = ['Small_Hybrid_Flask', 'Medium_Hybrid_Flask', 'Colossal_Hybrid_Flask', 'Sacred_Hybrid_Flask'];
const PAGINAS_DO_POOL_HIBRIDO = [['Life_Flasks', 'life_flask'], ['Mana_Flasks', 'mana_flask']];
const tirarHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

/** O objeto do `new ModsView({...})` de uma página de classe do poedb (o JSON com `normal`, `master`…), ou null. */
export function modsViewDoHtml(html) {
  const i = html.indexOf('new ModsView(');
  if (i < 0) return null;
  const ini = html.indexOf('{', i);
  let prof = 0;
  let aspas = false;
  for (let k = ini; k < html.length; k++) {
    const ch = html[k];
    if (aspas) {
      if (ch === '\\') k++;
      else if (ch === '"') aspas = false;
      continue;
    }
    if (ch === '"') aspas = true;
    else if (ch === '{') prof++;
    else if (ch === '}' && --prof === 0) return JSON.parse(html.slice(ini, k + 1));
  }
  return null;
}

/** A base do frasco híbrido pela página dela no poedb (`<Slug>.html`): `{ nome, nivelDrop, vida, mana, cargasPorUso, cargasMaximas, iconeUrl }`. */
export function baseHibridaDoHtml(html) {
  const texto = tirarHtml(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const rec = (recurso) => {
    const m = texto.match(new RegExp(`Recupera (\\d+(?:\\.\\d+)?) de ${recurso} por (\\d+(?:\\.\\d+)?) Segundo`));
    return m ? { quantidade: Number(m[1]), segundos: Number(m[2]) } : null;
  };
  const cargas = texto.match(/Consome (\d+) de (\d+) Cargas na utilização/);
  const drop = html.match(/DropLevel[\s\S]*?<\/td>\s*<td[^>]*>\s*(\d+)/);
  const nome = tirarHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? html.match(/<title>([^<]+?) - PoEDB/)?.[1]) || null;
  return {
    nome,
    nivelDrop: drop ? Number(drop[1]) : null,
    vida: rec('Vida'),
    mana: rec('Mana'),
    cargasPorUso: cargas ? Number(cargas[1]) : null,
    cargasMaximas: cargas ? Number(cargas[2]) : null,
    iconeUrl: html.match(/https:\/\/cdn\.poedb\.tw\/image\/Art\/2DItems\/Flasks\/hybridflask\d+\.webp/)?.[0] ?? null,
  };
}

/** O nome do mod no poedb pt ("<if:MS>{Catalisado}<elif:FS>{Catalisada}…" → "Catalisado"). */
const nomeDoMod = (n) => tirarHtml(String(n ?? '').match(/^<if:MS>\{([^}]*)\}/)?.[1] ?? n);

/**
 * O pool `normal` do frasco híbrido (prefixos e sufixos por família, no formato do catálogo) a partir dos `ModsView` das páginas de Vida e de
 * Mana: os mods que nascem no híbrido (regra no comentário de `POEDB_HTML`), sem repetir o mesmo mod das duas páginas. `tagsDaFamilia`: as
 * tags que o catálogo já dá a cada família (as das páginas de Vida/Mana).
 */
export function poolHibrido(paginas, tagsDaFamilia = {}) {
  const vistos = new Set();
  const grupos = new Map();
  let ordem = 0;
  for (const [view, tagDaPagina] of paginas) {
    for (const m of view?.normal ?? []) {
      const nao = m.spawn_no ?? [];
      if (nao.includes('hybrid_flask') || nao.includes(tagDaPagina)) continue;
      const lado = String(m.ModGenerationTypeID) === '1' ? 'prefixo' : String(m.ModGenerationTypeID) === '2' ? 'sufixo' : null;
      if (!lado) continue;
      const familia = (m.ModFamilyList ?? [])[0] ?? null;
      const texto = String(m.str ?? '').split(/<br\s*\/?>/).map(tirarHtml).filter(Boolean).join(' / ');
      const chave = `${lado}|${familia}|${m.Level}|${nomeDoMod(m.Name)}|${texto}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const g = grupos.get(`${lado}|${familia}`) ?? { familia, lado, tiers: [] };
      grupos.set(`${lado}|${familia}`, g);
      g.tiers.push({ nome: nomeDoMod(m.Name), nivel: Number(m.Level), peso: Number(m.DropChance) || 0, texto, ordem: ordem++ });
    }
  }
  const pool = { prefixos: [], sufixos: [] };
  for (const g of grupos.values()) {
    // (Como na coleção: o tier 1 é o de iLvl mais alto e o mesmo iLvl dá o mesmo tier; no empate, a ordem do poedb.)
    const niveis = [...new Set(g.tiers.map((t) => t.nivel))].sort((a, b) => b - a);
    const tiers = g.tiers.sort((a, b) => b.nivel - a.nivel || a.ordem - b.ordem).map((t) => ({ tier: niveis.indexOf(t.nivel) + 1, nome: t.nome, nivel: t.nivel, peso: t.peso, texto: t.texto }));
    const grupo = normalizarGrupo({ familia: g.familia, tags: tagsDaFamilia[g.familia] ?? [], ilvl_max: Math.max(...tiers.map((t) => t.nivel)), tiers }, g.lado);
    (g.lado === 'prefixo' ? pool.prefixos : pool.sufixos).push(grupo);
  }
  return pool;
}

/**
 * A classe `Hybrid_Flasks` do catálogo (as bases de `FRASCOS_HIBRIDOS` e o pool) lida das páginas do poedb em `html`. `classes`: as que o
 * importador já montou (as tags das famílias vêm das de Vida e de Mana). Devolve `{ classe, icones: [{ slug, url }], faltando: [...] }`.
 */
export function classeHibrida(html = POEDB_HTML, classes = {}) {
  const ler = (slug) => (existsSync(join(html, `${slug}.html`)) ? readFileSync(join(html, `${slug}.html`), 'utf8') : null);
  const faltando = [];
  const paginas = [];
  for (const [pagina, tag] of PAGINAS_DO_POOL_HIBRIDO) {
    const h = ler(pagina);
    const view = h ? modsViewDoHtml(h) : null;
    if (!view) faltando.push(`${pagina}.html (ModsView)`);
    else paginas.push([view, tag]);
  }
  const tagsDaFamilia = {};
  for (const id of ['Life_Flasks', 'Mana_Flasks']) for (const g of Object.values(classes[id]?.paginas ?? {}).flatMap((p) => [...p.prefixos, ...p.sufixos])) tagsDaFamilia[g.familia] ??= g.tags;
  const icones = [];
  const bases = [];
  for (const slug of FRASCOS_HIBRIDOS) {
    const h = ler(slug);
    const b = h ? baseHibridaDoHtml(h) : null;
    if (!b?.vida || !b?.mana || !b.cargasMaximas) { faltando.push(`${slug}.html`); continue; }
    icones.push({ slug, url: b.iconeUrl });
    bases.push({
      id: `Hybrid_Flasks/${slug}`,
      slug,
      nome: b.nome,
      requisitos: { nivel: b.nivelDrop > 1 ? b.nivelDrop : null, forca: null, destreza: null, inteligencia: null },
      // (Os dois recursos: `recupera` é o de Vida — o mesmo campo dos Frascos de Vida — e `recupera_mana` o de Mana.)
      atributos: {
        recupera: { recurso: 'vida', quantidade: b.vida.quantidade, segundos: b.vida.segundos },
        recupera_mana: { recurso: 'mana', quantidade: b.mana.quantidade, segundos: b.mana.segundos },
        cargas_por_uso: b.cargasPorUso,
        cargas_maximas: b.cargasMaximas,
        cargas_atuais: b.cargasMaximas,
      },
      implicitos: [],
      icone: null,
      pool: paginas.length ? '*' : null,
    });
  }
  const classe = {
    id: 'Hybrid_Flasks',
    grupo: 'Frascos',
    fontes: ['https://poedb.tw/pt/Life_Flasks#ModifiersCalc', 'https://poedb.tw/pt/Mana_Flasks#ModifiersCalc', ...FRASCOS_HIBRIDOS.map((s) => `https://poedb.tw/pt/${s}`)],
    bases,
    paginas: paginas.length ? { '*': poolHibrido(paginas, tagsDaFamilia) } : {},
    unicos: [],
  };
  return { classe, icones, faltando };
}

export function importar(origem = ORIGEM, { html = origem === ORIGEM ? POEDB_HTML : null } = {}) {
  const relatorio = { classes: 0, bases: 0, basesSemPool: [], familias: 0, tiers: 0, unicos: 0, textosSemFaixa: 0, arquivos: {} };
  const classes = {};
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (!e.isDirectory()) continue;
      if (existsSync(join(p, 'atributos-bases.json')) && existsSync(join(p, 'modificadores-tiers.json'))) lerClasse(p);
      else andar(p);
    }
  };
  const lerClasse = (dir) => {
    const id = relative(origem, dir).split('/').pop();
    const grupo = relative(origem, dir).split('/')[0];
    const tiers = lerJson(join(dir, 'modificadores-tiers.json'));
    const bases = lerJson(join(dir, 'atributos-bases.json'));
    // (Por slug, na ordem: a N-ésima base com o slug repetido fica com o N-ésimo ícone dele — antes todas ficavam com o último.)
    const visuais = new Map();
    if (existsSync(join(dir, 'bases.json'))) for (const b of lerJson(join(dir, 'bases.json'))) visuais.set(b.slug, [...(visuais.get(b.slug) ?? []), b]);
    const unicos = existsSync(join(dir, 'atributos-unicos.json')) ? lerJson(join(dir, 'atributos-unicos.json')) : [];
    for (const f of ['modificadores-tiers.json', 'atributos-bases.json', 'bases.json', 'atributos-unicos.json']) if (existsSync(join(dir, f))) relatorio.arquivos[relative(origem, join(dir, f))] = hashDe(join(dir, f));
    // As páginas de mods: uma por arquétipo (`Gloves_str_dex`), uma só (`Rings`) ou uma por base (as joias: `Crimson_Jewel`).
    const paginas = {};
    for (const [nome, pagina] of Object.entries(tiers.paginas ?? {})) {
      const pool = poolNormal(pagina);
      if (!pool) continue;
      const sufixo = nome.startsWith(`${id}_`) ? nome.slice(id.length + 1) : nome === id ? '*' : nome;
      paginas[sufixo] = pool;
      relatorio.familias += pool.prefixos.length + pool.sufixos.length;
      for (const g of [...pool.prefixos, ...pool.sufixos]) {
        relatorio.tiers += g.tiers.length;
        relatorio.textosSemFaixa += g.tiers.filter((t) => !t.faixas.length).length;
      }
    }
    const poolDaBase = (b) => {
      const a = arquetipoDaBase(b);
      if (paginas[b.slug]) return b.slug; // joia: página pela base
      if (a && paginas[a]) return a;
      if (paginas['*']) return '*';
      return null;
    };
    const distintos = slugsDistintos(bases);
    const lista = bases.map((b, i) => {
      const { slug, ocorrencia } = distintos[i];
      const doSlug = visuais.get(b.slug) ?? [];
      const v = doSlug[ocorrencia - 1] ?? doSlug[0] ?? {};
      const pool = poolDaBase(b);
      if (!pool) relatorio.basesSemPool.push(`${id}/${slug}`);
      return {
        id: `${id}/${slug}`,
        slug,
        nome: b.nome ?? null,
        requisitos: b.requisitos ?? null,
        atributos: b.atributos ?? {},
        implicitos: (b.implicitos ?? []).map((t) => ({ texto: t, ...analisarTexto(t) })),
        icone: v.icone ? `poe-itens/${relative(origem, dir)}/${v.icone}` : null,
        pool,
      };
    });
    relatorio.classes++;
    relatorio.bases += lista.length;
    relatorio.unicos += unicos.length;
    classes[id] = {
      id,
      grupo,
      fontes: tiers.fonte ?? null,
      bases: lista,
      paginas,
      unicos: unicos.map((u) => ({ slug: u.slug, nome: u.nome ?? null, base: u.base ?? null, requisitos: u.requisitos ?? null, atributosDaBase: u.atributos_da_base ?? {}, modificadores: (u.modificadores ?? []).map((m) => ({ tipo: m.tipo ?? null, texto: m.texto, ...analisarTexto(m.texto) })), icone: `poe-itens/${relative(origem, dir)}/unicos/${u.slug}.png` })),
    };
  };
  andar(origem);
  // (04/11) os FRASCOS HÍBRIDOS, das páginas do poedb (a coleção não tem a classe — `classeHibrida`). Só com a coleção de verdade (os testes
  // que montam uma coleção de mentira não passam `html`).
  if (html && existsSync(html)) {
    const h = classeHibrida(html, classes);
    relatorio.hibridos = { icones: h.icones, faltando: h.faltando };
    for (const f of ['Life_Flasks.html', 'Mana_Flasks.html', ...FRASCOS_HIBRIDOS.map((s) => `${s}.html`)]) if (existsSync(join(html, f))) relatorio.arquivos[`poedb-html/${f}`] = hashDe(join(html, f));
    if (h.classe.bases.length) {
      classes.Hybrid_Flasks = h.classe;
      relatorio.classes++;
      relatorio.bases += h.classe.bases.length;
      for (const g of Object.values(h.classe.paginas).flatMap((p) => [...p.prefixos, ...p.sufixos])) {
        relatorio.familias++;
        relatorio.tiers += g.tiers.length;
        relatorio.textosSemFaixa += g.tiers.filter((t) => !t.faixas.length).length;
      }
    }
  }
  return { geradoEm: new Date().toISOString(), origem: 'poe-itens (PoEDB) — no repositório por decisão do dono (08/10)', classes, relatorio };
}

const imprimirImagens = (r) => console.log(`imagens: ${r.copiadas} copiadas (${(r.bytes / 1e6).toFixed(1)} MB) para ${IMAGENS}${r.faltando.length ? ` — ${r.faltando.length} faltando na coleção: ${r.faltando.slice(0, 5).join(', ')}` : ''}`);

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--so-imagens')) {
  imprimirImagens(copiarImagens(JSON.parse(readFileSync(DESTINO, 'utf8'))));
} else if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--so-pools')) {
  imprimirPools(gravarPoolsEspeciais(importarPoolsEspeciais()));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(ORIGEM)) {
    console.error(`Coleção não encontrada em ${ORIGEM} (defina REFERENCIAS_POE).`);
    process.exit(1);
  }
  const dados = importar();
  const r = dados.relatorio;
  console.log(`classes ${r.classes} · bases ${r.bases} · famílias ${r.familias} · tiers ${r.tiers} · únicos ${r.unicos}`);
  console.log(`bases sem pool de mods: ${r.basesSemPool.length}${r.basesSemPool.length ? ` (${r.basesSemPool.slice(0, 8).join(', ')}${r.basesSemPool.length > 8 ? '…' : ''})` : ''}`);
  console.log(`tiers sem faixa numérica no texto: ${r.textosSemFaixa}`);
  if (r.hibridos) {
    console.log(`frascos híbridos: ${dados.classes.Hybrid_Flasks?.bases.length ?? 0} bases${r.hibridos.faltando.length ? ` — faltando: ${r.hibridos.faltando.join(', ')}` : ''}`);
    // (O ícone não está na coleção: o link do poedb, para baixar à parte.)
    for (const i of r.hibridos.icones) console.log(`  ícone a baixar: ${i.slug} ← ${i.url}`);
  }
  if (!process.argv.includes('--checar')) {
    mkdirSync(ITENS_POE, { recursive: true });
    writeFileSync(DESTINO, JSON.stringify(dados));
    console.log(`gravado: ${DESTINO} (${(statSync(DESTINO).size / 1e6).toFixed(1)} MB)`);
    imprimirImagens(copiarImagens(dados));
    imprimirPools(gravarPoolsEspeciais(importarPoolsEspeciais()));
  }
}
