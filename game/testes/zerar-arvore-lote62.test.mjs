// LOTE 62 — dono, 17/10: "2+2 em todas". A JOIA Rara do PoE tem no máximo 2 Prefixos e 2 Sufixos (o PoB: `affixLimit` 4 para "Jewel"); no
// jogo ela seguia a regra geral da Rara (4 a 6 mods, até 3 + 3). Agora o drop, as moedas (o Exaltado, os pools especiais) e a Forja usam o teto
// da joia (`gerar.vagasDaPeca`) — Carmesim, Viridiana, Cobalto, as Abissais e as Ramificadoras; as outras peças seguem com até 3 + 3. As joias
// que os jogadores já têm não mudam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const Gerar = await import('../systems/itens-poe/gerar.mjs');

/** Um gerador de números semeado (os primeiros números saem fora — com sementes seguidas, o 1º fica perto de 0). */
const semeado = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const gerar = (base, raridade, seed) => Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl: 84, rng: semeado(seed) });
const JOIAS = ['Jewels/Crimson_Jewel', 'Jewels/Viridian_Jewel', 'Jewels/Cobalt_Jewel', 'Abyss_Jewels/Murderous_Eye_Jewel', 'Abyss_Jewels/Ghastly_Eye_Jewel', 'Jewels/Large_Cluster_Jewel'];

test('as VAGAS: a joia 2 + 2 na Rara (e 1 + 1 na Mágica); as outras peças seguem a regra da raridade (3 + 3)', { skip: SEM }, () => {
  const R = Catalogo.REGRAS.raridades;
  for (const classe of ['Jewels', 'Abyss_Jewels']) {
    assert.deepEqual(Gerar.vagasDaPeca(R.raro, Gerar.regrasDaBase([]), classe), { prefixo: 2, sufixo: 2 });
    assert.deepEqual(Gerar.vagasDaPeca(R.magico, Gerar.regrasDaBase([]), classe), { prefixo: 1, sufixo: 1 });
  }
  assert.deepEqual(Gerar.vagasDaPeca(R.raro, Gerar.regrasDaBase([]), 'Rings'), { prefixo: 3, sufixo: 3 });
});

test('o DROP: a joia Rara sai com 4 mods (2 + 2) — antes, até 6 —; o anel Raro segue chegando a 5 e 6', { skip: SEM }, () => {
  for (const base of JOIAS) {
    for (let s = 1; s <= 80; s++) {
      const p = gerar(base, 'raro', s);
      assert.equal(p.erro, undefined, `${base}: ${p.erro}`);
      assert.ok(p.prefixos.length <= 2 && p.sufixos.length <= 2, `${base}: ${p.prefixos.length} + ${p.sufixos.length}`);
      assert.equal(p.prefixos.length + p.sufixos.length, 4, base);
    }
  }
  const anel = Array.from({ length: 120 }, (_, s) => gerar('Rings/Ruby_Ring', 'raro', s + 1));
  assert.ok(anel.some((p) => p.prefixos.length + p.sufixos.length > 4), 'o anel ainda chega a 5 ou 6 mods');
});

test('as MOEDAS: o Exaltado (o mod a mais) e o pool especial não passam de 2 + 2 na joia', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  for (const base of ['Jewels/Crimson_Jewel', 'Abyss_Jewels/Murderous_Eye_Jewel']) {
    const p = gerar(base, 'raro', 3);
    assert.equal(Gerar.sortearUmMod({ catalogo: cat, regras: Catalogo.REGRAS, poe: p, rng: semeado(9) }), null, `${base}: cheia`);
    // tirado um Sufixo, o mod a mais só pode ser Sufixo
    const umSufixo = { ...p, sufixos: p.sufixos.slice(0, 1) };
    const novo = Gerar.sortearUmMod({ catalogo: cat, regras: Catalogo.REGRAS, poe: umSufixo, rng: semeado(11) });
    assert.equal(novo?.lado, 'sufixo', base);
    const pagina = Gerar.poolDa(Gerar.acharBase(cat, base).classe, Gerar.acharBase(cat, base).base);
    assert.equal(Gerar.sortearDoPool({ pagina, poe: p, regras: Catalogo.REGRAS, rng: semeado(5) }), null, `${base}: o pool especial também respeita as vagas`);
  }
});
