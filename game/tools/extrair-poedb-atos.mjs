// Extrai do poedb.tw (pt) os CHEFES DE CADA ÁREA dos atos 1 a 10 (https://poedb.tw/pt/Act_1 … Act_10, pedido do dono, 05/10): as áreas
// de cada ato (com as de chefe que a coleção do Drive não tinha — Prisão Superior, Caverna da Cólera…), o nível e os chefes de cada uma;
// e, de cada chefe, a variante de campanha: os multiplicadores (vida, dano, tempo de ataque, variação de dano, experiência, crítico), as
// resistências, as tags, os STATUS NO NÍVEL DA ÁREA dele (a chamada `api/monsterLevelSkill` que o seletor de nível da página usa) e as
// HABILIDADES com o dano naquele nível (dano base, crítico, tempo, recarga, descrição).
//
// Os status da chamada não incluem os bônus de monstro Único (o próprio site avisa); quem monta a campanha aplica os do PoE.
// A saída é REFERÊNCIA LOCAL, fora do git e da produção: /home/deploy/referencias-poe/poedb/atos.json
//
// Uso: node tools/extrair-poedb-atos.mjs [--refazer-erros]   (com a opção: só os chefes que falharam da última extração)
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const SITE = 'https://poedb.tw';
const SAIDA = '/home/deploy/referencias-poe/poedb/atos.json';
const PAUSA_MS = 1200;
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function baixar(url, json = false) {
  for (let t = 1; ; t++) {
    const r = await fetch(url, { headers: { 'user-agent': AGENTE } });
    if (r.ok) return json ? r.json() : r.text();
    if (t >= 3) throw new Error(`${r.status} em ${url}`);
    await esperar(PAUSA_MS * t * 2);
  }
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
const texto = (h) =>
  String(h ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
const num = (s) => Number(String(s ?? '').replace(/[^\d.-]/g, '')) || 0;
const links = (h) => [...String(h).matchAll(/<a [^>]*href="\/pt\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ slug: decodeURIComponent(m[1]), nome: texto(m[2]) }));

/** As áreas da tabela do ato: `[{ slug, nome, nivel, cidade, waypoint, chefes: [{slug, nome}] }]` (as linhas com duas áreas viram duas). */
export function areasDoAto(html, numero) {
  const ini = html.indexOf(`id="Ato${numero}Area"`);
  if (ini < 0) throw new Error(`tabela de áreas do Ato ${numero} não encontrada`);
  const fim = html.indexOf('</table>', ini);
  const areas = [];
  for (const tr of html.slice(ini, fim).match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const tds = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (tds.length < 3) continue;
    const nomes = tds[0].split(/<br\s*\/?>/).map(links).map((l) => l[0]).filter(Boolean);
    const niveis = tds[1].split(/<br\s*\/?>/).map((s) => ({ nivel: num(texto(s).split(' ')[0]), cidade: /TownPin/.test(s), waypoint: /WaypointIcon/.test(s) }));
    const chefes = tds[2].split(/<br\s*\/?>/).map(links);
    nomes.forEach((a, i) => {
      areas.push({ slug: a.slug, nome: a.nome, nivel: niveis[i]?.nivel || niveis[0]?.nivel || 1, ...(niveis[i]?.cidade ? { cidade: true } : {}), ...(niveis[i]?.waypoint ? { waypoint: true } : {}), chefes: chefes[i] ?? [], ...(i > 0 ? { depoisDe: nomes[i - 1].slug } : {}) });
    });
  }
  return areas;
}

/** A primeira variante (campanha/base) da página do chefe: `{ id, nome, tags, multiplicadores, resistencias }`. */
export function varianteDoChefe(html) {
  const m = html.match(/data-monster-id="(\d+)"/);
  const tabs = [...html.matchAll(/<span data-tabname="([^"]*)" data-category="MonsterVarieties"><\/span>/g)];
  if (!m || !tabs.length) return null;
  const ini = tabs[0].index;
  const fim = html.indexOf('data-monster-id', ini);
  const t = html.slice(ini, fim > 0 ? fim : ini + 20000);
  const mult = {};
  for (const b of t.matchAll(/<div class="border p-2 d-flex justify-content-between"><div>(?:<i[^>]*><\/i>)?([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g)) {
    const k = texto(b[1]);
    if (k !== 'Resistência') mult[k] = texto(b[2]);
  }
  const res = [...t.matchAll(/IconEnemyResistance(Fire|Cold|Lightning|Chaos)[^"]*\.webp"[^>]*\/>(?:<span[^>]*>)?(-?\d+)/g)].reduce((o, x) => ({ ...o, [{ Fire: 'fire', Cold: 'ice', Lightning: 'energy', Chaos: 'chaos' }[x[1]]]: Number(x[2]) }), {});
  const tags = (t.match(/<tr><th>Tags<td>([\s\S]*?)<\/table>/)?.[1] ?? '').replace(/<[^>]+>/g, '').split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  return { id: m[1], interno: texto(tabs[0][1]).split('\n')[1] ?? null, multiplicadores: mult, resistencias: res, tags };
}

/** Os status e as habilidades no nível (o HTML da chamada `api/monsterLevelSkill`). */
export function statusNoNivel(h) {
  const status = {};
  for (const b of h.matchAll(/<div class="border p-2 d-flex justify-content-between"><div>([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g)) status[texto(b[1])] = texto(b[2]);
  const habilidades = [];
  let interno;
  for (const card of h.split("<div class='card pb-0 mb-2 col-monster").slice(1)) {
    const props = [...card.matchAll(/<div class="property">([\s\S]*?)<\/div>/g)].map((x) => texto(x[1]));
    const valor = (rot) => props.find((p) => p.startsWith(rot))?.slice(rot.length).trim() ?? null;
    const linhas = [...card.matchAll(/<div class="explicitMod">([\s\S]*?)<\/div>/g)].map((x) => texto(x[1]));
    // O dano: "Base Damage: a — b" (ataques) ou, nas magias, a linha "Causa a a b de Dano de <Elemento>".
    const base = valor('Base Damage:')?.match(/([\d.]+)\D+([\d.]+)/);
    const magia = linhas.map((l) => l.match(/^Causa ([\d.]+) a ([\d.]+) de Dano (?:de )?(\S+)/)).find(Boolean);
    const dano = base ?? magia;
    const ELEMENTO = { Fogo: 'fire', Gelo: 'ice', Raio: 'energy', Caos: 'chaos', Físico: 'physical' };
    interno = texto(card.match(/class="TitleBar[^"]*">([\s\S]*?)<\/div>/)?.[1]);
    habilidades.push({
      interno,
      // O nome é a linha sem ":" depois das tags (as magias de monstro muitas vezes não têm): senão, o nome interno.
      nome: props.slice(1).find((p) => !p.includes(':')) ?? interno ?? null,
      tags: props[0] ? props[0].split(/,\s*/) : [],
      ...(dano ? { dano: { min: Math.round(Number(dano[1])), max: Math.round(Number(dano[2])) } } : {}),
      ...(magia ? { elemento: ELEMENTO[magia[3]] ?? 'physical' } : {}),
      critico: num(valor('Chance de Crítico:')) || null,
      tempo: num(valor('Attack Time:') ?? valor('Cast Time:') ?? valor('Tempo de Conjuração:')) || null,
      recarga: num(valor('Recarga:')) || null,
      descricao: texto(card.match(/<div class='text-gem'>([\s\S]*?)<\/div>/)?.[1]) || null,
      linhas: linhas.filter((l) => !/\[\d+\]$/.test(l)),
    });
  }
  return { status: Object.fromEntries(Object.entries(status).map(([k, v]) => [k, /%$/.test(v) ? v : num(v)])), habilidades };
}

async function principal() {
  mkdirSync('/home/deploy/referencias-poe/poedb', { recursive: true });
  const refazer = process.argv.includes('--refazer-erros') && existsSync(SAIDA);
  const anterior = refazer ? JSON.parse(readFileSync(SAIDA, 'utf8')) : null;
  const atos = [];
  const chefes = {};
  if (anterior) for (const [k, c] of Object.entries(anterior.chefes)) if (!c.erro || c.erro === 'sem variante') chefes[k] = c;
  for (let n = 1; n <= 10; n++) {
    const areas = anterior ? anterior.atos.find((a) => a.numero === n).areas : areasDoAto(await baixar(`${SITE}/pt/Act_${n}`), n);
    atos.push({ numero: n, areas });
    console.log(`Ato ${n}: ${areas.length} áreas, ${areas.reduce((s, a) => s + a.chefes.length, 0)} chefes`);
    for (const a of areas) for (const c of a.chefes) {
      const chave = `${c.slug}@${a.nivel}`;
      if (chefes[chave]) continue;
      await esperar(PAUSA_MS);
      try {
        // O site espera a vírgula codificada (%2C), como no link da tabela.
        const v = varianteDoChefe(await baixar(`${SITE}/pt/${encodeURIComponent(c.slug)}`));
        if (!v) {
          chefes[chave] = { slug: c.slug, nome: c.nome, nivel: a.nivel, erro: 'sem variante' };
          continue;
        }
        await esperar(PAUSA_MS);
        const api = await baixar(`${SITE}/pt/api/monsterLevelSkill?monsterHash=${v.id}&arealv=${a.nivel}`, true);
        chefes[chave] = { slug: c.slug, nome: c.nome, nivel: a.nivel, area: a.slug, ...v, ...(api?.code === 200 ? statusNoNivel(api.data) : { erro: 'sem status no nível' }) };
      } catch (e) {
        chefes[chave] = { slug: c.slug, nome: c.nome, nivel: a.nivel, erro: e.message };
      }
    }
  }
  const saida = { fonte: `${SITE}/pt/Act_1 … Act_10`, extraidoEm: new Date().toISOString(), licenca: 'poedb.tw — dados do jogo © Grinding Gear Games. Referência local.', atos, chefes };
  writeFileSync(SAIDA, JSON.stringify(saida, null, 1));
  const l = Object.values(chefes);
  console.log(`total: ${atos.reduce((s, a) => s + a.areas.length, 0)} áreas, ${l.length} chefes (${l.filter((c) => c.erro).length} com erro) → ${SAIDA}`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
