#!/usr/bin/env node
// (Frente D, 04/11) Os SABORES das peças do PoE — o texto de sabor ("FlavourText") do card do poedb, a marca "Corrompido" de fábrica e a marca
// "Histórico" das Joias Atemporais. Grava `gamedata/itens-poe/sabores.json` (um arquivo NOVO: o catálogo e o poedb-unicos ficam como estão):
//   - `unicos[slug]`: `{ sabor?, corrompidoDeFabrica?, historico? }` — o slug é o do único no catálogo (`peca.poe.unico`);
//   - `bases["Classe/Slug"]`: `{ sabor?, corrompidoDeFabrica? }` — o id da base no catálogo (`peca.poe.base`; o Anel da Fenda e o Adorno do Ladrão
//     caem corrompidos no PoE).
// O catálogo lê as marcas ao carregar (`itens-poe/catalogo.mjs → sabores`): o gerador põe `corrompido` na peça que já sai corrompida e a linha
// "Histórico" na Atemporal que não a tinha. O cliente busca o arquivo (estático, `/gamedata/itens-poe/sabores.json`) uma vez, no primeiro
// balão, e mostra o sabor no fim, em itálico (`itens-poe-balao.mjs`).
//
// As fontes (o Scrapling — `/home/deploy/scrapling`; só leitura):
//   - o sabor: a página de cada item (`saida/html/<Slug>.html`), o `<div class="FlavourText">` do card do próprio item (o primeiro card com o
//     nome dele; a página da base lista os únicos dela depois). `<br>` vira quebra de linha; a marcação do PoE ("<size:24>{…}") sai.
//   - o "Corrompido" e o "Histórico": os cards das listas do poedb (`saida/itens/lista.json`: a linha da classe `corrupted`; a linha
//     `explicitMod` "Histórico").
//
//   POEDB_HTML=/home/deploy/scrapling/saida/html POEDB_LISTA=/home/deploy/scrapling/saida/itens/lista.json node tools/importar-sabores-poedb.mjs
//   (os dois são o padrão; sem eles, os caminhos acima)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA_HTML = process.env.POEDB_HTML ?? '/home/deploy/scrapling/saida/html';
const LISTA = process.env.POEDB_LISTA ?? '/home/deploy/scrapling/saida/itens/lista.json';
const DESTINO = new URL('../gamedata/itens-poe/sabores.json', import.meta.url);
const CATALOGO = new URL('../gamedata/itens-poe/catalogo-itens.json', import.meta.url);
const CORRECOES = new URL('../gamedata/itens-poe/unicos-correcoes.json', import.meta.url);
const MAPAS = new URL('../gamedata/itens-poe/mapas.json', import.meta.url);

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const semEntidades = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e.toLowerCase()] ?? m));

/**
 * O texto do `<div class="FlavourText">`: `<br>` (e a quebra crua das páginas dos mapas únicos) vira "\n"; a marcação de tamanho do PoE
 * ("<size:24>{…}", "<tamanho:23>{…}") fica só com o texto; os espaços das pontas saem de cada verso.
 */
export function textoDoSabor(html) {
  let t = String(html).replace(/<br\s*\/?>/gi, '\n');
  // a marcação do PoE: "<size:24>{texto}" / "<tamanho:23>{texto}" (o poedb pt traduziu a palavra em parte das páginas)
  // e o grupo sem tamanho ("{Este item pode ser ungido pela Cassia}"): o PoE mostra o texto, sem as chaves
  for (let i = 0; i < 4 && /\{[^{}]*\}/.test(t); i++) t = t.replace(/(?:<[a-zà-ú]+:\d+>)?\{([^{}]*)\}/gi, '$1');
  t = semEntidades(t.replace(/<[^>]+>/g, ''));
  return t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** Os cards (`newItemPopup`) da página: o nome (as linhas do cabeçalho), o sabor e se está corrompido. */
export function cardsDaPagina(html) {
  return String(html).split(/<div class="newItemPopup /).slice(1).map((p) => {
    const fim = p.indexOf('<div class="content">');
    const cabecalho = fim >= 0 ? p.slice(0, fim) : p;
    const nomes = [...cabecalho.matchAll(/<div class="itemName[^"]*">\s*<span class="lc">([^<]*)<\/span>/g)].map((m) => semEntidades(m[1]).trim());
    const sabor = p.match(/<div class="FlavourText[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    return { nomes, sabor: sabor ? textoDoSabor(sabor[1]) : null, corrompido: /<div class="corrupted">/.test(p) };
  });
}

function lerPagina(slug) {
  for (const nome of [slug, encodeURIComponent(slug)]) {
    const arq = join(PASTA_HTML, `${nome}.html`);
    // (a página com a vírgula crua — "Caer_Blaidd,_Wolfpacks_Den" — veio vazia; a codificada, "%2C", tem os cards)
    const html = existsSync(arq) ? readFileSync(arq, 'utf8') : null;
    if (html?.includes('newItemPopup')) return html;
  }
  return null;
}

/** O card do próprio item na página: o primeiro com o nome dele (o único: o nome; a base: o nome da base); sem nome que bata, o primeiro. */
function cardDoItem(slug, nome) {
  const html = lerPagina(slug);
  if (!html) return null;
  const cards = cardsDaPagina(html);
  return cards.find((c) => c.nomes[0] === nome) ?? cards[0] ?? null;
}

function main() {
  const cat = JSON.parse(readFileSync(CATALOGO, 'utf8'));
  const novos = existsSync(CORRECOES) ? JSON.parse(readFileSync(CORRECOES, 'utf8')).novos ?? [] : [];
  const mapas = existsSync(MAPAS) ? JSON.parse(readFileSync(MAPAS, 'utf8')).classe : null;
  // os únicos e as bases que o JOGO conhece (o catálogo, os novos das correções e os mapas — os mesmos que `catalogo.mjs` monta)
  const unicos = new Map();
  const bases = new Map();
  for (const c of [...Object.values(cat.classes), ...(mapas ? [mapas] : [])]) {
    for (const u of c.unicos ?? []) if (!unicos.has(u.slug)) unicos.set(u.slug, u.nome);
    for (const b of c.bases ?? []) bases.set(b.id, b.nome);
  }
  for (const n of novos) if (!unicos.has(n.slug)) unicos.set(n.slug, n.nome);
  const slugsDasBases = new Set([...bases.keys()].map((id) => id.split('/')[1]));

  // As marcas dos cards das listas: "Corrompido" e "Histórico" (o href é "/pt/<Slug>" ou só "<Slug>").
  const lista = JSON.parse(readFileSync(LISTA, 'utf8'));
  const corrompidos = new Set();
  const historicos = new Set();
  for (const card of lista) {
    const slug = String(card.href ?? '').replace(/^\/pt\//, '');
    if (card.linhas?.corrupted?.includes('Corrompido')) corrompidos.add(slug);
    if (card.linhas?.explicitMod?.includes('Histórico')) historicos.add(slug);
  }

  const saida = { unicos: {}, bases: {} };
  const semPagina = [];
  const foraDoJogo = [...new Set([...corrompidos, ...historicos])].filter((s) => !unicos.has(s) && !slugsDasBases.has(s));
  for (const [slug, nome] of [...unicos].sort(([a], [b]) => a.localeCompare(b))) {
    const card = cardDoItem(slug, nome);
    if (!card) semPagina.push(slug);
    const e = {
      ...(card?.sabor ? { sabor: card.sabor } : {}),
      ...(corrompidos.has(slug) ? { corrompidoDeFabrica: true } : {}),
      ...(historicos.has(slug) ? { historico: true } : {}),
    };
    if (Object.keys(e).length) saida.unicos[slug] = e;
  }
  for (const [id, nome] of [...bases].sort(([a], [b]) => a.localeCompare(b))) {
    const slug = id.split('/')[1];
    const card = cardDoItem(slug, nome);
    const e = { ...(card?.sabor ? { sabor: card.sabor } : {}), ...(corrompidos.has(slug) ? { corrompidoDeFabrica: true } : {}) };
    if (Object.keys(e).length) saida.bases[id] = e;
  }
  const contar = (o, k) => Object.values(o).filter((e) => e[k]).length;
  const arquivo = {
    _nota: 'Os SABORES das peças do PoE (tools/importar-sabores-poedb.mjs, do poedb pt extraído pelo Scrapling). `unicos[slug]` (o `peca.poe.unico`) e `bases["Classe/Slug"]` (o `peca.poe.base`): `sabor` — o texto de sabor do card (FlavourText; "\\n" entre os versos), mostrado no fim do balão em itálico (o cliente busca este arquivo uma vez — `frontend/client/src/itens-poe-balao.mjs`); `corrompidoDeFabrica` — o card do poedb traz "Corrompido": a peça já cai corrompida e não aceita moeda que altere (só as Corroídas), como no PoE; `historico` — a Joia Atemporal com a linha "Histórico" (o "Limitado a: 1 Histórico" — `passivas/joias.mjs`). O catálogo aplica as marcas ao carregar (`systems/itens-poe/catalogo.mjs → sabores`).',
    geradoEm: new Date().toISOString(),
    fontes: ['https://poedb.tw/pt/<Slug> — o <div class="FlavourText"> do card do item', 'https://poedb.tw/pt/Unique_item (e as páginas das classes) — as linhas "Corrompido" (classe corrupted) e "Histórico" dos cards'],
    contagem: { unicosComSabor: contar(saida.unicos, 'sabor'), basesComSabor: contar(saida.bases, 'sabor'), corrompidosDeFabrica: contar(saida.unicos, 'corrompidoDeFabrica') + contar(saida.bases, 'corrompidoDeFabrica'), historicos: contar(saida.unicos, 'historico') },
    ...saida,
  };
  writeFileSync(DESTINO, `${JSON.stringify(arquivo, null, 1)}\n`);
  console.log(`sabores.json: ${JSON.stringify(arquivo.contagem)}`);
  if (semPagina.length) console.log(`únicos sem página no Scrapling (${semPagina.length}): ${semPagina.join(', ')}`);
  if (foraDoJogo.length) console.log(`marcados no poedb e fora do catálogo do jogo (${foraDoJogo.length}): ${foraDoJogo.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
