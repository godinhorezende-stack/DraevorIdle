// Baixa do poedb (pt) as GEMAS DE SUPORTE do PoE (dono, 06/10: "faça isso" — as magias ativadas por gatilho e os suportes do PoE no
// lugar dos do Draevor). A coleção do dono (`poe-gemas-poedb`) traz só as 562 ativas; esta traz os suportes no MESMO formato que o
// interpretador da arena lê (`slug, nome, en, cor, nivelReq, tags, tipos, props, mods, qualidade, desc, icone, colunas, linhas`), mais
// os implícitos da tabela "Level Effect" e as linhas da parte híbrida (a magia ativada da "Conjurar no Acerto Crítico").
//   - a lista: https://poedb.tw/pt/Support_Gems; cada suporte: https://poedb.tw/pt/<Slug>;
//   - o ícone: o PNG do CDN oficial (web.poecdn.com), o mesmo desenho do webp do poedb;
//   - pausa entre os pedidos; o HTML fica em cache (`.cache/`), rodar de novo só completa.
// A saída é REFERÊNCIA LOCAL (fora do git e da produção), como o resto do PoE: <REFERENCIAS_POE>/poe-suportes-poedb/
//   suportes.json (todos) e icones/<Slug>.png.
// Uso: node tools/baixar-suportes-poedb.mjs
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const PASTA = join(RAIZ, 'poe-suportes-poedb');
const CACHE = join(PASTA, '.cache');
const SITE = 'https://poedb.tw';
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const PAUSA_MS = 400;
const COR = { gem_red: 'vermelha', gem_green: 'verde', gem_blue: 'azul', gem_white: 'branca' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
for (const p of [PASTA, CACHE, join(PASTA, 'icones')]) mkdirSync(p, { recursive: true });

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
/** O texto de um pedaço de HTML: sem tags, entidades trocadas, espaços juntados (o "—" das faixas fica). */
const texto = (h) => String(h ?? '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENT[e]).replace(/ㅤ/g, '').replace(/\s+/g, ' ').trim();

async function pagina(caminho) {
  const arq = join(CACHE, `${caminho.replace(/[^\w.-]/g, '_')}.html`);
  if (existsSync(arq)) return readFileSync(arq, 'utf8');
  for (let t = 1; ; t++) {
    await esperar(PAUSA_MS);
    const r = await fetch(SITE + caminho, { headers: { 'user-agent': AGENTE } }).catch(() => null);
    if (r?.ok) {
      const h = await r.text();
      writeFileSync(arq, h);
      return h;
    }
    if (t >= 4) throw new Error(`${caminho}: ${r?.status ?? 'sem resposta'}`);
    await esperar(PAUSA_MS * 4 * t);
  }
}

/** A lista: `[{ slug, nome, cor, nivelReq, tags, iconeWebp }]` (cada suporte uma vez). */
async function lista() {
  const h = await pagina('/pt/Support_Gems');
  const vistos = new Set();
  const saida = [];
  for (const m of h.matchAll(/<tr data-filters="[^"]*"><td><a class="(gem_\w+)"[^>]*href="\/pt\/([^"]+)"><img[^>]*src="([^"]+)"[^>]*\/><\/a><td><a [^>]*>([^<]+)<\/a>\s*\((\d+)\)<div class="gem_tags small">([^<]*)<\/div>/g)) {
    const [, cor, slug, icone, nome, nivel, tags] = m;
    if (vistos.has(slug)) continue;
    vistos.add(slug);
    saida.push({ slug, nome: texto(nome).replace(/^Suporte:\s*/, ''), cor: COR[cor] ?? cor, nivelReq: Number(nivel), tags: tags.split(',').map((t) => texto(t)).filter(Boolean), iconeWebp: icone });
  }
  return saida;
}

/** Uma tabela HTML: `{ colunas, linhas }` (o texto de cada célula). */
function tabela(h) {
  const colunas = [...(h.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => texto(m[1]));
  const corpo = h.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  const linhas = [...corpo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) => [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => texto(m[1])));
  return { colunas, linhas };
}

/** As divs de um bloco `Stats` (a caixa do item) pela classe. */
function linhasDoBloco(bloco) {
  const out = [];
  for (const m of bloco.matchAll(/<div class="(property|hybridProperty|requirements|secDescrText|explicitMod|implicitMod|qualityMod)">([\s\S]*?)<\/div>/g)) out.push({ classe: m[1], html: m[2], texto: texto(m[2]) });
  return out;
}

async function suporte(s) {
  const h = await pagina(`/pt/${s.slug}`);
  const caixa = h.slice(h.indexOf('newItemPopup'), h.indexOf('itemboximage'));
  const tipos = [...caixa.matchAll(/class="GemTags" href="([^"]+)"/g)].map((m) => m[1]);
  const props = [];
  const mods = [];
  const qualidade = [];
  let desc = '';
  for (const l of linhasDoBloco(caixa)) {
    if ((l.classe === 'property' || l.classe === 'hybridProperty') && !/GemTags/.test(l.html)) props.push(l.texto);
    else if (l.classe === 'secDescrText') desc = l.texto;
    else if (l.classe === 'explicitMod' || l.classe === 'implicitMod') mods.push(l.texto);
    else if (l.classe === 'qualityMod') qualidade.push(l.texto);
  }
  const en = texto(caixa.match(/<div>\s*([^<]+?)\s*<\/div>\s*<\/div>\s*<\/div>\s*$/)?.[1] ?? '') || s.slug.replace(/_/g, ' ');
  // "Level Effect": a tabela de implícitos (o custo, a regra do gatilho) e a de níveis.
  const efeito = h.slice(h.indexOf('Level Effect'));
  const tabelas = [...efeito.slice(0, efeito.indexOf('card-header', 20) > 0 ? efeito.indexOf('card-header', 20) : undefined).matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => tabela(m[0]));
  const implicitos = tabelas.filter((t) => t.colunas[0] === 'Implicit').flatMap((t) => t.linhas.map((l) => l[0]));
  const niveis = tabelas.find((t) => t.colunas[0] === 'Nível') ?? { colunas: [], linhas: [] };
  return {
    slug: s.slug, nome: s.nome, en: en.replace(/ Support$/, '') + ' Support', cor: s.cor, nivelReq: s.nivelReq, tags: s.tags, tipos,
    props: [...new Set(props)], mods: [...new Set(mods)], qualidade: [...new Set(qualidade)], implicitos, desc, icone: `icones/${s.slug}.png`,
    colunas: niveis.colunas, linhas: niveis.linhas,
  };
}

async function icone(s) {
  const alvo = join(PASTA, 'icones', `${s.slug}.png`);
  if (existsSync(alvo) || !s.iconeWebp) return;
  const oficial = s.iconeWebp.replace(/^https:\/\/cdn\.poedb\.tw\/image\/(.*)\.webp$/, 'https://web.poecdn.com/image/$1.png');
  await esperar(PAUSA_MS / 2);
  const r = await fetch(oficial, { headers: { 'user-agent': AGENTE } }).catch(() => null);
  if (r?.ok) writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
  else throw new Error(`ícone ${r?.status ?? '?'}`);
}

const todos = await lista();
console.log(`${todos.length} suportes na lista`);
const saida = [];
const erros = [];
for (const s of todos) {
  try {
    saida.push(await suporte(s));
    await icone(s).catch((e) => erros.push(`${s.slug}: ${e.message}`));
    if (saida.length % 25 === 0) console.log(`${saida.length}/${todos.length}`);
  } catch (e) {
    erros.push(`${s.slug}: ${e.message}`);
  }
}
writeFileSync(join(PASTA, 'suportes.json'), JSON.stringify(saida, null, 1));
console.log(`gravados ${saida.length} em ${PASTA}/suportes.json${erros.length ? ` — erros ${erros.length}:\n${erros.slice(0, 20).join('\n')}` : ''}`);
