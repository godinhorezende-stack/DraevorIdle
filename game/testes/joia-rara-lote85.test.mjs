// LOTE 85 — a JOIA RARA com 3 ou 4 mods (dono, 19/10: "3 ou 4, 58/42"): no PoE 1 a joia (Carmesim, Viridiana, Cobalto, as Abissais e as
// Ramificadoras — o teto de 2 Prefixos + 2 Sufixos) sai Rara com 3 ou 4 mods; os pesos são os da comunidade (Craft of Exile: 7/12 e 5/12 —
// a GGG não publica), na tabela `raro.quantidadeJoia` de regras.json. Antes saía sempre com 4 (a regra geral da Rara começa em 4) e o
// Exaltado não tinha uso nela. Vale no drop e nas Orbes de Alquimia e do Caos; as outras peças Raras seguem com 4 a 6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  Jogo.iniciar(ITEM_CATALOG);
  M.iniciar();
}
// (o gerador aquecido — com a semente pequena, o 1º número dele sai sempre baixo)
const rngDe = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const gerar = (base, raridade, s) => Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng: rngDe(s) });
const n = (p) => (p.prefixos ?? []).length + (p.sufixos ?? []).length;

test('a tabela: a joia Rara 3 ou 4 (7 : 5); o resto, a da Rara', { skip: SEM }, () => {
  const R = Catalogo.REGRAS.raridades.raro;
  assert.deepEqual(Gerar.quantidadeDa(R, 'Jewels'), { 3: 7, 4: 5 });
  assert.deepEqual(Gerar.quantidadeDa(R, 'Abyss_Jewels'), { 3: 7, 4: 5 });
  assert.deepEqual(Gerar.quantidadeDa(R, 'Rings'), R.quantidade);
});

test('o DROP: as joias Raras saem com 3 (~58%) ou 4 (~42%); o anel Raro segue com 4 a 6', { skip: SEM }, () => {
  for (const base of ['Jewels/Crimson_Jewel', 'Abyss_Jewels/Murderous_Eye_Jewel', 'Jewels/Medium_Cluster_Jewel']) {
    const conta = { 3: 0, 4: 0 };
    const N = 1200;
    for (let s = 1; s <= N; s++) {
      const p = gerar(base, 'raro', s * 7 + 1);
      assert.equal(p.erro, undefined, `${base}: ${p.erro}`);
      conta[n(p)] = (conta[n(p)] ?? 0) + 1;
    }
    assert.deepEqual(Object.keys(conta).sort(), ['3', '4'], `${base}: ${JSON.stringify(conta)}`);
    const tres = conta[3] / N;
    assert.ok(tres > 0.52 && tres < 0.64, `${base}: ${(tres * 100).toFixed(1)}% com 3`);
  }
  for (let s = 1; s <= 200; s++) { const a = gerar('Rings/Ruby_Ring', 'raro', s); assert.ok(n(a) >= 4 && n(a) <= 6, `anel: ${n(a)}`); }
});

test('as MOEDAS: a Alquimia e o Caos na joia dão 3 ou 4; o Exaltado põe o 4º na joia de 3', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [] });
  const usar = (slug, s) => { e.inventory.push({ id: M.idDa(slug), count: 1 }); return M.usar(e, { moeda: M.idDa(slug), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s)); };
  const vistos = new Set();
  for (let s = 1; s <= 40; s++) {
    e.inventory = [Jogo.pecaDoJogo(gerar('Jewels/Cobalt_Jewel', 'normal', s))];
    assert.ok(usar('Orb_of_Alchemy', s).ok);
    const p = e.inventory[0].poe;
    assert.equal(p.raridade, 'raro');
    vistos.add(n(p));
    assert.ok(usar('Chaos_Orb', s + 100).ok);
    assert.ok([3, 4].includes(n(e.inventory[0].poe)), `o Caos: ${n(e.inventory[0].poe)}`);
    vistos.add(n(e.inventory[0].poe));
  }
  assert.deepEqual([...vistos].sort(), [3, 4]);
  // o Exaltado: a joia de 3 ganha o 4º; a de 4 está cheia
  let s = 1;
  for (;; s++) { e.inventory = [Jogo.pecaDoJogo(gerar('Jewels/Cobalt_Jewel', 'raro', s))]; if (n(e.inventory[0].poe) === 3) break; }
  assert.ok(usar('Exalted_Orb', 5).ok);
  assert.equal(n(e.inventory[0].poe), 4);
  assert.ok(e.inventory[0].poe.prefixos.length <= 2 && e.inventory[0].poe.sufixos.length <= 2);
  const cheia = usar('Exalted_Orb', 6);
  assert.equal(cheia.ok, false, 'cheia (2 + 2)');
  assert.match(cheia.error ?? cheia.erro ?? JSON.stringify(cheia), /2 prefixos e 2 sufixos/);
});

test('a WIKI mostra a tabela da joia Rara', { skip: SEM }, async () => {
  const Wiki = await import('../systems/wiki.mjs');
  const raro = Wiki.itensPoe().raridades.find((r) => r.id === 'raro');
  assert.deepEqual(raro.quantidadeJoia.map((q) => [q.quantos, Math.round(q.chance * 1000) / 10]), [[3, 58.3], [4, 41.7]]);
});
