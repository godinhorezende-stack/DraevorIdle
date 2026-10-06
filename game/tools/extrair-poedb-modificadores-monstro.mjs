// Extrai do poedb.tw os MODIFICADORES DE MONSTRO do Path of Exile 1 (pedido do dono, 05/10: "extraia todos os modificadores de mobs e implemente").
// A poewiki (Monster_modifiers) fica atrás de um desafio anti-robô; o poedb tem a mesma lista atual — https://poedb.tw/pt/Monster_Modifiers —, com os
// 205 modificadores: os 87 "Archnemesis" (nomeados: Tóxico, Rápido...) e os 118 "MonsterMod" (Esmaga ao Acertar, Dano Extra de Fogo...).
// De cada um: o nome e as linhas em português (e o nome em inglês), e o detalhe do poedb (a mesma janela que o site abre ao passar o mouse): o id, a
// família, o nível exigido, os STATS com os valores e os PESOS por raridade (spawn tags: `magic`, `default`...) — é isso que diz se o modificador
// aparece em monstro Mágico, Raro ou nos dois.
//
// A saída é REFERÊNCIA LOCAL, fora do git e da produção: /home/deploy/referencias-poe/poedb/modificadores-monstro.json
// Uso: node tools/extrair-poedb-modificadores-monstro.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://poedb.tw';
const SAIDA = '/home/deploy/referencias-poe/poedb/modificadores-monstro.json';
const AGENTE = 'Mozilla/5.0 (DraevorIdle referencia local)';
const PAUSA_MS = 700;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function baixar(url, referer = `${SITE}/pt/Monster_Modifiers`) {
  for (let t = 1; ; t++) {
    const r = await fetch(url, { headers: { 'user-agent': AGENTE, referer } });
    if (r.ok) return r.text();
    if (t >= 3) throw new Error(`${r.status} em ${url}`);
    await esperar(PAUSA_MS * t * 3);
  }
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };
const texto = (h) => String(h ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m)).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Os blocos da página: `[{ nome, tipo: 'archnemesis'|'mod', linhas, ocultas, hover }]`. */
export function blocosDaPagina(html) {
  const saida = [];
  for (const c of html.split('<div class="col">').slice(1)) {
    const corpo = c.match(/<div class="flex-grow-1 ms-2">([\s\S]*?)<i data-hover="([^"]+)"/);
    if (!corpo) continue;
    const nome = corpo[1].match(/<div class="(?:outlinecolour:[^"]*|strong)">([^<]+)<\/div>/);
    const tipo = /outlinecolour:/.test(corpo[1]) ? 'archnemesis' : 'mod';
    const resto = corpo[1].replace(/<div class="(?:outlinecolour:[^"]*|strong)">[^<]+<\/div>/, '');
    const ocultas = [...resto.matchAll(/<span class="secondary">([\s\S]*?)<\/span>/g)].flatMap((m) => texto(m[1]));
    const linhas = texto(resto.replace(/<span class="secondary">[\s\S]*?<\/span>/g, ''));
    saida.push({ nome: texto(nome?.[1])[0] ?? null, tipo, linhas, ocultas, hover: corpo[2].replace(/&amp;/g, '&') });
  }
  return saida;
}

/** O detalhe do hover (as linhas `<tr><th>Rótulo<td>valor`, sem fechar): `{ nomeInterno, familia, dominio, geracao, nivel, nivelEfetivo, stats: [{ stat, min, max }], pesos: { tag: peso } }`. */
export function detalhe(html) {
  const linhas = {};
  for (const m of html.matchAll(/<tr><th>([^<]+)<td>([\s\S]*?)(?=<tr>|<\/table>)/g)) linhas[m[1].trim()] = m[2];
  const um = (k) => texto(linhas[k] ?? '')[0] ?? null;
  const nivel = (um('Req. level') ?? '').match(/(\d+)(?:\D+(\d+))?/);
  const stats = [...String(linhas.Stats ?? '').matchAll(/<li>([\s\S]*?)<span class="badge bg-primary">(-?[\d.]+)\s*<span class="ndash">[^<]*<\/span>\s*(-?[\d.]+)<\/span>/g)].map((m) => ({ stat: texto(m[1])[0], min: Number(m[2]), max: Number(m[3]) }));
  const pesos = {};
  for (const l of texto(linhas['Spawn Tags'] ?? linhas['Spawn Weight'] ?? '')) for (const m of l.matchAll(/([A-Za-z_][\w]*):\s*(-?\d+)/g)) pesos[m[1]] = Number(m[2]);
  return { nomeInterno: um('Name'), familia: um('Family'), dominio: um('Domains'), geracao: um('GenerationType'), nivel: nivel ? Number(nivel[1]) : null, nivelEfetivo: nivel?.[2] ? Number(nivel[2]) : null, stats, pesos };
}

/**
 * Os modificadores OCULTOS de cada raridade (a seção "Hidden innate modifiers based on rarity" da wiki): `MonsterMagic1..`, `MonsterRare1..`,
 * `MonsterUnique1..` no poedb — vida, dano, velocidade, experiência, quantidade e raridade dos itens. `{ magico: [{ id, stats }], raro, unico }`.
 */
async function ocultosPorRaridade() {
  const saida = {};
  for (const [raridade, base] of [['magico', 'MonsterMagic'], ['raro', 'MonsterRare'], ['unico', 'MonsterUnique']]) {
    saida[raridade] = [];
    for (let n = 1; n <= 20; n++) {
      await esperar(PAUSA_MS);
      const d = detalhe(await baixar(`${SITE}/us/hover?s=Data%5CMods%2F${base}${n}`, `${SITE}/us/Monster_Modifiers`).catch(() => ''));
      if (!d.familia) break;
      saida[raridade].push({ id: `${base}${n}`, familia: d.familia, stats: d.stats });
    }
  }
  return saida;
}

async function principal() {
  mkdirSync('/home/deploy/referencias-poe/poedb', { recursive: true });
  const pt = blocosDaPagina(await baixar(`${SITE}/pt/Monster_Modifiers`));
  await esperar(PAUSA_MS);
  const us = blocosDaPagina(await baixar(`${SITE}/us/Monster_Modifiers`, `${SITE}/us/Monster_Modifiers`));
  console.log(`página: ${pt.length} em pt, ${us.length} em us`);
  const mods = [];
  for (const [i, b] of pt.entries()) {
    // O detalhe pela versão em inglês (os rótulos — Family, Req. level, Spawn Tags — são os que o leitor conhece); o texto fica o em português.
    const h = us[i]?.hover ?? b.hover;
    const url = h.startsWith('http') ? h : `${SITE}/us/hover${h}`;
    const id = decodeURIComponent((h.match(/s=Data%5CMods%2F([^&"]+)/) ?? b.hover.match(/s=Data%5CMods%2F([^&"]+)/))?.[1] ?? '') || null;
    let d = null;
    try {
      await esperar(PAUSA_MS);
      d = detalhe(await baixar(url, `${SITE}/us/Monster_Modifiers`));
    } catch (e) {
      d = { erro: e.message };
    }
    mods.push({ id: id ?? d?.id ?? null, nome: b.nome, nomeEn: us[i]?.nome ?? null, tipo: b.tipo, linhas: b.linhas, linhasEn: us[i]?.linhas ?? [], ocultas: b.ocultas, ...d });
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${pt.length}`);
  }
  const ocultos = await ocultosPorRaridade();
  writeFileSync(SAIDA, JSON.stringify({ fonte: `${SITE}/pt/Monster_Modifiers`, extraidoEm: new Date().toISOString(), licenca: 'poedb.tw — dados do jogo © Grinding Gear Games. Referência local.', mods, ocultos }, null, 1));
  const comErro = mods.filter((m) => m.erro).length;
  console.log(`total: ${mods.length} (${mods.filter((m) => m.tipo === 'archnemesis').length} archnemesis, ${mods.filter((m) => m.tipo === 'mod').length} mods; ${comErro} com erro no detalhe) → ${SAIDA}`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
