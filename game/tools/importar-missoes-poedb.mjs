#!/usr/bin/env node
// (05/11) As MISSÕES do PoE pelo poedb (dono: "verifique se todas essas missões e assets de itens de missões estão implementadas" —
// https://poedb.tw/pt/Quest). Grava `gamedata/itens-poe/missoes-poedb.json`:
//   - `missoes[]`: as 194 da aba "Missão" — `{ slug, nome, en, tipo, ato, descricao, icone, recompensa: { texto, links }, passos }`; `tipo`
//     é o do poedb (Normal, Optional, Labyrinth, Hideout, MasterQuest, MasterMission); `passos` vêm da página de cada missão
//     (`{ n, titulo, descricao, objetivos, area, npcs }`);
//   - `itens[]`: os itens das abas "Itens de Missão Item" e "Quest Item", um por variante da página do item (o `Type` do poedb é o id:
//     `Metadata/Items/QuestItems/GoldenPages/Page1`) — `{ id, slug, nome, en, classe, linhas, sabor, icone, largura, altura, abas }`;
//   - `recompensasPorClasse`, `vendedor` e `bonus`: as tabelas "Quest Reward", "Quest Vendor Rewards" e "Missão Stats".
//
// As fontes (o Scrapling — só leitura): `saida/html/missoes/Quest.html` (a página da lista) e `saida/html/missoes/<Slug>.html` (a de cada missão
// e de cada item, baixadas em 05/11).
//
//   POEDB_MISSOES=/home/deploy/scrapling/saida/html/missoes node tools/importar-missoes-poedb.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = process.env.POEDB_MISSOES ?? '/home/deploy/scrapling/saida/html/missoes';
const DESTINO = new URL('../gamedata/itens-poe/missoes-poedb.json', import.meta.url);

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const semEntidades = (t) => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e.toLowerCase()] ?? m));
/** O texto de um trecho de HTML: `<br>` vira "\n", as tags saem, os espaços se juntam. */
export const texto = (h) => semEntidades(String(h ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
const slugDoHref = (h) => decodeURIComponent(h.replace(/^\/pt\//, '').replace(/^\/us\//, ''));
// O arquivo foi gravado com o href do poedb como estava (codificado: `Contract%3A_Trial_Run`, `Shapers_Orb_%28Tier_1%29`, `%22O_Eternal%22`).
const codificado = (slug) => encodeURIComponent(slug).replace(/[()'!*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const arquivosDo = (slug) => [slug, codificado(slug), encodeURIComponent(slug)].map((s) => join(PASTA, `${s.replace(/\//g, '_')}.html`));
const lerPagina = (slug) => {
  const f = arquivosDo(slug).find((x) => existsSync(x));
  return f ? readFileSync(f, 'utf8') : null;
};

/** O painel `id` (uma aba) da página da lista. */
function painel(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return '';
  // (o próprio painel tem `class="tab-pane` logo depois do id: o fim é o PRÓXIMO)
  const j = html.indexOf('class="tab-pane', i + id.length + 40);
  return html.slice(i, j < 0 ? html.length : j);
}

/** Os links de um trecho: `{ classe, slug, nome }` (a classe do poedb diz o que é: gem_red, Quest, WorldAreas, uma classe de item…). */
const links = (h) => [...String(h).matchAll(/<a class="([^"]*)"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)].map(([, c, href, n]) => ({ classe: c.trim(), slug: slugDoHref(href), nome: texto(n) }));

/** Os cards de uma aba (o ícone, o link e as linhas). */
function cards(p) {
  return p.split('<div class="col"><div class="d-flex').slice(1).map((c) => {
    const l = links(c);
    return {
      slug: l[0]?.slug ?? null,
      nome: l.find((x) => x.nome)?.nome ?? null,
      icone: c.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? null,
      propriedades: [...c.matchAll(/<div class="property">(.*?)<\/div>/gs)].map((m) => texto(m[1])),
      linhas: [...c.matchAll(/<div class="(implicitMod|explicitMod)">(.*?)<\/div>/gs)].map((m) => texto(m[2])),
    };
  });
}

/** As linhas de uma tabela: cada célula com o texto e os links. */
function tabela(p) {
  const corpo = p.includes('<tbody') ? p.slice(p.indexOf('<tbody')) : p;
  return [...corpo.matchAll(/<tr>(.*?)(?=<tr>|<\/tbody>|<\/table>)/gs)].map(([, r]) =>
    [...r.matchAll(/<t[dh]>(.*?)(?=<t[dh]>|$)/gs)].map(([, c]) => ({ texto: texto(c.replace(/<br\s*\/?>/gi, '\n')), links: links(c) })));
}

/** Os passos da página da missão (a tabela "# / Nome"). */
export function passosDaPagina(html) {
  const i = html.indexOf('<th>#</th><th>Nome</th>');
  if (i < 0) return [];
  const t = html.slice(i, html.indexOf('</tbody>', i));
  return [...t.matchAll(/<tr><td>(\d+)<\/td><td>(.*?)(?=<tr><td>\d+<\/td>|$)/gs)].map(([, n, c]) => {
    const [antesNpc] = c.split('<div>NPC:');
    const [antesArea, area] = antesNpc.split(/<br>\s*Area:/);
    const objetivos = [...antesArea.matchAll(/<li>(.*?)<\/li>/gs)].map((m) => texto(m[1])).filter(Boolean);
    const [titulo, ...descricao] = texto(antesArea.replace(/<li>.*?<\/li>/gs, '')).split('\n');
    const npcs = [...new Set([...(c.split('<div>NPC:')[1] ?? '').matchAll(/<a class="NPCs"[^>]*>(.*?)<\/a>/g)].map((m) => texto(m[1])))];
    return { n: Number(n), titulo: titulo ?? '', descricao: descricao.join('\n'), objetivos, area: area ? texto(area) || null : null, npcs };
  });
}

/** O cabeçalho da página da missão: o nome inglês, a descrição e os links da recompensa. */
function cabecalhoDaPagina(html) {
  const i = html.indexOf('<div class="property">');
  if (i < 0) return {};
  const caixa = html.slice(i, html.indexOf('itemboximage', i));
  const rec = caixa.match(/Recompensa:(.*?)<\/span><\/div>/s)?.[1] ?? '';
  return {
    en: texto(caixa.match(/<\/div>\s*<div>\s*([^<]+?)\s*<\/div>\s*<\/div>\s*<\/div>\s*$/s)?.[1] ?? caixa.match(/<div>\s*([A-Za-z][^<]+?)\s*<\/div>\s*<\/div>\s*<\/div>/s)?.[1] ?? '') || null,
    recompensaLinks: links(rec),
  };
}

/** As variantes da página de um item de missão (um bloco "newItemPopup" + a tabela com BaseType, Type, Icon e o tamanho). */
export function variantesDoItem(html, slug) {
  const blocos = html.split('<div class="newItemPopup').slice(1);
  return blocos.map((b) => {
    const tab = b.slice(b.indexOf('<table'), b.indexOf('</table>'));
    const campo = (k) => [...tab.matchAll(new RegExp(`<tr><td>${k}(?:\\s*<span[^>]*></span>)?</td><td>(.*?)</td></tr>`, 'gs'))].map((m) => texto(m[1]));
    return {
      id: campo('Type')[0] ?? null,
      slug,
      nome: texto(b.match(/<span class="lc">(.*?)<\/span>/s)?.[1] ?? ''),
      en: campo('BaseType')[0] ?? null,
      classe: texto(b.match(/<div class="property">(.*?)<\/div>/s)?.[1] ?? '') || null,
      linhas: [...b.slice(0, b.indexOf('itemboximage')).matchAll(/<div class="(explicitMod|implicitMod)">(.*?)<\/div>/gs)].map((m) => texto(m[2])),
      sabor: texto(b.match(/<div class="FlavourText">(.*?)<\/div>/s)?.[1] ?? '') || null,
      icone: b.match(/itemboximage[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1] ?? null,
      largura: Number(campo('Base\\.x_size')[0] ?? 1),
      altura: Number(campo('Base\\.y_size')[0] ?? 1),
      nivelDrop: Number(campo('DropLevel')[0] ?? 1),
    };
  });
}

export function importar() {
  const lista = readFileSync(join(PASTA, 'Quest.html'), 'utf8');
  const missoes = cards(painel(lista, 'Missão')).map((c) => {
    const pagina = lerPagina(c.slug);
    const cab = pagina ? cabecalhoDaPagina(pagina) : {};
    const ato = c.propriedades.find((p) => /^Ato -?\d+$/.test(p));
    const rec = c.propriedades.find((p) => p.startsWith('Recompensa:'));
    return {
      slug: c.slug,
      nome: c.nome,
      en: cab.en ?? null,
      tipo: c.propriedades[0] ?? null,
      ato: ato ? Number(ato.replace('Ato ', '')) : null,
      descricao: c.linhas.join('\n') || null,
      icone: c.icone,
      recompensa: rec ? { texto: rec.replace(/^Recompensa:\s*/, ''), links: cab.recompensaLinks ?? [] } : null,
      passos: pagina ? passosDaPagina(pagina) : [],
      ...(pagina ? {} : { semPagina: true }),
    };
  });
  const itens = new Map();
  const faltando = [];
  for (const [aba, id] of [['itensDeMissao', 'ItensdeMissãoItem'], ['questItem', 'QuestItem']]) {
    for (const c of cards(painel(lista, id))) {
      const pagina = lerPagina(c.slug);
      const vs = pagina ? variantesDoItem(pagina, c.slug) : [];
      // O card da lista aponta para a página; a variante dele é a do mesmo ícone (ou, sem ícone igual, a do mesmo nome).
      const v = vs.find((x) => x.icone === c.icone && x.nome === c.nome) ?? vs.find((x) => x.icone === c.icone) ?? vs.find((x) => x.nome === c.nome);
      const id2 = v?.id ?? `${c.slug}#${c.nome}`;
      if (!v) faltando.push(`${aba}: ${c.slug} (${c.nome})`);
      const ja = itens.get(id2);
      if (ja) { if (!ja.abas.includes(aba)) ja.abas.push(aba); continue; }
      itens.set(id2, { ...(v ?? { id: id2, slug: c.slug, nome: c.nome, en: null, classe: null, linhas: c.linhas, sabor: null, icone: c.icone, largura: 1, altura: 1, nivelDrop: 1 }), nome: c.nome ?? v?.nome, linhas: v?.linhas?.length ? v.linhas : c.linhas, abas: [aba] });
    }
  }
  const recompensasPorClasse = tabela(painel(lista, 'QuestReward'));
  const vendedor = tabela(painel(lista, 'QuestVendorRewards'));
  // (As linhas sem link são marcas internas do PoE — "Descent2Reward1", "EndlessDelvePassiveRewards1": ficam, com `missao` null.)
  const bonus = tabela(painel(lista, 'MissãoStats')).filter((r) => r.length >= 2 && r[0].texto).map((r) => ({ missao: r[0].links[0]?.slug ?? null, nome: r[0].texto, recompensa: r[1]?.texto ?? null }));
  return { missoes, itens: [...itens.values()], recompensasPorClasse, vendedor, bonus, faltando };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const d = importar();
  const saida = {
    _nota: 'As missões e os itens de missão do PoE pelo poedb (https://poedb.tw/pt/Quest), gerado por tools/importar-missoes-poedb.mjs. Quem lê: systems/itens-poe/missoes.mjs (o registro de missões) e o catálogo de itens de missão.',
    missoes: d.missoes,
    itens: d.itens,
    recompensasPorClasse: d.recompensasPorClasse,
    vendedor: d.vendedor,
    bonus: d.bonus,
  };
  writeFileSync(DESTINO, JSON.stringify(saida) + '\n');
  const semPassos = d.missoes.filter((m) => !m.passos.length).length;
  console.log(`missões ${d.missoes.length} (sem passos: ${semPassos}) · itens ${d.itens.length} · recompensas por classe ${d.recompensasPorClasse.length} · vendedor ${d.vendedor.length} · bônus ${d.bonus.length}`);
  if (d.faltando.length) console.log(`itens sem a variante na página: ${d.faltando.length}\n  ${d.faltando.join('\n  ')}`);
}
