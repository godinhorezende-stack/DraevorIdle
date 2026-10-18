// O IMPLÍCITO DO ÚNICO (auditoria dos únicos × poedb, 11/10): o único com implícito próprio (a linha `implicitMod` da página dele) não leva
// também o implícito da BASE — antes os dois somavam (a Vergôntea dava Dano Mágico 8–12% duas vezes: o da Varinha de Madeira Balsa e o
// dela). Vale na peça nova e na que já existia (refeita na entrada, `refazerPecasAntigas`), e o corrompido/eldritch ficam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('os únicos são do PoE') };

function unico(slug) {
  const cat = Catalogo.catalogo();
  for (const c of Object.values(cat.classes)) {
    const u = c.unicos?.find((x) => x.slug === slug);
    if (u) return { cat, u, base: c.bases.find((b) => b.nome === u.base) };
  }
  return null;
}

test('a Vergôntea: só o implícito dela (8–12%) e o explícito (20–28%) — o Dano Mágico fica entre 28% e 40%, nunca somando o da base', SKIP, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const { cat, base } = unico('Lifesprig');
  assert.ok(base.implicitos?.length, 'a Varinha de Madeira Balsa tem implícito');
  let semente = 7;
  const rng = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 60; k++) {
    const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 30, rng, unico: 'Lifesprig' });
    assert.deepEqual(g.implicitos, [], 'sem o implícito da base');
    assert.equal(g.modificadores.filter((m) => m.tipo === 'implicit').length, 1);
    const p = Jogo.pecaDoJogo(g, Catalogo.REGRAS, rng);
    assert.ok(p.poe.af.spell_dmg >= 28 && p.poe.af.spell_dmg <= 40, `Dano Mágico ${p.poe.af.spell_dmg}`);
  }
});

test('nenhum único com implícito próprio leva o da base; o único sem implícito próprio continua com o da base', SKIP, () => {
  const cat = Catalogo.catalogo();
  let com = 0;
  let sem = 0;
  for (const c of Object.values(cat.classes)) {
    for (const u of c.unicos ?? []) {
      const base = c.bases.find((b) => b.nome === u.base);
      if (!base?.implicitos?.length) continue;
      const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng: () => 0.5, unico: u.slug });
      if (g.erro) continue;
      if (u.modificadores.some((m) => m.tipo === 'implicit')) {
        com++;
        // (Dono, 11/10: o único cuja regra TROCA o implícito — a Corda da Servidão, 1 corrompido; o Nebulis, 1 a 3 de Síntese — sai com
        // os implícitos da regra: nenhum é o da base, todos vêm do pool dela. Os outros seguem sem implícito nenhum.)
        const s = u.implicitosSorteados;
        if (s) {
          const daBase = new Set(base.implicitos.map((i) => i.modelo));
          assert.ok(g.implicitos.length >= 1, u.slug);
          assert.ok(g.implicitos.every((i) => i.origem === s.origem && !daBase.has(i.modelo)), u.slug);
        } else assert.deepEqual(g.implicitos, [], u.slug);
      } else if (/_Cluster_Jewel$/.test(base.id)) {
        // (dono, 18/10, lote 79: "Ajustar o teste") a Ramificadora ÚNICA: as linhas dela substituem as da base ("Adiciona N", os encaixes, o
        // encantamento), como no PoE e no PoB — sai sem implícito
        assert.deepEqual(g.implicitos, [], u.slug);
      } else {
        sem++;
        assert.equal(g.implicitos.length, base.implicitos.length, u.slug);
      }
    }
  }
  assert.ok(com > 600, `únicos com implícito próprio conferidos: ${com}`);
  assert.ok(sem >= 1, `sem implícito próprio: ${sem}`);
});

test('a peça que já existia (tradução versão 9) é refeita na entrada: sai o implícito da base, ficam o corrompido e o eldritch', SKIP, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const { cat, base } = unico('Lifesprig');
  const nova = Jogo.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 30, rng: () => 0, unico: 'Lifesprig' }), Catalogo.REGRAS, () => 0);
  const spell = nova.poe.af.spell_dmg;
  const velha = structuredClone(nova);
  velha.poe.implicitos = [{ texto: 'Dano Mágico aumentado em 12%', modelo: 'Dano Mágico aumentado em {0}%', valores: [12] }];
  velha.poe.tv = 9;
  const corrompida = structuredClone(nova);
  corrompida.poe.implicitos = [
    { texto: 'Dano Mágico aumentado em 12%', modelo: 'Dano Mágico aumentado em {0}%', valores: [12] },
    { texto: '+1 ao Nível das Gemas Encaixadas', modelo: '+{0} ao Nível das Gemas Encaixadas', valores: [1], corrompido: true },
  ];
  corrompida.poe.tv = 9;
  const estado = { inventory: [velha], equipment: { weapon: corrompida } };
  assert.equal(Jogo.refazerPecasAntigas(estado), 2);
  assert.deepEqual(velha.poe.implicitos, []);
  assert.equal(velha.poe.af.spell_dmg, spell, 'o Dano Mágico volta ao do único sozinho');
  assert.deepEqual(corrompida.poe.implicitos.map((m) => !!m.corrompido), [true], 'o corrompido fica');
  assert.equal(velha.poe.tv, Jogo.VERSAO_DA_TRADUCAO);
});
