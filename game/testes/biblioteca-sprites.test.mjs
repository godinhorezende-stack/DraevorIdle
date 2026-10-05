// A Biblioteca de sprites da Engine: mobs, itens, efeitos, projéteis, outfits e montarias, cada desenho uma vez (com quem o usa), busca e organização.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../admin/biblioteca-sprites.mjs');

test('as seis seções listam desenhos com quem usa, e a busca acha pelo nome de quem usa', () => {
  for (const tipo of B.TIPOS) {
    const r = B.listar({ tipo, limite: 5 });
    assert.ok(r.total > 0, `${tipo} vazio`);
    assert.ok(r.itens.every((x) => x.tipo === tipo && x.id && x.desenho), tipo);
  }
  const mobs = B.listar({ tipo: 'mobs', q: 'skeleton', limite: 50 });
  assert.ok(mobs.itens.some((x) => x.usos.some((u) => /skeleton/i.test(u.nome))));
  const um = B.listar({ tipo: 'mobs', limite: 300 }).itens;
  assert.equal(new Set(um.map((x) => x.id)).size, um.length, 'nenhum desenho repetido na lista');
  assert.ok(B.listar({ tipo: 'itens', filtro: 'sem-uso', limite: 1 }).total > 0 && B.listar({ tipo: 'itens', filtro: 'com-uso', limite: 1 }).total > 0);
});

test('organizar: o nome e as etiquetas recusam tipo e sprite que não existem', () => {
  assert.equal(B.salvarMeta('naves', '1', { nome: 'x' }).ok, false);
  assert.equal(B.salvarMeta('efeitos', '999999', { nome: 'x' }).ok, false);
  assert.equal(B.lookExiste(128), true);
  assert.equal(B.lookExiste(99999999), false);
});
