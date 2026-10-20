// (lote A5d, dono 20/10) As DEFESAS dos monstros do PoE: a evasão e a precisão como no PoE 1 — a tabela do PoE por nível × o multiplicador do
// TIPO do monstro. Grava `gamedata/itens-poe/monstros-defesa-poe.json`, que `systems/mobs/atributos.mjs` lê.
//
// Fontes:
//   - as tabelas (1–100): `data.monsterEvasionTable` e `data.monsterAccuracyTable` do Misc.lua do PoB (`/home/deploy/referencias-poe/pob/Misc.lua`);
//   - os multiplicadores: o tooltip do poedb na página de cada monstro ("290(Base Stat) * 2(Monster Type Multiplier) = 580"), lido por
//     `/home/deploy/scrapling/extrair/monstros_defesa.py` → `saida/json/monstros-defesa.json` (uma entrada por variante — cada aba da página).
// Por slug: o GERAL — a moda das variantes de nível 68+ (a Base Stat = a tabela no 68 ou no 83; é o que vale nos MAPAS), senão a de todas — e o
// `porNivel[N]` — o da variante cuja Base Stat é a tabela no nível N em que o slug aparece na campanha, quando difere do geral (na evasão dos
// únicos, a que bate com a evasão da campanha). A armadura só fica registrada (não vale neste lote).
// Sem página: evasão × 1, precisão × a mediana dos importados (o `padrao`).
//
// Uso: node tools/importar-defesa-monstros-poe.mjs [monstros-defesa.json] [Misc.lua]
import { readFileSync, writeFileSync } from 'node:fs';

const ENTRADA = process.argv[2] ?? '/home/deploy/scrapling/saida/json/monstros-defesa.json';
const MISC = process.argv[3] ?? '/home/deploy/referencias-poe/pob/Misc.lua';
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const SAIDA = new URL('../gamedata/itens-poe/monstros-defesa-poe.json', import.meta.url);

const lua = readFileSync(MISC, 'utf8');
const tabela = (nome) => {
  const m = new RegExp(`data\\.${nome}\\s*=\\s*\\{([^}]*)\\}`).exec(lua);
  if (!m) throw new Error(`${nome} não está em ${MISC}`);
  const t = m[1].split(',').map((x) => x.trim()).filter(Boolean).map(Number);
  if (t.length !== 100 || t.some((x) => !Number.isFinite(x))) throw new Error(`${nome}: esperava 100 números, veio ${t.length}`);
  return t;
};
const tabelas = { evasao: tabela('monsterEvasionTable'), precisao: tabela('monsterAccuracyTable') };

// Os slugs: os monstros das áreas e os chefes de ato (os mapas usam os mesmos — `itens-poe/mapas-areas.mjs`, levados ao nível do mapa).
const slugs = new Set();
for (const a of Object.values(CAMPANHA.areas)) for (const m of a.monstros ?? []) slugs.add(m.slug);
for (const c of Object.values(CAMPANHA.chefes ?? {})) if (c.monstro?.slug) slugs.add(c.monstro.slug);
// A evasão que a campanha já traz (só os únicos têm — `campanha-poe.json`): com variantes divergentes no poedb, vale a que bate com ela.
const evasaoDaCampanha = new Map();
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) if (m.evasao > 0) evasaoDaCampanha.set(`${m.slug}@${m.nivel}`, m);
// Os níveis em que cada slug aparece na campanha (as áreas e os chefes de ato).
const niveisDaCampanha = new Map();
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) if (m.nivel > 0) (niveisDaCampanha.get(m.slug) ?? niveisDaCampanha.set(m.slug, new Set()).get(m.slug)).add(m.nivel);

const lido = JSON.parse(readFileSync(ENTRADA, 'utf8'));
// A página do poedb sem vírgula ("Kuduku,_the_False_God" → "Kuduku_the_False_God") — a variante que o poedb usa.
const variantesDe = (slug) => lido.monstros?.[slug] ?? lido.monstros?.[slug.replace(/,/g, '')] ?? null;

/** O valor mais comum (no empate, o primeiro). */
function moda(valores) {
  const n = new Map();
  for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1);
  let melhor = null;
  for (const [v, k] of n) if (melhor == null || k > n.get(melhor)) melhor = v;
  return melhor;
}

const monstros = {};
const faltantes = [];
const divergentes = [];
for (const slug of [...slugs].sort()) {
  const vs = variantesDe(slug);
  if (!vs?.length) { faltantes.push(slug); continue; }
  const e = {};
  for (const c of ['precisao', 'evasao', 'armadura']) {
    const ms = vs.map((v) => v[c]?.mult).filter((x) => Number.isFinite(x));
    if (!ms.length) continue;
    if (new Set(ms).size > 1) divergentes.push(`${slug}.${c}: ${[...new Set(ms)].join('/')}`);
    // O GERAL (o que vale nos MAPAS e em todo nível sem `porNivel`): o da variante de nível 68+ (a Base Stat igual à tabela no 68 ou no 83 — as
    // abas de mapa, Delve, Gauntlet), quando existe; senão, o de todas. A armadura não tem tabela aqui: todas as variantes.
    const tab = tabelas[c];
    const doMapa = tab ? vs.filter((v) => v[c]?.base === tab[67] || v[c]?.base === tab[82]).map((v) => v[c].mult).filter((x) => Number.isFinite(x)) : [];
    e[c] = moda(doMapa.length ? doMapa : ms);
    if (!tab) continue;
    // Por NÍVEL DA CAMPANHA: as variantes cuja Base Stat é a tabela naquele nível (a do monstro daquela área — ex.: o Lurking_Venom do 18 é a
    // ScalySabreSpider, 493 × 1,5; as do 54/68, × 1). Todas com o mesmo multiplicador e diferente do geral → `porNivel[N][c]`. (As variantes do
    // mesmo nível que divergem entre si — o Savage_Crab no 3 — ficam no geral e em `divergentes`.)
    for (const n of [...(niveisDaCampanha.get(slug) ?? [])].sort((a, b) => a - b)) {
      const doNivel = [...new Set(vs.filter((v) => v[c]?.base === tab[n - 1]).map((v) => v[c].mult).filter((x) => Number.isFinite(x)))];
      if (doNivel.length > 1) divergentes.push(`${slug}.${c}@${n}: ${doNivel.join('/')}`);
      let mult = doNivel.length === 1 ? doNivel[0] : null;
      // (a evasão que a campanha já traz — os únicos — decide quando o nível não decide)
      const daCampanha = c === 'evasao' ? evasaoDaCampanha.get(`${slug}@${n}`) : null;
      if (daCampanha) mult = ms.find((x) => Math.abs(Math.round(tab[n - 1] * x) - daCampanha.evasao) <= 1) ?? mult;
      if (mult != null && mult !== e[c]) ((e.porNivel ??= {})[n] ??= {})[c] = mult;
    }
  }
  if (e.precisao == null && e.evasao == null) { faltantes.push(slug); continue; }
  monstros[slug] = e;
}
const precisoes = Object.values(monstros).map((m) => m.precisao).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
const mediana = precisoes.length ? (precisoes.length % 2 ? precisoes[(precisoes.length - 1) / 2] : (precisoes[precisoes.length / 2 - 1] + precisoes[precisoes.length / 2]) / 2) : 1;

const saida = {
  _nota: 'Lote A5d (dono, 20/10): a evasão e a precisão dos monstros do PoE = round(tabela[nível] × multiplicador do tipo), com os aumentos do monstro por cima. Tabelas: data.monsterEvasionTable / data.monsterAccuracyTable do Misc.lua do PoB (índice 0 = nível 1). Multiplicadores: o "Monster Type Multiplier" do tooltip do poedb. O geral (o dos MAPAS e de todo nível sem porNivel): a moda das variantes de nível 68+ (Base Stat = tabela no 68 ou no 83), senão a de todas. porNivel[N]: o da variante cuja Base Stat é a tabela no nível N da campanha, quando difere do geral (o motor usa o do poe.nivel). A armadura só fica registrada (não vale). Sem página: evasão × 1, precisão × a mediana (`padrao`). Gerado por tools/importar-defesa-monstros-poe.mjs.',
  fonte: { tabelas: 'Path of Building — src/Data/Misc.lua', multiplicadores: 'poedb.tw/pt/<slug> (tooltips de Precisão, Evasão e Armadura)' },
  tabelas,
  padrao: { evasao: 1, precisao: mediana },
  monstros,
  faltantes,
  divergentes,
};
writeFileSync(SAIDA, `${JSON.stringify(saida, null, 1)}\n`);

const dist = (c) => Object.entries(Object.values(monstros).reduce((t, m) => ((t[m[c]] = (t[m[c]] ?? 0) + 1), t), {})).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}×${n}`).join(' ');
console.log(`slugs ${slugs.size} · importados ${Object.keys(monstros).length} · faltantes ${faltantes.length}${faltantes.length ? ` (${faltantes.join(', ')})` : ''}`);
console.log(`precisão: ${dist('precisao')}`);
console.log(`evasão: ${dist('evasao')}`);
console.log(`armadura: ${dist('armadura')}`);
console.log(`slugs com porNivel: ${Object.values(monstros).filter((m) => m.porNivel).length} (evasão ${Object.values(monstros).filter((m) => Object.values(m.porNivel ?? {}).some((x) => x.evasao != null)).length}, precisão ${Object.values(monstros).filter((m) => Object.values(m.porNivel ?? {}).some((x) => x.precisao != null)).length})`);
console.log(`mediana da precisão (o padrão): ${mediana} · slugs com variantes divergentes: ${divergentes.length}`);
