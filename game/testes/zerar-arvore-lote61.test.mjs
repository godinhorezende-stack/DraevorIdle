// LOTE 61 — as RAMIFICADORAS, o passo 2 (o servidor): a PEÇA como o PoE a gera (`itens-poe/ramificadoras.mjs`): o encantamento (um dos do
// tamanho, por igual) no lugar da marcação da base, os mods pelo PESO do PoE (a 1ª chave da tabela que a peça tem × o multiplicador — o notável
// põe `has_affliction_notable`: a Pequena só tem 1 notável, a Média 2, a Grande 3 com no máximo 1 Sufixo), no máximo 2 Prefixos e 2 Sufixos
// (joia), o nível do mod ≤ o Item Level; os textos em português (o poedb) de todos os 514 mods; as moedas (o Exaltado e o Divino) pela mesma
// regra. A peça ainda não cai (a joia só entra no drop com os nós e a tela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const R = await import('../systems/itens-poe/ramificadoras.mjs');

/** Um gerador de números semeado (o mesmo resultado a cada execução; os primeiros números saem fora — com sementes seguidas, o 1º fica perto de 0). */
const semeado = (s) => {
  let x = (s * 7919 + 104729) % 2147483647;
  const proximo = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4; i++) proximo();
  return proximo;
};
const gerar = (base, raridade, ilvl, seed) => Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: `Jewels/${base}_Cluster_Jewel`, raridade, ilvl, rng: semeado(seed) });
const mods = (p) => [...p.prefixos, ...p.sufixos];

test('os DADOS: os 514 mods com o português do poedb (o "%" do inglês de volta), os 2 notáveis com o mesmo nome em português separados, os 2 Bloqueios da Pequena', { skip: SEM }, () => {
  const D = Catalogo.catalogo().ramificadoras;
  assert.ok(D, 'o catálogo traz as Ramificadoras');
  assert.equal(D.mods.length, 514);
  assert.deepEqual(D.mods.filter((m) => !m.modelo).map((m) => m.id), []);
  assert.equal(D.mods.filter((m) => m.notavel).length, 301);
  const fogo = D.mods.find((m) => m.id === 'AfflictionJewelSmallPassivesGrantFireRes');
  assert.equal(fogo.modelo, 'Pequenas Habilidades Passivas Adicionadas também concedem: +{0}% de Resistência a Fogo');
  // o "Inspiração Ancestral" do português do PoE são dois notáveis: o Ancestral Inspiration (Totens) e o Eldritch Inspiration (Caos e Mana)
  assert.equal(D.notaveis['Inspiração Ancestral'].en, 'Ancestral Inspiration');
  assert.equal(D.notaveis['Inspiração Ancestral (Eldritch Inspiration)'].en, 'Eldritch Inspiration');
  assert.equal(D.notaveis['Inspiração Ancestral (Eldritch Inspiration)'].nome, 'Inspiração Ancestral');
  assert.equal(D.mods.find((m) => m.id === 'AfflictionNotableEldritchInspiration').notavel, 'Inspiração Ancestral (Eldritch Inspiration)');
  const bloqueios = D.tamanhos.Small.encantamentos.filter((e) => e.tag === 'affliction_chance_to_block');
  assert.deepEqual(bloqueios.map((e) => e.linhas[0]), ['+2% de Chance de Bloquear o Dano de Ataques', '2% de Chance de Bloquear o Dano Mágico']);
  assert.equal(new Set(D.tamanhos.Small.encantamentos.map((e) => e.id)).size, 14);
});

test('o PESO do PoE: a 1ª chave que a peça tem × o multiplicador — o notável da Pequena some depois do 1º; o Sufixo notável da Grande, depois do 1º Sufixo notável', { skip: SEM }, () => {
  const D = Catalogo.catalogo().ramificadoras;
  const feto = D.mods.find((m) => m.id === 'AfflictionNotableFettle');
  assert.equal(R.pesoDoMod(feto, new Set(['default', 'expansion_jewel_small', 'affliction_maximum_life'])), 49);
  assert.equal(R.pesoDoMod(feto, new Set(['default', 'expansion_jewel_small', 'affliction_maximum_life', 'has_affliction_notable'])), 0);
  assert.equal(R.pesoDoMod(feto, new Set(['default', 'expansion_jewel_large', 'affliction_maximum_life', 'has_affliction_notable'])), 49);
  assert.equal(R.pesoDoMod(feto, new Set(['default', 'expansion_jewel_small', 'affliction_armour'])), 0, 'o notável de outro encantamento');
  const sufixo = D.mods.find((m) => m.id === 'AfflictionNotableForceMultiplier');
  const grande = new Set(['default', 'expansion_jewel_large', 'affliction_physical_damage']);
  assert.ok(R.pesoDoMod(sufixo, grande) > 0);
  assert.equal(R.pesoDoMod(sufixo, new Set([...grande, 'has_affliction_notable', 'has_affliction_notable2'])), 0);
  const vida = D.mods.find((m) => m.id === 'AfflictionJewelSmallPassivesGrantLife_');
  assert.equal(R.pesoDoMod(vida, new Set(['default', 'expansion_jewel_large'])), 500);
  assert.equal(R.pesoDoMod(vida, new Set(['default', 'expansion_jewel_small'])), 0, 'a Vida de +2–3 é da Grande e da Média; a Pequena tem a dela');
});

test('a PEÇA: o encantamento no lugar da marcação; os notáveis do encantamento; no máximo 1 / 2 / 3 notáveis; 2 Prefixos e 2 Sufixos; o nível do mod', { skip: SEM }, () => {
  const D = Catalogo.catalogo().ramificadoras;
  const maximo = { Small: 1, Medium: 2, Large: 3 };
  for (const t of ['Small', 'Medium', 'Large']) {
    const vistos = new Set();
    let maisNotaveis = 0;
    for (let s = 1; s <= 400; s++) {
      const p = gerar(t, s % 4 ? 'raro' : 'magico', 84, s);
      assert.equal(p.ramificadora.tamanho, t);
      const enc = R.encantamentoDa(D, p);
      assert.ok(enc, `${t}: o encantamento ${p.ramificadora.encantamento}`);
      vistos.add(enc.id);
      assert.ok(!p.implicitos.some((x) => /#$/.test(x.modelo)), 'a marcação "concedem #" sai');
      assert.deepEqual(p.implicitos.filter((x) => x.encantamento).map((x) => x.texto), enc.linhas.map((l) => `Habilidades Passivas Adicionadas concedem ${l}`));
      assert.ok(p.prefixos.length <= 2 && p.sufixos.length <= 2, `${t}: ${p.prefixos.length}+${p.sufixos.length}`);
      const notaveis = mods(p).filter((m) => m.notavel);
      assert.ok(notaveis.length <= maximo[t], `${t}: ${notaveis.length} notáveis`);
      assert.ok(p.sufixos.filter((m) => m.notavel).length <= 1);
      maisNotaveis = Math.max(maisNotaveis, notaveis.length);
      const doEncantamento = new Set(enc.notaveis.map((n) => n.nome));
      for (const m of notaveis) assert.ok(doEncantamento.has(m.notavel), `${t}/${enc.id}: ${m.notavel} é do encantamento`);
      assert.equal(new Set(mods(p).map((m) => m.familia)).size, mods(p).length, 'um mod por grupo');
      if (p.raridade === 'raro') assert.equal(mods(p).length, 4, 'a Rara: as 4 vagas da joia (as regras dão 4 a 6 mods)');
    }
    assert.equal(maisNotaveis, maximo[t], `${t}: chega a ${maximo[t]} notáveis`);
    assert.equal(vistos.size, D.tamanhos[t].encantamentos.length, `${t}: todos os encantamentos saem`);
  }
  // o Item Level: numa peça de nível 1 só os mods de nível 1
  for (let s = 1; s <= 60; s++) for (const m of mods(gerar('Large', 'raro', 1, s))) assert.equal(m.ilvl, 1);
});

test('o número de passivas na faixa do PoE (8–12, 4–6, 2–3) e os encaixes da base', { skip: SEM }, () => {
  const faixa = { Small: [2, 3], Medium: [4, 6], Large: [8, 12] };
  for (const [t, [a, b]] of Object.entries(faixa)) {
    const vistos = new Set();
    for (let s = 1; s <= 200; s++) {
      const p = gerar(t, 'raro', 84, s);
      const n = p.implicitos.find((x) => x.modelo === 'Adiciona {0} Habilidades Passivas')?.valores?.[0];
      assert.ok(n >= a && n <= b, `${t}: ${n}`);
      vistos.add(n);
    }
    assert.equal(vistos.size, b - a + 1, `${t}: todos de ${a} a ${b}`);
  }
  assert.ok(gerar('Large', 'raro', 84, 1).implicitos.some((x) => x.texto === '2 das Habilidades Passivas adicionadas são Encaixes de Joia'));
  assert.ok(gerar('Medium', 'raro', 84, 1).implicitos.some((x) => x.texto === '1 das Habilidades Passivas adicionadas são Encaixes de Joia'));
});

test('as MOEDAS: o mod a mais (o Exaltado) pela regra da Ramificadora — o encantamento e as vagas da joia; o Divino acha as faixas do mod', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const D = cat.ramificadoras;
  const p = gerar('Small', 'magico', 84, 7);
  const enc = R.encantamentoDa(D, p);
  const poe = { ...p, raridade: 'raro' };
  for (let i = 0; i < 6; i++) {
    const novo = Gerar.sortearUmMod({ catalogo: cat, regras: Catalogo.REGRAS, poe, rng: semeado(100 + i) });
    if (!novo) break;
    poe[`${novo.lado}s`].push(novo.mod);
  }
  assert.equal(mods(poe).length, 4, 'até as 4 vagas da joia');
  assert.equal(Gerar.sortearUmMod({ catalogo: cat, regras: Catalogo.REGRAS, poe, rng: semeado(1) }), null, 'cheia: nenhum mod a mais');
  for (const m of mods(poe).filter((x) => x.notavel)) assert.ok(enc.notaveis.some((n) => n.nome === m.notavel));
  const comFaixa = mods(poe).find((m) => (R.modDoPoe(D, m)?.faixas ?? []).some(([a, b]) => a !== b));
  if (comFaixa) assert.deepEqual(Gerar.tierDoMod(cat, poe, comFaixa).tier.faixas, R.modDoPoe(D, comFaixa).faixas);
});
