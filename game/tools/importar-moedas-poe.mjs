// As MOEDAS EMPILHÁVEIS do PoE (dono, 07/10: "cadastre todas as moedas empilháveis — poedb.tw/pt/Stackable_Currency — com suas
// funcionalidades") → `gamedata/itens-poe/moedas-poe.json` (o que o jogo lê: `systems/itens-poe/moedas.mjs`) e os ícones em
// `gamedata/itens-poe/icones-moedas/<Slug>.png` (o PNG do CDN oficial do PoE — o mesmo desenho do webp do poedb; já baixado é pulado).
// A fonte é a coleção do dono (`original/poe-itens/Itens_Monetarios/Stackable_Currency/itens.json`, do poedb em português).
// Os ids de item ficam em `moedas-poe-ids.json` (ESTÁVEIS: só cresce). O Joalheiro, a Fusão e o Cromático mantêm os ids de antes
// (915001–915003, os orbes de socket).
// Uso: node tools/importar-moedas-poe.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const FONTE = join(RAIZ, 'original', 'poe-itens', 'Itens_Monetarios', 'Stackable_Currency', 'itens.json');
const SAIDA = new URL('../gamedata/itens-poe/moedas-poe.json', import.meta.url);
const ARQ_IDS = new URL('../gamedata/itens-poe/moedas-poe-ids.json', import.meta.url);
const ICONES = new URL('../gamedata/itens-poe/icones-moedas/', import.meta.url);
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(ICONES, { recursive: true });

const fonte = JSON.parse(readFileSync(FONTE, 'utf8'));
const vistos = new Set();
const moedas = [];
for (const x of fonte.itens) {
  // Repetidos na coleção (o "Corrompido" aparece três vezes) e os de teste do PoE (DNT = "do not translate", fora do jogo) ficam de fora.
  if (vistos.has(x.slug) || /^DNT_/.test(x.slug)) continue;
  vistos.add(x.slug);
  moedas.push({
    slug: x.slug, nome: x.nome, efeitos: (x.efeitos ?? []).map((l) => l.replace(/\s*\/\s*/g, ' ').trim()).filter(Boolean),
    pilha: x.tamanho_pilha?.maximo ?? 20, icone: `${x.slug}.png`, fonteDaImagem: x.fonte_imagem ?? null,
  });
}

// Os ids estáveis.
const ids = existsSync(ARQ_IDS) ? JSON.parse(readFileSync(ARQ_IDS, 'utf8')).ids : { Jewellers_Orb: 915001, Orb_of_Fusing: 915002, Chromatic_Orb: 915003 };
let proximo = Math.max(915003, ...Object.values(ids)) + 1;
for (const m of [...moedas].sort((a, b) => a.slug.localeCompare(b.slug))) ids[m.slug] ??= proximo++;
writeFileSync(ARQ_IDS, `${JSON.stringify({ _nota: 'Ids de ITEM das moedas do PoE (slug → id). ESTÁVEL: só cresce. Gerado por tools/importar-moedas-poe.mjs.', ids }, null, 1)}\n`);

// Os ícones (o PNG oficial; sem par no CDN oficial, o webp do poedb fica sem ícone e a moeda usa o desenho de reserva).
let baixados = 0;
const semIcone = [];
for (const m of moedas) {
  const alvo = new URL(m.icone, ICONES);
  if (existsSync(alvo)) continue;
  const url = m.fonteDaImagem?.replace(/^https:\/\/cdn\.poedb\.tw\/image\/(.*)\.webp$/, 'https://web.poecdn.com/image/$1.png');
  if (!url) {
    semIcone.push(m.slug);
    continue;
  }
  await esperar(150);
  const r = await fetch(url, { headers: { 'user-agent': AGENTE } }).catch(() => null);
  if (r?.ok) {
    writeFileSync(alvo, Buffer.from(await r.arrayBuffer()));
    baixados++;
  } else semIcone.push(m.slug);
}
for (const m of moedas) {
  m.itemId = ids[m.slug];
  if (!existsSync(new URL(m.icone, ICONES))) m.icone = null;
  delete m.fonteDaImagem;
}
writeFileSync(SAIDA, `${JSON.stringify({ _nota: 'As moedas empilháveis do PoE (tools/importar-moedas-poe.mjs, da coleção do dono — poedb pt). O que cada uma FAZ no jogo está em systems/itens-poe/moedas.mjs; o drop e a loja, em itens-poe/regras.json → `moedas`.', moedas }, null, 1)}\n`);
console.log(`${moedas.length} moedas; ícones baixados agora: ${baixados}; sem ícone: ${semIcone.length ? semIcone.join(', ') : 'nenhuma'}`);
