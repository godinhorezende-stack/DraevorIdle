// LOTE 59 — as RAMIFICADORAS (Cluster Jewels), o passo 1: os DADOS (`gamedata/itens-poe/ramificadoras.json`, de `tools/importar-ramificadoras.mjs`:
// o Path of Building — ClusterJewels.lua e ModJewelCluster.lua — e o poedb — os encantamentos em português e a árvore 3.29). Como no PoE: a Grande
// cria 8 a 12 nós, a Média 4 a 6, a Pequena 2 a 3; os índices na órbita do encaixe de expansão; os notáveis de cada encantamento com o peso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const ARQUIVO = new URL('../gamedata/itens-poe/ramificadoras.json', import.meta.url);
const SEM = !existsSync(ARQUIVO) && 'sem os dados das Ramificadoras';
const D = SEM ? null : JSON.parse(readFileSync(ARQUIVO, 'utf8'));

test('os TAMANHOS como no PoB: os nós, os índices das pequenas, dos notáveis e dos encaixes', { skip: SEM }, () => {
  assert.deepEqual(D.tamanhos.Large.nos, [8, 12]);
  assert.deepEqual(D.tamanhos.Medium.nos, [4, 6]);
  assert.deepEqual(D.tamanhos.Small.nos, [2, 3]);
  assert.deepEqual(D.tamanhos.Small.pequenas, [0, 4, 2]);
  assert.deepEqual(D.tamanhos.Large.encaixes, [4, 8, 6]);
  for (const t of Object.values(D.tamanhos)) {
    for (const i of [...t.pequenas, ...t.notaveis, ...t.encaixes]) assert.ok(i >= 0 && i < t.total, `${t.en}: ${i}`);
    assert.equal(t.base.startsWith('Jewels/'), true);
  }
});

test('os ENCANTAMENTOS: o texto das pequenas em português e os notáveis com o efeito na árvore', { skip: SEM }, () => {
  let n = 0;
  for (const t of Object.values(D.tamanhos)) {
    for (const e of t.encantamentos) {
      assert.ok(e.tag.startsWith('affliction_'), e.tag);
      for (const x of e.notaveis) {
        assert.ok(D.notaveis[x.nome], `${t.en}/${e.tag}: ${x.nome}`);
        assert.ok(x.peso > 0 && x.nivel >= 1);
        n++;
      }
    }
  }
  assert.ok(n > 500, `${n}`);
  assert.deepEqual(D.tamanhos.Small.encantamentos.find((e) => e.tag === 'affliction_maximum_life').linhas, ['Vida máxima aumentada em 4%']);
  for (const [nome, x] of Object.entries(D.notaveis)) assert.ok(x.linhas.length > 0 && x.en, nome);
  assert.ok(Object.keys(D.notaveis).length >= 299);
});

test('as PEDRAS FUNDAMENTAIS das únicas e os mods da peça com os pesos', { skip: SEM }, () => {
  for (const nome of ['Técnica da Palma Oca', 'Discípulo de Kitava', 'Segredos do Sofrimento', 'Mensageiro Solitário', 'Paciência da Natureza', 'Cineticismo', 'Astúcia do Veterano']) assert.ok(D.pedras[nome]?.linhas.length, nome);
  assert.ok(D.mods.length > 100);
  for (const m of D.mods) assert.ok(m.textosEn.length && ['prefixo', 'sufixo'].includes(m.lado), m.id);
});
