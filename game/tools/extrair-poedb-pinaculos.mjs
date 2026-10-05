// Extrai do poedb.tw os CHEFES PINÁCULO do PoE (https://poedb.tw/us/Pinnacle_boss): para cada chefe, as variantes do monstro (vida, dano,
// resistências, área, tags e os parâmetros do drop) e os ÚNICOS EXCLUSIVOS dele (nome, base, requisitos, mods, ícone) — a "tabela de loot
// exclusiva" que o dono descreveu (05/10). Cruza cada Único com a coleção do Drive pelo slug (o mesmo nome em inglês do link do poedb),
// para usar o texto em português quando existir.
//
// A saída é REFERÊNCIA LOCAL, fora do git e da produção (a mesma regra das imagens do PoE, decisão do dono de 04/10):
//   /home/deploy/referencias-poe/poedb/pinaculos.json  e  /home/deploy/referencias-poe/poedb/icones/*.webp
//
// Uso: node tools/extrair-poedb-pinaculos.mjs [--sem-icones]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://poedb.tw';
const PAGINA = `${SITE}/us/Pinnacle_boss`;
export const SAIDA = '/home/deploy/referencias-poe/poedb';
const COLECAO = '/home/deploy/referencias-poe/importado/itens-poe.json';
const PAUSA_MS = 1500;
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function baixar(url, tipo = 'text') {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(url, { headers: { 'user-agent': AGENTE } });
    if (r.ok) return tipo === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
    if (tentativa >= 3) throw new Error(`${r.status} em ${url}`);
    await esperar(PAUSA_MS * tentativa * 2);
  }
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
const texto = (h) =>
  String(h ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
const todos = (re, s) => [...s.matchAll(re)];
/** O conteúdo das `<div class="X">` (não aninhadas da mesma classe). */
const divs = (classe, s) => todos(new RegExp(`<div class="${classe}">([\\s\\S]*?)</div>`, 'g'), s).map((m) => m[1]);

/** Os blocos de aba (`tab-pane`) da página: id → html. */
export function abas(html) {
  const inicios = todos(/<div[^>]*\bid="([^"]+)"[^>]*class="tab-pane[^"]*"/g, html).map((m) => ({ id: m[1], i: m.index }));
  return inicios.map((a, k) => ({ id: a.id, html: html.slice(a.i, inicios[k + 1]?.i ?? html.length) }));
}

/** Os chefes listados na aba "Pinnacle Atlas Boss Monster". */
export function chefesDaLista(html) {
  const aba = abas(html).find((a) => a.id === 'PinnacleAtlasBossMonster');
  if (!aba) throw new Error('aba PinnacleAtlasBossMonster não encontrada');
  return todos(/<tr><td><a [^>]*href="\/us\/([^"]+)">([^<]+)<\/a>/g, aba.html).map((m) => ({ pagina: decodeURIComponent(m[1]), nome: texto(m[2]) }));
}

/** Um Único (o bloco `col` da aba de Únicos). */
function unico(col) {
  const href = col.match(/href="\/us\/([^"]+)"/)?.[1];
  const nome = texto(col.match(/<span class="uniqueName">([\s\S]*?)<\/span>/)?.[1]);
  if (!href || !nome) return null;
  const separado = col.split('<div class="separator"></div>');
  const linhas = (classe, h) =>
    todos(new RegExp(`<div class="${classe}">([\\s\\S]*?)</div>`, 'g'), h)
      .map((m) => m[1])
      .filter((x) => !/item_description/.test(x))
      .map(texto)
      .filter(Boolean);
  const notas = todos(/<span class="item_description">([\s\S]*?)<\/span>/g, col).map((m) => texto(m[1]));
  const req = texto(col.match(/<div class="requirements">([\s\S]*?)<\/div>/)?.[1]);
  const nivel = Number(req.match(/Level\s*(\d+)/)?.[1]) || null;
  const atr = (k) => Number(req.match(new RegExp(`(\\d+)\\s*${k}`))?.[1]) || null;
  return {
    slug: decodeURIComponent(href),
    nome,
    base: texto(col.match(/<span class="uniqueTypeLine">([\s\S]*?)<\/span>/)?.[1]) || null,
    icone: col.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? null,
    requisitos: { texto: req || null, nivel, forca: atr('Str'), destreza: atr('Dex'), inteligencia: atr('Int') },
    implicitos: separado.length > 1 ? linhas('implicitMod', separado[0]) : [],
    explicitos: linhas('explicitMod', separado.length > 1 ? separado.slice(1).join('') : col),
    notas,
    corrompido: /class="corrupted"|>\s*Corrupted\s*</.test(col),
  };
}

/** Uma variante do monstro (a aba com `data-category="MonsterVarieties"`). */
function variante(aba) {
  const h = aba.html;
  const tab = h.match(/data-tabname="([^"]*)"/)?.[1] ?? '';
  const id = texto(tab.match(/&lt;small&gt;(.*?)&lt;\/small&gt;|<small>(.*?)<\/small>/)?.slice(1).find(Boolean) ?? '') || aba.id;
  const atributos = {};
  for (const m of todos(/<div class="border p-2 d-flex justify-content-between"><div><i[^>]*><\/i>([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g, h)) {
    const k = texto(m[1]);
    if (k !== 'Resistance') atributos[k] = texto(m[2]);
  }
  const resistencias = {};
  for (const m of todos(/IconEnemyResistance(Fire|Cold|Lightning|Chaos)\w*\.webp"[^>]*\/>(?:<span[^>]*>)?(-?\d+)(?:<\/span>)?%/g, h)) resistencias[m[1].toLowerCase()] = Number(m[2]);
  const tabela = {};
  for (const m of todos(/<tr><th>([^<]+)<td>([\s\S]*?)(?=<tr>|<\/table>)/g, h)) tabela[texto(m[1])] = texto(m[2]);
  const mods = divs('implicitMod', h.split('data-tabname')[0]).flatMap((x) => texto(x).split('\n'));
  const param = (re) => mods.map((l) => l.match(re)).find(Boolean);
  return {
    id,
    nome: texto(h.match(/<span class="lc">([\s\S]*?)<\/span>/)?.[1]) || null,
    area: tabela.Area || null,
    tags: tabela.Tags ? tabela.Tags.split(/,\s*/) : [],
    atributos,
    resistencias,
    drop: {
      raridadePct: Number(param(/monster dropped item rarity \+% \[(-?\d+)\]/)?.[1] ?? NaN) || null,
      quantidadePct: Number(param(/monster dropped item quantity \+% \[(-?\d+)\]/)?.[1] ?? NaN) || null,
      semDrop: mods.some((l) => /monster no drops/.test(l)),
    },
    mods,
  };
}

/** Lê a página de um chefe: variantes + Únicos exclusivos. */
export function lerChefe(html) {
  const as = abas(html);
  const unicos = [];
  for (const a of as.filter((x) => /Unique$/.test(x.id))) {
    for (const col of a.html.split('<div class="col">').slice(1)) {
      const u = unico(col);
      if (u && !unicos.some((x) => x.slug === u.slug)) unicos.push(u);
    }
  }
  const variantes = as.filter((a) => /data-category="MonsterVarieties"/.test(a.html)).map(variante);
  return { unicos, variantes };
}

/** A coleção do Drive por slug (para o texto em português). */
function colecaoPorSlug() {
  if (!existsSync(COLECAO)) return new Map();
  const c = JSON.parse(readFileSync(COLECAO, 'utf8'));
  const m = new Map();
  for (const cl of Object.values(c.classes)) for (const u of cl.unicos ?? []) if (u.slug && !m.has(u.slug)) m.set(u.slug, { classe: cl.id, nome: u.nome, base: u.base });
  return m;
}

async function principal() {
  const semIcones = process.argv.includes('--sem-icones');
  mkdirSync(join(SAIDA, 'icones'), { recursive: true });
  const lista = chefesDaLista(await baixar(PAGINA));
  console.log(`${lista.length} chefes pináculo`);
  const colecao = colecaoPorSlug();
  const chefes = [];
  for (const c of lista) {
    await esperar(PAUSA_MS);
    const url = `${SITE}/us/${encodeURIComponent(c.pagina).replace(/%2C/g, '%2C')}`;
    const { unicos, variantes } = lerChefe(await baixar(url));
    for (const u of unicos) {
      const d = colecao.get(u.slug) ?? colecao.get(u.slug.replace(/_/g, '')) ?? null;
      u.naColecao = d;
      if (u.icone && !semIcones) {
        const arquivo = u.icone.split('/').slice(-3).join('_');
        u.iconeLocal = `icones/${arquivo}`;
        if (!existsSync(join(SAIDA, u.iconeLocal))) {
          await esperar(300);
          try {
            writeFileSync(join(SAIDA, u.iconeLocal), await baixar(u.icone, 'buffer'));
          } catch (e) {
            // O CDN recusa alguns ícones (403): fica a URL, sem a cópia local.
            u.iconeErro = e.message;
            delete u.iconeLocal;
          }
        }
      }
    }
    chefes.push({ nome: c.nome, pagina: url, variantes, unicos });
    console.log(`  ${c.nome}: ${variantes.length} variantes, ${unicos.length} únicos (${unicos.filter((u) => u.naColecao).length} na coleção do Drive)`);
  }
  const saida = { fonte: PAGINA, extraidoEm: new Date().toISOString(), licenca: 'poedb.tw — conteúdo de wiki sob CC BY-NC-SA 3.0; dados do jogo © Grinding Gear Games. Referência local.', chefes };
  writeFileSync(join(SAIDA, 'pinaculos.json'), JSON.stringify(saida, null, 2));
  const u = chefes.flatMap((c) => c.unicos);
  console.log(`total: ${chefes.length} chefes, ${chefes.reduce((n, c) => n + c.variantes.length, 0)} variantes, ${u.length} únicos (${u.filter((x) => x.naColecao).length} na coleção) → ${join(SAIDA, 'pinaculos.json')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
