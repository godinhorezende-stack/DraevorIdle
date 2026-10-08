// IMPORTADOR da referência de itens do PoE (Fase 1 do sistema de itens no modelo do PoE — docs/engine/04-piloto-prefixo-sufixo.md).
//
// Lê a coleção local (`poe-itens/**`, extraída do PoEDB; ver docs/engine/02-referencia-poe.md) e grava UM catálogo normalizado:
// classes de item → bases (requisitos, atributos, implícitos, ícone) e o pool `normal` de cada arquétipo (prefixos e sufixos por
// FAMÍLIA, com os tiers: nome, iLvl, peso, texto e as faixas numéricas), mais os únicos (mods fixos em texto). Nada é inventado: o que
// a fonte não traz fica `null`, e cada classe guarda as URLs de origem.
//
// A COLEÇÃO fica fora do repositório (`REFERENCIAS_POE`, padrão `/home/deploy/referencias-poe`): é só a fonte deste tool. O que o JOGO
// usa entra no repositório (dono, 08/10, revogando a decisão de 04/10 de deixar tudo fora): o catálogo em
// `game/gamedata/itens-poe/catalogo-itens.json` e SÓ as imagens que ele referencia em `game/gamedata/itens-poe/icones-itens/` (as mesmas
// pastas relativas de `original/`, para o caminho do ícone no catálogo continuar valendo). Uso:
//   node tools/importar-poe-itens.mjs              → grava o catálogo e as imagens dele, e imprime o relatório
//   node tools/importar-poe-itens.mjs --checar     → só o relatório (não grava)
//   node tools/importar-poe-itens.mjs --so-imagens → só refaz as imagens do catálogo que já está no repositório
//   node tools/importar-poe-itens.mjs --so-pools   → só refaz os POOLS ESPECIAIS (`game/gamedata/itens-poe/pools/<pool>.json`)
//
// Os pools especiais (influências, corrompido, bancada do mestre, essência, fósseis, velado, eldritch, síntese, encantamento…) ficam FORA
// do catálogo (o drop comum só usa o pool `normal`, como na campanha do PoE) e cada um num arquivo: o sistema que precisar dele (orbe Vaal,
// essência, fóssil, orbe de influência…) lê só o seu, sob demanda (`itens-poe/catalogo.mjs` `poolEspecial`).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
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
    else if (typeof x === 'string' && /\.(png|webp|jpe?g|gif|svg)$/i.test(x)) refs.add(x.replace(/^\/+/, ''));
  };
  andar(dados);
  return [...refs].sort();
}

/** Refaz `icones-itens/` com só as imagens referenciadas (a pasta é apagada e copiada de novo). Devolve `{ copiadas, faltando, bytes }`. */
export function copiarImagens(dados) {
  rmSync(IMAGENS, { recursive: true, force: true });
  let copiadas = 0;
  let bytes = 0;
  const faltando = [];
  for (const rel of imagensDoCatalogo(dados)) {
    const de = join(ORIGINAL, rel);
    if (!existsSync(de)) { faltando.push(rel); continue; }
    const para = join(IMAGENS, rel);
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

export function importar(origem = ORIGEM) {
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
    const visuais = existsSync(join(dir, 'bases.json')) ? Object.fromEntries(lerJson(join(dir, 'bases.json')).map((b) => [b.slug, b])) : {};
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
    const lista = bases.map((b) => {
      const v = visuais[b.slug] ?? {};
      const pool = poolDaBase(b);
      if (!pool) relatorio.basesSemPool.push(`${id}/${b.slug}`);
      return {
        id: `${id}/${b.slug}`,
        slug: b.slug,
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
  if (!process.argv.includes('--checar')) {
    mkdirSync(ITENS_POE, { recursive: true });
    writeFileSync(DESTINO, JSON.stringify(dados));
    console.log(`gravado: ${DESTINO} (${(statSync(DESTINO).size / 1e6).toFixed(1)} MB)`);
    imprimirImagens(copiarImagens(dados));
    imprimirPools(gravarPoolsEspeciais(importarPoolsEspeciais()));
  }
}
