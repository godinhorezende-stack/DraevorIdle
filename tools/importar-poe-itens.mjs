// IMPORTADOR da referência de itens do PoE (Fase 1 do sistema de itens no modelo do PoE — docs/engine/04-piloto-prefixo-sufixo.md).
//
// Lê a coleção local (`poe-itens/**`, extraída do PoEDB; ver docs/engine/02-referencia-poe.md) e grava UM catálogo normalizado:
// classes de item → bases (requisitos, atributos, implícitos, ícone) e o pool `normal` de cada arquétipo (prefixos e sufixos por
// FAMÍLIA, com os tiers: nome, iLvl, peso, texto e as faixas numéricas), mais os únicos (mods fixos em texto). Nada é inventado: o que
// a fonte não traz fica `null`, e cada classe guarda as URLs de origem.
//
// A coleção e o catálogo ficam FORA do repositório (direitos da Grinding Gear Games; decisão do dono de 04/10): entrada e saída vêm
// de `REFERENCIAS_POE` (padrão `/home/deploy/referencias-poe`). Uso:
//   node tools/importar-poe-itens.mjs            → grava <REFERENCIAS_POE>/importado/itens-poe.json e imprime o relatório
//   node tools/importar-poe-itens.mjs --checar   → só o relatório (não grava)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const ORIGEM = join(RAIZ, 'original', 'poe-itens');
const DESTINO = join(RAIZ, 'importado', 'itens-poe.json');

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
  return { geradoEm: new Date().toISOString(), origem: 'poe-itens (PoEDB) — referência local, não distribuível sem decisão do dono', classes, relatorio };
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
    mkdirSync(join(RAIZ, 'importado'), { recursive: true });
    writeFileSync(DESTINO, JSON.stringify(dados));
    console.log(`gravado: ${DESTINO} (${(statSync(DESTINO).size / 1e6).toFixed(1)} MB)`);
  }
}
