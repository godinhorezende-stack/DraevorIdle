// (lote A5d, dono 20/10) As DEFESAS dos monstros do PoE: a evasão e a precisão como no PoE 1 — a tabela do PoE por nível × o multiplicador do
// TIPO do monstro. Grava `gamedata/itens-poe/monstros-defesa-poe.json`, que `systems/mobs/atributos.mjs` lê.
//
// Fontes:
//   - as tabelas (1–100): `data.monsterEvasionTable` e `data.monsterAccuracyTable` do Misc.lua do PoB (`/home/deploy/referencias-poe/pob/Misc.lua`);
//   - os multiplicadores: o tooltip do poedb na página de cada monstro ("290(Base Stat) * 2(Monster Type Multiplier) = 580"), lido por
//     `/home/deploy/scrapling/extrair/monstros_defesa.py` → `saida/json/monstros-defesa.json` (uma entrada por variante — cada aba da página).
// Por slug: o GERAL — a moda das variantes de nível 68+ (a Base Stat = a tabela no 68 ou no 83; é o que vale nos MAPAS), senão a de todas — e o
// `porNivel[N]` — o da variante cuja Base Stat é a tabela no nível N em que o slug aparece na campanha, quando difere do geral (na evasão dos
// únicos, a que bate com a evasão da campanha).
// Sem página: evasão × 1, precisão × a mediana dos importados (o `padrao`).
//
// (lote A5e, dono 20/10) A ARMADURA também: a Base Stat da armadura no poedb NÃO é a `monsterArmourTable` do PoB (no 68: 28790 × 12009). A tabela
// (1–100) é a do poedb:
//   - os níveis 1–90: a "Base por nível" do bestiário do poedb (`referencias-poe/original/poe-bestiario/Base_por_Nivel/base-por-nivel.json`,
//     coluna Armadura), conferida com TODA Base Stat de armadura dos tooltips (o nível de cada variante: a Base Stat da evasão dela na tabela de
//     evasão — a mesma aba); se alguma divergir, o importador para;
//   - os níveis 91–100 (sem fonte na escala do poedb — o poedb não os tem, e a `monsterArmourTable` do PoB vai até o 100, mas em outra escala): EXTRAPOLADOS no log — o crescimento por nível do 90, que cai a cada nível como
//     caía do 85 ao 90 (marcados em `origemDasTabelas.armadura.extrapolados`).
// Os multiplicadores: como na evasão (o geral = o das variantes de nível 68+; `porNivel`), e, quando o nível não decide, o que bate com a armadura
// da campanha. Sem página: o da campanha (armadura ÷ tabela, igual em todos os níveis do slug), senão × 1.
//
// Uso: node tools/importar-defesa-monstros-poe.mjs [monstros-defesa.json] [Misc.lua] [base-por-nivel.json]
import { readFileSync, writeFileSync } from 'node:fs';

const ENTRADA = process.argv[2] ?? '/home/deploy/scrapling/saida/json/monstros-defesa.json';
const MISC = process.argv[3] ?? '/home/deploy/referencias-poe/pob/Misc.lua';
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const BASE_POR_NIVEL = process.argv[4] ?? '/home/deploy/referencias-poe/original/poe-bestiario/Base_por_Nivel/base-por-nivel.json';
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

// (lote A5e) A tabela de ARMADURA do poedb: 1–90 da "Base por nível" do bestiário do poedb; 91–100 extrapolados no log.
const baseDoPoedb = JSON.parse(readFileSync(BASE_POR_NIVEL, 'utf8')).niveis ?? [];
const armadura = [];
for (const n of baseDoPoedb) if (Number.isFinite(n?.nivel) && Number.isFinite(n?.Armadura)) armadura[n.nivel - 1] = n.Armadura;
const ultimoMedido = armadura.length;
if (ultimoMedido < 85 || armadura.some((x) => !Number.isFinite(x)) || armadura.includes(undefined)) throw new Error(`${BASE_POR_NIVEL}: a armadura 1–${ultimoMedido} tem buracos`);
// O crescimento por nível g(n) = A(n) / A(n−1): no 90 e a queda média por nível do 85 ao 90 (1,07941 → 1,07873) — segue caindo igual.
const g = (n) => armadura[n - 1] / armadura[n - 2];
const queda = (g(ultimoMedido) - g(ultimoMedido - 5)) / 5;
const extrapolados = [];
for (let n = ultimoMedido + 1; n <= 100; n++) {
  armadura[n - 1] = Math.round(armadura[n - 2] * (g(ultimoMedido) + queda * (n - ultimoMedido)));
  extrapolados.push(n);
}
tabelas.armadura = armadura;

// Os slugs: os monstros das áreas e os chefes de ato (os mapas usam os mesmos — `itens-poe/mapas-areas.mjs`, levados ao nível do mapa).
const slugs = new Set();
for (const a of Object.values(CAMPANHA.areas)) for (const m of a.monstros ?? []) slugs.add(m.slug);
for (const c of Object.values(CAMPANHA.chefes ?? {})) if (c.monstro?.slug) slugs.add(c.monstro.slug);
// A evasão que a campanha já traz (só os únicos têm — `campanha-poe.json`): com variantes divergentes no poedb, vale a que bate com ela.
const evasaoDaCampanha = new Map();
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) if (m.evasao > 0) evasaoDaCampanha.set(`${m.slug}@${m.nivel}`, m);
// (lote A5e) A armadura da campanha (todos têm): com variantes divergentes no nível, vale a que bate com ela.
const armaduraDaCampanha = new Map();
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) if (m.armadura > 0) armaduraDaCampanha.set(`${m.slug}@${m.nivel}`, m.armadura);
// Os níveis em que cada slug aparece na campanha (as áreas e os chefes de ato).
const niveisDaCampanha = new Map();
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) if (m.nivel > 0) (niveisDaCampanha.get(m.slug) ?? niveisDaCampanha.set(m.slug, new Set()).get(m.slug)).add(m.nivel);

const lido = JSON.parse(readFileSync(ENTRADA, 'utf8'));
// A página do poedb sem vírgula ("Kuduku,_the_False_God" → "Kuduku_the_False_God") — a variante que o poedb usa.
// (lote A5e) Toda Base Stat de armadura dos tooltips tem de ser a tabela no nível da variante (o da Base Stat da evasão da mesma aba).
const nivelPelaEvasao = new Map(tabelas.evasao.map((v, i) => [v, i + 1]));
const niveisDosTooltips = new Set();
{
  const erradas = [];
  for (const [slug, vs] of Object.entries(lido.monstros ?? {})) for (const v of vs) {
    const n = nivelPelaEvasao.get(v.evasao?.base);
    if (!n || !Number.isFinite(v.armadura?.base)) continue;
    niveisDosTooltips.add(n);
    if (v.armadura.base !== armadura[n - 1]) erradas.push(`${slug}/${v.id} nível ${n}: ${v.armadura.base} ≠ ${armadura[n - 1]}`);
  }
  if (erradas.length) throw new Error(`a armadura dos tooltips não bate com a tabela do poedb:\n${erradas.slice(0, 20).join('\n')}`);
}
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
    // abas de mapa, Delve, Gauntlet), quando existe; senão, o de todas.
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
      const daCampanha = c === 'evasao' ? evasaoDaCampanha.get(`${slug}@${n}`)?.evasao : c === 'armadura' ? armaduraDaCampanha.get(`${slug}@${n}`) : null;
      if (daCampanha && !(mult != null && Math.abs(Math.round(tab[n - 1] * mult) - daCampanha) <= 1)) mult = ms.find((x) => Math.abs(Math.round(tab[n - 1] * x) - daCampanha) <= 1) ?? mult;
      if (mult != null && mult !== e[c]) ((e.porNivel ??= {})[n] ??= {})[c] = mult;
    }
  }
  if (e.precisao == null && e.evasao == null) { faltantes.push(slug); continue; }
  monstros[slug] = e;
}
// (lote A5e) Sem página: a armadura pelo multiplicador da campanha (armadura ÷ tabela no nível), quando é o mesmo em todos os níveis do slug.
for (const slug of faltantes) {
  const ms = [...(niveisDaCampanha.get(slug) ?? [])].map((n) => Math.round(((armaduraDaCampanha.get(`${slug}@${n}`) ?? 0) / armadura[n - 1]) * 100) / 100);
  if (ms.length && new Set(ms).size === 1 && ms[0] > 0) monstros[slug] = { armadura: ms[0], armaduraDaCampanha: true };
}
// (lote A5e) A conferência: a armadura da campanha × round(tabela[nível] × multiplicador) — quantas batem (até 1%) e as que não.
const conferencia = { total: 0, batem: 0, exatas: 0, naoBatem: [] };
for (const m of [...Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []), ...Object.values(CAMPANHA.chefes ?? {}).map((c) => c.monstro).filter(Boolean)]) {
  const d = monstros[m.slug];
  const mult = d?.porNivel?.[m.nivel]?.armadura ?? d?.armadura ?? 1;
  const conta = Math.round(armadura[m.nivel - 1] * mult);
  conferencia.total++;
  if (conta === Math.round(m.armadura ?? 0)) conferencia.exatas++;
  if (Math.abs(conta - (m.armadura ?? 0)) <= Math.max(1, 0.01 * (m.armadura ?? 0))) conferencia.batem++;
  else conferencia.naoBatem.push(`${m.slug}@${m.nivel}: campanha ${m.armadura}, tabela ${armadura[m.nivel - 1]} × ${mult} = ${conta}`);
}
conferencia.naoBatem = [...new Set(conferencia.naoBatem)];
// (dono, 20/10) Onde a campanha divergia, vale a do poedb (a tabela × o multiplicador) — sem exceção; fica só o registro.
if (conferencia.naoBatem.length) conferencia._nota = 'A campanha divergia nestes (naoBatem); vale a do poedb — tabela × multiplicador (dono, 20/10). Ex.: o Vaal_Oversoul no 23 fica com 834 (556 × 1,5), não os 924 da campanha.';
const precisoes = Object.values(monstros).map((m) => m.precisao).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
const mediana = precisoes.length ? (precisoes.length % 2 ? precisoes[(precisoes.length - 1) / 2] : (precisoes[precisoes.length / 2 - 1] + precisoes[precisoes.length / 2]) / 2) : 1;

const saida = {
  _nota: 'Lote A5d (dono, 20/10): a evasão e a precisão dos monstros do PoE = round(tabela[nível] × multiplicador do tipo), com os aumentos do monstro por cima. Lote A5e: a armadura também (o teto de L.armaduraMaxima por cima). Tabelas: data.monsterEvasionTable / data.monsterAccuracyTable do Misc.lua do PoB (índice 0 = nível 1); a de armadura é a do poedb (NÃO a monsterArmourTable do PoB): 1–90 da Base por nível do bestiário do poedb, conferida com as Base Stat dos tooltips; 91–100 extrapolados no log (origemDasTabelas.armadura). Multiplicadores: o "Monster Type Multiplier" do tooltip do poedb. O geral (o dos MAPAS e de todo nível sem porNivel): a moda das variantes de nível 68+ (Base Stat = tabela no 68 ou no 83), senão a de todas. porNivel[N]: o da variante cuja Base Stat é a tabela no nível N da campanha, quando difere do geral (o motor usa o do poe.nivel). `faltantes`: os slugs SEM PÁGINA no poedb — evasão × 1, precisão × a mediana (`padrao`); a armadura × a da campanha quando ela dá um multiplicador só (esses ficam também em `monstros`, só com `armadura` e `armaduraDaCampanha: true`), senão × 1. Gerado por tools/importar-defesa-monstros-poe.mjs.',
  fonte: { tabelas: 'Path of Building — src/Data/Misc.lua (evasão, precisão)', armadura: 'poedb — Base por nível do bestiário (1–90) + Base Stat dos tooltips; 91–100 extrapolados (sem fonte na escala do poedb)', multiplicadores: 'poedb.tw/pt/<slug> (tooltips de Precisão, Evasão e Armadura)' },
  tabelas,
  origemDasTabelas: {
    armadura: {
      tooltips: [...niveisDosTooltips].sort((a, b) => a - b),
      baseDoPoedb: Array.from({ length: ultimoMedido }, (_, i) => i + 1).filter((n) => !niveisDosTooltips.has(n)),
      extrapolados,
      regra: `91–100: A(n) = round(A(n−1) × (g90 + (n − 90) × ${Math.round(queda * 1e7) / 1e7})), g90 = A(90)/A(89) = ${Math.round(g(ultimoMedido) * 1e5) / 1e5}`,
    },
  },
  padrao: { evasao: 1, precisao: mediana, armadura: 1 },
  monstros,
  faltantes,
  divergentes,
  conferenciaDaArmadura: conferencia,
};
writeFileSync(SAIDA, `${JSON.stringify(saida, null, 1)}\n`);

const dist = (c) => Object.entries(Object.values(monstros).reduce((t, m) => ((t[m[c]] = (t[m[c]] ?? 0) + 1), t), {})).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}×${n}`).join(' ');
console.log(`slugs ${slugs.size} · importados do poedb ${Object.values(monstros).filter((m) => !m.armaduraDaCampanha).length} · sem página (faltantes) ${faltantes.length}, ${Object.values(monstros).filter((m) => m.armaduraDaCampanha).length} com a armadura da campanha · faltantes ${faltantes.length}${faltantes.length ? ` (${faltantes.join(', ')})` : ''}`);
console.log(`precisão: ${dist('precisao')}`);
console.log(`evasão: ${dist('evasao')}`);
console.log(`armadura: ${dist('armadura')}`);
console.log(`slugs com porNivel: ${Object.values(monstros).filter((m) => m.porNivel).length} (evasão ${Object.values(monstros).filter((m) => Object.values(m.porNivel ?? {}).some((x) => x.evasao != null)).length}, precisão ${Object.values(monstros).filter((m) => Object.values(m.porNivel ?? {}).some((x) => x.precisao != null)).length})`);
console.log(`armadura: tabela 1/10/30/50/68/83/90/100 = ${[1, 10, 30, 50, 68, 83, 90, 100].map((n) => armadura[n - 1]).join('/')} · a campanha bate (até 1%) ${conferencia.batem}/${conferencia.total} (exatas ${conferencia.exatas}); não batem: ${conferencia.naoBatem.join('; ') || '—'}`);
console.log(`mediana da precisão (o padrão): ${mediana} · slugs com variantes divergentes: ${divergentes.length}`);
