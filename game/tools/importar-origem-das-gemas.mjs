// ONDE SE GANHA CADA GEMA (dono, 07/10: "em Gem Atelier vira catálogo de gemas e onde é dada cada gema nas missões e ato — faça esse
// mapeamento para facilitar o usuário"): da coleção do poedb (recompensas de missão por classe e as gemas que o vendedor libera depois de
// cada missão) → `gamedata/itens-poe/origem-das-gemas.json`, pelo id do item da gema. Só as missões da campanha (Atos 1 a 10).
// Uso: node tools/importar-origem-das-gemas.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join(process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe', 'original', 'poe-atos', 'Missoes');
const ler = (f) => JSON.parse(readFileSync(join(PASTA, f), 'utf8')).itens;
const ids = (f) => { const d = JSON.parse(readFileSync(new URL(`../gamedata/itens-poe/${f}`, import.meta.url), 'utf8')); return d.ids ?? d; };
const ID = { ...ids('gemas-poe-ids.json'), ...ids('suportes-poe-ids.json') };
const CLASSE = { Marauder: 'Marauder', Bruxa: 'Witch', Herdeira: 'Scion', Caçadora: 'Ranger', Duelista: 'Duelist', Sombra: 'Shadow', Templário: 'Templar' };
const COR = { gem_red: 'vermelha', gem_green: 'verde', gem_blue: 'azul', gem_white: 'branca' };

const porMissao = ler('recompensas-por-missao.json').filter((m) => m.ato >= 1 && m.ato <= 10);
const atoDa = new Map(porMissao.map((m) => [m.missao.slug, m.ato]));
const vendedor = ler('recompensas-vendedor.json');
const gemas = {};
const semId = new Set();
const anotar = (m, tipo, ato) => {
  for (const [classePt, lista] of Object.entries(m.por_classe ?? {})) {
    for (const g of lista) {
      const id = ID[g.slug];
      if (!id) { semId.add(g.slug); continue; }
      const x = (gemas[id] ??= { slug: g.slug, nome: g.nome, cor: COR[g.classe] ?? null, origens: [] });
      let o = x.origens.find((y) => y.missao === m.missao.slug && y.tipo === tipo);
      if (!o) x.origens.push((o = { tipo, missao: m.missao.slug, nomeDaMissao: m.missao.nome, ato, classes: [] }));
      if (!o.classes.includes(CLASSE[classePt])) o.classes.push(CLASSE[classePt]);
    }
  }
};
for (const m of porMissao) anotar(m, 'recompensa', m.ato);
for (const m of vendedor) if (atoDa.has(m.missao.slug)) anotar(m, 'vendedor', atoDa.get(m.missao.slug));
for (const x of Object.values(gemas)) x.origens.sort((a, b) => a.ato - b.ato || (a.tipo === 'recompensa' ? -1 : 1));
const missoes = porMissao.map((m) => ({ slug: m.missao.slug, nome: m.missao.nome, ato: m.ato, vendedor: vendedor.some((v) => v.missao.slug === m.missao.slug) }));
writeFileSync(new URL('../gamedata/itens-poe/origem-das-gemas.json', import.meta.url), `${JSON.stringify({
  _nota: 'Onde se ganha cada gema do PoE na campanha (tools/importar-origem-das-gemas.mjs, da coleção do poedb): `recompensa` = escolhida ao concluir a missão; `vendedor` = o vendedor passa a vender depois da missão. Classes pelo slug do PoE. A tela: Gem Atelier › Catálogo.',
  missoes, gemas,
})}\n`);
console.log(`${Object.keys(gemas).length} gemas com origem; ${missoes.length} missões (Atos 1–10); sem id no jogo: ${semId.size ? [...semId].join(', ') : 'nenhuma'}`);
