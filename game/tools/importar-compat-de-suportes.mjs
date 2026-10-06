// QUAIS GEMAS ATIVAS cada suporte do PoE suporta, exatamente como no PoE (dono, 06/10: "implemente as gemas de suporte ... e verifique o
// funcionamento"): a lista `suporta.gemas` de cada suporte na coleção do Drive (`suportes-drive/gemas`) → `gamedata/itens-poe/
// suportes-compat.json`, compacta: a ordem dos suportes (o índice de cada um) e, por gema ativa, um mapa de bits em base64 (o bit `i`
// ligado = o suporte `i` a suporta). A regra pelas tags acertava 65% (aceitava muito que o PoE não aceita) — esta é a do PoE.
// Suporte sem lista no Drive (Pacifism, Inspiration) fica de fora e segue a regra das tags.
// Uso: node tools/importar-compat-de-suportes.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.env.REFERENCIAS_POE ?? '/home/deploy/referencias-poe';
const PASTA = join(RAIZ, 'suportes-drive', 'gemas');
const SAIDA = new URL('../gamedata/itens-poe/suportes-compat.json', import.meta.url);

const suportes = readdirSync(PASTA).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(PASTA, f), 'utf8')))
  .filter((d) => (d.suporta?.gemas ?? []).length)
  .sort((a, b) => a.slug.localeCompare(b.slug));
const porAtiva = new Map();
suportes.forEach((d, i) => {
  for (const g of d.suporta.gemas) {
    const bits = porAtiva.get(g.slug) ?? new Uint8Array(Math.ceil(suportes.length / 8));
    bits[i >> 3] |= 1 << (i & 7);
    porAtiva.set(g.slug, bits);
  }
});
const ativas = Object.fromEntries([...porAtiva].sort(([a], [b]) => a.localeCompare(b)).map(([slug, bits]) => [slug, Buffer.from(bits).toString('base64')]));
writeFileSync(SAIDA, `${JSON.stringify({
  _nota: 'Quais gemas ativas cada suporte do PoE suporta, como no PoE (tools/importar-compat-de-suportes.mjs, da coleção do Drive). `suportes`: a ordem (o índice de cada um). `ativas`: por gema ativa, os bits em base64 (bit i = o suporte i a suporta). Lido por systems/itens-poe/compat-suportes.mjs; a conta é `compativel` (engine/sockets-de-gema.mjs).',
  suportes: suportes.map((d) => d.slug),
  ativas,
})}\n`);
console.log(`${suportes.length} suportes, ${porAtiva.size} gemas ativas`);
