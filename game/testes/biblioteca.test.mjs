import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../admin/biblioteca.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import { CATALOGO } from '../systems/dados.mjs';

test('L1. o resumo traz todas as categorias com a contagem dos cadastros reais', () => {
  const r = Object.fromEntries(B.resumo().map((c) => [c.id, c.total]));
  assert.equal(r.hunts, CATALOGO.hunts.length);
  assert.equal(r.vips, CATALOGO.vips.length);
  assert.equal(r.especiais, CATALOGO.especiais.length);
  assert.equal(r.bosses, CATALOGO.bosses.length);
  assert.equal(r.monstros, Object.keys(CATALOGO.bestiary).length);
  for (const id of ['divinas', 'mapas', 'itens', 'drops', 'encontros']) assert.ok(id in r, id);
});

test('L2. busca por nome (sem acento/caixa) e por id, filtro de nível, ordem e categoria inválida', () => {
  assert.ok(B.listar({ categoria: 'vips', q: 'ROTWORM' }).itens.some((i) => i.id === 'vip-rotworm'));
  assert.equal(B.listar({ categoria: 'bosses', q: 'urmahlullu-the-immaculate' }).itens[0].id, 'urmahlullu-the-immaculate');
  const faixa = B.listar({ categoria: 'hunts', nivelMin: 10, nivelMax: 20 });
  assert.ok(faixa.itens.length > 0 && faixa.itens.every((i) => i.nivel >= 10 && i.nivel <= 20));
  const nomes = B.listar({ categoria: 'hunts', ordem: 'nome', limite: 200 }).itens.map((i) => i.nome.toLowerCase());
  assert.deepEqual(nomes, [...nomes].sort());
  assert.equal(B.listar({ categoria: 'xyz' }).ok, false);
  assert.ok(B.listar({ categoria: 'itens', limite: 9999 }).itens.length <= 200);
});

test('L3. detalhe da hunt VIP, da especial e do boss: dados reais, e o que falta sai como null (nada inventado)', () => {
  const vip = B.detalhe('vips', 'vip-rotworm');
  assert.equal(vip.requisitos.acesso.tipo, 'vip');
  assert.ok(vip.monstros.length > 0);
  assert.equal(vip.cooldowns.horas, null);
  const esp = B.detalhe('especiais', CATALOGO.especiais[0].id);
  assert.equal(esp.requisitos.acesso.tipo, 'instance');
  const boss = B.detalhe('bosses', 'urmahlullu-the-immaculate');
  assert.equal(boss.cooldowns.horas, 0);
  assert.equal(boss.especiais.bossDeAto.ato, 1);
  assert.ok(boss.atributos.hp > 0);
  assert.equal(B.detalhe('bosses', 'nao-existe'), null);
});

test('L4. é só leitura: não há escrita no módulo e as rotas HTTP novas respondem GET', async () => {
  const fonte = readFileSync(new URL('../admin/biblioteca.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /writeFileSync|unlinkSync|mkdirSync/);
  const respostas = [];
  const res = {};
  const json = (r, cod, corpo) => respostas.push([cod, corpo]);
  const atender = (rota, q = '') => Http.atender({ method: 'GET' }, res, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${q}`), { json, corpoJson: async () => ({}) });
  assert.equal(await atender('biblioteca'), true);
  await atender('biblioteca/lista', 'categoria=bosses&q=ahau');
  await atender('biblioteca/detalhe', 'categoria=bosses&id=ahau');
  await atender('biblioteca/detalhe', 'categoria=bosses&id=nope');
  assert.deepEqual(respostas.map((r) => r[0]), [200, 200, 200, 404]);
  assert.ok(respostas[0][1].categorias.length >= 10);
});

test('L5. auditoria de referências: aponta item inexistente em drop (real) sem corrigir nada', () => {
  const p = B.auditarReferencias();
  assert.ok(Array.isArray(p));
  for (const x of p) assert.ok(x.itensInexistentes.length > 0);
});
