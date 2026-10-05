// Monta `gamedata/itens-poe/pinaculos.json` (os 11 CHEFES PINÁCULO do PoE no Draevor — decisão do dono de 05/10: "crie os chefes") a partir da
// extração do poedb (`tools/extrair-poedb-pinaculos.mjs` → /home/deploy/referencias-poe/poedb/pinaculos.json, referência local).
//
// Cada chefe é um BOSS ÚNICO do Draevor (`bosses-unicos/`) numa arena de boss própria. O que vem do PoE: nome, Vida %, Dano %, Experiência %,
// resistências (Fogo, Gelo, Raio, Caos) e os ÚNICOS EXCLUSIVOS (a tabela de loot só dele). O que é do Draevor: a criatura-BASE (desenho,
// golpes e poderes — um boss nível 250 de tema parecido) e a arena dela. A força: a vida do PoE é relativa ("% da vida de um monstro do
// nível"), então a régua é o pináculo mais fraco — `vidaDeReferenciaPct` (Venarius, 400%) = 1× a vida da base; os outros na proporção.
//
// Uso: node tools/montar-pinaculos.mjs   (reescreve o arquivo; os números de ajuste ficam em `REGRA` e `CHEFES` abaixo)
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEM = '/home/deploy/referencias-poe/poedb/pinaculos.json';
const DESTINO = new URL('../gamedata/itens-poe/pinaculos.json', import.meta.url);

const REGRA = { nivel: 250, cooldownHours: 12, vidaDeReferenciaPct: 400, chanceDoExclusivoPct: 100 };

/** Chefe do PoE (nome no poedb) → id no Draevor, a variante principal (a do mapa/encontro normal) e a criatura-base do Draevor. */
const CHEFES = {
  'The Shaper': { id: 'poe-the-shaper', variante: 'TheShaperBoss', base: 'the-time-guardian' },
  'The Elder': { id: 'poe-the-elder', variante: 'TheElder', base: 'chagorz' },
  Venarius: { id: 'poe-venarius', variante: 'SynthesisVenariusBoss', base: 'the-last-lore-keeper' },
  'Sirus, Awakener of Worlds': { id: 'poe-sirus', variante: 'AtlasExile5', base: 'eradicator' },
  'The Maven': { id: 'poe-the-maven', variante: 'TheMaven', base: 'the-brainstealer' },
  'Nucleus of the Maven': { id: 'poe-nucleus-of-the-maven', variante: 'MavenBrainBoss', base: 'brain-head', unicosDe: 'The Maven' },
  'The Searing Exarch': { id: 'poe-the-searing-exarch', variante: 'CleansingBoss', base: 'magma-bubble' },
  'The Eater of Worlds': { id: 'poe-the-eater-of-worlds', variante: 'ConsumeBoss', base: 'ravenous-hunger' },
  'Incarnation of Dread': { id: 'poe-incarnation-of-dread', variante: 'BenevolenceBoss', base: 'the-dread-maiden' },
  'Incarnation of Fear': { id: 'poe-incarnation-of-fear', variante: 'AngerBoss', base: 'the-fear-feaster' },
  'Incarnation of Neglect': { id: 'poe-incarnation-of-neglect', variante: 'IgnoranceBoss', base: 'the-unwelcome' },
};

const pct = (s) => (s == null ? null : Number(String(s).replace(/[^\d.-]/g, '')) || null);
const ELEMENTO = { fire: 'fire', cold: 'ice', lightning: 'energy', chaos: 'chaos' };

const fonte = JSON.parse(readFileSync(ORIGEM, 'utf8'));
const porNome = new Map(fonte.chefes.map((c) => [c.nome, c]));
const chefes = [];
for (const [nome, cfg] of Object.entries(CHEFES)) {
  const c = porNome.get(nome);
  if (!c) throw new Error(`chefe ${nome} não está na extração`);
  const v = c.variantes.find((x) => x.id === cfg.variante) ?? c.variantes[0];
  const vidaPct = pct(v.atributos.Life);
  const unicos = (cfg.unicosDe ? porNome.get(cfg.unicosDe) : c).unicos
    .filter((u) => u.naColecao)
    .map((u) => ({ slug: u.slug, nome: u.naColecao.nome, nomeOriginal: u.nome, classe: u.naColecao.classe, base: u.naColecao.base }));
  chefes.push({
    id: cfg.id,
    nome,
    poedb: c.pagina,
    variante: v.id,
    base: cfg.base,
    vidaPct,
    danoPct: pct(v.atributos.Damage) ?? 100,
    expPct: pct(v.atributos.Experience) ?? 100,
    vidaMult: Math.round((vidaPct / REGRA.vidaDeReferenciaPct) * 100) / 100,
    resistencias: Object.fromEntries(Object.entries(v.resistencias ?? {}).map(([k, n]) => [ELEMENTO[k], n]).filter(([k]) => k)),
    raridadeDoDropPct: v.drop?.raridadePct ?? null,
    unicos,
  });
}
const saida = {
  _nota:
    'Os CHEFES PINÁCULO do PoE no Draevor (sistema de itens do PoE, Fase 1 — só com ITENS_POE=1; em produção não existem). Gerado por tools/montar-pinaculos.mjs a partir do poedb (referência local). Cada um é um boss único (bosses-unicos) numa arena de boss própria, com a criatura-base do Draevor dando desenho, golpes e poderes. Vida: vidaMult = vidaPct / vidaDeReferenciaPct (o pináculo mais fraco = 1× a base); dano: danoPct/100; exp: expPct/100; resistências do PoE (Fogo, Gelo, Raio, Caos). Na vitória: o drop normal do PoE (raridade Único do monstro, +2850%) e 1 Único EXCLUSIVO do chefe com chanceDoExclusivoPct.',
  regra: REGRA,
  chefes,
};
writeFileSync(DESTINO, JSON.stringify(saida, null, 2) + '\n');
for (const c of chefes) console.log(`${c.id}: vida ${c.vidaPct}% → ×${c.vidaMult}, dano ${c.danoPct}%, exp ${c.expPct}%, ${JSON.stringify(c.resistencias)}, ${c.unicos.length} únicos`);
