// Monta `gamedata/itens-poe/pinaculos-acesso.json`: a ENTRADA dos pináculos como no PoE (dono, 05/11: "quero igual do poe"). No PoE nenhum
// pináculo pede level: cada um abre no Dispositivo de Mapas com um conjunto de fragmentos, e os fragmentos saem de chefes intermediários
// nos mapas T14+. Etapa 1 (dono, 05/11: em etapas, os chefes novos "como os pináculos"):
//
//   - The Shaper: os 4 fragmentos dos Guardiões do Criador (Hidra, Fênix, Minotauro, Quimera). Cada guardião é o chefe do mapa dele
//     (Covil da Hidra, Fornalha da Fênix, Labirinto do Minotauro, Fosso da Quimera — mapas T16 que caem dos chefes de mapa T14+);
//   - The Elder: os 4 fragmentos dos Guardiões do Ancião (Escravizador, Erradicador, Constritor, Purificador), que ocupam mapas comuns
//     ("Mapa ocupado pelo …", também dos chefes T14+);
//   - Sirus: as 4 Coroas dos Conquistadores (Baran, Veritania, Al-Hezmin, Drox), nas Cidadelas ("Mapa contém a Cidadela de …").
//
// Os 12 chefes são feitos como os pináculos (`montar-pinaculos.mjs`): a criatura de um chefe do Draevor dá o desenho, os golpes e os
// poderes; o poedb dá a vida (relativa ao pináculo mais fraco, Venarius 400% = 1×), o dano, a experiência e as resistências. Cada um
// solta o fragmento dele garantido (poedb: "It is guaranteed to drop upon killing the map's unique boss").
//
// Fontes (referência local, fora do git): as páginas do poedb em /home/deploy/scrapling/saida/html (os itens) e .../html/pinaculos (os
// chefes e os mapas dos guardiões). Os ícones (PNG 64×64, do CDN oficial do PoE) já estão em gamedata/itens-poe/icones-itens/poe-itens/Pinaculos.
//
// Uso: node tools/montar-pinaculos-acesso.mjs   (reescreve o arquivo; os números de ajuste ficam em `DROP` abaixo)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { variantesDoItem, texto } from './importar-missoes-poedb.mjs';
import { abas } from './extrair-poedb-pinaculos.mjs';

const ITENS_HTML = process.env.POEDB_HTML ?? '/home/deploy/scrapling/saida/html';
const CHEFES_HTML = join(ITENS_HTML, 'pinaculos');
const DESTINO = new URL('../gamedata/itens-poe/pinaculos-acesso.json', import.meta.url);
const ICONES = fileURLToPath(new URL('../gamedata/itens-poe/icones-itens/poe-itens/Pinaculos', import.meta.url));
const VIDA_DE_REFERENCIA_PCT = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/pinaculos.json', import.meta.url), 'utf8')).regra.vidaDeReferenciaPct;

/**
 * O drop dos mapas com os encontros: cada chefe de mapa a partir de `tierMinimo` tem a chance de cada grupo de soltar UM mapa a mais com o
 * encontro (o grupo sorteia qual dos 4). O poedb e os guias dizem só "drop from T14+ map bosses", sem a taxa: estes números são do jogo
 * (ajustáveis aqui).
 */
const DROP = { tierMinimo: 14, chancePorChefe: { criador: 0.08, anciao: 0.08, conquistador: 0.08 } };

// Os ids do catálogo (fixos, fora das outras faixas): os fragmentos em 7.750.001…, os mapas dos guardiões em 7.751.001…
const ID_DOS_FRAGMENTOS = 7_750_001;
const ID_DOS_MAPAS = 7_751_001;

/**
 * Os 12 chefes: a página do poedb (us/pt), a variante do encontro no mapa, a criatura-base do Draevor (um chefe de 50 mil de vida, como
 * as bases dos pináculos), o grupo e o item que solta.
 */
const CHEFES = [
  { id: 'poe-guardiao-da-hidra', pagina: 'Guardian_of_the_Hydra', variante: /HydraBoss$/, base: 'timira-the-many-headed', grupo: 'criador', fragmento: 'Fragment_of_the_Hydra', mapa: 'Lair_of_the_Hydra_Map' },
  { id: 'poe-guardiao-da-fenix', pagina: 'Guardian_of_the_Phoenix', variante: /PhoenixBoss$/, base: 'mawhawk', grupo: 'criador', fragmento: 'Fragment_of_the_Phoenix', mapa: 'Forge_of_the_Phoenix_Map' },
  { id: 'poe-guardiao-do-minotauro', pagina: 'Guardian_of_the_Minotaur', variante: /MinotaurBoss$/, base: 'the-ravager', grupo: 'criador', fragmento: 'Fragment_of_the_Minotaur', mapa: 'Maze_of_the_Minotaur_Map' },
  { id: 'poe-guardiao-da-quimera', pagina: 'Guardian_of_the_Chimera', variante: /ChimeraBoss$/, base: 'urmahlullu-the-immaculate', grupo: 'criador', fragmento: 'Fragment_of_the_Chimera', mapa: 'Pit_of_the_Chimera_Map' },
  { id: 'poe-o-escravizador', pagina: 'The_Enslaver', variante: /ElderGuardian1$/, base: 'foreshock', grupo: 'anciao', fragmento: 'Fragment_of_Enslavement', linha: 'Mapa ocupado pelo Escravizador' },
  { id: 'poe-o-erradicador', pagina: 'The_Eradicator', variante: /ElderGuardian2$/, base: 'outburst', grupo: 'anciao', fragmento: 'Fragment_of_Eradication', linha: 'Mapa ocupado pelo Erradicador' },
  { id: 'poe-o-constritor', pagina: 'The_Constrictor', variante: /ElderGuardian3$/, base: 'the-pale-worm', grupo: 'anciao', fragmento: 'Fragment_of_Constriction', linha: 'Mapa ocupado pelo Constritor', nome: 'O Constritor' },
  { id: 'poe-a-purificadora', pagina: 'The_Purifier', variante: /ElderGuardian4_$/, base: 'plagirath', grupo: 'anciao', fragmento: 'Fragment_of_Purification', linha: 'Mapa ocupado pela Purificadora', nome: 'A Purificadora' },
  { id: 'poe-baran', pagina: 'Baran,_The_Crusader', variante: /AtlasExile1$/, base: 'sir-baeloc', grupo: 'conquistador', fragmento: 'Barans_Crest', linha: 'Mapa contém a Cidadela de Baran' },
  { id: 'poe-veritania', pagina: 'Veritania,_The_Redeemer', variante: /AtlasExile2_$/, base: 'melting-frozen-horror', grupo: 'conquistador', fragmento: 'Veritanias_Crest', linha: 'Mapa contém a Cidadela de Veritania', nome: 'Veritania, a Redentora' },
  { id: 'poe-al-hezmin', pagina: 'Al-Hezmin,_The_Hunter', variante: /AtlasExile3$/, base: 'grand-master-oberon', grupo: 'conquistador', fragmento: 'Al-Hezmins_Crest', linha: 'Mapa contém a Cidadela de Al-Hezmin', nome: 'Al-Hezmin, o Caçador' },
  { id: 'poe-drox', pagina: 'Drox,_The_Warlord', variante: /AtlasExile4$/, base: 'king-zelos', grupo: 'conquistador', fragmento: 'Droxs_Crest', linha: 'Mapa contém a Cidadela de Drox' },
];

/** O que cada pináculo pede no Dispositivo (os 4 do grupo, um de cada). Os outros pináculos entram nas próximas etapas. */
const ENTRADAS = { 'poe-the-shaper': 'criador', 'poe-the-elder': 'anciao', 'poe-sirus': 'conquistador' };

const ELEMENTO = { Fire: 'fire', Cold: 'ice', Lightning: 'energy', Chaos: 'chaos' };
const pct = (s) => Number(String(s ?? '').replace(/[^\d.-]/g, '')) || null;
const ler = (arquivo) => {
  if (!existsSync(arquivo)) throw new Error(`falta a página do poedb: ${arquivo}`);
  return readFileSync(arquivo, 'utf8');
};

/** A variante do monstro no poedb: vida, dano, experiência e resistências (o formato de 11/2026, `<div class="th">`). */
function varianteDoChefe(html, re) {
  for (const a of abas(html).filter((x) => /data-category="MonsterVarieties"/.test(x.html))) {
    if (!re.test(a.id)) continue;
    const at = {};
    for (const m of a.html.matchAll(/<div class="th"><i[^>]*><\/i>([^<]+)<\/div><div>([\s\S]*?)<\/div><\/div>/g)) at[m[1]] = texto(m[2]);
    const resistencias = {};
    for (const m of a.html.matchAll(/IconEnemyResistance(Fire|Cold|Lightning|Chaos)\w*\.webp"[^>]*\/>(?:<span[^>]*>)?(-?\d+)/g)) resistencias[ELEMENTO[m[1]]] = Number(m[2]);
    return { variante: a.id, vidaPct: pct(at.Life), danoPct: pct(at.Damage) ?? 100, expPct: pct(at.Experience) ?? 100, resistencias };
  }
  throw new Error(`variante ${re} não encontrada`);
}

/** O item da página do poedb (a primeira variante com Type). */
function item(slug, pasta = ITENS_HTML) {
  const v = variantesDoItem(ler(join(pasta, `${slug}.html`)), slug).find((x) => x.id) ?? null;
  if (!v) throw new Error(`item ${slug} sem variante`);
  const icone = existsSync(join(ICONES, `${slug}.png`)) ? `poe-itens/Pinaculos/${slug}.png` : null;
  return { slug, tipo: v.id, nome: v.nome, en: v.en, linhas: v.linhas, sabor: v.sabor, icone, nivelDrop: v.nivelDrop };
}

const itens = [];
const mapas = [];
const chefes = [];
for (const c of CHEFES) {
  const us = ler(join(CHEFES_HTML, `us-${c.pagina}.html`));
  const pt = ler(join(CHEFES_HTML, `pt-${c.pagina}.html`));
  const v = varianteDoChefe(us, c.variante);
  const fragmento = { ...item(c.fragmento), itemId: ID_DOS_FRAGMENTOS + itens.length, chefe: c.id, grupo: c.grupo };
  itens.push(fragmento);
  let mapa = null;
  if (c.mapa) {
    const m = item(c.mapa, CHEFES_HTML);
    mapa = { ...m, nome: m.nome.replace(/^Mapa:\s*/, ''), itemId: ID_DOS_MAPAS + mapas.length, chefe: c.id, tier: 16 };
    mapas.push(mapa);
  }
  chefes.push({
    id: c.id,
    nome: c.nome ?? texto(pt.match(/<span class="lc">([\s\S]*?)<\/span>/)?.[1] ?? '') ?? c.pagina,
    en: c.pagina.replace(/_/g, ' '),
    poedb: `https://poedb.tw/us/${encodeURIComponent(c.pagina)}`,
    ...v,
    vidaMult: Math.round((v.vidaPct / VIDA_DE_REFERENCIA_PCT) * 100) / 100,
    base: c.base,
    grupo: c.grupo,
    fragmento: fragmento.itemId,
    ...(mapa ? { mapa: mapa.itemId } : { linha: c.linha }),
  });
}

const entradas = Object.fromEntries(Object.entries(ENTRADAS).map(([pin, grupo]) => [pin, itens.filter((i) => i.grupo === grupo).map((i) => i.itemId)]));
const saida = {
  _nota:
    'A ENTRADA dos pináculos como no PoE (dono, 05/11): sem trava de level; cada pináculo abre no Dispositivo de Mapas com os itens de `entradas` (um de cada, gastos ao abrir). Os itens saem dos 12 chefes de `chefes` (garantido), que nascem nos mapas com o encontro: o mapa do guardião do Criador (T16, o guardião é o chefe do mapa) ou o mapa comum "ocupado"/"com a Cidadela" (o chefe a mais no fundo do mapa). Os mapas com encontro caem dos chefes de mapa a partir de `drop.tierMinimo`, com `drop.chancePorChefe` por grupo (sem a taxa no poedb: números do jogo). Gerado por tools/montar-pinaculos-acesso.mjs a partir do poedb.',
  drop: DROP,
  entradas,
  itens,
  mapas,
  chefes,
};
writeFileSync(DESTINO, `${JSON.stringify(saida, null, 1)}\n`);
console.log(`${itens.length} fragmentos, ${mapas.length} mapas, ${chefes.length} chefes → ${fileURLToPath(DESTINO)}`);
for (const c of chefes) console.log(`  ${c.nome} (${c.variante}): vida ${c.vidaPct}% (×${c.vidaMult}), dano ${c.danoPct}%, exp ${c.expPct}%, base ${c.base}`);
