#!/usr/bin/env node
// (lote 55, J31) As LINHAS SORTEADAS das únicas de joia do PoE ("[Two random aura modifiers]" do Olho do Vigia, "[Two random modifiers]" da
// Personalidade Dividida e do Equilíbrio do Terror): o pool de cada uma, da aba "Modificadores" da página do poedb, extraída pelo Scrapling
// (`/home/deploy/scrapling/extrair/abas.py <Pagina>` → `saida/json/<Pagina>.json`). Grava `gamedata/itens-poe/linhas-sorteadas.json` — o
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
  unicos[slug] = { classe: 'Jewels', substitui, fonte: d.fonte, linhas };
  console.log(`${slug}: ${linhas.length} linhas`);
}
writeFileSync(DESTINO, `${JSON.stringify({
  _nota: 'As LINHAS SORTEADAS das únicas de joia do PoE (lote 55, J31): `substitui` — a linha de marcação do catálogo ("[Two random aura modifiers]") → quantas linhas do pool `linhas` ela vira, sem repetir e com a mesma chance (o poedb não dá o peso). A coleção não traz; o catálogo põe por cima (`itens-poe/catalogo.mjs`) e o gerador sorteia (`itens-poe/gerar.modificadoresDoUnico`). Feito por `tools/importar-poedb-sorteados.mjs` a partir das abas "Modificadores" do poedb (o Scrapling).',
  geradoEm: new Date().toISOString(),
  unicos,
}, null, 1)}\n`);
console.log(`→ ${DESTINO.pathname}`);
