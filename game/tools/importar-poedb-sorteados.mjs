#!/usr/bin/env node
// (lote 55, J31) As LINHAS SORTEADAS das únicas de joia do PoE ("[Two random aura modifiers]" do Olho do Vigia, "[Two random modifiers]" da
// Personalidade Dividida e do Equilíbrio do Terror; lote 56: o "[Aura Bonus Modifier]" da Visão Sublime): o pool de cada uma, da aba
// "Modificadores" da página do poedb, extraída pelo Scrapling (`/home/deploy/scrapling/extrair/abas.py <Pagina>` → `saida/json/<Pagina>.json`). Grava `gamedata/itens-poe/linhas-sorteadas.json` — o
// catálogo põe `linhasSorteadas` no único ao carregar (`itens-poe/catalogo.mjs`) e o gerador troca a linha de marcação pelas sorteadas
// (`itens-poe/gerar.modificadoresDoUnico`).
//
//   node tools/importar-poedb-sorteados.mjs [pasta do Scrapling, padrão /home/deploy/scrapling/saida/json]
import { readFileSync, writeFileSync } from 'node:fs';

const PASTA = process.argv[2] ?? '/home/deploy/scrapling/saida/json';
const DESTINO = new URL('../gamedata/itens-poe/linhas-sorteadas.json', import.meta.url);

/** As únicas: a página do poedb, a aba do pool e a linha de marcação do catálogo → quantas linhas ela vira. */
const UNICOS = {
  Watchers_Eye: { aba: /^OlhodoVigiaModificadores$/, substitui: { '[Two random aura modifiers]': 2, '[Three random aura modifiers]': 3 } },
  Split_Personality: { aba: /^PersonalidadeDivididaModificadores$/, substitui: { '[Two random modifiers]': 2 } },
  The_Balance_of_Terror: { aba: /^OEquilíbriodoTerrorModificadores$/, substitui: { '[Two random modifiers]': 2 } },
  // (lote 56) a Visão Sublime: 1 das 17 combinações (o efeito das auras em você, o bônus de uma aura e "as outras são Desabilitadas")
  Sublime_Vision: { aba: /^VisãoSublimeModificadores$/, substitui: { '[Aura Bonus Modifier]': 1 } },
  // (lote 57) o Limitado pelo Destino: cada marcação sorteia 1 das linhas do seu número de itens ("se 2 / 4 / 6 Itens do <Influência>…")
  // (lote 58) a Fé Militante (a Atemporal): 2 das 16 linhas de devoção ("por cada 10 de Devoção")
  Militant_Faith: { aba: /^FéMilitanteModificadores$/, substitui: { '[Two random mods of devotion]': 2 } },
  Bound_By_Destiny: { aba: /^LimitadopeloDestinoModificadores$/, substitui: { '[Random 2x influence item bonus]': { quantidade: 1, itens: 2 }, '[Random 4x influence item bonus]': { quantidade: 1, itens: 4 }, '[Random 6x influence item bonus]': { quantidade: 1, itens: 6 } } },
};

/**
 * A linha no formato do catálogo (o mesmo do `extrair/unicos.py`): todo número vira marcador — "+(a—b)" → "+{i}" com a faixa [a, b], o fixo com
 * [n, n]; `texto` fica como no poedb.
 */
export function noFormatoDoCatalogo(texto) {
  const faixas = [];
  const modelo = texto.replace(/([+-]?)\((-?[\d.]+)—(-?[\d.]+)\)|(-?\d+(?:\.\d+)?)/g, (m, pre, a, b, c) => {
    const i = faixas.length;
    if (a != null) { faixas.push([Number(a), Number(b)]); return `${pre}{${i}}`; }
    faixas.push([Number(c), Number(c)]);
    return `{${i}}`;
  });
  return { texto, modelo, faixas };
}

const unicos = {};
for (const [slug, { aba, substitui }] of Object.entries(UNICOS)) {
  const d = JSON.parse(readFileSync(`${PASTA}/${slug}.json`, 'utf8'));
  const a = d.abas.find((x) => aba.test(x.id));
  if (!a) throw new Error(`${slug}: a aba do pool não está no arquivo do Scrapling`);
  const linhas = a.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []).map((r) => noFormatoDoCatalogo(String(r[0]).trim()));
  // (lote 57) a marcação com o pool próprio (`{ quantidade, itens }`): `pools[marca]` — as linhas do pool com "se N itens"; `substitui` fica com o número
  const proprios = Object.entries(substitui).filter(([, x]) => typeof x !== 'number');
  const pools = Object.fromEntries(proprios.map(([marca, x]) => [marca, linhas.filter((l) => Number(/se (?:tiver )?(\d+) itens/i.exec(l.texto)?.[1]) === x.itens)]));
  const quantas = Object.fromEntries(Object.entries(substitui).map(([marca, x]) => [marca, typeof x === 'number' ? x : x.quantidade]));
  unicos[slug] = { classe: 'Jewels', substitui: quantas, ...(proprios.length ? { pools } : {}), fonte: d.fonte, linhas };
  console.log(`${slug}: ${linhas.length} linhas`);
}
// (lote 56) Os NOMES SORTEADOS: a marcação "Passive Skill" do texto vira um nome — a Fuga Impossível, uma das pedras fundamentais da aba "Notável"
// do poedb (as que estão na árvore do jogo); a Chama e a Carne Proibida, um notável de ascendência (os da árvore do jogo — os 7 escondidos da
// variação do Exarca Supremo não estão nela). Com a mesma chance.
const ARVORE = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));
const pedras = new Set(ARVORE.nos.filter((n) => n.tipo === 'keystone' && !n.ascendencia).map((n) => n.nome));
const fuga = JSON.parse(readFileSync(`${PASTA}/Impossible_Escape.json`, 'utf8'));
const doPoedb = fuga.abas.find((x) => x.id === 'Notável').cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []).map((r) => String(r[0]).trim());
const foraDaArvore = doPoedb.filter((n) => !pedras.has(n));
unicos.Impossible_Escape = { classe: 'Jewels', fonte: fuga.fonte, nomeSorteado: { marca: 'Passive Skill', nomes: doPoedb.filter((n) => pedras.has(n)), ...(foraDaArvore.length ? { foraDaArvore } : {}) } };
console.log(`Impossible_Escape: ${unicos.Impossible_Escape.nomeSorteado.nomes.length} pedras fundamentais (fora da árvore: ${foraDaArvore.join(', ') || 'nenhuma'})`);
// (lote 79) o MEGALOMANÍACO: "[Three random notable modifiers]" vira 3 dos 287 mods da aba "Megalomaniac Mods" do poedb ("All non-unique notables from
// any size cluster jewels have a chance to roll" — todos com peso 1000, cada um com o nível do mod). Cada linha leva o notável (a chave de
// `ramificadoras.json` — os nós saem dele) e o nível: pelo texto do mod da Ramificadora, pelo nome, ou pelo apelido (o poedb traduziu alguns
// nomes de outro jeito no mod do Megalomaníaco); as duas "Inspiração Ancestral" pelo nível (68: a Ancestral, 50: a Eldritch).
const RAMIFICADORAS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/ramificadoras.json', import.meta.url), 'utf8'));
const APELIDOS = {
  'Presença Rancorosa': 'Presença Malévola', 'Presença Eletrizante': 'Presença Elétrica', 'Caminho Casto': 'Caminho Virtuoso', 'Explore a Fraqueza': 'Explorar a Fraqueza',
  'Espíritos Aprisionados': 'Espíritos Aprisionadores', 'Mistura Cravada': 'Composto Tonificado', 'Agravar Ferimentos': 'Agravar Ferimento', 'Suserano': 'Soberano',
  'Leve a Destruição': 'Liderar a Destruição', 'Exaurir Psiquê': 'Exaurir a Psique', 'Sádico': 'Sadista', 'Toque de Crueldade': 'Toque da Crueldade',
  'Presentes Inefáveis': 'Dons Inefáveis', 'Garras Pútrida': 'Garras Pútridas', 'Envolta em Chamas': 'Envolto em Chamas', 'Ferimento Composto': 'Ferida Composta',
  'Tempestade de Raios': 'Trovoada', 'Olho Malígno': 'Olho Perverso', 'Rancor de Doedre': 'Despeito de Doedre', 'Agonia Pura': 'Pura Agonia',
  'Lealdade Rúnica': 'Runa da Lealdade', 'Tática de Guerrilha': 'Táticas de Guerra', 'Reforço do Hábito': 'Reforço da Hábito', 'Capacitador': 'Capacitor', 'Instrospecção': 'Introspecção',
};
{
  const mega = JSON.parse(readFileSync(`${PASTA}/Megalomaniac.json`, 'utf8'));
  const tabela = mega.abas.find((x) => x.id === 'MegalomaniacMods')?.cards.flatMap((c) => c.tabelas ?? []).flatMap((t) => t.linhas ?? []) ?? [];
  const porMod = new Map(RAMIFICADORAS.mods.filter((m) => m.notavel).map((m) => [String(m.modelo).replace('{0}', '1'), m.notavel]));
  // (sem acento nem maiúscula: "Quebra-crânios" × "Quebra-Crânios")
  const norm = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const porNome = new Map(Object.keys(RAMIFICADORAS.notaveis).map((k) => [norm(k), k]));
  const linhas = tabela.map(([, texto, , nivel]) => {
    const t = String(texto).trim();
    const nome = / é (.+)$/.exec(t)?.[1];
    const inspiracao = nome === 'Inspiração Ancestral' ? (Number(nivel) >= 68 ? 'Inspiração Ancestral' : 'Inspiração Ancestral (Eldritch Inspiration)') : null;
    const notavel = inspiracao ?? porMod.get(t) ?? porNome.get(norm(nome)) ?? porNome.get(norm(APELIDOS[nome]));
    if (!notavel) throw new Error(`Megalomaníaco: o notável de "${t}" não está em ramificadoras.json`);
    return { ...noFormatoDoCatalogo(t), notavel, nivel: Number(nivel) || 1 };
  });
  unicos.Megalomaniac = { classe: 'Jewels', substitui: { '[Three random notable modifiers]': 3 }, fonte: mega.fonte, linhas };
  console.log(`Megalomaniac: ${linhas.length} linhas, ${new Set(linhas.map((l) => l.notavel)).size} notáveis`);
}
const notaveis = ARVORE.nos.filter((n) => n.ascendencia && n.tipo === 'notable').map((n) => n.nome);
for (const slug of ['Forbidden_Flame', 'Forbidden_Flesh']) unicos[slug] = { classe: 'Jewels', fonte: `https://poedb.tw/pt/${slug}`, nomeSorteado: { marca: 'Passive Skill', nomes: notaveis } };
console.log(`Forbidden_Flame / Forbidden_Flesh: ${notaveis.length} notáveis de ascendência`);
writeFileSync(DESTINO, `${JSON.stringify({
  _nota: 'As LINHAS SORTEADAS das únicas de joia do PoE (lote 55, J31): `substitui` — a linha de marcação do catálogo ("[Two random aura modifiers]") → quantas linhas do pool `linhas` ela vira, sem repetir e com a mesma chance (o poedb não dá o peso). (lote 56) `nomeSorteado` — a marcação `marca` ("Passive Skill") do texto vira um dos `nomes` (a pedra fundamental da Fuga Impossível, o notável de ascendência da Chama/Carne Proibida). A coleção não traz; o catálogo põe por cima (`itens-poe/catalogo.mjs`) e o gerador sorteia (`itens-poe/gerar.modificadoresDoUnico`). Feito por `tools/importar-poedb-sorteados.mjs` a partir das abas "Modificadores" do poedb (o Scrapling).',
  geradoEm: new Date().toISOString(),
  unicos,
}, null, 1)}\n`);
console.log(`→ ${DESTINO.pathname}`);
